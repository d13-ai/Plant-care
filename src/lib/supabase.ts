import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session } from "@supabase/supabase-js";
import { Platform } from "react-native";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "";

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
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

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
