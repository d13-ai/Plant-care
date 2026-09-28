/**
 * Puts the current analytics snippet into the hand-written pages.
 *
 * Generated pages import ANALYTICS_SNIPPET and the app shell imports
 * ANALYTICS_INLINE, so they change when src/domain/analytics.ts does. The
 * hand-written pages below held a pasted copy, and a pasted copy goes stale
 * the first time the snippet changes -- `npm run seo` would then fail them
 * for a drifted beforeSend. This replaces each page's copy with the real one.
 * Runs as part of `npm run plants`.
 *
 * Usage: node scripts/stamp-analytics.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ANALYTICS_SNIPPET } from "../src/domain/analytics.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

export const HAND_WRITTEN = [
  "parlour-games/index.html",
  "parlour-games/trickle.html",
  "parlour-games/windowsill.html",
  "count-me-out.html",
];

/** The pasted snippet: the queue stub and everything after it in the same <script>. */
export const PASTED = /<script>\nwindow\.va = window\.va[\s\S]*?<\/script>/;

function main() {
  for (const rel of HAND_WRITTEN) {
    const path = join(PUBLIC, rel);
    const html = readFileSync(path, "utf-8");
    if (!PASTED.test(html)) throw new Error(`${rel}: no analytics snippet to replace`);
    const next = html.replace(PASTED, () => ANALYTICS_SNIPPET);
    if (next !== html) {
      writeFileSync(path, next, "utf-8");
      console.log(`Stamped the analytics snippet into ${rel}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
