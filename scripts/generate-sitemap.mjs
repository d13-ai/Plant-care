/**
 * Generates public/sitemap.xml with honest per-URL <lastmod> dates.
 *
 * Runs after the plant-page generator so every page's final HTML is on disk.
 * A URL's lastmod only moves when that page's *content* changes, tracked in
 * a committed content-hash manifest (scripts/sitemap-manifest.json) rather
 * than taken from the build clock. Without that, every rebuild would claim
 * all 160-odd URLs changed today, which is how you teach a crawler to ignore
 * your lastmod entirely.
 *
 * No git, so it behaves the same locally and on Vercel's shallow clone:
 * given the same sources, the hashes — and the dates — are reproducible.
 * Commit the manifest along with whatever you changed; if you don't, the
 * next build simply re-dates the pages it can't account for.
 *
 * Usage: node scripts/generate-sitemap.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { plantPages, SITE } from "./generate-plant-pages.mjs";
import { GUIDES } from "./guides-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MANIFEST_PATH = join(__dirname, "sitemap-manifest.json");
const today = new Date().toISOString().split("T")[0];

// Each URL is keyed to the file(s) whose content defines it. The app's own
// shell isn't on disk until expo export runs, so / is keyed off its sources.
//
// Deliberately absent: /tag (unlisted by design, and noindexed), /@handle
// conservatories (a keeper's to share, and not knowable at build time), and
// the app's inner routes, which render client-side and have nothing for a
// crawler to read.
const urls = [
  {
    loc: `${SITE}/`,
    files: ["src/app/+html.tsx", "src/app/index.tsx", "src/components/welcome.tsx"],
    priority: "1.0",
    changefreq: "weekly",
  },
  { loc: `${SITE}/plants`, files: ["public/plants/index.html"], priority: "0.9", changefreq: "weekly" },
  ...plantPages().map((p) => ({
    loc: p.url,
    files: [`public/plants/${p.slug}.html`],
    priority: "0.7",
    changefreq: "monthly",
  })),
  // The guides gather from every plant page and the pet page from the ASPCA
  // snapshot, so each is keyed to its own output rather than its sources.
  { loc: `${SITE}/problems`, files: ["public/problems/index.html"], priority: "0.8", changefreq: "monthly" },
  ...GUIDES.map((g) => ({
    loc: `${SITE}/problems/${g.slug}`,
    files: [`public/problems/${g.slug}.html`],
    priority: "0.8",
    changefreq: "monthly",
  })),
  { loc: `${SITE}/pet-safe-houseplants`, files: ["public/pet-safe-houseplants.html"], priority: "0.8", changefreq: "monthly" },
  { loc: `${SITE}/parlour-games`, files: ["public/parlour-games/index.html"], priority: "0.6", changefreq: "weekly" },
  { loc: `${SITE}/parlour-games/trickle`, files: ["public/parlour-games/trickle.html"], priority: "0.6", changefreq: "weekly" },
  { loc: `${SITE}/parlour-games/windowsill`, files: ["public/parlour-games/windowsill.html"], priority: "0.6", changefreq: "weekly" },
  { loc: `${SITE}/privacy`, files: ["api/privacy.ts", "api/legal.ts"], priority: "0.3", changefreq: "yearly" },
  { loc: `${SITE}/terms`, files: ["api/terms.ts", "api/legal.ts"], priority: "0.3", changefreq: "yearly" },
];

let prev = {};
if (existsSync(MANIFEST_PATH)) {
  try {
    prev = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    prev = {};
  }
}

const next = {};
let changed = 0;

const lastmodFor = (loc, files) => {
  const h = createHash("sha256");
  for (const rel of files) {
    const abs = join(ROOT, rel);
    // Strip today's date before hashing so a page that stamps the build date
    // into its markup doesn't look changed on every build.
    const content = existsSync(abs) ? readFileSync(abs, "utf-8").split(today).join("") : "";
    h.update(`${rel}::${content}::`);
  }
  const hash = h.digest("hex");
  const before = prev[loc];
  const lastmod = before && before.hash === hash ? before.lastmod : today;
  if (!before || before.hash !== hash) changed++;
  next[loc] = { hash, lastmod };
  return lastmod;
};

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const lastmod = lastmodFor(u.loc, u.files);
    return `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>
`;

writeFileSync(join(ROOT, "public", "sitemap.xml"), xml, "utf-8");

const sorted = {};
for (const k of Object.keys(next).sort()) sorted[k] = next[k];
writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf-8");

console.log(`Generated sitemap.xml (${urls.length} URLs, ${changed} re-dated to ${today})`);
