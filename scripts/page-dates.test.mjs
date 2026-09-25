import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { contentHash, longDate, pageDates } from "./page-dates.mjs";

const URL = "https://plantparlour.org/plants/example-plant";
const page = (body, foot = "<footer>links</footer>") => `<!doctype html>
<html><head>
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: "x" }, null, 2)}
</script>
</head><body>
<main>
<h1>Example</h1>
<p class="sub">Aroids</p>
<p>${body}</p>
</main>
${foot}
</body></html>`;

/** A fresh manifest holding one page, last changed on `updated`. */
const manifest = (html, updated) => {
  const path = join(mkdtempSync(join(tmpdir(), "page-dates-")), "page-dates.json");
  writeFileSync(path, JSON.stringify({ [URL]: { hash: contentHash(html), updated } }));
  return path;
};

describe("a page's last-updated date", () => {
  test("stays put while the content does", () => {
    const html = page("Water weekly.");
    const dates = pageDates({ today: "2026-10-01", path: manifest(html, "2026-09-24") });
    expect(dates.dateFor(URL, html)).toBe("2026-09-24");
  });

  test("moves when what a reader reads changes", () => {
    const path = manifest(page("Water weekly."), "2026-09-24");
    expect(pageDates({ today: "2026-10-01", path }).dateFor(URL, page("Water every ten days."))).toBe("2026-10-01");
  });

  test("does not move for a footer, a head tag or a template change outside <main>", () => {
    const path = manifest(page("Water weekly."), "2026-09-24");
    const retemplated = page("Water weekly.", "<footer>links, and a new one</footer>").replace("<head>", "<head><meta name=x>");
    expect(pageDates({ today: "2026-10-01", path }).dateFor(URL, retemplated)).toBe("2026-09-24");
  });

  test("printing the date on the page doesn't count as a change to it", () => {
    // The loop that re-dated the pet page: a page that carries its own date
    // must hash the same with the date in it as without.
    const html = page("Water weekly.");
    const path = manifest(html, "2026-09-24");
    const stamped = pageDates({ today: "2026-09-24", path }).stamp(URL, html);
    expect(contentHash(stamped)).toBe(contentHash(html));
  });

  test("goes on the page, in dateModified, and nowhere a reader would be misled", () => {
    const html = page("Water weekly.");
    const out = pageDates({ today: "2026-10-01", path: manifest(html, "2026-09-24") }).stamp(URL, html);
    expect(out).toContain('<p class="sub">Aroids</p>\n<p class="updated">Last updated <time datetime="2026-09-24">24 September 2026</time></p>');
    expect(out).toContain('"dateModified": "2026-09-24"');
    expect(out).not.toContain("reviewed");
  });

  test("reads the way the rest of the site writes dates", () => {
    expect(longDate("2026-09-05")).toBe("5 September 2026");
  });
});
