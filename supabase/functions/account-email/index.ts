// Account emails: POST /account-email
//   { kind: "welcome" }                 -- signed in; welcomes the caller, once
//   { kind: "reset", email: "..." }     -- anyone; emails a reset link if there
//                                          is an account for that address
//
// Supabase's own mailer only delivers to the project's team, and no SMTP
// server was set, so until this existed a forgotten password was a lost
// account. This sends through Resend from plantparlour.org instead, with the
// key held in Vault (public.resend_api_key(), service role only).
//
// Every email is claimed first through claim_account_email(), which does the
// lookup, the rate limits and the once-only rule for welcomes in one locked
// statement. See supabase/migrations/20261004000000_account_emails.sql.
//
// A reset request answers the same whether or not the address has an
// account, and whether or not a limit stopped it, so the form can't be used
// to find out who uses PlantParlour. The one exception is Resend itself
// failing, which says so: "we couldn't send it" is worth more to someone
// locked out than a promise of an email that isn't coming.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { boundedText, PHOTO_TRIAL } from "../_shared/cap.ts";
import { type Email, FROM, LOGO_CONTENT_ID, LOGO_URL, REPLY_TO, resetEmail, welcomeEmail } from "../_shared/account-emails.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const log = (fields: Record<string, unknown>) => console.log(JSON.stringify({ fn: "account-email", ...fields }));

type Claim =
  | { allowed: true; id: number; user_id: string; email: string }
  | { allowed: false; reason: string };

/** For the per-IP limit. Hashed: the table only needs to count. */
async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The logo, base64, for the inline attachment: fetched once per instance from
 * the site. A failure isn't kept, so the next email tries again; until then
 * emails go out without the logo rather than with a broken image.
 */
let logo: Promise<string | null> | null = null;
function logoBase64(): Promise<string | null> {
  logo ??= fetch(LOGO_URL, { signal: AbortSignal.timeout(3000) })
    .then(async (r) => {
      if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/png")) throw new Error(`logo ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary);
    })
    .catch((err) => {
      log({ outcome: "logo_unavailable", error: err instanceof Error ? err.message : String(err) });
      logo = null;
      return null;
    });
  return logo;
}

async function send(key: string, to: string, kind: string, claimId: number, email: Email, logoPng: string | null): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // A retry of the same claim can never become a second email.
      "Idempotency-Key": `account-email-${claimId}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [{ name: "kind", value: kind }],
      // The logo travels inside the email; see LOGO_CONTENT_ID.
      ...(logoPng
        ? { attachments: [{ filename: "plantparlour.png", content: logoPng, content_type: "image/png", content_id: LOGO_CONTENT_ID }] }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { kind?: unknown; email?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Expected JSON." }, 400); }
  const kind = body.kind;
  if (kind !== "welcome" && kind !== "reset") return json({ error: "Unknown kind." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let claim: Claim;
  if (kind === "welcome") {
    // Only ever the caller's own address: the session says who, not the body.
    const asCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await asCaller.auth.getUser();
    if (!user) return json({ error: "Sign in first." }, 401);
    const { data, error } = await admin.rpc("claim_account_email", { p_kind: "welcome", p_user: user.id });
    if (error || !data) {
      log({ kind, outcome: "claim_failed", error: error?.message });
      return json({ error: "Couldn't send just now." }, 503);
    }
    claim = data as Claim;
    if (!claim.allowed) {
      log({ kind, outcome: claim.reason });
      return json({ sent: false, reason: claim.reason });
    }
  } else {
    const address = boundedText(body.email, 254).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return json({ error: "That doesn't look like an email address." }, 400);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const { data, error } = await admin.rpc("claim_account_email", {
      p_kind: "reset",
      p_email: address,
      p_ip_hash: ip ? await sha256(`ip:${ip}`) : null,
    });
    if (error || !data) {
      log({ kind, outcome: "claim_failed", error: error?.message });
      return json({ error: "Couldn't send the email just now. Try again in a few minutes." }, 503);
    }
    claim = data as Claim;
    if (!claim.allowed) {
      // Same answer as a sent email: see the note at the top.
      log({ kind, outcome: claim.reason });
      return json({ ok: true });
    }
  }

  const { data: key } = await admin.rpc("resend_api_key");
  try {
    if (typeof key !== "string" || !key) throw new Error("no Resend key in Vault");
    const logoPng = await logoBase64();
    let email: Email;
    if (kind === "welcome") {
      email = welcomeEmail(PHOTO_TRIAL, logoPng !== null);
    } else {
      // Generated only now, after the claim: a new link replaces the last one,
      // so generating one for a refused request would break a link that is
      // already sitting in somebody's inbox.
      const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email: claim.email });
      const token = link?.properties?.hashed_token;
      if (error || !token) throw new Error(`generateLink: ${error?.message ?? "no token"}`);
      email = resetEmail(claim.email, token, logoPng !== null);
    }
    await send(key, claim.email, kind, claim.id, email, logoPng);
    log({ kind, outcome: "sent" });
    return json(kind === "welcome" ? { sent: true } : { ok: true });
  } catch (err) {
    // Nothing left, so nothing is counted: the welcome can be tried again on
    // the next visit, and a failed reset doesn't use up one of the hour's three.
    await admin.rpc("release_account_email", { p_id: claim.id });
    log({ kind, outcome: "send_failed", error: err instanceof Error ? err.message : String(err) });
    return json({ error: "Couldn't send the email just now. Try again in a few minutes." }, 502);
  }
});
