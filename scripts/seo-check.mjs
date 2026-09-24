/**
 * Checks the crawlable surface of the site before it ships.
 *
 * These are the mistakes that are invisible in a browser and expensive in a
 * search console: two pages claiming the same title, a canonical pointing at
 * the wrong URL, a FAQPage block promising answers the page doesn't show
 * (which is a manual-action offence, not a style question), JSON-LD that
 * doesn't parse, an og:image that 404s, a page missing from the sitemap, or
 * an internal link to a plant that left the catalogue.
 *
 * Run over public/ — the generated pages and the hand-written ones alike.
 * Exits non-zero on any error. Warnings are printed and don't fail the run.
 *
 * Usage: npm run seo
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { plantPages, SITE } from "./generate-plant-pages.mjs";
import { ANALYTICS_SCRIPT_SRC, BEFORE_SEND } from "../src/domain/analytics.ts";
import { GUIDES } from "./guides-data.mjs";
import { petSafe } from "./generate-guides.mjs";
import { aspcaNonToxic, auditToxicity, APCC } from "./pet-safety.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const read = (rel) => readFileSync(join(PUBLIC, rel), "utf-8");

/** Visible text, near enough: tags out, entities back, whitespace flattened. */
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&mdash;/g, "—")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const attr = (html, re) => {
  const m = html.match(re);
  return m ? m[1] : null;
};

// Every URL the site is meant to serve, and the file behind it. Anything an
// internal link points at has to be in here.
const pages = plantPages();
const ROUTES = new Map([
  ["/", null], // the app shell; expo writes it, not this build
  ["/plants", "plants/index.html"],
  ["/parlour-games", "parlour-games/index.html"],
  ["/parlour-games/trickle", "parlour-games/trickle.html"],
  ["/parlour-games/windowsill", "parlour-games/windowsill.html"],
  ["/privacy", null], // served by api/privacy.ts
  ["/terms", null], // served by api/terms.ts
  ...pages.map((p) => [`/plants/${p.slug}`, `plants/${p.slug}.html`]),
  ["/problems", "problems/index.html"],
  ...GUIDES.map((g) => [`/problems/${g.slug}`, `problems/${g.slug}.html`]),
  ["/pet-safe-houseplants", "pet-safe-houseplants.html"],
]);

/** The documents this script actually inspects, with the URL each claims. */
const DOCS = [...ROUTES].filter(([, file]) => file).map(([url, file]) => ({ url, file }));

const titles = new Map();

for (const { url, file } of DOCS) {
  const where = file;
  if (!existsSync(join(PUBLIC, file))) {
    err(where, "file is missing — run `npm run plants`");
    continue;
  }
  const html = read(file);

  // --- title: present, sane length, and not shared with another page
  const title = attr(html, /<title>([\s\S]*?)<\/title>/);
  if (!title) err(where, "no <title>");
  else {
    if (titles.has(title)) err(where, `duplicate <title> — also used by ${titles.get(title)}`);
    titles.set(title, file);
    if (title.length > 70) warn(where, `<title> is ${title.length} chars; Google will truncate it`);
  }

  // --- description
  const desc = attr(html, /<meta name="description" content="([\s\S]*?)">/);
  if (!desc) err(where, "no meta description");
  else if (desc.length < 70) warn(where, `meta description is only ${desc.length} chars`);
  else if (desc.length > 320) err(where, `meta description is ${desc.length} chars; cut it under 320`);

  // --- canonical: present, absolute, and the URL this file is served at
  const canonical = attr(html, /<link rel="canonical" href="([^"]+)">/);
  const expected = `${SITE}${url}`;
  if (!canonical) err(where, "no canonical");
  else if (canonical !== expected) err(where, `canonical is ${canonical}, expected ${expected}`);

  // --- og:image has to exist, or the link previews as a blank rectangle
  const ogImage = attr(html, /<meta property="og:image" content="([^"]+)">/);
  if (!ogImage) err(where, "no og:image");
  else {
    const rel = ogImage.replace(SITE, "").replace(/^\//, "");
    if (!existsSync(join(PUBLIC, rel))) err(where, `og:image ${ogImage} has no file — run \`npm run icons\``);
  }

  // --- JSON-LD parses, and a FAQPage's answers are actually on the page
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) err(where, "no JSON-LD");
  const text = visibleText(html);
  for (const [, raw] of blocks) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      err(where, `JSON-LD does not parse: ${e.message}`);
      continue;
    }
    if (!data["@context"]) err(where, `JSON-LD block has no @context`);
    const types = [].concat(data["@type"] ?? []);
    if (types.includes("FAQPage")) {
      for (const q of data.mainEntity ?? []) {
        // Rich-result rules: every question and answer in the markup must be
        // visible on the page. Both are rendered from the same array as the
        // JSON, so a failure here means something got out of step.
        if (!text.includes(q.name)) err(where, `FAQPage question is not visible on the page: "${q.name}"`);
        const answer = q.acceptedAnswer?.text ?? "";
        if (answer && !text.includes(answer.slice(0, 60)))
          err(where, `FAQPage answer is not visible on the page: "${answer.slice(0, 60)}…"`);
      }
    }
  }

  // --- internal links go somewhere we serve
  for (const [, href] of html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g)) {
    const target = href.length > 1 ? href.replace(/\/$/, "") : href;
    if (ROUTES.has(target)) continue;
    if (existsSync(join(PUBLIC, target.replace(/^\//, "")))) continue; // a real asset
    err(where, `internal link to ${href}, which nothing serves`);
  }
}

// --- sitemap covers every page, and claims nothing it doesn't serve
if (!existsSync(join(PUBLIC, "sitemap.xml"))) {
  err("sitemap.xml", "missing — run `npm run plants`");
} else {
  const sitemap = read("sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const listed = new Set(locs.map((l) => l.replace(SITE, "") || "/"));
  for (const url of ROUTES.keys()) {
    if (!listed.has(url)) err("sitemap.xml", `does not list ${url}`);
  }
  for (const url of listed) {
    if (!ROUTES.has(url)) err("sitemap.xml", `lists ${url}, which is not a page we serve`);
  }
  if (locs.length !== new Set(locs).size) err("sitemap.xml", "contains duplicate <loc> entries");
  // A tag is unlisted by design; if one ever reaches the sitemap, say so loudly.
  if (locs.some((l) => l.includes("/tag"))) err("sitemap.xml", "lists a plant tag, which must stay unlisted");
}

// --- robots.txt: points at the sitemap and keeps tags out of search results
//
// Two different mechanisms, because two different kinds of crawler:
//
//   A search crawler is kept out of the RESULTS by `noindex`, which lives
//   inside the page -- so it has to be allowed to fetch a tag in order to be
//   told not to list it. Disallowing it would leave the instruction unread,
//   and a disallowed URL can still be listed as a bare link.
//
//   Everything else is kept out by not being allowed to fetch at all, since
//   a crawler collecting text for a model has no index for `noindex` to
//   exclude it from.
//
// Get either half backwards and tags leak, quietly, so both are asserted.
const SEARCH_BOTS = ["Googlebot", "Bingbot"];

if (!existsSync(join(PUBLIC, "robots.txt"))) {
  err("robots.txt", "missing");
} else {
  const robots = read("robots.txt");
  if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) err("robots.txt", "does not name the sitemap");

  // One group per `User-agent:` line, each ending where the next begins.
  const groups = robots
    .split(/^User-agent:[ \t]*/m)
    .slice(1)
    .map((block) => {
      const [name, ...rest] = block.split("\n");
      return { name: name.trim(), lines: rest.map((l) => l.trim()) };
    });
  if (!groups.length) err("robots.txt", "names no crawlers at all");

  for (const g of groups) {
    const blocksTags = g.lines.includes("Disallow: /tag");
    const search = SEARCH_BOTS.includes(g.name);
    if (search && blocksTags) {
      err("robots.txt", `${g.name} is disallowed from /tag, so it can never read the noindex that keeps tags out of search`);
    }
    if (!search && !blocksTags) {
      err("robots.txt", `${g.name} may fetch /tag but nothing stops it keeping what it finds`);
    }
    if (!g.lines.includes("Disallow: /api/")) err("robots.txt", `${g.name} may crawl /api/`);
  }

  for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"]) {
    if (!robots.includes(`User-agent: ${bot}`)) warn("robots.txt", `no rule named for ${bot}`);
  }

  // The other half of the pair: the page itself has to say noindex, or
  // letting the search crawlers in publishes every tag. Both the meta tag
  // and the published-tag branch that asks for it are checked -- the word
  // "noindex" also appears in that file as a comment and a parameter name,
  // and neither of those keeps anything out of Google.
  const tagSrc = readFileSync(join(ROOT, "api", "tag.ts"), "utf8");
  if (!/content="noindex/.test(tagSrc)) {
    err("api/tag.ts", "no longer emits a noindex robots meta tag");
  }
  // `noindex` keeps the PAGE out of results and says nothing about the
  // photographs on it, which are served from a host whose robots.txt is a 404
  // -- permission for everything, as a crawler reads it. Losing this directive
  // would leave a keeper's photos indexable while the page stayed hidden.
  if (!/content="noindex[^"]*noimageindex/.test(tagSrc)) {
    err("api/tag.ts", "a tag's photos are no longer marked noimageindex");
  }
  if (!/render\(data\)[^;]*\btrue\b/.test(tagSrc)) {
    err("api/tag.ts", "a published tag no longer asks to be noindexed");
  }
}

// --- any number the library quotes about itself has to be the real one.
// The hub's title once said 158 while the page under it said 159, because
// the title was typed and the body was counted.
{
  const hub = DOCS.find((d) => d.url === "/plants");
  if (hub && existsSync(join(PUBLIC, hub.file))) {
    const html = read(hub.file);
    const real = String([...ROUTES.keys()].filter((u) => u.startsWith("/plants/")).length);
    const parts = [
      ["title", attr(html, /<title>([\s\S]*?)<\/title>/)],
      ["meta description", attr(html, /<meta name="description" content="([\s\S]*?)">/)],
    ];
    for (const [what, text] of parts) {
      for (const n of (text || "").match(/\b\d{2,4}\b/g) ?? []) {
        if (n !== real) err(hub.file, `${what} says ${n} houseplants; the library has ${real}`);
      }
    }
  }
}

// --- a public page never serves a full-size photo into a small box.
// Supabase resizes on the way out; asking for the raw object instead means a
// 704 KB original filling a 320px square. Every <img> on a server-rendered
// page has to name the size it draws.
for (const file of ["tag.ts", "conservatory.ts"]) {
  const src = readFileSync(join(ROOT, "api", file), "utf8");
  for (const [, call] of src.matchAll(/<img[^>]*?photoUrl\(([^)]*)\)/g)) {
    if (!/,/.test(call)) {
      err(`api/${file}`, `an <img> asks for photoUrl(${call.trim()}) at full size — name the size it is drawn at`);
    }
  }
}

// --- llms.txt exists and doesn't advertise anything unlisted
if (!existsSync(join(PUBLIC, "llms.txt"))) {
  err("llms.txt", "missing");
}

// ------------------------------------------------- analytics, and its muzzle
//
// A tag's URL carries the token that makes it reachable, so a page that gets
// the counter without the redaction in front of it reports that token to a
// dashboard. The app shell and the generated pages import the snippet, but
// the three games are hand-written HTML where a copy can rot quietly — so
// every surface is checked for both halves, and for this exact beforeSend
// rather than merely some beforeSend.
const HAND_WRITTEN = [
  "parlour-games/index.html",
  "parlour-games/trickle.html",
  "parlour-games/windowsill.html",
];
for (const rel of [
  ...HAND_WRITTEN,
  "plants/index.html",
  `plants/${pages[0].slug}.html`,
  "problems/index.html",
  `problems/${GUIDES[0].slug}.html`,
  "pet-safe-houseplants.html",
]) {
  const html = read(rel);
  const where = `/${rel.replace(/\.html$/, "").replace(/\/index$/, "")}`;
  if (!html.includes(ANALYTICS_SCRIPT_SRC)) err(where, "no analytics script — this page is not counted");
  if (!html.includes("window.vaq")) err(where, "no window.va queue stub, so beforeSend can never register");
  if (!html.includes(BEFORE_SEND)) {
    err(where, "analytics beforeSend is missing or has drifted from src/domain/analytics.ts — URLs would be reported unredacted, tag tokens included");
  } else if (html.indexOf("beforeSend") > html.indexOf(ANALYTICS_SCRIPT_SRC)) {
    err(where, "beforeSend is registered after the script is appended, so the first pageview goes out unredacted");
  }
  if (!/localhost/.test(html.slice(html.indexOf("window.vaq"), html.indexOf(ANALYTICS_SCRIPT_SRC)))) {
    err(where, "no localhost guard — a static file server answers this path with index.html and the page throws on it");
  }
}

// ------------------------------------------------- what we say about pets
//
// "Non-toxic to cats and dogs" is the one sentence in the library someone
// might act on with an animal's health. It may only appear where the ASPCA
// says the same, and every page that talks about toxicity has to carry the
// emergency number. See scripts/pet-safety.mjs.
for (const problem of auditToxicity(pages)) err("scripts/plants-data.mjs", problem);

if (existsSync(join(PUBLIC, "pet-safe-houseplants.html"))) {
  const html = read("pet-safe-houseplants.html");
  const safeTable = html.slice(html.indexOf('id="how-we-decide"'), html.indexOf('id="toxic"'));
  const listed = [...safeTable.matchAll(/<tr><td><a href="\/plants\/([^"]+)"/g)].map((m) => m[1]);
  for (const slug of listed) {
    if (!aspcaNonToxic(slug)) err("pet-safe-houseplants.html", `lists ${slug} as pet-safe, but the ASPCA snapshot doesn't back it for both cats and dogs`);
  }
  if (listed.length !== petSafe(pages).length) {
    err("pet-safe-houseplants.html", `lists ${listed.length} plants in its safe tables, expected ${petSafe(pages).length}`);
  }
}
for (const rel of ["pet-safe-houseplants.html", ...pages.map((p) => `plants/${p.slug}.html`)]) {
  if (!existsSync(join(PUBLIC, rel))) continue;
  const html = read(rel);
  if (!html.includes(APCC.phone)) err(rel, `talks about toxicity without the ${APCC.name} number`);
  if (!html.includes('class="notice"')) err(rel, "has no pet-safety notice beside its toxicity information");
}

for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.error(`  ERROR ${e}`);
console.log(
  `\nChecked ${DOCS.length} pages, ${warnings.length} warning(s), ${errors.length} error(s).`,
);
if (errors.length) process.exit(1);
