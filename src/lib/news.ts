import { supabase } from "./supabase";

/**
 * Whether this account gets news emails -- occasional, no more than monthly,
 * as /privacy promises. Saying no is a row in `news_opt_outs` (see
 * supabase/migrations/20261014000000_news_opt_outs.sql); no row means yes.
 * Whoever sends news reads `news_recipients()`, which leaves opted-out
 * accounts out, so the switch is the whole of what a keeper has to do.
 */

/** True when news is on for this account, false when it's off, null when
 *  there is no account to ask about. Throws if the server can't be read. */
export async function getNewsEmails(): Promise<boolean | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: row, error } = await supabase
    .from("news_opt_outs")
    .select("user_id")
    .eq("user_id", data.session.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row == null;
}

/** Turn news emails on or off for this account. */
export async function setNewsEmails(on: boolean): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in first.");
  const userId = data.session.user.id;
  const { error } = on
    ? await supabase.from("news_opt_outs").delete().eq("user_id", userId)
    : await supabase.from("news_opt_outs").upsert({ user_id: userId, via: "app" }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
