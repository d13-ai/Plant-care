/**
 * The upgrade path a phone with plants takes on the first launch after v2:
 * a v4 database (pre-sync) gets uuids backfilled, every row marked dirty so
 * the first sync pushes all of it, and the lineage still resolves. Offline;
 * runs with the e2e suite because it needs node:sqlite.
 */
import { expect, test } from "vitest";
import { dirtyPlants, getPlant, listPlants, migrate, pendingChanges } from "@/db";
import { CREATE_TABLES, MIGRATIONS, SCHEMA_VERSION } from "@/db/schema";
import { openTestDatabase } from "./node-sqlite";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("a v4 database with plants upgrades to the current schema with sync columns backfilled", async () => {
  const { db, close } = openTestDatabase();
  try {
    await db.execAsync(CREATE_TABLES);
    for (const version of [2, 3, 4]) for (const statement of MIGRATIONS[version]) await db.execAsync(statement);
    await db.execAsync("PRAGMA user_version = 4");

    // Rows exactly as a v4 phone holds them: no uuid, no dirty, no updated_at on events/photos.
    await db.runAsync(
      "INSERT INTO plants (nickname, species, status, acquired_at, created_at, updated_at, water_every_days) VALUES ('Old Monstera', 'Monstera deliciosa', 'ACTIVE', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', 7)",
    );
    await db.runAsync(
      "INSERT INTO plants (nickname, status, acquired_at, created_at, updated_at, mother_plant_id, propagated_at) VALUES ('Old Cutting', 'ACTIVE', '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z', 1, '2026-08-10T00:00:00.000Z')",
    );
    await db.runAsync(
      "INSERT INTO care_events (plant_id, type, occurred_at, created_at) VALUES (1, 'WATER', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')",
    );
    await db.runAsync(
      "INSERT INTO photos (plant_id, uri, taken_at, created_at) VALUES (1, 'data:image/jpeg;base64,AAAA', '2026-08-02T00:00:00.000Z', '2026-08-02T00:00:00.000Z')",
    );

    await migrate(db);

    const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(version!.user_version).toBe(SCHEMA_VERSION);
    const tombstoneColumns = (await db.getAllAsync<{ name: string }>("PRAGMA table_info(sync_tombstones)")).map((c) => c.name);
    expect(tombstoneColumns, "v6 tombstones say what kind of row they are").toContain("kind");

    const plants = await listPlants(db);
    expect(plants.map((p) => p.plant.nickname).sort()).toEqual(["Old Cutting", "Old Monstera"]);
    for (const p of plants) expect(p.plant.uuid).toMatch(UUID);
    expect(new Set(plants.map((p) => p.plant.uuid)).size).toBe(2);

    const mother = (await getPlant(db, 1))!;
    expect(mother.events[0].uuid).toMatch(UUID);
    expect(mother.events[0].updatedAt, "events borrow created_at as updated_at").toBe("2026-09-01T00:00:00.000Z");
    expect(mother.photos[0].uuid).toMatch(UUID);
    expect(mother.propagations[0].nickname).toBe("Old Cutting");

    // Everything is dirty, so the first sync after adding an email pushes it all.
    const dirty = await dirtyPlants(db);
    expect(dirty.map((p) => p.nickname).sort()).toEqual(["Old Cutting", "Old Monstera"]);
    expect(dirty.find((p) => p.nickname === "Old Cutting")!.motherUuid).toBe(
      dirty.find((p) => p.nickname === "Old Monstera")!.uuid,
    );
    expect(await pendingChanges(db)).toBe(4);

    // Running the migrations again on a current database changes nothing.
    await migrate(db);
    expect((await listPlants(db)).map((p) => p.plant.uuid).sort()).toEqual(plants.map((p) => p.plant.uuid).sort());
  } finally {
    close();
  }
});

test("an upgrade interrupted partway leaves the database usable and finishes on the next launch", async () => {
  const { db, close } = openTestDatabase();
  try {
    // A v4 phone, mid-upgrade to v5 — the version that adds the uuid columns.
    await db.execAsync(CREATE_TABLES);
    for (const version of [2, 3, 4]) for (const statement of MIGRATIONS[version]) await db.execAsync(statement);
    await db.execAsync("PRAGMA user_version = 4");
    await db.runAsync(
      "INSERT INTO plants (nickname, status, acquired_at, created_at, updated_at) VALUES ('Fiddle Leaf', 'ACTIVE', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')",
    );

    // The app is swiped away partway through v5: plants.uuid has been added,
    // care_events.uuid has not.
    const realExec = db.execAsync.bind(db);
    let interrupt = true;
    db.execAsync = async (sql: string) => {
      if (interrupt && sql === "ALTER TABLE care_events ADD COLUMN uuid TEXT") throw new Error("app was killed");
      return realExec(sql);
    };

    await expect(migrate(db)).rejects.toThrow("app was killed");

    // The whole version rolled back, so the schema and the version agree.
    const stalled = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(stalled!.user_version, "an interrupted version does not half-apply").toBe(4);
    const columns = (await db.getAllAsync<{ name: string }>("PRAGMA table_info(plants)")).map((c) => c.name);
    expect(columns, "the uuid column went back with the transaction").not.toContain("uuid");

    // Next launch: the phone is no longer wedged on "duplicate column name".
    interrupt = false;
    await migrate(db);

    const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(version!.user_version).toBe(SCHEMA_VERSION);
    const plants = await listPlants(db);
    expect(plants.map((p) => p.plant.nickname)).toEqual(["Fiddle Leaf"]);
    expect(plants[0].plant.uuid).toMatch(UUID);
  } finally {
    close();
  }
});

test("a database wedged by the old half-applied upgrade heals itself", async () => {
  const { db, close } = openTestDatabase();
  try {
    // What an older build could leave behind: it bumped user_version outside
    // the transaction, so a phone killed mid-upgrade kept the new column while
    // the version stayed behind. Every launch after that re-ran the ALTER and
    // threw "duplicate column name" — the database never opened again.
    await db.execAsync(CREATE_TABLES);
    for (const version of [2, 3, 4, 5, 6]) for (const statement of MIGRATIONS[version]) await db.execAsync(statement);
    await db.execAsync("PRAGMA user_version = 6");
    await db.runAsync(
      "INSERT INTO plants (nickname, status, acquired_at, created_at, updated_at) VALUES ('Stuck Monstera', 'ACTIVE', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')",
    );
    // v7's column is already there; the version says it isn't.
    for (const statement of MIGRATIONS[7]) await db.execAsync(statement);

    await migrate(db);

    const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(version!.user_version, "the upgrade gets past the column it already added").toBe(SCHEMA_VERSION);
    const columns = (await db.getAllAsync<{ name: string }>("PRAGMA table_info(plants)")).map((c) => c.name);
    expect(columns).toContain("cover_photo_uuid");
    expect((await listPlants(db)).map((p) => p.plant.nickname)).toEqual(["Stuck Monstera"]);
  } finally {
    close();
  }
});
