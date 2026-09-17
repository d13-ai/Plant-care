/**
 * Trickle, step 1 of the build order — the core game.
 *
 * Drives the real page in Chromium the way the spec's reference tests do:
 * clicking tiles until each svg's rotation is a multiple of 360°, which is
 * the solved orientation because the art is drawn solved and only rotated.
 *
 *   node scripts/trickle-smoke.mjs
 *
 * CHROME=/path/to/chrome overrides the browser.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const PAGE = readFileSync("public/parlour-games/trickle.html", "utf8");
const server = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(PAGE);
}).listen(4610);

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const errors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));

const step = async (name, fn) => { await fn(); console.log("✓", name); };
const rotationOf = (tile) =>
  tile.$eval("svg", (s) => {
    const m = /rotate\((-?\d+)deg\)/.exec(s.style.transform || "");
    return m ? Number(m[1]) : 0;
  });

/** Turn every tile to a multiple of 360°. A cross never moves, so give up on
 *  one whose rotation does not change — it is already right whatever it reads. */
async function solve() {
  const tiles = await page.$$(".tile");
  for (const tile of tiles) {
    for (let guard = 0; guard < 5; guard++) {
      const before = await rotationOf(tile);
      if (before % 360 === 0) break;
      await tile.click();
      if ((await rotationOf(tile)) === before) break;
    }
  }
  return tiles.length;
}

try {
  await page.goto("http://localhost:4610/");
  await page.waitForSelector(".tile");

  await step("the page is Trickle and points back at the hub", async () => {
    const h1 = await page.textContent("h1");
    if (h1.trim() !== "Trickle") throw new Error(`heading reads "${h1}"`);
    const back = await page.getAttribute(".hub a", "href");
    if (back !== "/parlour-games") throw new Error(`hub link points at ${back}`);
  });

  await step("a fresh board deals 36 tiles with the valve in the middle", async () => {
    const count = await page.$$eval(".tile", (t) => t.length);
    if (count !== 36) throw new Error(`expected 36 tiles, got ${count}`);
    const valves = await page.$$eval(".valve", (v) => v.length);
    if (valves !== 1) throw new Error(`expected one valve, got ${valves}`);
  });

  await step("nudge straightens exactly one tile and counts one turn", async () => {
    const before = await page.$$eval(".tile svg", (s) => s.map((x) => x.style.transform));
    const movesBefore = Number(await page.textContent("#moves"));
    await page.click("#nudge");
    const after = await page.$$eval(".tile svg", (s) => s.map((x) => x.style.transform));
    const changed = after.filter((v, i) => v !== before[i]).length;
    if (changed !== 1) throw new Error(`nudge moved ${changed} tiles, expected 1`);
    const movesAfter = Number(await page.textContent("#moves"));
    if (movesAfter !== movesBefore + 1) {
      throw new Error(`turns went ${movesBefore} → ${movesAfter}, expected +1`);
    }
  });

  await step("solving every tile lights all 36 and shows the win", async () => {
    const total = await solve();
    await page.waitForSelector("#win:not([hidden])", { timeout: 10000 });
    const lit = await page.textContent("#lit");
    if (lit !== `${total} of ${total}`) throw new Error(`flowing says "${lit}"`);
    const line = await page.textContent("#win-line");
    if (!/6×6 in \d+ turns? · fewest possible was \d+\./.test(line)) {
      throw new Error(`win line reads "${line}"`);
    }
  });

  await step("a size switch rebuilds at 16, 36 and 64", async () => {
    for (const [size, expected] of [["4", 16], ["8", 64], ["6", 36]]) {
      await page.click(`[data-size="${size}"]`);
      const count = await page.$$eval(".tile", (t) => t.length);
      if (count !== expected) throw new Error(`size ${size} dealt ${count} tiles`);
      const hidden = await page.getAttribute("#win", "hidden");
      if (hidden === null) throw new Error("the win panel survived a new board");
      const moves = await page.textContent("#moves");
      if (moves !== "0") throw new Error(`a new board starts at ${moves} turns`);
    }
  });

  await step("an 8×8 fits a 390px phone with tap targets over 44px", async () => {
    await page.click('[data-size="8"]');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (overflow) throw new Error("the page scrolls sideways at 390px");
    const box = await (await page.$(".tile")).boundingBox();
    if (box.width < 44) throw new Error(`tiles are ${box.width.toFixed(1)}px, under the 44px minimum`);
    console.log(`  (8×8 tiles measure ${box.width.toFixed(1)}px)`);
  });

  await step("an 8×8 solves too, so the generator holds at every size", async () => {
    const total = await solve();
    await page.waitForSelector("#win:not([hidden])", { timeout: 20000 });
    const lit = await page.textContent("#lit");
    if (lit !== `${total} of ${total}`) throw new Error(`flowing says "${lit}"`);
  });

  await step("every tile carries a label a screen reader can use", async () => {
    await page.click('[data-size="6"]');
    const labels = await page.$$eval(".tile", (t) => t.map((x) => x.getAttribute("aria-label")));
    const bad = labels.filter((l) => !/^Row \d+, column \d+, .*(flowing|dry)\./.test(l || ""));
    if (bad.length) throw new Error(`${bad.length} tiles have no usable label, e.g. "${bad[0]}"`);
    const stops = await page.$$eval(".tile", (t) => t.filter((x) => x.tabIndex === 0).length);
    if (stops !== 1) throw new Error(`grid has ${stops} tab stops, expected 1`);
  });

  if (errors.length) {
    console.log("Browser errors:");
    for (const e of errors) console.log("  " + e);
    process.exitCode = 1;
  } else {
    console.log("ALL PASSED");
  }
} catch (err) {
  console.error("✗", err);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
