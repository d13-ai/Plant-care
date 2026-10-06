/**
 * Google sign-in in the Android and iOS app: the sign-in page opens in an
 * in-app browser sheet, and Google, by way of Supabase, sends it back to
 * the app at this address with a one-time code to trade for a session.
 *
 * The address has to be in Supabase's allowed redirect URLs
 * (Authentication -> URL Configuration), or Supabase sends the sheet to the
 * website instead and the app never hears back.
 */
export const NATIVE_REDIRECT = "plantparlour://auth-callback";

export type OAuthReturn =
  | { kind: "code"; code: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

/**
 * What came back. The code arrives in the query string (PKCE); an error can
 * arrive in the query or, from some providers, the fragment.
 */
export function readOAuthReturn(url: string): OAuthReturn {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "none" };
  }
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const get = (k: string) => parsed.searchParams.get(k) ?? hash.get(k);
  const description = get("error_description") ?? get("error");
  if (description) return { kind: "error", message: description.replace(/\+/g, " ") };
  const code = get("code");
  return code ? { kind: "code", code } : { kind: "none" };
}
