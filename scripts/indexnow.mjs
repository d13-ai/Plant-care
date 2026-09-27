/**
 * Tells Bing (and the other IndexNow engines -- Yandex, Seznam, Naver) which
 * pages changed, the moment they are live, instead of waiting to be crawled.
 *
 * Why it matters here: ChatGPT search and Copilot answer from Bing's index,
 * and a two-week-old domain gets crawled rarely. IndexNow is the one way to
 * say "this page changed" and have it heard within minutes. Google doesn't
 * take part; Search Console and the sitemap cover Google.
 *
 * Which pages: the sitemap is the record of what changed. A URL counts as
 * changed when its <lastmod> differs from the sitemap at an earlier commit,
 * or it is new, or it has gone (IndexNow takes removed URLs too, so a dead
 * page drops out of the index sooner). Because every lastmod here is an
 * honest content date (see page-dates.mjs), a template change submits
 * nothing, and a single new plant submits the plant, the library index and
 * whatever guide lists it.
 *
 * The key is public by design: IndexNow proves ownership by fetching
 * https://plantparlour.org/<key>.txt and checking it holds the key. Nothing
 * here is a secret.
 *
 * Usage:
 *   node scripts/indexnow.mjs --since <git-ref> [--wait] [--dry-run]
 *   node scripts/indexnow.mjs --all [--wait] [--dry-run]
 *
 * --wait polls the live site until it serves this commit's sitemap and the
 * key file, so a submission never points a crawler at the old page. The
 * GitHub workflow (.github/workflows/indexnow.yml) runs it that way on every
 * push to main that changes the sitemap.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const HOST = "plantparlour.org";
export const KEY = "df1a1687ac3cc57d57481ab4c3ecd761";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

/** loc -> lastmod, from a sitemap's text. */
export const parseSitemap = (xml) =>
  new Map([...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));

/** URLs added, re-dated or removed between two sitemaps. */
export function changedUrls(before, after) {
  const out = [];
  for (const [loc, lastmod] of after) if (before.get(loc) !== lastmod) out.push(loc);
  for (const loc of before.keys()) if (!after.has(loc)) out.push(loc);
  return out;
}

const sitemapAt = (ref) => {
  try {
    return execFileSync("git", ["show", `${ref}:public/sitemap.xml`], { cwd: ROOT, encoding: "utf-8" });
  } catch {
    return ""; // the sitemap didn't exist then: everything is new
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait until the live site serves exactly this sitemap, and the key. */
async function waitForDeploy(localXml, minutes = 15) {
  const deadline = Date.now() + minutes * 60_000;
  while (Date.now() < deadline) {
    try {
      const [site, key] = await Promise.all([
        fetch(`https://${HOST}/sitemap.xml`, { cache: "no-store" }).then((r) => r.text()),
        fetch(KEY_LOCATION, { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")),
      ]);
      if (site.trim() === localXml.trim() && key.trim() === KEY) return;
    } catch {
      // a network blip is a reason to try again, not to give up
    }
    await sleep(20_000);
  }
  throw new Error(`The live site didn't serve this commit's sitemap within ${minutes} minutes; nothing submitted.`);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const since = args[args.indexOf("--since") + 1];

  const localXml = readFileSync(join(ROOT, "public", "sitemap.xml"), "utf-8");
  const after = parseSitemap(localXml);
  let urls;
  if (flag("--all")) urls = [...after.keys()];
  else if (args.includes("--since") && since) urls = changedUrls(parseSitemap(sitemapAt(since)), after);
  else throw new Error("Say which pages: --since <git-ref> or --all");

  if (!urls.length) {
    console.log("No page changed; nothing to submit.");
    return;
  }
  console.log(`${urls.length} URL(s) to submit:\n${urls.map((u) => `  ${u}`).join("\n")}`);
  if (flag("--dry-run")) return;

  if (flag("--wait")) await waitForDeploy(localXml);

  // IndexNow takes up to 10,000 URLs a request; the whole site is under 200.
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls.slice(0, 10_000) }),
  });
  // 200: accepted. 202: accepted, key still being verified (normal the first time).
  if (res.status === 200 || res.status === 202) {
    console.log(`IndexNow accepted ${urls.length} URL(s) (${res.status}).`);
    return;
  }
  throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
