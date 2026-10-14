/**
 * The news-email opt-out, against the real project.
 *
 * /privacy promises occasional news and a way to stop it, and US law gives
 * ten business days to honour a no. The switch in Account writes a row to
 * `news_opt_outs`; whoever sends news reads `news_recipients()`. What has to
 * hold, and is checked here as the signed-in keeper (no service role):
 *
 *   - the switch's two calls do what they say, and the setting reads back;
 *   - a keeper can only ever opt out themselves, never another account;
 *   - 'reply' rows (an emailed "unsubscribe", entered by us) can't be forged;
 *   - the recipient list, which returns addresses, is not callable at all.
 *
 * Leaves the account as it found it.
 */
import { afterAll, beforeAll, expect, test } from "vitest";
import { getNewsEmails, setNewsEmails } from "@/lib/news";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { signInTestAccount } from "./test-account";

let userId = "";
let before: boolean | null = null;

beforeAll(async () => {
  if (!supabaseConfigured) throw new Error("EXPO_PUBLIC_SUPABASE_URL/_KEY are not set (.env)");
  userId = (await signInTestAccount("sync")).id;
  before = await getNewsEmails();
});

afterAll(async () => {
  if (before !== null) await setNewsEmails(before);
  await supabase.auth.signOut();
});

test("switching news off and on again reads back each time", async () => {
  await setNewsEmails(false);
  expect(await getNewsEmails()).toBe(false);
  const { data } = await supabase.from("news_opt_outs").select("user_id, via").eq("user_id", userId);
  expect(data).toEqual([{ user_id: userId, via: "app" }]);

  // Twice in a row is not an error: the switch can be pressed on a slow connection.
  await setNewsEmails(false);
  expect(await getNewsEmails()).toBe(false);

  await setNewsEmails(true);
  expect(await getNewsEmails()).toBe(true);
});

test("a keeper can't opt somebody else out", async () => {
  const stranger = "00000000-0000-4000-8000-0000000000aa";
  const { error } = await supabase.from("news_opt_outs").insert({ user_id: stranger, via: "app" });
  expect(error, "row-level security refuses another account's row").not.toBeNull();
});

test("an emailed unsubscribe can't be forged from the app", async () => {
  const { error } = await supabase.from("news_opt_outs").insert({ user_id: userId, via: "reply" });
  expect(error).not.toBeNull();
  expect(await getNewsEmails()).toBe(true);
});

test("the recipient list, which returns addresses, is not callable by a keeper", async () => {
  const { data, error } = await supabase.rpc("news_recipients");
  expect(error).not.toBeNull();
  expect(data).toBeNull();
});
