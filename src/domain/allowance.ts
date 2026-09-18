/**
 * How many AI identifications a keeper has left, in words.
 *
 * A new keeper gets a fixed number of photo identifications — not per day,
 * for their account's lifetime (`PHOTO_TRIAL` in
 * `supabase/functions/_shared/cap.ts`). Until now the only place that number
 * appeared was a trailing clause after a scan had already happened, so the
 * way to discover the allowance was to watch it count down, and the way to
 * discover what happens at zero was to reach zero. Somebody photographing a
 * collection spends all five in about four minutes.
 *
 * So it is said before the button rather than after the answer. The wording
 * lives here, apart from the screens, because it is the line that will become
 * an upgrade prompt and it should read the same in both places.
 */

/**
 * The default allowance. The server is the authority — `AI_PHOTO_TRIAL` can
 * move it without a redeploy — so a count that came back from a scan always
 * wins over this. It is here for the keeper who has not scanned yet, where
 * the alternative is saying nothing.
 */
export const PHOTO_TRIAL = 5;

export type Allowance = {
  /** Identifications left, or null when they are unlimited or unknown. */
  left: number | null;
  unlimited?: boolean;
};

/**
 * The line shown beside the scan button, before anything is spent. `null`
 * means say nothing — an unlimited keeper does not need a running total.
 */
export function allowanceLine(a: Allowance): string | null {
  if (a.unlimited) return null;
  if (a.left == null) return `${PHOTO_TRIAL} free AI identifications with your account.`;
  if (a.left <= 0) return "No AI identifications left — you can still add the plant and keep its record.";
  if (a.left === 1) return "1 AI identification left.";
  return `${a.left} AI identifications left.`;
}

/**
 * The line shown after a scan. It reports what is left rather than what the
 * scan cost: the cost is recorded in `ai_usage` and answers a question the
 * owner has, not one the keeper has. Being told a photo of your plant cost
 * four cents invites the thought that the next one will too.
 */
export function afterScanLine(a: Allowance & { cached?: boolean }): string | null {
  if (a.cached) return "Remembered from before — that didn't use an identification.";
  if (a.unlimited) return null;
  if (a.left == null) return null;
  if (a.left <= 0) return "That was your last AI identification. You can still add plants and keep their records.";
  if (a.left === 1) return "1 AI identification left.";
  return `${a.left} AI identifications left.`;
}
