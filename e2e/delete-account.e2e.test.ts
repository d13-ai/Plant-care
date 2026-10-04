/**
 * Deleting an account, end to end, against the real project.
 *
 * Makes a brand-new account for the run -- never the fixtures, never
 * PASSPORT_E2E_EMAIL, never anyone's real one -- gives it a plant with a care
 * history and a photo through the app's own db layer and sync, then deletes it
 * through the live `delete-account` function and checks that nothing is left:
 * not the sign-in, not the rows, not the photo file in storage.
 *
 * The account it makes is the account it deletes, so unlike the other suites
 * this one leaves nothing behind in auth.users. It spends nothing: no AI.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { addPhoto, createPlant, logCare, migrate } from "@/db";
import { SUPABASE_URL, supabase, supabaseConfigured } from "@/lib/supabase";
import { syncNow } from "@/lib/sync";
import { openTestDatabase, type TestDatabase } from "./node-sqlite";

// Smallest valid JPEG, as the data: URL a web image picker would hand back.
const PHOTO_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0" +
  "aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBg" +
  "cICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJico" +
  "KSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7" +
  "i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiv/9k=";

const EMAIL = `e2e-delete-${Date.now()}@plantparlour.app`;
const PASSWORD = "E2e-delete-7c1d-not-a-secret";

describe("deleting an account", () => {
  let phone: TestDatabase;
  let keeperId: string;
  let photoPath: string;
  let deleted = false;

  beforeAll(async () => {
    expect(supabaseConfigured, "EXPO_PUBLIC_SUPABASE_URL / _KEY must be set").toBe(true);
    const { data, error } = await supabase.auth.signUp({ email: EMAIL, password: PASSWORD });
    if (error || !data.session) throw new Error(`Sign-up for the run failed: ${error?.message ?? "no session"}`);
    keeperId = data.user!.id;

    phone = openTestDatabase();
    await migrate(phone.db);
    const plant = await createPlant(phone.db, { nickname: "Doomed Pothos", species: "Epipremnum aureum" });
    await logCare(phone.db, plant, "WATER", {});
    await addPhoto(phone.db, plant, PHOTO_DATA_URL, { caption: "Before" });
    await syncNow(phone.db);

    const { data: photos } = await supabase.from("photos").select("path");
    photoPath = photos?.[0]?.path as string;
    expect(photoPath, "the photo reached storage").toMatch(new RegExp(`^${keeperId}/`));
  });

  afterAll(async () => {
    // If the delete failed part-way, the run's own account is the only thing
    // there is to clean up, and the function is the way to do it.
    if (!deleted) {
      await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE" } }).catch(() => {});
    }
    await supabase.auth.signOut({ scope: "local" });
    phone?.close();
  });

  test("refuses without the word", async () => {
    const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });
    expect(data?.deleted).toBeFalsy();
    expect(error).toBeTruthy();
    const { count } = await supabase.from("plants").select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  test("deletes the account and says what went", async () => {
    const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
    expect(error).toBeNull();
    expect(data).toMatchObject({ deleted: true, plants: 1, photos: 1, files: 1 });
    expect(data.care_events).toBeGreaterThanOrEqual(1);
    deleted = true;
  });

  test("the photo file is gone from storage", async () => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/plant-photos/${photoPath}`);
    expect(res.ok).toBe(false);
  });

  test("the sign-in is gone", async () => {
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    expect(error?.message).toMatch(/invalid login credentials/i);
  });
});
