// Public plant tag page: GET /tag?t=<token>, served by Vercel.
//
// Supabase Edge Functions rewrite any text/html response to text/plain (a
// documented limit: they're for APIs, not pages), so the page is rendered
// here instead. The only data access is the passport(token) RPC — SECURITY
// DEFINER, returns one public plant or nothing — called with the publishable
// key. Tokens are 32 random hex chars: links are unlisted, not browsable.
// Anyone with the link can read it; that is the point of a tag.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ixagjvntbgyqemxxinqe.supabase.co";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || "sb_publishable__A5fA6nyI8nrSqJWfaaJBQ_vqEZdRn6";

type Event = { type: string; notes: string | null; occurred_at: string; resolved_at: string | null };
type Photo = { path: string; caption: string | null; taken_at: string };
export type Tag = {
  plant: {
    nickname: string; species: string | null; status: string; acquired_at: string;
    acquired_from: string | null; notes: string | null; propagated_at: string | null;
    published_at: string; passport_token: string;
  };
  keeper: { display_name: string } | null;
  // A cutting still says it is a cutting when its mother is unpublished;
  // passport() withholds the name and the link, not the fact.
  mother: { nickname: string | null; passport_token: string | null } | null;
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

/**
 * The PlantParlour look: aubergine page, one cream card with the double gold
 * rule, Lora and Source Sans 3. `head` is extra markup for the document head
 * — the welcome page's description and social tags; a tag page has none,
 * being one keeper's unlisted record rather than something to index.
 */
export function page(title: string, body: string, status = 200, head = ""): { status: number; html: string } {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#2E1633">
<title>${esc(title)}</title>
${status === 200 ? "" : '<meta name="robots" content="noindex">'}
${head}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;600;700&display=swap">
<style>
:root{--bg:#2E1633;--card:#F3ECDD;--text:#2E1633;--muted:#6B5A6B;--label:#1F3D2B;--gold:#C9A24B;--gold-deep:#7A5A12;--gold-light:#E6C46B;--plum:#4B2142;--hair:rgba(201,162,75,.6);--hair2:rgba(201,162,75,.35);--ok-bg:#E3EFE6;--ok:#1F3D2B;--bad-bg:#F0DCE2;--bad:#7A2141;--neu-bg:#EDE3D3;--neu:#4B2142}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 'Source Sans 3','Segoe UI',system-ui,sans-serif;padding:20px 16px;-webkit-font-smoothing:antialiased}
main{max-width:640px;margin:0 auto;background:var(--card);border:1.5px solid var(--gold);border-radius:6px;box-shadow:inset 0 0 0 4px var(--card),inset 0 0 0 5px var(--hair);padding:22px 18px;display:grid;gap:16px}
h1{font-family:Lora,Georgia,serif;font-size:30px;line-height:34px;font-weight:600;margin:0 0 2px}
.sub{font-family:Lora,Georgia,serif;font-style:italic;font-size:15px;color:var(--muted)}
.caps{font-family:Lora,Georgia,serif;font-size:12px;line-height:16px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;color:var(--label)}
.top{display:flex;align-items:center;justify-content:space-between}.brand{font-family:Lora,Georgia,serif;font-style:italic;font-size:13px;color:var(--muted)}
section{display:grid;gap:8px}h2{margin:0}.muted{color:var(--muted)}small,.small{font-size:13px}p{margin:0}
.badges{display:flex;flex-wrap:wrap;gap:6px}.badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;line-height:15px;font-weight:700;background:var(--neu-bg);color:var(--neu)}.badge.ok{background:var(--ok-bg);color:var(--ok)}.badge.bad{background:var(--bad-bg);color:var(--bad)}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}.photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block}
table{width:100%;border-collapse:collapse}td{padding:7px 0;border-top:1px solid var(--hair2);vertical-align:top;font-size:14px}tr:last-child td{border-bottom:1px solid var(--hair2)}td:first-child{color:var(--muted);white-space:nowrap;width:92px;padding-right:12px}
a{color:var(--gold-deep);font-weight:600}.hero{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;display:block}
ul{margin:0;padding-left:18px}
.foot{background-color:var(--plum);background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.045) 0 2px,transparent 2px 7px);padding:12px 14px;border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:Lora,Georgia,serif;font-style:italic;font-size:13px;line-height:17px;color:var(--gold-light)}
</style></head><body><main>${body}</main></body></html>`;
  return { status, html };
}

const LEAF = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E6C46B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21C7 21 4 17 4 12 4 8 8 4 13 3c4-1 7 0 7 0s-1 4-2 9c-1 5-3 9-6 9z"></path><path d="M12 21c1-6 3-10 7-16"></path></svg>`;

export function render(p: Tag): string {
  const { plant, keeper, mother, cuttings, events, photos } = p;
  const last = (type: string) => events.find((e) => e.type === type)?.occurred_at ?? null;
  const count = (type: string) => events.filter((e) => e.type === type).length;
  const open = events.filter((e) => e.type === "ISSUE" && !e.resolved_at).length;
  const health = events.filter((e) => ["ISSUE", "TREATMENT", "REPOT", "PRUNE", "PROPAGATED", "TRANSFERRED", "AI_CHECK"].includes(e.type));
  const hero = photos[0];
  const link = (t: string | null, label: string) => (t ? `<a href="?t=${esc(t)}">${esc(label)}</a>` : esc(label));

  return `
<div class="top"><div class="caps">Plant tag</div><div class="brand">PlantParlour</div></div>
<header><h1>${esc(plant.nickname)}</h1><div class="sub">${esc(plant.species || "Species not listed")}</div></header>
${hero ? `<img class="hero" src="${esc(photoUrl(hero.path))}" alt="${esc(plant.nickname)}">` : ""}
<div class="badges">
  <span class="badge ${plant.status === "ACTIVE" ? "ok" : ""}">${esc(plant.status.toLowerCase())}</span>
  <span class="badge ${open ? "bad" : "ok"}">${open ? `${open} open issue${open === 1 ? "" : "s"}` : "No open issues"}</span>
  <span class="badge">kept by ${esc(keeper?.display_name ?? "A keeper")} since ${day(plant.acquired_at)}</span>
</div>
<section><h2 class="caps">Care record</h2><table>
  <tr><td>Water</td><td>last ${day(last("WATER"))} · ${count("WATER")} logged</td></tr>
  <tr><td>Fertilize</td><td>last ${day(last("FERTILIZE"))} · ${count("FERTILIZE")} logged</td></tr>
  <tr><td>Repot</td><td>last ${day(last("REPOT"))} · ${count("REPOT")} logged</td></tr>
  <tr><td>Photos</td><td>${photos.length} on record${photos[0] ? `, latest ${day(photos[0].taken_at)}` : ""}</td></tr>
</table>${plant.acquired_from ? `<p class="small muted">Origin: ${esc(plant.acquired_from)}</p>` : ""}</section>
<section><h2 class="caps">Lineage</h2>
  ${mother ? `<p>Cutting from ${mother.nickname ? link(mother.passport_token, mother.nickname) : `<span class="muted">a plant that isn't published</span>`}${plant.propagated_at ? ` · ${day(plant.propagated_at)}` : ""}</p>` : `<p class="muted">Original plant — no mother recorded.</p>`}
  ${cuttings.length ? `<p class="small"><strong>Cuttings taken</strong></p><ul class="small">${cuttings.map((c) => `<li>${link(c.passport_token, c.nickname)} · ${day(c.propagated_at)}</li>`).join("")}</ul>` : ""}
</section>
<section><h2 class="caps">Health &amp; handling</h2>
  ${health.length ? `<table>${health.map((e) => `<tr><td>${day(e.occurred_at)}</td><td>${esc(LABELS[e.type] ?? e.type)}${e.type === "ISSUE" ? (e.resolved_at ? ` · resolved ${day(e.resolved_at)}` : " · <strong>unresolved</strong>") : ""}${e.notes ? `<br><span class="small muted">${esc(e.notes)}</span>` : ""}</td></tr>`).join("")}</table>` : `<p class="muted">Nothing reported — no issues, treatments or repottings on record.</p>`}
</section>
${photos.length > 1 ? `<section><h2 class="caps">Photos over time</h2><div class="photos">${photos.map((ph) => `<figure style="margin:0"><img src="${esc(photoUrl(ph.path))}" alt="" loading="lazy"><figcaption class="small muted">${day(ph.taken_at)}${ph.caption ? ` · ${esc(ph.caption)}` : ""}</figcaption></figure>`).join("")}</div></section>` : ""}
${plant.notes ? `<section><h2 class="caps">Notes</h2><p>${esc(plant.notes)}</p></section>` : ""}
<div class="foot"><span>Self-reported by the plant's keeper · published ${day(plant.published_at)}</span>${LEAF}</div>`;
}

/** Build the response for a token: the page, or a not-found page. Pure apart from the RPC call. */
export async function tagPage(token: string): Promise<{ status: number; html: string }> {
  if (!/^[a-f0-9]{32}$/.test(token)) return page("Plant Tag", `<section><h2 class="caps">No tag here</h2><p class="muted">This link is missing its token.</p></section>`, 404);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/passport`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) return page("Plant Tag", `<section><h2 class="caps">Something went wrong</h2><p class="muted">The record couldn't be read right now (${res.status}).</p></section>`, 502);
  const data = (await res.json()) as Tag | null;
  if (!data) return page("Plant Tag", `<section><h2 class="caps">No tag here</h2><p class="muted">This plant isn't published, or the link is wrong.</p></section>`, 404);
  return page(`${data.plant.nickname} · Plant Tag`, render(data));
}

// Vercel's Node request/response, typed only as far as this handler uses them.
type Req = { method?: string; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = { status(code: number): Res; setHeader(name: string, value: string): void; send(body: string): void };

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).setHeader("Allow", "GET");
    res.send("Method not allowed");
    return;
  }
  const raw = req.query?.t ?? new URL(req.url ?? "/", "http://x").searchParams.get("t") ?? "";
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const { status, html } = await tagPage(token);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Never cached at the edge: a republish or an unpublish must show on the
  // next load, and each render is one cheap RPC anyway.
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Tag-Renderer", "vercel-2");
  res.status(status).send(html);
}
