/**
 * End-to-end check of syncing a greenhouse between two devices, against the
 * real Supabase project.
 *
 * Two node:sqlite databases stand in for two phones signed into the same
 * account. Everything in between — `syncNow` from `src/lib/sync.ts`, the
 * `src/db` layer, the Supabase client — is the code that ships. It writes
 * real rows and a real storage object, then deletes them. Run it with
 * `npm run e2e`.
 *
 * Identity: an account with an email (sync is off for anonymous sessions).
 * Set PASSPORT_E2E_EMAIL and PASSPORT_E2E_PASSWORD to a confirmed account;
 * without them the test signs up a throwaway one, which works when the
 * project doesn't require email confirmation.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addPhoto,
  createPlant,
  deletePlant,
  getPlant,
  listPlants,
  logCare,
  migrate,
  pendingChanges,
  propagate,
  updatePlant,
  type Plant,
} from "@/db";
import { SUPABASE_URL, supabase, supabaseConfigured } from "@/lib/supabase";
import { getSyncStatus, syncNow } from "@/lib/sync";
import { openTestDatabase, type TestDatabase } from "./node-sqlite";

const PHOTO_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0" +
  "aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBg" +
  "cICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJico" +
  "KSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7" +
  "i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiv/9k=";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signInTestAccount(): Promise<string> {
  const email = process.env.PASSPORT_E2E_EMAIL;
  const password = process.env.PASSPORT_E2E_PASSWORD;
  if (email && password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Test account sign-in failed: ${error.message}`);
    return data.user!.id;
  }
  const fresh = `e2e-${Date.now()}@plantparlour.app`;
  const { data, error } = await supabase.auth.signUp({
    email: fresh,
    password: `E2e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  if (error) throw new Error(`Sign-up failed: ${error.message}`);
  if (!data.session) {
    throw new Error(
      "This project requires email confirmation, so a throwaway account can't sign in. " +
        "Set PASSPORT_E2E_EMAIL / PASSPORT_E2E_PASSWORD to a confirmed account.",
    );
  }
  return data.user!.id;
}

/** updatePlant wants the whole editable record; patch one field of it. */
const edit = (plant: Plant, patch: Partial<Plant>) => ({
  nickname: plant.nickname,
  species: plant.species,
  location: plant.location,
  status: plant.status,
  notes: plant.notes,
  waterEveryDays: plant.waterEveryDays,
  fertilizeEveryDays: plant.fertilizeEveryDays,
  repotEveryDays: plant.repotEveryDays,
  photoEveryDays: plant.photoEveryDays,
  ...patch,
});

const byName = async (db: TestDatabase["db"], nickname: string) =>
  (await listPlants(db)).find((p) => p.plant.nickname === nickname)?.plant ?? null;

describe("syncing a greenhouse between two devices", () => {
  let a: TestDatabase;
  let b: TestDatabase;
  let keeperId: string;
  let motherId: number;
  let motherUuid: string;

  beforeAll(async () => {
    expect(supabaseConfigured, "EXPO_PUBLIC_SUPABASE_URL / _KEY must be set").toBe(true);
    keeperId = await signInTestAccount();
    // A clean slate for this account, in case an earlier run was interrupted.
    await supabase.from("plants").delete().eq("keeper_id", keeperId);

    a = openTestDatabase();
    await migrate(a.db);
    b = openTestDatabase();
    await migrate(b.db);

    // Phone A: a plant with history, a photo, and a cutting.
    motherId = await createPlant(a.db, {
      nickname: "Sync Monstera",
      species: "Monstera deliciosa",
      location: "Kitchen",
      acquiredAt: daysAgo(30),
      waterEveryDays: 5,
    });
    await logCare(a.db, motherId, "WATER", { occurredAt: daysAgo(2) });
    await logCare(a.db, motherId, "ISSUE", { notes: "Yellow leaf", occurredAt: daysAgo(4) });
    await addPhoto(a.db, motherId, PHOTO_DATA_URL, { caption: "Day one", takenAt: daysAgo(29) });
    await propagate(a.db, motherId, "Sync Cutting");
    motherUuid = (await getPlant(a.db, motherId))!.plant.uuid;
  });

  afterAll(async () => {
    if (keeperId) {
      const folder = `${keeperId}/${motherUuid}`;
      const { data: objects } = await supabase.storage.from("plant-photos").list(folder);
      if (objects?.length) {
        await supabase.storage.from("plant-photos").remove(objects.map((o) => `${folder}/${o.name}`));
      }
      await supabase.from("plants").delete().eq("keeper_id", keeperId);
      await supabase.from("keepers").delete().eq("id", keeperId);
      await supabase.auth.signOut();
    }
    a?.close();
    b?.close();
  });

  test("phone A pushes its greenhouse", async () => {
    await syncNow(a.db);
    expect(getSyncStatus().state).toBe("idle");
    expect(getSyncStatus().lastSyncedAt).toBeTruthy();

    const { data: plants, error } = await supabase
      .from("plants")
      .select("id, nickname, mother_plant_id, water_every_days, location, is_public")
      .eq("keeper_id", keeperId)
      .is("deleted_at", null);
    expect(error).toBeNull();
    expect(plants).toHaveLength(2);
    const mother = plants!.find((p) => p.nickname === "Sync Monstera")!;
    const cutting = plants!.find((p) => p.nickname === "Sync Cutting")!;
    expect(mother.id).toBe(motherUuid);
    expect(mother.water_every_days).toBe(5);
    expect(mother.location).toBe("Kitchen");
    expect(mother.is_public, "synced plants are private unless published").toBe(false);
    expect(cutting.mother_plant_id).toBe(mother.id);

    const photo = (await getPlant(a.db, motherId))!.photos[0];
    expect(photo.remotePath).toBe(`${keeperId}/${motherUuid}/${photo.uuid}.jpg`);
    expect(await pendingChanges(a.db), "everything pushed").toBe(0);
  });

  test("phone B pulls the same greenhouse", async () => {
    await syncNow(b.db);

    const namesA = (await listPlants(a.db)).map((p) => p.plant.nickname).sort();
    const namesB = (await listPlants(b.db)).map((p) => p.plant.nickname).sort();
    expect(namesB).toEqual(namesA);

    const motherB = (await byName(b.db, "Sync Monstera"))!;
    expect(motherB.uuid).toBe(motherUuid);
    expect(motherB.waterEveryDays).toBe(5);
    expect(motherB.location).toBe("Kitchen");

    const fullA = (await getPlant(a.db, motherId))!;
    const fullB = (await getPlant(b.db, motherB.id))!;
    expect(fullB.events.map((e) => e.type).sort()).toEqual(fullA.events.map((e) => e.type).sort());
    expect(fullB.events.find((e) => e.type === "ISSUE")!.notes).toBe("Yellow leaf");

    // The photo shows from its storage URL on the second phone.
    expect(fullB.photos).toHaveLength(1);
    expect(fullB.photos[0].uri).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${fullB.photos[0].remotePath}`,
    );
    const image = await fetch(fullB.photos[0].uri);
    expect(image.status).toBe(200);

    const cuttingB = (await byName(b.db, "Sync Cutting"))!;
    expect(cuttingB.motherPlantId, "lineage survives the trip").toBe(motherB.id);
    expect(await pendingChanges(b.db), "a pull leaves nothing dirty").toBe(0);
  });

  test("a change on phone B reaches phone A", async () => {
    const motherB = (await byName(b.db, "Sync Monstera"))!;
    await logCare(b.db, motherB.id, "FERTILIZE", { notes: "From phone B" });
    await updatePlant(b.db, motherB.id, edit(motherB, { nickname: "Sync Monstera (B)" }));

    await syncNow(b.db);
    await syncNow(a.db);

    const fullA = (await getPlant(a.db, motherId))!;
    expect(fullA.plant.nickname).toBe("Sync Monstera (B)");
    expect(fullA.events.some((e) => e.type === "FERTILIZE" && e.notes === "From phone B")).toBe(true);
  });

  test("when both phones edit the same plant, the later edit wins everywhere", async () => {
    const plantA = (await getPlant(a.db, motherId))!.plant;
    await updatePlant(a.db, motherId, edit(plantA, { notes: "A's note" }));
    await sleep(25);
    const motherB = (await byName(b.db, "Sync Monstera (B)"))!;
    await updatePlant(b.db, motherB.id, edit(motherB, { notes: "B's note" }));

    // B syncs first, then A: A's older edit must not overwrite B's.
    await syncNow(b.db);
    await syncNow(a.db);
    await syncNow(b.db);

    expect((await getPlant(a.db, motherId))!.plant.notes).toBe("B's note");
    expect((await getPlant(b.db, motherB.id))!.plant.notes).toBe("B's note");
  });

  test("a delete on phone A removes the plant from phone B", async () => {
    const cuttingA = (await byName(a.db, "Sync Cutting"))!;
    await deletePlant(a.db, cuttingA.id);

    await syncNow(a.db);
    await syncNow(b.db);

    expect(await byName(b.db, "Sync Cutting")).toBeNull();
    const { data } = await supabase
      .from("plants")
      .select("deleted_at")
      .eq("keeper_id", keeperId)
      .eq("nickname", "Sync Cutting");
    expect(data?.[0]?.deleted_at, "server keeps a tombstone").toBeTruthy();
  });

  test("a brand-new phone ends up with the same greenhouse as A", async () => {
    const c = openTestDatabase();
    try {
      await migrate(c.db);
      await syncNow(c.db);
      const summary = async (db: TestDatabase["db"]) =>
        (await listPlants(db))
          .map((p) => ({ uuid: p.plant.uuid, nickname: p.plant.nickname, notes: p.plant.notes, events: p.events.length }))
          .sort((x, y) => x.uuid.localeCompare(y.uuid));
      expect(await summary(c.db)).toEqual(await summary(a.db));
    } finally {
      c.close();
    }
  });
});
