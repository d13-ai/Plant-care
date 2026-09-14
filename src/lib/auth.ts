import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useState } from "react";
import { markAllDirty } from "@/db";
import { supabase } from "./supabase";

/**
 * Accounts are an email and a 6-digit code — no passwords, no links. Codes
 * work the same in a browser, the home-screen app and the native app; a
 * magic link tapped from Mail would open in the wrong place on a phone.
 */

export interface Account {
  userId: string;
  email: string | null;
  /** True until an email has been attached. */
  anonymous: boolean;
}

export async function currentAccount(): Promise<Account | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
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

  // Whatever is on this phone now belongs to this account: push all of it,
  // and pull the account's greenhouse from scratch.
  await markAllDirty(db);
  const account = await currentAccount();
  if (!account) throw new Error("Signed in, but no session came back.");
  return account;
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
