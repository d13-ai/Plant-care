/**
 * "Last updated" dates for the generated pages, and the one place they come
 * from.
 *
 * A date on a page is a claim: the content under it changed on that day. So
 * it is not the build date, and it is not the date a template changed. Each
 * page's <main> is hashed -- the part a reader reads -- and the date moves
 * only when that hash does. A new footer link, a head tag or the analytics
 * snippet changes every file on the site and none of their dates.
 *
 * The same date goes three places, and they have to agree:
 *   - on the page, as "Last updated ..." under the heading;
 *   - in the page's JSON-LD, as dateModified;
 *   - in sitemap.xml, as lastmod (generate-sitemap.mjs reads it from here).
 * The sitemap used to hash finished pages itself, which can't work for a
 * page that prints its own date: it strips today's date before hashing, so
 * a page stamped today reads differently tomorrow and gets re-dated a day
 * late. Taking the date from here avoids that loop.
 *
 * Why "updated" and not "reviewed": nobody re-reads 161 pages on a schedule,
 * and a "reviewed" date would claim they had. "Updated" is exactly what the
 * hash can vouch for.
 *
 * Dates live in scripts/page-dates.json, committed like sitemap-manifest.json.
 * A page with no entry yet takes its sitemap date, which already records when
 * its content last changed, so switching this on re-dates nothing.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PAGE_DATES_PATH = join(__dirname, "page-dates.json");
const SITEMAP_MANIFEST = join(__dirname, "sitemap-manifest.json");

const readJson = (path) => {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
  } catch {
    return {};
  }
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-09-24" -> "24 September 2026". */
export const longDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** What a reader reads: the page's <main>, without any date already on it. */
export const contentHash = (html) => {
  const main = html.match(/<main>([\s\S]*?)<\/main>/)?.[1] ?? html;
  return createHash("sha256").update(main.replace(/<p class="updated">[\s\S]*?<\/p>\n?/, "")).digest("hex");
};

/**
 * Dates for one generator run. `today` is injectable so tests can move the
 * clock; in a build it is the UTC date, the same as the sitemap uses.
 */
export function pageDates({ today = new Date().toISOString().slice(0, 10), path = PAGE_DATES_PATH } = {}) {
  const prev = readJson(path);
  const seed = readJson(SITEMAP_MANIFEST);
  const next = {};

  /** The date this page's content last changed, recording it as seen. */
  const dateFor = (url, html) => {
    const hash = contentHash(html);
    const before = prev[url];
    const updated =
      before?.hash === hash ? before.updated : before ? today : (seed[url]?.lastmod ?? today);
    next[url] = { hash, updated };
    return updated;
  };

  /**
   * The page with its date in it: a line under the heading's subtitle, and
   * dateModified on the page's own WebPage or CollectionPage block.
   */
  const stamp = (url, html) => {
    const iso = dateFor(url, html);
    const line = `<p class="updated">Last updated <time datetime="${iso}">${longDate(iso)}</time></p>`;
    let out = html.replace(/(<p class="sub">[\s\S]*?<\/p>)/, `$1\n${line}`);
    if (!out.includes(line)) throw new Error(`${url}: no <p class="sub"> to put the date under`);
    let dated = false;
    out = out.replace(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g, (whole, raw) => {
      if (dated) return whole;
      const data = JSON.parse(raw);
      if (data["@type"] !== "WebPage" && data["@type"] !== "CollectionPage") return whole;
      dated = true;
      return `<script type="application/ld+json">\n${JSON.stringify({ ...data, dateModified: iso }, null, 2)}\n</script>`;
    });
    return out;
  };

  /**
   * Write this run's dates back, merged with everything already there: the
   * plant generator and the guides generator run separately and each owns
   * only its own pages.
   */
  const save = () => {
    const merged = { ...readJson(path), ...next };
    const sorted = {};
    for (const k of Object.keys(merged).sort()) sorted[k] = merged[k];
    writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
  };

  return { dateFor, stamp, save };
}

/** Every recorded page date, for the sitemap. */
export const recordedDates = (path = PAGE_DATES_PATH) => readJson(path);
