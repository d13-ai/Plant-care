/**
 * The account the e2e tests sign in as.
 *
 * Sync is off for anonymous sessions, so these tests need an account with an
 * email. PASSPORT_E2E_EMAIL / _PASSWORD name one when they are set; without
 * them the suite falls back to a fixture so it still runs with no
 * configuration at all, which is the property worth keeping.
 *
 * The fallback used to be `e2e-${Date.now()}@plantparlour.app` — a brand new
 * account every run. The tests hold no service role, so they can delete their
 * own plants and keeper row but never their own account, and 46 empty ones
 * had piled up in auth.users in three days. Two per run, for ever.
 *
 * So the fallback is now a *fixed* account per test file: created on the first
 * run that needs it, signed into by every run after. The count stops growing.
 * Reuse is safe because these tests already clear leftovers from an
 * interrupted run by name before they start — they were written to share an
 * account with a keeper's real data, which is a stronger requirement than
 * sharing one with their own previous run.
 *
 * Two fixtures rather than one because vitest runs test files in parallel:
 * sync and tag each need an account the other is not deleting plants from.
 *
 * On the password being in the repository: these accounts hold nothing. They
 * are on a domain we control, RLS confines each to its own rows, and the
 * tests empty them on the way out. Anyone who can read this file can already
 * read the publishable key next to it. Set PASSPORT_E2E_EMAIL / _PASSWORD if
 * you would rather the suite never touch a shared account at all.
 */
import { supabase } from "@/lib/supabase";

export type TestAccount = {
  /** The signed-in keeper's id. */
  id: string;
  /** True when this run may delete the keeper row — i.e. it isn't a real
   *  account someone pointed the suite at. */
  disposable: boolean;
};

// Lower, upper and a digit: the project's own password policy applies to
// the fixture as much as to a keeper.
const FIXTURE_PASSWORD = "E2e-fixture-8f2a1c-not-a-secret";

/**
 * Sign in, creating the fixture the first time it is needed.
 *
 * `purpose` keeps the two test files on separate accounts so they can run at
 * the same time without deleting each other's plants.
 */
export async function signInTestAccount(purpose: "sync" | "tag"): Promise<TestAccount> {
  const email = process.env.PASSPORT_E2E_EMAIL;
  const password = process.env.PASSPORT_E2E_PASSWORD;
  if (email && password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Test account sign-in failed: ${error.message}`);
    return { id: data.user!.id, disposable: false };
  }

  const fixture = `e2e-fixture-${purpose}@plantparlour.app`;
  const signedIn = await supabase.auth.signInWithPassword({
    email: fixture,
    password: FIXTURE_PASSWORD,
  });
  if (signedIn.data.user) return { id: signedIn.data.user.id, disposable: true };

  // Not there yet: the first run on a fresh project creates it.
  const { data, error } = await supabase.auth.signUp({ email: fixture, password: FIXTURE_PASSWORD });
  if (error) throw new Error(`Fixture sign-up failed: ${error.message}`);
  if (!data.session) {
    throw new Error(
      "This project requires email confirmation, so the fixture account can't sign in. " +
        "Set PASSPORT_E2E_EMAIL / PASSPORT_E2E_PASSWORD to a confirmed account.",
    );
  }
  return { id: data.user!.id, disposable: true };
}
