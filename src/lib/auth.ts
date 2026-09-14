import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { markAllDirty } from "@/db";
import { supabase } from "./supabase";

/**
 * Accounts are a Google sign-in (one tap) or an email and a 6-digit code —
 * no passwords, no magic links. Codes work the same in a browser, the
 * home-screen app and the native app; a link tapped from Mail would open in
 * the wrong place on a phone. Whichever way someone signs in, the sync
 * engine notices the account and pushes what's on the phone into it.
 */

export interface Account {
  userId: string;
  email: string | null;
  /** True until an email has been attached. */
  anonymous: boolean;
}

export async function currentAccount(): Promise<Account | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  // The stored token can lag the server — an email confirmed by link, say —
  // so ask; offline, the token is the best we have.
  const { data: fresh } = await supabase.auth.getUser();
  const user = fresh.user ?? data.session.user;
  return { userId: user.id, email: user.email ?? null, anonymous: Boolean(user.is_anonymous) || !user.email };
}

export type CodeMode = "link" | "signin";

/**
 * Send a code to `email`. An anonymous session gets the email attached
 * (same account, so anything already published stays put); otherwise, or
 * if that email already has an account, it's a sign-in — creating the
 * account if it's new.
 */
export async function sendEmailCode(email: string): Promise<CodeMode> {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("That doesn't look like an email address.");

  const { data } = await supabase.auth.getSession();
  if (data.session?.user.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email: address });
    if (!error) return "link";
    if (!/already|registered|exists|taken/i.test(error.message)) throw new Error(friendly(error.message));
    // The email has an account already: sign into that one instead.
  }
  const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
  if (error) throw new Error(friendly(error.message));
  return "signin";
}

/** Supabase's built-in mailer allows only a few emails an hour; say so plainly. */
function friendly(message: string): string {
  return /rate limit/i.test(message)
    ? "Too many sign-in emails were sent recently. Wait a while and try again."
    : message;
}

/** Check the code from the email; on success the session is the account's. */
export async function verifyEmailCode(db: SQLiteDatabase, email: string, code: string, mode: CodeMode): Promise<Account> {
  const address = email.trim().toLowerCase();
  const token = code.replace(/\D/g, "");
  if (token.length < 6) throw new Error("Enter the 6-digit code from the email.");

  const { error } = await supabase.auth.verifyOtp({
    email: address,
    token,
    type: mode === "link" ? "email_change" : "email",
  });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? "That code didn't work. Check it, or send a new one." : error.message);

  const account = await currentAccount();
  if (!account) throw new Error("Signed in, but no session came back.");
  return account;
}

/**
 * Google sign-in. The browser goes to Google and comes back to /account
 * with the session in the URL, which the client picks up. Web only for now:
 * the native app needs a browser session handler it doesn't ship yet.
 */
export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS !== "web") throw new Error("Google sign-in is available in the web app for now.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/account` },
  });
  if (error) throw new Error(error.message);
}

/** Sign out. The plants stay on this device; they just stop syncing. */
export async function signOut(db: SQLiteDatabase): Promise<void> {
  await supabase.auth.signOut();
  await markAllDirty(db);
}

/** The current account, kept fresh as the session changes. */
export function useAccount(): { account: Account | null; loading: boolean } {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    currentAccount().then((a) => {
      if (live) {
        setAccount(a);
        setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange(() => {
      currentAccount().then((a) => live && setAccount(a));
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { account, loading };
}
