// Public plant tag page: GET /tag?t=<token>
//
// Anyone with the link can read it — that is the point of a tag — so
// JWT verification is off. The only data access is the passport(token) RPC,
// which is SECURITY DEFINER and returns one public plant or nothing; the
// token is a 32-hex-char random string, so links are unlisted, not browsable.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Event = { type: string; notes: string | null; occurred_at: string; resolved_at: string | null };
type Photo = { path: string; caption: string | null; taken_at: string };
type Tag = {
  plant: {
    nickname: string; species: string | null; status: string; acquired_at: string;
    acquired_from: string | null; notes: string | null; propagated_at: string | null;
    published_at: string; passport_token: string;
  };
  keeper: { display_name: string } | null;
  mother: { nickname: string; passport_token: string | null } | null;
  cuttings: { nickname: string; propagated_at: string | null; passport_token: string | null }[];
  events: Event[];
  photos: Photo[];
};

const LABELS: Record<string, string> = {
  WATER: "Watered", FERTILIZE: "Fertilized", REPOT: "Repotted", PRUNE: "Pruned",
  PHOTO: "Photo taken", ISSUE: "Issue reported", TREATMENT: "Treatment applied",
  NOTE: "Note", ACQUIRED: "Acquired", PROPAGATED: "Propagated", TRANSFERRED: "Changed keeper",
  AI_CHECK: "AI check",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
const photoUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${path}`;

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{color-scheme:light dark;--bg:#f6f7f4;--card:#fff;--text:#1b1f1a;--muted:#6b7069;--line:#e3e6e0;--green:#2f6b3a;--red-bg:#fbe9e7;--red:#8e1f16;--ok-bg:#e3f3e8;--ok:#1e6b3a}
@media(prefers-color-scheme:dark){:root{--bg:#101311;--card:#1a1f1b;--text:#eef1ec;--muted:#9ba39a;--line:#2a302b;--green:#7bc48a;--red-bg:#3a1b18;--red:#f2a49b;--ok-bg:#173225;--ok:#8fd6a3}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
main{max-width:640px;margin:0 auto;display:grid;gap:14px}h1{font-size:26px;margin:0 0 2px}h2{font-size:16px;margin:0 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}.muted{color:var(--muted)}small,.small{font-size:13px}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:var(--line);margin-right:6px}.badge.ok{background:var(--ok-bg);color:var(--ok)}.badge.bad{background:var(--red-bg);color:var(--red)}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}.photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block}
table{width:100%;border-collapse:collapse}td{padding:6px 0;border-top:1px solid var(--line);vertical-align:top}td:first-child{color:var(--muted);white-space:nowrap;width:110px;padding-right:12px}
a{color:var(--green)}.hero{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;display:block}
</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } },
  );
}

function render(p: Tag) {
  const { plant, keeper, mother, cuttings, events, photos } = p;
  const last = (type: string) => events.find((e) => e.type === type)?.occurred_at ?? null;
  const count = (type: string) => events.filter((e) => e.type === type).length;
  const open = events.filter((e) => e.type === "ISSUE" && !e.resolved_at).length;
  const health = events.filter((e) => ["ISSUE", "TREATMENT", "REPOT", "PRUNE", "PROPAGATED", "TRANSFERRED", "AI_CHECK"].includes(e.type));
  const hero = photos[0];
  const link = (t: string | null, label: string) => (t ? `<a href="?t=${esc(t)}">${esc(label)}</a>` : esc(label));

  return `
<header><h1>${esc(plant.nickname)}</h1><div class="muted">${esc(plant.species || "Species not listed")}</div></header>
${hero ? `<img class="hero" src="${esc(photoUrl(hero.path))}" alt="${esc(plant.nickname)}">` : ""}
<div>
  <span class="badge ${plant.status === "ACTIVE" ? "ok" : ""}">${esc(plant.status.toLowerCase())}</span>
  <span class="badge ${open ? "bad" : "ok"}">${open ? `${open} open issue${open === 1 ? "" : "s"}` : "No open issues"}</span>
  <span class="badge">kept by ${esc(keeper?.display_name ?? "A keeper")} since ${day(plant.acquired_at)}</span>
</div>
<section class="card"><h2>Care record</h2><table>
  <tr><td>Water</td><td>last ${day(last("WATER"))} · ${count("WATER")} logged</td></tr>
  <tr><td>Fertilize</td><td>last ${day(last("FERTILIZE"))} · ${count("FERTILIZE")} logged</td></tr>
  <tr><td>Repot</td><td>last ${day(last("REPOT"))} · ${count("REPOT")} logged</td></tr>
  <tr><td>Photos</td><td>${photos.length} on record${photos[0] ? `, latest ${day(photos[0].taken_at)}` : ""}</td></tr>
</table>${plant.acquired_from ? `<p class="small muted">Origin: ${esc(plant.acquired_from)}</p>` : ""}</section>
<section class="card"><h2>Lineage</h2>
  ${mother ? `<p>Cutting from ${link(mother.passport_token, mother.nickname)}${plant.propagated_at ? ` · ${day(plant.propagated_at)}` : ""}</p>` : `<p class="muted">Original plant — no mother recorded.</p>`}
  ${cuttings.length ? `<p class="small"><strong>Cuttings taken</strong></p><ul class="small">${cuttings.map((c) => `<li>${link(c.passport_token, c.nickname)} · ${day(c.propagated_at)}</li>`).join("")}</ul>` : ""}
</section>
<section class="card"><h2>Health &amp; handling</h2>
  ${health.length ? `<table>${health.map((e) => `<tr><td>${day(e.occurred_at)}</td><td>${esc(LABELS[e.type] ?? e.type)}${e.type === "ISSUE" ? (e.resolved_at ? ` · resolved ${day(e.resolved_at)}` : " · <strong>unresolved</strong>") : ""}${e.notes ? `<br><span class="small muted">${esc(e.notes)}</span>` : ""}</td></tr>`).join("")}</table>` : `<p class="muted">Nothing reported — no issues, treatments or repottings on record.</p>`}
</section>
${photos.length > 1 ? `<section class="card"><h2>Photos over time</h2><div class="photos">${photos.map((ph) => `<figure style="margin:0"><img src="${esc(photoUrl(ph.path))}" alt="" loading="lazy"><figcaption class="small muted">${day(ph.taken_at)}${ph.caption ? ` · ${esc(ph.caption)}` : ""}</figcaption></figure>`).join("")}</div></section>` : ""}
${plant.notes ? `<section class="card"><h2>Notes</h2><p>${esc(plant.notes)}</p></section>` : ""}
<p class="small muted">Plant Tag · self-reported by the plant's keeper · published ${day(plant.published_at)}</p>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const token = new URL(req.url).searchParams.get("t")?.trim() ?? "";
  if (!/^[a-f0-9]{32}$/.test(token)) return page("Plant Tag", `<section class="card"><h2>No tag here</h2><p class="muted">This link is missing its token.</p></section>`, 404);

  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await supabase.rpc("passport", { token });
  if (error) return page("Plant Tag", `<section class="card"><h2>Something went wrong</h2><p class="muted">${esc(error.message)}</p></section>`, 500);
  if (!data) return page("Plant Tag", `<section class="card"><h2>No tag here</h2><p class="muted">This plant isn't published, or the link is wrong.</p></section>`, 404);

  const tag = data as Tag;
  return page(`${tag.plant.nickname} · Plant Tag`, render(tag));
});
