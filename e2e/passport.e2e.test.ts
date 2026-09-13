/**
 * End-to-end check of publishing a passport against a real Supabase project.
 *
 * This drives the app's own code — `publishPassport` / `unpublishPassport`
 * from `src/lib/passport.ts`, on top of the real `src/db` layer — so the
 * thing under test is the shipping publish path, not a re-implementation of
 * it. Only the device-side modules are swapped out: SQLite is backed by
 * node:sqlite and AsyncStorage by a Map (see `vitest.e2e.config.ts`).
 *
 * It talks to the project in `.env` and writes real rows and real storage
 * objects, then deletes them again. Run it with `npm run e2e`.
 *
 * Identity: by default the app's anonymous sign-in is used, which requires
 * "Allow anonymous sign-ins" to be on for the project. Set PASSPORT_E2E_EMAIL
 * and PASSPORT_E2E_PASSWORD to run as a dedicated test account instead.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { addPhoto, createPlant, getPlant, logCare, migrate, propagate, resolveIssue } from "@/db";
import { publishPassport, setKeeperName, unpublishPassport } from "@/lib/passport";
import { SUPABASE_URL, ensureSession, passportUrl, supabase, supabaseConfigured } from "@/lib/supabase";
import { openTestDatabase, type TestDatabase } from "./node-sqlite";

const KEEPER_NAME = "Passport e2e greenhouse";
const TOKEN_IN_URL = /\/functions\/v1\/passport\?t=([0-9a-f]{32})$/;

// Smallest valid JPEG, as the data: URL a web image picker would hand back.
const PHOTO_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0" +
  "aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBg" +
  "cICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJico" +
  "KSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7" +
  "i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiv/9k=";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** GET the deployed passport Edge Function the way a browser with the link would. */
async function fetchPassportPage(url: string) {
  const response = await fetch(url);
  return { status: response.status, html: await response.text() };
}

/** Read a table with the publishable key and no session — i.e. as `anon`. */
async function readAsAnon(table: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "" },
  });
  return { status: response.status, body: await response.text() };
}

describe("publishing a passport to Supabase", () => {
  let local: TestDatabase;
  let keeperId: string;
  let plantId: number;
  let cuttingId: number;
  let passportLink: string;
  let token: string;

  beforeAll(async () => {
    expect(supabaseConfigured, "EXPO_PUBLIC_SUPABASE_URL / _KEY must be set").toBe(true);

    // A dedicated test account, when one is configured; otherwise the app's
    // own anonymous sign-in, which is what a real first publish uses.
    const email = process.env.PASSPORT_E2E_EMAIL;
    const password = process.env.PASSPORT_E2E_PASSWORD;
    if (email && password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`Test account sign-in failed: ${error.message}`);
    }
    const session = await ensureSession();
    keeperId = session.user.id;

    // A plant with a history worth publishing: acquired 40 days ago, watered,
    // an issue that was treated, and a photo.
    local = openTestDatabase();
    await migrate(local.db);
    await setKeeperName(KEEPER_NAME);

    plantId = await createPlant(local.db, {
      nickname: "E2E Fiddle-leaf",
      species: "Ficus lyrata",
      location: "East window",
      acquiredAt: daysAgo(40),
      acquiredFrom: "Passport end-to-end test",
    });
    await logCare(local.db, plantId, "WATER", { occurredAt: daysAgo(3) });
    await logCare(local.db, plantId, "FERTILIZE", { occurredAt: daysAgo(20) });
    await logCare(local.db, plantId, "ISSUE", { notes: "Spider mites", occurredAt: daysAgo(10) });
    const issue = await getPlant(local.db, plantId);
    const issueId = issue!.events.find((e) => e.type === "ISSUE")!.id;
    await resolveIssue(local.db, issueId, "Neem oil, twice a week");
    await addPhoto(local.db, plantId, PHOTO_DATA_URL, { caption: "New leaf", takenAt: daysAgo(1) });
  });

  afterAll(async () => {
    // Take the test's rows and uploaded objects back out of the project.
    if (keeperId) {
      const { data: paths } = await supabase.storage.from("plant-photos").list(`${keeperId}/${plantId}`);
      if (paths?.length) {
        await supabase.storage
          .from("plant-photos")
          .remove(paths.map((p) => `${keeperId}/${plantId}/${p.name}`));
      }
      await supabase.from("plants").delete().eq("keeper_id", keeperId);
      await supabase.from("keepers").delete().eq("id", keeperId);
      await supabase.auth.signOut();
    }
    local?.close();
  });

  test("publish returns a shareable passport link", async () => {
    passportLink = await publishPassport(local.db, plantId);

    const match = passportLink.match(TOKEN_IN_URL);
    expect(match, `unexpected passport URL: ${passportLink}`).not.toBeNull();
    token = match![1];
    expect(passportLink).toBe(passportUrl(token));

    // The local record now knows it is published.
    const after = await getPlant(local.db, plantId);
    expect(after!.plant.passportToken).toBe(token);
    expect(after!.plant.publishedAt).toBeTruthy();
  });

  test("the snapshot landed in Supabase", async () => {
    const { data: rows, error } = await supabase
      .from("plants")
      .select("id, nickname, species, is_public, passport_token")
      .eq("keeper_id", keeperId)
      .eq("local_id", plantId);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].nickname).toBe("E2E Fiddle-leaf");
    expect(rows![0].species).toBe("Ficus lyrata");
    expect(rows![0].is_public).toBe(true);
    expect(rows![0].passport_token).toBe(token);

    const { count } = await supabase
      .from("care_events")
      .select("*", { count: "exact", head: true })
      .eq("plant_id", rows![0].id);
    // water, fertilize, issue, treatment, photo, and the ACQUIRED entry
    expect(count).toBe(6);
  });

  test("the photo is uploaded and publicly readable", async () => {
    const local_ = await getPlant(local.db, plantId);
    const photo = local_!.photos[0];
    expect(photo.remotePath, "photo should have been marked uploaded").toBe(
      `${keeperId}/${plantId}/${photo.id}.jpg`,
    );

    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${photo.remotePath}`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]); // JPEG magic
  });

  test("the passport page renders the plant's record", async () => {
    const { status, html } = await fetchPassportPage(passportLink);
    expect(status).toBe(200);
    expect(html).toContain("E2E Fiddle-leaf");
    expect(html).toContain("Ficus lyrata");
    expect(html).toContain(KEEPER_NAME);
    expect(html).toContain("No open issues");
    expect(html).toContain("Treatment applied");
    expect(html).toContain("Neem oil, twice a week");
    expect(html).toContain("/storage/v1/object/public/plant-photos/");
  });

  test("republishing replaces the snapshot and keeps the link", async () => {
    await logCare(local.db, plantId, "PRUNE", { notes: "Republish check" });
    const again = await publishPassport(local.db, plantId);
    expect(again).toBe(passportLink);

    // The new event shows up on the already-shared link.
    const { html } = await fetchPassportPage(passportLink);
    expect(html).toContain("Pruned");
    expect(html).toContain("Republish check");

    const { data: rows } = await supabase
      .from("plants")
      .select("id")
      .eq("keeper_id", keeperId)
      .eq("local_id", plantId);
    expect(rows, "republishing must update the row, not add one").toHaveLength(1);

    const { count } = await supabase
      .from("care_events")
      .select("*", { count: "exact", head: true })
      .eq("plant_id", rows![0].id);
    expect(count).toBe(7);
  });

  test("a published cutting links back to its mother", async () => {
    cuttingId = await propagate(local.db, plantId, "E2E Cutting");
    const cuttingLink = await publishPassport(local.db, cuttingId);
    expect(cuttingLink).not.toBe(passportLink);

    // The cutting's own page names its mother and links to her passport.
    const cutting = await fetchPassportPage(cuttingLink);
    expect(cutting.status).toBe(200);
    expect(cutting.html).toContain("E2E Cutting");
    expect(cutting.html).toContain("E2E Fiddle-leaf");
    expect(cutting.html).toContain(`?t=${token}`);

    // And the mother's page now lists the cutting.
    const mother = await fetchPassportPage(passportLink);
    expect(mother.html).toContain("E2E Cutting");
  });

  test("the tables are not readable anonymously", async () => {
    for (const table of ["plants", "care_events", "photos", "keepers"]) {
      const { status, body } = await readAsAnon(table);
      expect([status, body], `${table} leaked to anon`).toEqual([200, "[]"]);
    }
  });

  test("unpublishing takes the passport and its photos offline", async () => {
    const before = await getPlant(local.db, plantId);
    const photoPath = before!.photos[0].remotePath!;

    await unpublishPassport(local.db, plantId);

    const { status, html } = await fetchPassportPage(passportLink);
    expect(status).toBe(404);
    expect(html).not.toContain("Ficus lyrata");

    // The bucket is public-read, so the image URL must stop working too.
    const photo = await fetch(`${SUPABASE_URL}/storage/v1/object/public/plant-photos/${photoPath}`);
    expect(photo.ok, "photo still publicly readable after unpublish").toBe(false);
    const { data: left } = await supabase.storage.from("plant-photos").list(`${keeperId}/${plantId}`);
    expect(left).toEqual([]);

    const after = await getPlant(local.db, plantId);
    expect(after!.plant.passportToken).toBeNull();
    expect(after!.photos[0].remotePath, "local db must forget the upload").toBeNull();
  });

  test("republishing after that uploads the photos again", async () => {
    const link = await publishPassport(local.db, plantId);
    const { status, html } = await fetchPassportPage(link);
    expect(status).toBe(200);
    expect(html).toContain("/storage/v1/object/public/plant-photos/");

    const after = await getPlant(local.db, plantId);
    const photo = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${after!.photos[0].remotePath}`,
    );
    expect(photo.status).toBe(200);
  });
});
