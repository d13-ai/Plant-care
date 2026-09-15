/**
 * The two local halves of the sync engine that lost data quietly.
 *
 * Offline — runs with the e2e suite only because it needs node:sqlite. The
 * cursor half of the same story needs a live server and lives in
 * sync.e2e.test.ts; what is checked here is the device-side bookkeeping that
 * decided a row had been dealt with when it had not.
 */
import { expect, test } from "vitest";
import {
  applyRemoteEvent,
  clearDirty,
  createPlant,
  dirtyPlants,
  getPlant,
  migrate,
  updatePlant,
  type RemoteEvent,
} from "@/db";
import { openTestDatabase } from "./node-sqlite";

const plantInput = (nickname: string) => ({
  nickname,
  species: null,
  location: null,
  acquiredFrom: null,
  acquiredAt: null,
  motherPlantId: null,
  photoUri: null,
});

test("an edit saved while the push is in flight is not marked as synced", async () => {
  const { db, close } = openTestDatabase();
  try {
    await migrate(db);
    const id = await createPlant(db, plantInput("Rubber Plant"));
    // Pin the version the push will read, so the two writes can't land in the
    // same millisecond and make this pass by luck.
    await db.runAsync("UPDATE plants SET updated_at = ? WHERE id = ?", ["2026-09-01T00:00:00.000Z", id]);

    // What the push read and sent.
    const pushed = (await dirtyPlants(db)).find((p) => p.nickname === "Rubber Plant")!;
    expect(pushed.updatedAt).toBe("2026-09-01T00:00:00.000Z");

    // The keeper renames the plant while the request is still out.
    await updatePlant(db, id, {
      nickname: "Ficus elastica",
      species: null,
      location: null,
      status: "ACTIVE",
      notes: null,
      waterEveryDays: null,
      fertilizeEveryDays: null,
      repotEveryDays: null,
      photoEveryDays: null,
    });

    // The response comes back and the push clears what it sent.
    await clearDirty(db, "plants", [{ uuid: pushed.uuid, updatedAt: pushed.updatedAt }]);

    const stillDirty = await dirtyPlants(db);
    expect(
      stillDirty.map((p) => p.nickname),
      "the rename happened after the push read the row, so it still has to go",
    ).toEqual(["Ficus elastica"]);
  } finally {
    close();
  }
});

test("the version that was pushed is cleared when nothing changed under it", async () => {
  const { db, close } = openTestDatabase();
  try {
    await migrate(db);
    await createPlant(db, plantInput("Calathea"));
    const pushed = (await dirtyPlants(db))[0];

    await clearDirty(db, "plants", [{ uuid: pushed.uuid, updatedAt: pushed.updatedAt }]);

    expect(await dirtyPlants(db), "an undisturbed push still clears the flag").toEqual([]);
  } finally {
    close();
  }
});

test("an event whose plant hasn't arrived yet is deferred, not dropped", async () => {
  const { db, close } = openTestDatabase();
  try {
    await migrate(db);
    const remote: RemoteEvent = {
      id: "3f1c0a7e-0000-4000-8000-000000000001",
      plant_id: "9a2b0c6d-0000-4000-8000-000000000002",
      type: "WATER",
      notes: null,
      occurred_at: "2026-09-10T00:00:00.000Z",
      resolved_at: null,
      created_at: "2026-09-10T00:00:00.000Z",
      updated_at: "2026-09-10T00:00:00.000Z",
      deleted_at: null,
    };

    expect(
      await applyRemoteEvent(db, remote),
      "'deferred' is what keeps the pull cursor from stepping over this row",
    ).toBe("deferred");

    // The plant turns up on a later page, or a later sync.
    const plantId = await createPlant(db, plantInput("Monstera"));
    await db.runAsync("UPDATE plants SET uuid = ? WHERE id = ?", [remote.plant_id, plantId]);

    expect(await applyRemoteEvent(db, remote), "and then it applies").toBe("inserted");
    const plant = await getPlant(db, plantId);
    expect(plant!.events.map((e) => e.type)).toContain("WATER");
  } finally {
    close();
  }
});
