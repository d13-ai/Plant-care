import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Directory, Paths } from "expo-file-system";
import { markAllDirty, wipeLocalData } from "@/db";
import { OPT_OUT_KEY } from "@/domain/analytics";
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
 * The one thing that does need one is resetting a forgotten password, and
 * that no longer goes through Supabase's mailer at all: the `account-email`
 * function sends the link itself, through Resend, from plantparlour.org. See
 * requestPasswordReset() and resetPassword() below.
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
  // Length only, deliberately. The project also demands a capital and a number;
  // that is a dashboard setting which has already been relaxed once, and a rule
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
 * Ask for a reset link. The answer is the same whether or not there is an
 * account for the address -- the function sees to that -- so the screen can
 * only ever say "if there's an account, it's on its way".
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("That doesn't look like an email address.");
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("account-email", {
    body: { kind: "reset", email: address },
  });
  if (error || !data?.ok) {
    throw new Error(data?.error ?? "Couldn't send the email just now. Try again in a few minutes.");
  }
}

/** The token a reset link carries, if this page was opened from one. */
export function resetTokenInUrl(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("reset");
}

/**
 * Leave the reset page for the same address without its token, so a reload,
 * the history or a screenshot of the URL doesn't carry it about. A fresh
 * load rather than history.replaceState: the router read the URL when the
 * page opened and writes it back on its first navigation, token and all.
 * Returns false where there is no address bar to clean (native).
 */
export function leaveResetPage(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  url.searchParams.delete("reset");
  window.location.replace(url.pathname + url.search + url.hash);
  return true;
}

/**
 * Use a reset link: trade its token for a session, then set the new password
 * on it. The token is only spent here, when the keeper presses the button --
 * never on opening the page -- so a mail scanner that follows every link in
 * an email can't use it up first.
 */
export async function resetPassword(tokenHash: string, password: string): Promise<void> {
  if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters.`);
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (verifyError) {
    throw new Error(
      /expired|invalid|not found/i.test(verifyError.message)
        ? "This link has run out or has already been used. Ask for a new one from the sign-in page."
        : friendly(verifyError.message),
    );
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/different from the old/i.test(error.message)) {
      // The link worked and they are signed in; the password they chose is
      // the one they already had. Nothing to change, nothing lost.
      return;
    }
    throw new Error(friendly(error.message));
  }
}

const welcomedKey = (userId: string) => `pp:welcomed:${userId}`;
/** Asked already in this page's life. The account resolves more than once on
 *  launch -- the stored session, then the server's answer -- and both land
 *  before the first request has come back to record itself. */
const welcomeAsked = new Set<string>();

/**
 * Ask for this account's welcome email, once per device. The function holds
 * the real rule -- one welcome per account, ever, and only in its first week
 * -- so this is just about not asking on every launch. A failure is quiet and
 * tried again next time: nobody should see an error about an email they
 * didn't ask for.
 */
export async function welcomeOnce(account: Account): Promise<void> {
  if (account.anonymous || !account.email) return;
  if (welcomeAsked.has(account.userId)) return;
  welcomeAsked.add(account.userId);
  try {
    if (await AsyncStorage.getItem(welcomedKey(account.userId))) return;
    const { data, error } = await supabase.functions.invoke<{ sent?: boolean; reason?: string }>("account-email", {
      body: { kind: "welcome" },
    });
    if (error || !data) {
      welcomeAsked.delete(account.userId);
      return;
    }
    await AsyncStorage.setItem(welcomedKey(account.userId), data.sent ? "sent" : (data.reason ?? "no"));
  } catch {
    welcomeAsked.delete(account.userId); // next launch
  }
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
    return "That password won't do: use at least 8 characters, with a capital letter and a number.";
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

/** The one word that has to be typed before an account is deleted. */
export const DELETE_WORD = "DELETE";

/**
 * Delete this account and everything in it, for good, then leave this device
 * as if nobody had ever signed in: no plants, no photos, no remembered name.
 *
 * The server goes first. If it fails, nothing here is touched -- the account
 * still exists and the keeper can try again. Only once it has gone are the
 * plants on this phone wiped, because a phone that kept them would hand them
 * to whoever signs in next (see markAllDirty).
 *
 * Other phones the keeper used still hold their copy until they next open;
 * they then find no account and land on the welcome screen. Their plants stay
 * on them, unsynced, which is what signing out leaves too.
 */
export async function deleteAccount(db: SQLiteDatabase, typed: string): Promise<void> {
  if (typed.trim().toUpperCase() !== DELETE_WORD) throw new Error(`Type ${DELETE_WORD} to confirm.`);
  const { data, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>("delete-account", {
    body: { confirm: DELETE_WORD },
  });
  if (!data?.deleted) {
    // invoke() puts a non-2xx answer in `error` and leaves the body unread.
    let message = data?.error;
    if (!message && error && "context" in error && error.context instanceof Response) {
      message = await error.context.json().then((b: { error?: string }) => b.error).catch(() => undefined);
    }
    throw new Error(message ?? "Couldn't delete your account just now. Try again in a few minutes.");
  }

  await wipeLocalData(db);
  if (Platform.OS !== "web") {
    try {
      const dir = new Directory(Paths.document, "photos");
      if (dir.exists) dir.delete();
    } catch {
      /* the rows are gone; an orphaned file can't reach anyone */
    }
  }
  // Everything this app keeps per keeper -- the name, the half-filled new
  // plant, the last scan, "keep watering as is" answers. Not the analytics
  // opt-out, which is about the device's owner, not the account.
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k !== OPT_OUT_KEY && !k.startsWith("sb-")));
  } catch {
    /* nothing here identifies anyone once the account is gone */
  }
  // Local only: the session's account no longer exists, so there is nothing
  // on the server to sign out of.
  await supabase.auth.signOut({ scope: "local" });
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
