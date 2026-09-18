// A keeper's conservatory: GET /@handle, served by Vercel.
//
// Every plant one keeper has published, at one link — where a tag is one
// plant, this is the collection. The parlour is the private room a keeper
// keeps their greenhouse in; the conservatory is the glass house they show
// people into. Same shape as api/tag.ts and for the same
// reasons: static HTML off the edge, one SECURITY DEFINER RPC with the
// publishable key, no app boot, so it renders before the bundle would and
// carries the og: tags a shared link needs.
//
// It publishes nothing new. conservatory() returns only plants already marked
// is_public — the same set the tag links expose — so a private plant is as
// invisible here as everywhere else.

import { page } from "./tag";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ixagjvntbgyqemxxinqe.supabase.co";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || "sb_publishable__A5fA6nyI8nrSqJWfaaJBQ_vqEZdRn6";
const SITE = "https://plantparlour.org";

/** Matches the database's own check constraint on keepers.handle. */
export const HANDLE = /^[A-Za-z0-9_]{3,20}$/;

type Plant = {
  nickname: string;
  species: string | null;
  status: string;
  acquired_at: string | null;
  propagated_at: string | null;
  passport_token: string;
  photo: string | null;
};
export type Conservatory = {
  keeper: { handle: string; display_name: string; keeping_since: string };
  plants: Plant[];
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/**
 * A photo, at the size this page draws it. Supabase resizes on the way out,
 * and the saving is the difference between a page and a download: one real
 * photo in the bucket is 1600x3463 and 704 KB, and comes back as 10 KB at
 * 320px square, 144 KB at 900px wide. A tag with a dozen photos was several
 * megabytes of full-size originals to fill thumbnails a centimetre across.
 *
 * `hero` keeps the photo's shape; the strip below crops to squares, which is
 * what the grid draws anyway.
 */
const SIZES = {
  hero: "width=900&resize=contain&quality=75",
  grid: "width=320&height=320&resize=cover&quality=65",
} as const;

const photoUrl = (path: string, size: keyof typeof SIZES | "raw" = "raw") =>
  size === "raw"
    ? `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${path}`
    : `${SUPABASE_URL}/storage/v1/render/image/public/plant-photos/${path}?${SIZES[size]}`;
const year = (iso: string | null) => (iso ? new Date(iso).getFullYear() : null);

export function renderConservatory(data: Conservatory): string {
  const { keeper, plants } = data;
  const count = plants.length;
  const since = new Date(keeper.keeping_since).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const card = (p: Plant) => {
    const kept = year(p.acquired_at);
    return `<a class="plant" href="/tag?t=${esc(p.passport_token)}">
      ${p.photo ? `<img src="${esc(photoUrl(p.photo, "grid"))}" alt="" loading="lazy">` : `<div class="noshot"></div>`}
      <div class="pbody">
        <p class="pname">${esc(p.nickname)}</p>
        ${p.species ? `<p class="small muted"><em>${esc(p.species)}</em></p>` : ""}
        ${kept ? `<p class="small muted">Kept since ${kept}${p.propagated_at ? " · a cutting" : ""}</p>` : ""}
      </div>
    </a>`;
  };

  return `
<style>
.shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.plant{display:block;border:1px solid var(--hair2);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;background:var(--neu-bg)}
.plant img,.plant .noshot{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.plant .noshot{background:repeating-linear-gradient(135deg,var(--hair2) 0 2px,transparent 2px 10px)}
.pbody{padding:10px 12px}
.pname{font-family:Lora,Georgia,serif;font-size:16px;font-weight:600;margin:0 0 2px}
.pbody p{margin:0}
.empty{background:var(--neu-bg);border-radius:10px;padding:14px}
</style>
<div class="top"><div class="caps">A conservatory</div><div class="brand">PlantParlour</div></div>

<header>
  <h1>${esc(keeper.display_name)}</h1>
  <div class="sub">@${esc(keeper.handle)} · keeping plants here since ${esc(since)}</div>
</header>

${
  count === 0
    ? `<p class="empty small">Nothing on show just yet. ${esc(keeper.display_name)} hasn't published a plant.</p>`
    : `<p class="small muted">${count} plant${count === 1 ? "" : "s"} on show. Each one opens its own record — every photo, every watering, and where it came from.</p>
<section class="shelf">${plants.map(card).join("")}</section>`
}

<div class="foot"><span>Rare plants. Real community. Real pride.</span></div>`;
}

export async function conservatoryPage(handle: string): Promise<{ status: number; html: string }> {
  const missing = page(
    "Conservatory not found",
    `<section><h2 class="caps">No conservatory here</h2><p class="muted">Nobody keeps plants at that name — or they haven't chosen one yet.</p></section>`,
    404,
  );
  if (!HANDLE.test(handle)) return missing;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/conservatory`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
  if (!res.ok) return missing;
  const data = (await res.json()) as Conservatory | null;
  if (!data) return missing;

  const title = `${data.keeper.display_name} · PlantParlour`;
  const description =
    data.plants.length === 0
      ? `${data.keeper.display_name}'s conservatory on PlantParlour.`
      : `${data.plants.length} plant${data.plants.length === 1 ? "" : "s"} on show in ${data.keeper.display_name}'s conservatory — every photo, every watering, and where each one came from.`;
  const head = `<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}/@${esc(data.keeper.handle)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="PlantParlour">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}/@${esc(data.keeper.handle)}">
<meta name="twitter:card" content="summary">`;
  return page(title, renderConservatory(data), 200, head);
}

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = { status(code: number): Res; setHeader(name: string, value: string): void; send(body: string): void };

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET");
    res.status(405).send("Method not allowed");
    return;
  }
  const raw = req.query?.h ?? new URL(req.url ?? "/", "http://x").searchParams.get("h") ?? "";
  const handle = (Array.isArray(raw) ? raw[0] : raw)?.trim().replace(/^@/, "") ?? "";
  const { status, html } = await conservatoryPage(handle);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // A conservatory changes when its keeper publishes something, so it can't be held
  // for long; a minute at the edge still absorbs a link doing the rounds.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
  res.status(status).send(html);
}
