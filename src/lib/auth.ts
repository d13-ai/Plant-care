import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { markAllDirty } from "@/db";
import { supabase } from "./supabase";

/**
 * Accounts are a Google sign-in (one tap) or an email and a password.
 *
 * It was a 6-digit emailed code, chosen so that it would behave the same in a
 * browser, a home-screen app and a native app — unlike a magic link, which
 * opens in whichever browser the mail app prefers and fails there. That
 * reasoning held; what it did not survive is that Supabase only sends the code
 * if the email template contains {{ .Token }}, and until it does it sends a
 * bare link instead. So the code path was broken in production for everyone
 * without a Google account, and a password needs no mail server at all.
 *
 * The one thing that still does is resetting a forgotten password. Until the
 * SMTP settings are made (README → Accounts and sync), Google is the way back
 * in for anyone who forgets theirs.
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

/** Whether the email was already an account. Only the wording differs. */
export type EntryMode = "signin" | "signup";

/** Supabase's own minimum is 6; eight is little harder to pick and much harder to guess. */
const MIN_PASSWORD = 8;

/**
 * Sign in with an email and a password, or make the account if there isn't
 * one. The screen offers a single button, so this has to tell those apart
 * itself — and Supabase answers a wrong password and an unknown email with
 * the same "Invalid login credentials", by design, so that nobody can use the
 * form to discover which addresses have accounts. Signing up second is what
 * separates them: it is refused for an email that already exists, and that
 * refusal means the password was simply wrong.
 */
export async function signInOrUp(email: string, password: string): Promise<EntryMode> {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("That doesn't look like an email address.");
  // Length only, deliberately. The project also demands a capital, a number and
  // a symbol; that is a dashboard setting which can be relaxed, and a rule
  // hardcoded here would start rejecting passwords the server would accept.
  // The hint on the field asks for all of it, and friendly() handles the
  // refusal if the policy and the hint ever drift apart.
  if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters.`);

  const { error: signInError } = await supabase.auth.signInWithPassword({ email: address, password });
  if (!signInError) return "signin";
  if (!/invalid login credentials/i.test(signInError.message)) throw new Error(friendly(signInError.message));

  const { data, error: signUpError } = await supabase.auth.signUp({ email: address, password });
  if (signUpError) {
    if (/already registered|already exists|user already/i.test(signUpError.message)) {
      throw new Error("That password doesn't match this email. Try again, or continue with Google.");
    }
    throw new Error(friendly(signUpError.message));
  }
  if (!data.session) {
    // Only reachable if email confirmation gets turned on for the project.
    throw new Error("Check your email to confirm the address, then sign in.");
  }
  return "signup";
}

/**
 * Supabase's messages are written for whoever configured the project, not for
 * the person typing. Three of them reach a keeper and none of them reads well.
 */
function friendly(message: string): string {
  // The project's own switch (Authentication → Sign In / Providers → Allow new
  // users to sign up). Nothing done to this form gets past it.
  if (/signups? not allowed/i.test(message)) {
    return "New accounts are switched off for PlantParlour right now. Continue with Google, or ask us to let you in.";
  }
  // The password policy, which arrives as a full listing of every acceptable
  // character — punctuation and all — and is unreadable.
  if (/password should contain|password should be at least/i.test(message)) {
    return "That password won't do: use at least 8 characters, with a capital letter, a number and a symbol.";
  }
  // Signing up sends a confirmation email while "Confirm email" is on, so this
  // is the built-in mailer's few-per-hour ceiling rather than anything they did.
  if (/rate limit/i.test(message)) {
    return "We can't set up new accounts just now — too many attempts in the last hour. Continue with Google, or try again later.";
  }
  return message;
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
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Only a real sign-out takes the account away. Every other event that
      // resolves to null is the network failing — a refresh that couldn't
      // reach the server, say — and the app is gated on this: dropping the
      // account there would throw a keeper back to the welcome screen in the
      // middle of what they were doing, which is precisely what shouldn't
      // happen to someone photographing a plant with no signal.
      if (event === "SIGNED_OUT") {
        if (live) setAccount(null);
        return;
      }
      currentAccount().then((a) => {
        if (live && a) setAccount(a);
      });
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { account, loading };
}
