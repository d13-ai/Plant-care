// Whether the person holding a session proved who they are recently enough
// for something that can't be undone. Plain functions with no imports, so
// vitest can hold them (src/domain/recent-sign-in.test.ts).
//
// A session lasts for weeks on a phone, refreshing itself. Until 18 Oct 2026
// that was all deleting an account needed -- any valid token and the word
// DELETE -- so an unlocked phone left on a table, or a token lifted from a
// browser, was enough to erase someone's greenhouse for good.
//
// Supabase writes the time of the sign-in itself into every access token's
// `amr` claim (password, Google, a reset link...), and a refreshed token
// keeps it. So "signed in within the last N minutes" can be read off the
// token the caller already sent, once that token has been verified.

/** How recent a sign-in has to be to delete an account. */
export const RECENT_SIGN_IN_SECONDS = 30 * 60;

type Amr = { method?: unknown; timestamp?: unknown };

/** When this token's holder last signed in, in seconds since the epoch, or
 *  null if the token doesn't say. Only for a token already verified. */
export function lastSignIn(jwt: string): number | null {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const claims = JSON.parse(atob(base64)) as { amr?: Amr[] };
    const times = (Array.isArray(claims.amr) ? claims.amr : [])
      .map((a) => a?.timestamp)
      .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
    return times.length ? Math.max(...times) : null;
  } catch {
    return null;
  }
}

export function signedInRecently(jwt: string, nowSeconds: number, within = RECENT_SIGN_IN_SECONDS): boolean {
  const at = lastSignIn(jwt);
  return at !== null && nowSeconds - at <= within;
}
