// The public welcome page: GET /welcome, served by Vercel.
//
// Static HTML, no data access and no app boot — this is the link you hand to
// someone who has never opened PlantParlour, and it has to render on a slow
// phone before the Expo bundle and the SQLite wasm ever would. It reuses the
// tag page's shell so the two public pages are visibly the same product.
//
// The app itself stays at /. The first launch inside the app has its own
// welcome screen (`src/app/start.tsx`); this one is for people who are not
// in the app yet.

import { page } from "./tag";

const SITE = "https://plantparlour.org";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const TITLE = "PlantParlour — every plant, on the record";
const DESCRIPTION =
  "A CARFAX for plants. Photograph what you own, log what you do for it, see what it needs today, and hand the whole history to whoever you trade or sell it to.";

/** Head markup the tag page has no use for: this is the one page meant to be found and shared. */
const HEAD = `<meta name="description" content="${esc(DESCRIPTION)}">
<link rel="canonical" href="${SITE}/welcome">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PlantParlour">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:url" content="${SITE}/welcome">
<meta name="twitter:card" content="summary">`;

const icon = (path: string) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7A5A12" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const ICONS = {
  leaf: icon(`<path d="M12 21C7 21 4 17 4 12 4 8 8 4 13 3c4-1 7 0 7 0s-1 4-2 9c-1 5-3 9-6 9z"></path><path d="M12 21c1-6 3-10 7-16"></path>`),
  drop: icon(`<path d="M12 3s6 6.4 6 10.2A6 6 0 0 1 6 13.2C6 9.4 12 3 12 3z"></path>`),
  clock: icon(`<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path>`),
  tag: icon(`<path d="M3 11.5V4a1 1 0 0 1 1-1h7.5a1 1 0 0 1 .7.3l8.5 8.5a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 12.2a1 1 0 0 1-.3-.7z"></path><circle cx="7.5" cy="7.5" r="1.3"></circle>`),
  branch: icon(`<circle cx="6" cy="18" r="2.5"></circle><circle cx="18" cy="6" r="2.5"></circle><path d="M6 15.5V9a3 3 0 0 1 3-3h6.5"></path>`),
  cloud: icon(`<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 10.5 3.75 3.75 0 0 0 7 18z"></path>`),
};

const LEAF_GOLD = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E6C46B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21C7 21 4 17 4 12 4 8 8 4 13 3c4-1 7 0 7 0s-1 4-2 9c-1 5-3 9-6 9z"></path><path d="M12 21c1-6 3-10 7-16"></path></svg>`;

type Feature = { icon: keyof typeof ICONS; title: string; body: string };

const FREE: Feature[] = [
  { icon: "leaf", title: "A record per plant", body: "Photograph each plant you own. Where it came from, when you got it, what has happened since." },
  { icon: "clock", title: "What's due today", body: "Reminders for water, feed, repot and a fresh picture — set per plant, not per species." },
  { icon: "drop", title: "One-tap care log", body: "Log a watering from the list. Undo it if it was a misfire, and edit the history later." },
  { icon: "branch", title: "Cuttings keep their line", body: "Log a propagation and the new plant links back to the mother it came from." },
];

const ACCOUNT: Feature[] = [
  { icon: "leaf", title: "Identification and health checks", body: "Photograph the whole plant and a close-up or two; they get read together in one scan." },
  { icon: "clock", title: "Care guides for your plant", body: "Written for the plant in front of you — its species, its light, its history — not a generic page." },
  { icon: "tag", title: "Publish a tag", body: "Turn one plant's record into a link. Send it with a trade, a sale, or a plant left with a sitter." },
  { icon: "cloud", title: "Backup and sync", body: "The greenhouse is saved to your account and shows up on any phone you sign into." },
];

const grid = (features: Feature[]) =>
  `<div class="grid">${features
    .map(
      (f) =>
        `<div class="feature">${ICONS[f.icon]}<div><p class="ftitle">${esc(f.title)}</p><p class="small muted">${esc(f.body)}</p></div></div>`,
    )
    .join("")}</div>`;

/** The page body. Pure — no data access, so it renders the same every time. */
export function renderWelcome(): string {
  return `
<style>
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}
.feature{display:flex;gap:10px;align-items:flex-start}.feature svg{flex:none;margin-top:2px}
.ftitle{font-family:Lora,Georgia,serif;font-size:15px;font-weight:600;margin:0 0 2px}
.cta{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.btn{display:inline-block;padding:11px 18px;border-radius:12px;border:1px solid var(--gold);background:var(--gold);color:var(--bg);font-weight:700;text-decoration:none;font-size:15px}
.btn.ghost{background:transparent;color:var(--gold-deep)}
.note{background:var(--neu-bg);border-radius:10px;padding:10px 12px}
.rule{border:0;border-top:1px solid var(--hair2);margin:0}
</style>
<div class="top"><div class="caps">Welcome</div><div class="brand">PlantParlour</div></div>

<header>
  <h1>Every plant, on the record.</h1>
  <div class="sub">A CARFAX for plants.</div>
</header>
<p>
  Photograph what you own, log what you do for it, and see what it needs today. When a plant moves
  on — traded, sold, or left with a friend for a fortnight — its whole history goes with it.
</p>
<div class="cta">
  <a class="btn" href="/">Open PlantParlour</a>
  <span class="small muted">Free, and it works in your browser — nothing to install.</span>
</div>

<hr class="rule">

<section>
  <h2 class="caps">From the first tap, no account</h2>
  ${grid(FREE)}
  <p class="small muted">Your plants are kept on your own device. The app works with no account at all.</p>
</section>

<hr class="rule">

<section>
  <h2 class="caps">With an account</h2>
  ${grid(ACCOUNT)}
  <p class="note small">
    <strong>Straight about this:</strong> identification, care guides and tags run on our server, so
    they need an account — there is no offline version of them. Signing in is an email and a 6-digit
    code, or one tap with Google. No passwords.
  </p>
</section>

<hr class="rule">

<section>
  <h2 class="caps">What a tag looks like</h2>
  <p class="small">
    Publishing a plant puts its record at a link anyone can open: the photos over time, every
    watering and repotting, any issue reported and how it was treated, and the cuttings taken from
    it. Unlisted, not browsable — the link is the key, and you can withdraw it.
  </p>
</section>

<div class="cta">
  <a class="btn" href="/">Start your parlour</a>
  <a class="btn ghost" href="/account">I already have an account</a>
</div>

<div class="foot"><span>Rare plants. Real community. Real pride.</span>${LEAF_GOLD}</div>`;
}

export function welcomePage(): { status: number; html: string } {
  return page(TITLE, renderWelcome(), 200, HEAD);
}

// Vercel's Node request/response, typed only as far as this handler uses them.
type Req = { method?: string };
type Res = { status(code: number): Res; setHeader(name: string, value: string): void; send(body: string): void };

export default function handler(req: Req, res: Res): void {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).setHeader("Allow", "GET");
    res.send("Method not allowed");
    return;
  }
  const { status, html } = welcomePage();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Nothing here is per-visitor, so let the edge hold it.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.status(status).send(html);
}
