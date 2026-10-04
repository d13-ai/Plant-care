// Delete the caller's account: POST /delete-account  { confirm: "DELETE" }
//
// Apple requires that anyone who can make an account can delete it from
// inside the app, and until this the privacy page said to email us. This
// does it on the spot, for the signed-in caller only -- the id comes from
// their verified session, never from the request.
//
// Order matters, so that a failure part-way leaves an account someone can
// still delete rather than a half-deleted one:
//   1. Empty the keeper's folder in the photo bucket. Nothing in the database
//      reaches storage, so this is the one step the cascade can't do. If it
//      fails, stop: the account is untouched and the keeper can try again.
//   2. delete_account() -- one transaction: fold their AI costs into
//      ai_usage_retired, copy their bug reports without them into
//      bug_reports_retired, then delete the auth.users row, which cascades
//      to every table that holds their records.
//   3. Sweep the folder again. A sync already in flight on another phone
//      can still upload a photo with a token issued before step 2; the
//      database refuses its row, but storage would keep the file.
// See supabase/migrations/20261004100000_delete_account.sql.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "plant-photos";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const log = (fields: Record<string, unknown>) => console.log(JSON.stringify({ fn: "delete-account", ...fields }));

/** Every object under `prefix`, however deep. Folders come back from list()
 *  with no id, files with one. */
async function listAll(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) files.push(path);
      else files.push(...(await listAll(admin, path)));
    }
    if (!data || data.length < PAGE) break;
  }
  return files;
}

/** Remove everything in the keeper's folder. Returns how many files went. */
async function emptyFolder(admin: SupabaseClient, keeperId: string): Promise<number> {
  const files = await listAll(admin, keeperId);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
    if (error) throw new Error(`remove: ${error.message}`);
  }
  return files.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "Sign in first." }, 401);

  let body: { confirm?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Expected JSON." }, 400); }
  // The app asks for the word to be typed; asking again here means nothing
  // but a deliberate request can reach the delete.
  if (body.confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let files: number;
  try {
    files = await emptyFolder(admin, user.id);
  } catch (err) {
    log({ outcome: "storage_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ error: "Couldn't delete your photos just now, so nothing was deleted. Try again in a few minutes." }, 502);
  }

  const { data, error } = await admin.rpc("delete_account", { p_user: user.id });
  if (error || !data) {
    log({ outcome: "delete_failed", error: error?.message });
    return json({ error: "Couldn't delete your account just now. Try again in a few minutes." }, 502);
  }
  const result = data as { deleted: boolean; reason?: string; plants?: number; photos?: number; care_events?: number };
  if (!result.deleted) {
    log({ outcome: result.reason });
    return json({ error: "There's no account to delete." }, 404);
  }

  let late = 0;
  try {
    late = await emptyFolder(admin, user.id);
  } catch (err) {
    // The account is gone either way; a stray file is logged to be swept.
    log({ outcome: "late_sweep_failed", keeper: user.id, error: err instanceof Error ? err.message : String(err) });
  }

  log({ outcome: "deleted", plants: result.plants, photos: result.photos, care_events: result.care_events, files: files + late });
  return json({ deleted: true, plants: result.plants, photos: result.photos, care_events: result.care_events, files: files + late });
});
