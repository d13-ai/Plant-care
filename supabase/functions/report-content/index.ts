// Report a published page: POST /report-content
//   { page: "/tag?t=<token>" | "/@handle", reason, note? }
//
// Anyone can call it: most people who see a tag aren't keepers. The report
// is stored in content_reports (service role only) and emailed to us, so a
// report reaches a person the same day rather than waiting in a table.
//
// The limits are counted, not claimed under a lock as account emails are:
// the worst a race can do here is let a sixth report through, and every one
// is read by a person anyway. What they do stop is one source burying the
// mailbox: 5 an hour from one network address, 100 a day in all.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { FROM, REPLY_TO } from "../_shared/account-emails.ts";
import {
  isReason,
  REPORT_NOTE_MAX,
  reportedPage,
  reportEmail,
  REPORTS_PER_DAY,
  REPORTS_PER_HOUR_PER_SOURCE,
} from "../_shared/content-report.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const log = (fields: Record<string, unknown>) => console.log(JSON.stringify({ fn: "report-content", ...fields }));

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { page?: unknown; reason?: unknown; note?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Expected JSON." }, 400); }
  const target = reportedPage(body.page);
  if (!target) return json({ error: "That isn't a PlantParlour tag or conservatory page." }, 400);
  if (!isReason(body.reason)) return json({ error: "Choose a reason." }, 400);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, REPORT_NOTE_MAX) || null : null;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ipHash = ip ? await sha256(`report-ip:${ip}`) : null;

  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [{ count: today }, { count: fromSource }] = await Promise.all([
    admin.from("content_reports").select("id", { count: "exact", head: true }).gte("created_at", since(86_400_000)),
    ipHash
      ? admin.from("content_reports").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(3_600_000))
      : Promise.resolve({ count: 0 }),
  ]);
  if ((today ?? 0) >= REPORTS_PER_DAY || (fromSource ?? 0) >= REPORTS_PER_HOUR_PER_SOURCE) {
    log({ outcome: "limited", kind: target.kind });
    return json({ error: "Too many reports just now. Please try again later, or email bondcreativestudios@gmail.com." }, 429);
  }

  const { data: row, error } = await admin
    .from("content_reports")
    .insert({ kind: target.kind, page: target.page, reason: body.reason, note, ip_hash: ipHash })
    .select("id")
    .single();
  if (error || !row) {
    log({ outcome: "insert_failed", error: error?.message });
    return json({ error: "Couldn't send the report just now. Please try again, or email bondcreativestudios@gmail.com." }, 503);
  }

  // Stored is what matters; the email is how we hear about it soon. If Resend
  // fails the report is still there, so the caller is still told it's sent.
  try {
    const { data: key } = await admin.rpc("resend_api_key");
    if (typeof key !== "string" || !key) throw new Error("no Resend key in Vault");
    const email = reportEmail({ ...target, reason: body.reason, note, id: row.id as number });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `content-report-${row.id}` },
      body: JSON.stringify({ from: FROM, to: [REPLY_TO], subject: email.subject, html: email.html, text: email.text, tags: [{ name: "kind", value: "content-report" }] }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    log({ outcome: "sent", kind: target.kind, id: row.id });
  } catch (err) {
    log({ outcome: "stored_not_emailed", id: row.id, error: err instanceof Error ? err.message : String(err) });
  }
  return json({ ok: true });
});
