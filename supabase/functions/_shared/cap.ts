// The daily AI cap, shared by `analyze` and `care` so the two can't drift.
//
// The cap used to be read-then-write in each function: select count, compare,
// upsert count + 1. Twenty parallel requests all read 0 and all wrote 1, and
// the upsert's error was thrown away, so a failed write lifted the cap
// entirely. Both functions now claim a slot through claim_ai_call(), which
// does the check and the increment in one locked statement and says what it
// decided.
//
// The per-keeper cap is fairness, not a spend limit: `ensureSession()` mints a
// fresh anonymous keeper on demand against a publishable key that ships inside
// the app, so a script can always hand itself a new allowance. The bound that
// actually protects the owner's Anthropic bill is the global one, which is
// counted across every keeper for the day.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Photos or lookups one keeper gets per day. */
export const DAILY_CAP = 20;

/**
 * Photo identifications a new keeper gets in total, ever — a trial, not a
 * daily allowance. Photos are the expensive call (a few cents each against
 * Opus) and the one a curious tester will sit and hammer.
 *
 * Keepers with `ai_unlimited` set on their row skip it entirely; that is the
 * exemption for the people running this. PHOTO_TRIAL is overridable with the
 * AI_PHOTO_TRIAL secret so the number can move without a redeploy.
 */
export const PHOTO_TRIAL = Number(Deno.env.get("AI_PHOTO_TRIAL") ?? 5);

export type PhotoClaim =
  | { ok: true; left: number | null; unlimited: boolean }
  | { ok: false; status: number; error: string };

/** Take one off the lifetime photo trial, or explain that it is spent. */
export async function claimPhotoCall(
  admin: SupabaseClient,
  keeperId: string,
): Promise<PhotoClaim> {
  const { data, error } = await admin.rpc("claim_photo_call", {
    p_keeper: keeperId,
    p_cap: PHOTO_TRIAL,
  });
  if (error || !data) {
    console.error(JSON.stringify({ fn: "claim_photo_call", error: error?.message ?? "no row" }));
    return { ok: false, status: 503, error: "Couldn't check your photo allowance — try again shortly." };
  }
  const claim = data as { allowed: boolean; remaining: number | null; unlimited: boolean };
  if (claim.allowed) return { ok: true, left: claim.remaining, unlimited: claim.unlimited };
  return {
    ok: false,
    status: 429,
    error: `You have used all ${PHOTO_TRIAL} of your AI plant identifications. You can still add plants and keep their records — just without the camera doing the naming.`,
  };
}

/** Give the identification back when the model was never reached. */
export async function refundPhotoCall(admin: SupabaseClient, keeperId: string): Promise<void> {
  const { error } = await admin.rpc("refund_photo_call", { p_keeper: keeperId });
  if (error) console.error(JSON.stringify({ fn: "refund_photo_call", error: error.message }));
}

/**
 * Calls the whole project will pay for in a day, across every keeper. Set
 * AI_DAILY_GLOBAL_CAP as a function secret to change it without a redeploy.
 * The default is deliberately low: at Opus prices ~200 calls is a few dollars,
 * and a personal greenhouse never comes near it.
 */
export const GLOBAL_DAILY_CAP = Number(Deno.env.get("AI_DAILY_GLOBAL_CAP") ?? 200);

export const today = () => new Date().toISOString().slice(0, 10);

export type Claim =
  | { ok: true; remaining: number }
  | { ok: false; status: number; error: string };

/**
 * Take one slot out of today's budget, or explain why not. A claim that
 * cannot be recorded is refused rather than waved through — the previous
 * code's failure mode was the opposite.
 */
export async function claimAiCall(
  admin: SupabaseClient,
  keeperId: string,
  day: string,
  noun: string,
): Promise<Claim> {
  const { data, error } = await admin.rpc("claim_ai_call", {
    p_keeper: keeperId,
    p_day: day,
    p_cap: DAILY_CAP,
    p_global_cap: GLOBAL_DAILY_CAP,
  });
  if (error || !data) {
    console.error(JSON.stringify({ fn: "claim_ai_call", error: error?.message ?? "no row" }));
    return { ok: false, status: 503, error: "Couldn't check today's AI allowance — try again shortly." };
  }
  const claim = data as { allowed: boolean; scope: string; remaining: number };
  if (claim.allowed) return { ok: true, remaining: claim.remaining };
  return claim.scope === "global"
    ? { ok: false, status: 429, error: "This project has used its AI budget for today — try again tomorrow." }
    : { ok: false, status: 429, error: `That's ${DAILY_CAP} ${noun} today — try again tomorrow.` };
}

/** Hand the slot back when the call never reached the model, so a run of
 *  failures can't burn the whole project's budget for the day. */
export async function refundAiCall(admin: SupabaseClient, keeperId: string, day: string): Promise<void> {
  const { error } = await admin.rpc("refund_ai_call", { p_keeper: keeperId, p_day: day });
  if (error) console.error(JSON.stringify({ fn: "refund_ai_call", error: error.message }));
}

/** A free-text field that rides into the prompt. Every other input is
 *  bounded; an unbounded one is billed input tokens at the caller's choosing. */
export function boundedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
