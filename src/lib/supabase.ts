import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session } from "@supabase/supabase-js";
import { Platform } from "react-native";

// The project URL and publishable key. Safe to ship — the publishable key
// only permits what row-level security allows. Kept as built-in defaults so
// the app is configured wherever it's built (a host that doesn't inline the
// EXPO_PUBLIC_* env vars, like some CI, would otherwise leave it blank);
// .env still overrides them for anyone pointing the app at another project.
const DEFAULT_SUPABASE_URL = "https://ixagjvntbgyqemxxinqe.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable__A5fA6nyI8nrSqJWfaaJBQ_vqEZdRn6";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || DEFAULT_SUPABASE_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = createClient(SUPABASE_URL || "http://localhost", SUPABASE_KEY || "missing", {
  auth: {
    // AsyncStorage on native; the browser default (localStorage) on web.
    ...(Platform.OS === "web" ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    // A confirmation link tapped on Android opens the same Chrome profile
    // the home-screen app uses, so a session arriving in the URL can be
    // picked up. (Email and password is the primary path.)
    detectSessionInUrl: Platform.OS === "web",
  },
});

/**
 * The session behind everything server-side: scanning, care guides, tags, sync.
 *
 * v1 let the device sign in anonymously the first time it published, so a
 * keeper got a stable id without an account screen. That is off for this
 * project now — an anonymous sign-in against the publishable key that ships in
 * the app is a fresh keeper for the asking, which is how a script would walk
 * past the per-keeper AI cap. The fallback stays for a project that allows
 * them; here it lands on the message below and the keeper signs in.
 */
export async function ensureSession(): Promise<Session> {
  const stored = (await supabase.auth.getSession()).data.session;
  if (stored) {
    // The stored session's user can be gone (e.g. an anonymous user pruned
    // server-side); its token then still validates locally but the server
    // rejects it. Confirm the user really exists, and start fresh if not.
    const { error } = await supabase.auth.getUser();
    if (!error) return stored;
    await supabase.auth.signOut();
  }

  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.session) {
    throw new Error(
      error?.message.includes("Anonymous sign-ins are disabled")
        ? "Sign in on the Account screen first — scanning, care guides and tags all need an account."
        : error?.message ?? "Could not start a session.",
    );
  }
  return anon.session;
}

/** The storage bucket plant photos live in: public-read, unguessable paths. */
export const BUCKET = "plant-photos";

/**
 * Where the web app lives; the tag page is served from there (api/tag.ts).
 *
 * EXPO_PUBLIC_SITE_URL overrides it, and is inlined at build time rather than
 * read at runtime: setting it only takes effect on the next build, and on a
 * phone that means a new binary, because tagUrl() runs on the device.
 *
 * The fallback is the live domain, so a build that never sets the variable
 * still mints links that work. It was the Vercel address while tags might
 * have been printed against it -- a link on a physical plant tag cannot be
 * recalled, so that host had to keep answering. Checked before changing it:
 * two published tags, both this keeper's own, none shared or printed, so
 * nothing was relying on it.
 *
 * The Vercel address still answers, and should be left alone; it is just no
 * longer what an unconfigured build falls back to.
 */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://plantparlour.org";

/**
 * Public URL of a plant's tag page. Rendered by Vercel, not an Edge
 * Function: Supabase rewrites text/html responses to text/plain.
 */
export function tagUrl(token: string): string {
  return `${SITE_URL}/tag?t=${token}`;
}
