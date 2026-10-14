/**
 * The functions only the edge functions may call, checked from outside.
 *
 * Each of these takes a keeper's id and moves a counter the owner pays by:
 * the daily AI budget and the lifetime photo trial. Granted to PUBLIC -- the
 * Postgres default for a function -- any keeper could hand themselves more
 * (refund) or spend someone else's (claim). That happened twice: for the AI
 * budget, fixed 15 Sep 2026, and for the photo trial, fixed 14 Oct 2026,
 * because revoking from anon and authenticated alone leaves the PUBLIC grant
 * they inherit. This asks the API itself, as a stranger and as a keeper, so a
 * new migration can't bring it back unnoticed.
 *
 * The calls are refused before they run, so they move no counter.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { signInTestAccount } from "./test-account";

const NOBODY = "00000000-0000-4000-8000-0000000000bb";
const CALLS: [string, Record<string, unknown>][] = [
  ["claim_photo_call", { p_keeper: NOBODY, p_cap: 0 }],
  ["refund_photo_call", { p_keeper: NOBODY }],
  ["claim_ai_call", { p_keeper: NOBODY, p_day: "2026-01-01", p_cap: 0, p_global_cap: 0 }],
  ["refund_ai_call", { p_keeper: NOBODY, p_day: "2026-01-01" }],
  ["news_recipients", {}],
];

beforeAll(() => {
  if (!supabaseConfigured) throw new Error("EXPO_PUBLIC_SUPABASE_URL/_KEY are not set (.env)");
});

describe("with only the publishable key", () => {
  for (const [fn, args] of CALLS) {
    test(`${fn} is refused`, async () => {
      const { error } = await supabase.rpc(fn, args);
      expect(error, `${fn} ran for an anonymous caller`).not.toBeNull();
    });
  }
});

describe("signed in as a keeper", () => {
  beforeAll(async () => {
    await signInTestAccount("sync");
  });
  afterAll(async () => {
    await supabase.auth.signOut();
  });
  for (const [fn, args] of CALLS) {
    test(`${fn} is refused`, async () => {
      const { error } = await supabase.rpc(fn, args);
      expect(error, `${fn} ran for a signed-in keeper`).not.toBeNull();
    });
  }
});
