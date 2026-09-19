/**
 * End-to-end check of publishing a tag against a real Supabase project.
 *
 * This drives the app's own code — `publishTag` / `unpublishTag`
 * from `src/lib/tag.ts`, which push through the sync engine, on top of the
 * real `src/db` layer — so the thing under test is the shipping publish
 * path, not a re-implementation of it. Only the device-side modules are swapped out: SQLite is backed by
 * node:sqlite and AsyncStorage by a Map (see `vitest.e2e.config.ts`).
 *
 * It talks to the project in `.env` and writes real rows and real storage
 * objects, then deletes them again. Run it with `npm run e2e`.
 *
 * Identity: PASSPORT_E2E_EMAIL and PASSPORT_E2E_PASSWORD when they are set,
 * otherwise a throwaway account signed up on the spot. It used to fall back to
 * the app's own anonymous session, which stopped working the moment the app
 * was gated behind accounts and anonymous sign-ins were turned off — so this
 * whole suite has been failing in beforeAll since, which is a quiet way to
 * lose the only automated check on the publish path. The throwaway is what
 * e2e/sync.e2e.test.ts already does, and it means the suite runs with no
 * configuration at all.
 *
 * A throwaway run leaves one empty auth.users row behind: the test holds no
 * service role, so it can delete its own keeper row and plants but not its
 * own account. They own nothing. Clear them out now and then with
 *
 *   delete from auth.users where email like 'e2e-tag-%'
 *     and not exists (select 1 from public.plants p where p.keeper_id = id);
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { addPhoto, createPlant, getPlant, logCare, migrate, propagate, resolveIssue } from "@/db";
import { publishTag, setKeeperName, unpublishTag } from "@/lib/tag";
import { SUPABASE_URL, tagUrl, supabase, supabaseConfigured } from "@/lib/supabase";
import { openTestDatabase, type TestDatabase } from "./node-sqlite";

const KEEPER_NAME = "Tag e2e greenhouse";
const TOKEN_IN_URL = /[?&]t=([a-f0-9]{32})(?:&|$)/;

// Smallest valid JPEG, as the data: URL a web image picker would hand back.
const PHOTO_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0" +
  "aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBg" +
  "cICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJico" +
  "KSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7" +
  "i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiv/9k=";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** GET the deployed tag page (Vercel, api/tag.ts) the way a browser with the link would. */
async function fetchTagPage(url: string) {
  const response = await fetch(url);
  expect(response.headers.get("content-type"), "the tag page is served as HTML").toContain("text/html");
  return { status: response.status, html: await response.text() };
}

/** Read a table with the publishable key and no session — i.e. as `anon`. */
async function readAsAnon(table: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "" },
  });
  return { status: response.status, body: await response.text() };
}

/** Set when this run created its own account, so afterAll can clear it up. */
let throwawayKeeperId: string | null = null;

/**
 * The configured test account, or a fresh throwaway. A throwaway only works
 * while email confirmation is off for the project; if it is ever turned back
 * on, set PASSPORT_E2E_EMAIL / PASSPORT_E2E_PASSWORD to a confirmed account
 * and this takes that path instead.
 */
async function signInTestAccount(): Promise<string> {
  const email = process.env.PASSPORT_E2E_EMAIL;
  const password = process.env.PASSPORT_E2E_PASSWORD;
  if (email && password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Test account sign-in failed: ${error.message}`);
    return data.user!.id;
  }
  const fresh = `e2e-tag-${Date.now()}@plantparlour.app`;
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
  throwawayKeeperId = data.user!.id;
  return data.user!.id;
}

describe("publishing a tag to Supabase", () => {
  let local: TestDatabase;
  let keeperId: string;
  let plantId: number;
  let plantUuid: string;
  let cuttingId: number;
  let cuttingUuid: string | null = null;
  let tagLink: string;
  let token: string;
  /** The account's greenhouse name on the server before this test renamed it,
   *  or null when the test's own sync is what created the keeper row. */
  let previousKeeperName: string | null = null;
  let keeperRowExisted = false;

  beforeAll(async () => {
    expect(supabaseConfigured, "EXPO_PUBLIC_SUPABASE_URL / _KEY must be set").toBe(true);

    keeperId = await signInTestAccount();

    // A plant with a history worth publishing: acquired 40 days ago, watered,
    // an issue that was treated, and a photo.
    local = openTestDatabase();
    await migrate(local.db);
    // setKeeperName renames the account's greenhouse, and the push carries that
    // to the server. Note what was there so afterAll can put it back.
    const { data: keeper } = await supabase
      .from("keepers")
      .select("display_name")
      .eq("id", keeperId)
      .maybeSingle();
    keeperRowExisted = !!keeper;
    previousKeeperName = keeper?.display_name ?? null;
    await setKeeperName(KEEPER_NAME);

    plantId = await createPlant(local.db, {
      nickname: "E2E Fiddle-leaf",
      species: "Ficus lyrata",
      location: "East window",
      acquiredAt: daysAgo(40),
      acquiredFrom: "Tag end-to-end test",
    });
    await logCare(local.db, plantId, "WATER", { occurredAt: daysAgo(3) });
    await logCare(local.db, plantId, "FERTILIZE", { occurredAt: daysAgo(20) });
    await logCare(local.db, plantId, "ISSUE", { notes: "Spider mites", occurredAt: daysAgo(10) });
    const issue = await getPlant(local.db, plantId);
    const issueId = issue!.events.find((e) => e.type === "ISSUE")!.id;
    await resolveIssue(local.db, issueId, "Neem oil, twice a week");
    await addPhoto(local.db, plantId, PHOTO_DATA_URL, { caption: "New leaf", takenAt: daysAgo(1) });
    plantUuid = (await getPlant(local.db, plantId))!.plant.uuid;
  });

  afterAll(async () => {
    // Take the test's rows and uploaded objects back out, by the ids this test
    // created. The old cleanup deleted by keeper and dropped the keeper row,
    // which empties the whole account — and PASSPORT_E2E_EMAIL can name an
    // account with a real greenhouse in it.
    if (keeperId) {
      const ids = [plantUuid, cuttingUuid].filter((id): id is string => !!id);
      if (ids.length) {
        // The paths come from the photos table, not a bucket listing: listing
        // the bucket is no longer permitted, and these rows go with the plants.
        const { data: photos } = await supabase.from("photos").select("path").in("plant_id", ids);
        if (photos?.length) await supabase.storage.from("plant-photos").remove(photos.map((p) => p.path));
        await supabase.from("plants").delete().in("id", ids);
      }
      // The keeper row is the account's own profile. Delete it only when this
      // test's sync is what created it; otherwise put the name back.
      if (keeperRowExisted) {
        await supabase.from("keepers").update({ display_name: previousKeeperName }).eq("id", keeperId);
      } else {
        await supabase.from("keepers").delete().eq("id", keeperId);
      }
      await supabase.auth.signOut();
    }
    local?.close();
  });

  test("publish returns a shareable tag link", async () => {
    tagLink = await publishTag(local.db, plantId);

    const match = tagLink.match(TOKEN_IN_URL);
    expect(match, `unexpected tag URL: ${tagLink}`).not.toBeNull();
    token = match![1];
    expect(tagLink).toBe(tagUrl(token));

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
      .eq("id", plantUuid);
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
      `${keeperId}/${plantUuid}/${photo.uuid}.jpg`,
    );

    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${photo.remotePath}`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]); // JPEG magic
  });

  test("the tag page renders the plant's record", async () => {
    const { status, html } = await fetchTagPage(tagLink);
    expect(status).toBe(200);
    expect(html).toContain("E2E Fiddle-leaf");
    expect(html).toContain("Ficus lyrata");
    expect(html).toContain(KEEPER_NAME);
    expect(html).toContain("No open issues");
    expect(html).toContain("Treatment applied");
    expect(html).toContain("Neem oil, twice a week");
    // The page asks the bucket to resize on the way out rather than serving
    // the stored 1600px original into a thumbnail: 10 KB against 704 KB on a
    // real photo. seo-check enforces the same thing at the source; this
    // checks what the deployed page actually emits.
    expect(html).toContain("/storage/v1/render/image/public/plant-photos/");
    expect(html).toMatch(/render\/image\/public\/plant-photos\/[^"]*width=\d+/);
    expect(html).not.toContain("/storage/v1/object/public/plant-photos/");
  });

  test("republishing replaces the snapshot and keeps the link", async () => {
    await logCare(local.db, plantId, "PRUNE", { notes: "Republish check" });
    const again = await publishTag(local.db, plantId);
    expect(again).toBe(tagLink);

    // The new event shows up on the already-shared link.
    const { html } = await fetchTagPage(tagLink);
    expect(html).toContain("Pruned");
    expect(html).toContain("Republish check");

    const { data: rows } = await supabase
      .from("plants")
      .select("id")
      .eq("keeper_id", keeperId)
      .eq("id", plantUuid);
    expect(rows, "republishing must update the row, not add one").toHaveLength(1);

    const { count } = await supabase
      .from("care_events")
      .select("*", { count: "exact", head: true })
      .eq("plant_id", rows![0].id);
    expect(count).toBe(7);
  });

  test("a published cutting links back to its mother", async () => {
    cuttingId = await propagate(local.db, plantId, "E2E Cutting");
    cuttingUuid = (await getPlant(local.db, cuttingId))!.plant.uuid;
    const cuttingLink = await publishTag(local.db, cuttingId);
    expect(cuttingLink).not.toBe(tagLink);

    // The cutting's own page names its mother and links to her tag.
    const cutting = await fetchTagPage(cuttingLink);
    expect(cutting.status).toBe(200);
    expect(cutting.html).toContain("E2E Cutting");
    expect(cutting.html).toContain("E2E Fiddle-leaf");
    expect(cutting.html).toContain(`?t=${token}`);

    // And the mother's page now lists the cutting.
    const mother = await fetchTagPage(tagLink);
    expect(mother.html).toContain("E2E Cutting");
  });

  test("the tables are not readable anonymously", async () => {
    for (const table of ["plants", "care_events", "photos", "keepers"]) {
      const { status, body } = await readAsAnon(table);
      expect([status, body], `${table} leaked to anon`).toEqual([200, "[]"]);
    }
  });

  test("unpublishing takes the tag down and keeps the keeper's own copy", async () => {
    const before = await getPlant(local.db, plantId);
    const photoPath = before!.photos[0].remotePath!;

    await unpublishTag(local.db, plantId);

    const { status, html } = await fetchTagPage(tagLink);
    expect(status).toBe(404);
    expect(html).not.toContain("Ficus lyrata");

    // The record and photo stay on the server: they're this keeper's synced
    // copy now, not a snapshot that only existed for the tag.
    const { data: rows } = await supabase.from("plants").select("is_public").eq("id", plantUuid);
    expect(rows).toEqual([{ is_public: false }]);
    // Proved by a download, not a listing: the bucket can no longer be listed
    // by anyone, which is what closed the path-enumeration hole.
    const still = await fetch(`${SUPABASE_URL}/storage/v1/object/public/plant-photos/${photoPath}`);
    expect(still.status, "the keeper's own copy stays in the bucket").toBe(200);

    const after = await getPlant(local.db, plantId);
    expect(after!.plant.passportToken).toBeNull();
    expect(after!.photos[0].remotePath, "the upload is still known locally").toBe(photoPath);
  });

  test("republishing brings the same link back without re-uploading", async () => {
    const link = await publishTag(local.db, plantId);
    expect(link).toBe(tagLink);
    const { status, html } = await fetchTagPage(link);
    expect(status).toBe(200);
    // The page asks the bucket to resize on the way out rather than serving
    // the stored 1600px original into a thumbnail: 10 KB against 704 KB on a
    // real photo. seo-check enforces the same thing at the source; this
    // checks what the deployed page actually emits.
    expect(html).toContain("/storage/v1/render/image/public/plant-photos/");
    expect(html).toMatch(/render\/image\/public\/plant-photos\/[^"]*width=\d+/);
    expect(html).not.toContain("/storage/v1/object/public/plant-photos/");

    const after = await getPlant(local.db, plantId);
    const photo = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${after!.photos[0].remotePath}`,
    );
    expect(photo.status).toBe(200);
  });
});
