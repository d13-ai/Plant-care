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
    detectSessionInUrl: false,
  },
});

/**
 * v1 identity: the device signs in anonymously the first time it publishes.
 * That gives the keeper a stable id without an account screen; linking an
 * email to it later is `supabase.auth.updateUser({ email })`.
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
        ? "Anonymous sign-ins are off for this Supabase project. Enable them under Authentication → Sign In / Providers."
        : error?.message ?? "Could not start a session.",
    );
  }
  return anon.session;
}

/** Public URL of the tag page served by the `tag` Edge Function. */
export function tagUrl(token: string): string {
  return `${SUPABASE_URL}/functions/v1/tag?t=${token}`;
}
