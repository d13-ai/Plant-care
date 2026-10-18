/**
 * The conservatory directory, and the keepers row it sits on, asked of the
 * API itself.
 *
 * Both are checked from outside because a migration can undo either without
 * a single app test noticing:
 *  - the directory lists only conservatories whose keepers listed them and
 *    have something on show, and only to someone signed in;
 *  - a keeper can write their name, handle and listing on their own row and
 *    nothing else on it. Until 18 Oct 2026 they could write ai_unlimited and
 *    photo_calls too, or delete the row to start the photo trial over.
 *
 * Every write here puts back the value that was already there, and the
 * delete names a row nobody has, so a regression fails these tests without
 * handing the test account anything or taking anything from it.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { HANDLE_RULE } from "@/domain/handle";
import { browseConservatories } from "@/lib/directory";
import { cardsLeftWithMe, lookUpKeeper, myRounds } from "@/lib/rounds";
import { BUCKET, supabase, supabaseConfigured } from "@/lib/supabase";
import { signInTestAccount } from "./test-account";

const NOBODY = "00000000-0000-4000-8000-0000000000bb";

beforeAll(() => {
  if (!supabaseConfigured) throw new Error("EXPO_PUBLIC_SUPABASE_URL/_KEY are not set (.env)");
});

// Everything about cards and the directory is for signed-in keepers. Each of
// these also checks auth.uid() itself, but Supabase grants new functions to
// anon directly, and three of them answered without a session until 18 Oct.
const SIGNED_IN_ONLY: [string, Record<string, unknown>][] = [
  ["conservatory_directory", {}],
  ["rounds", {}],
  ["leave_card", { handle: "zz_nobody_e2e_404" }],
  ["take_card_back", { handle: "zz_nobody_e2e_404" }],
  ["visit_round", { handle: "zz_nobody_e2e_404" }],
  ["cards_left_with_me", {}],
];

describe("with only the publishable key", () => {
  for (const [fn, args] of SIGNED_IN_ONLY) {
    test(`${fn} is refused`, async () => {
      const { error } = await supabase.rpc(fn, args);
      expect(error, `${fn} answered a caller with no session`).not.toBeNull();
    });
  }
});

describe("signed in as a keeper", () => {
  let id: string;
  let before: { listed: boolean; ai_unlimited: boolean; photo_calls: number } | null = null;

  beforeAll(async () => {
    id = (await signInTestAccount("sync")).id;
    const { data, error } = await supabase
      .from("keepers")
      .select("listed, ai_unlimited, photo_calls")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    before = data;
  });

  test("the directory shows only listed conservatories with something on show", async () => {
    const rows = await browseConservatories("");
    for (const r of rows) {
      expect(r.handle).toMatch(HANDLE_RULE);
      expect(r.onShow, `@${r.handle} is listed with nothing on show`).toBeGreaterThanOrEqual(1);
      expect(r.photos.length).toBeLessThanOrEqual(3);
      expect(typeof r.carded).toBe("boolean");
    }
    // The test account never lists itself, so it is never in the list.
    if (!before?.listed) expect(rows.some((r) => r.mine)).toBe(false);
  });

  test("a search for a wildcard looks for the character, not for everyone", async () => {
    const all = await browseConservatories("");
    if (all.length === 0) return; // nothing listed yet: nothing to over-match
    expect(await browseConservatories("%%%%")).toEqual([]);
    expect(await browseConservatories("____________________")).toEqual([]);
  });

  test("a handle nobody has finds nobody, and a non-handle is refused before asking", async () => {
    expect(await lookUpKeeper("@zz_nobody_e2e_404")).toBeNull();
    await expect(lookUpKeeper("not a handle")).rejects.toThrow(/isn't a handle/);
  });

  test("its listing is its own to switch", async () => {
    const { error } = await supabase
      .from("keepers")
      .update({ listed: before?.listed ?? false, updated_at: new Date().toISOString() })
      .eq("id", id);
    expect(error).toBeNull();
  });

  test("its photo-trial counters are not its to write", async () => {
    const same = { ai_unlimited: before?.ai_unlimited ?? false, photo_calls: before?.photo_calls ?? 0 };
    for (const [column, value] of Object.entries(same)) {
      const { error } = await supabase.from("keepers").update({ [column]: value }).eq("id", id);
      expect(error?.code, `${column} was writable by its keeper`).toBe("42501");
    }
  });

  test("the rounds say what's new, and a keeper can count their cards", async () => {
    for (const r of await myRounds()) {
      expect(r.newPlants).toBeGreaterThanOrEqual(0);
      expect(r.newPhotos).toBeGreaterThanOrEqual(0);
    }
    expect(await cardsLeftWithMe()).toBeGreaterThanOrEqual(0);
    // Visiting a conservatory you hold no card for changes nothing and says nothing.
    const { error } = await supabase.rpc("visit_round", { handle: "zz_nobody_e2e_404" });
    expect(error).toBeNull();
  });

  test("the photo bucket takes JPEGs and nothing else", async () => {
    // An HTML file served from the bucket -- and through plantparlour.org's
    // own /plant-photos proxy -- would be a page on our origin.
    const path = `${id}/e2e-probe-${Date.now()}.html`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob(["<p>probe</p>"], { type: "text/html" }), { contentType: "text/html" });
    if (!error) await supabase.storage.from(BUCKET).remove([path]);
    expect(error, "the bucket stored an HTML file").not.toBeNull();
  });

  test("nor is deleting a keepers row", async () => {
    const { error } = await supabase.from("keepers").delete().eq("id", NOBODY);
    expect(error?.code, "a keeper could delete keepers rows").toBe("42501");
  });
});
