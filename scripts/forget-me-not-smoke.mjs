/**
 * Forget-Me-Not in a real browser.
 *
 * Drives the page in Chromium: a table of your own, a miss that waits for
 * the player rather than a clock, a pair that stays and says something true,
 * the nudge (which only ever points at what has been seen), clearing a table,
 * the three sizes on a phone, practice, the daily table with its share line
 * and streak, the embed, the keyboard, night mode, the hub's card, and no
 * console errors anywhere.
 *
 *   node scripts/forget-me-not-smoke.mjs
 *
 * CHROME=/path/to/chrome overrides the browser.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const FILES = {
  "/parlour-games/forget-me-not-rules.js": readFileSync("public/parlour-games/forget-me-not-rules.js", "utf8"),
  "/parlour-games/harness.js": readFileSync("public/parlour-games/harness.js", "utf8"),
};
const PAGE = readFileSync("public/parlour-games/forget-me-not.html", "utf8");
const HUB = readFileSync("public/parlour-games/index.html", "utf8");
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  const js = FILES[path];
  if (js) {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end(js);
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(/^\/parlour-games\/?$/.test(path) ? HUB : PAGE);
}).listen(4614);
const base = "http://localhost:4614/parlour-games/forget-me-not";
const shots = process.env.SHOTS || null;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const errors = [];
const step = async (name, fn) => { await fn(); console.log("✓", name); };
const fresh = async (viewport = { width: 420, height: 900 }) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  return { ctx, page };
};
const ready = (page) => page.waitForFunction(() => window.__game && window.__game.board() && document.querySelectorAll("#table .card").length > 0, null, { timeout: 15000 });
/** Where each plant lies on the table: [[a, b], ...]. */
const pairsOn = (page) => page.evaluate(() => {
  const at = {};
  window.__game.board().cards.forEach((k, i) => (at[k] = (at[k] || []).concat(i)));
  return Object.values(at);
});
const card = (page, i) => page.locator(`#table .card[data-card="${i}"]`);
const turn = (page, i) => card(page, i).click();
const up = (page) => page.evaluate(() => window.__game.position().up);

try {
  await step("a table of your own: a Bunch of 8 pairs, face down, with nothing on the faces to find", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    if ((await page.locator("#table .card").count()) !== 16) throw new Error("a Bunch isn't 16 cards");
    if (!(await page.locator('[data-size="bunch"].on').count())) throw new Error("Bunch isn't shown as chosen");
    // An unturned card carries no plant in the page at all.
    if (await page.locator("#table .card .art svg").count()) throw new Error("a face-down card already holds its plant");
    const label = await card(page, 0).getAttribute("aria-label");
    if (label !== "card 1 of 16, face down") throw new Error("unexpected label: " + label);
    await page.getByText("Turn over two cards to find a pair.").waitFor({ timeout: 3000 });
    if (shots) await page.screenshot({ path: `${shots}/fmn-01-table.png`, fullPage: true });
    await ctx.close();
  });

  await step("a miss waits for the player, never for a clock, and the next tap moves on", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    const pairs = await pairsOn(page);
    const [a, b] = [pairs[0][0], pairs[1][0]];
    await turn(page, a);
    await turn(page, b);
    await page.getByText("Not a pair. Tap any card to turn them back.").waitFor({ timeout: 3000 });
    // Still showing well after any flip-back timer would have fired.
    await page.waitForTimeout(2500);
    if (JSON.stringify(await up(page)) !== JSON.stringify([a, b])) throw new Error("the miss turned back on its own");
    if (shots) await page.screenshot({ path: `${shots}/fmn-02-miss.png`, fullPage: true });
    // A fresh card turns the two back and itself over in one tap.
    const c = pairs[2][0];
    await turn(page, c);
    if (JSON.stringify(await up(page)) !== JSON.stringify([c])) throw new Error("one tap didn't turn the miss back and the new card over");
    if (await page.evaluate(() => window.__game.position().turns) !== 1) throw new Error("turns miscounted");
    await ctx.close();
  });

  await step("a pair stays face up and says one true line about the plant, with its care page", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    const pairs = await pairsOn(page);
    // A pair whose plant has a page in the library.
    const kinds = await page.evaluate(() => window.__game.board().cards);
    const pick = pairs.find((p) => kinds[p[0]] !== "forgetmenot");
    await turn(page, pick[0]);
    await turn(page, pick[1]);
    await page.locator("#table .card.found").nth(1).waitFor({ timeout: 3000 });
    const said = await page.locator("#status").innerText();
    if (!/— a pair\. .{20,}/.test(said)) throw new Error("no line about the plant: " + said);
    const href = await page.locator("#status a").getAttribute("href");
    if (!href || !existsSync(`public${href}.html`)) throw new Error("the care link goes nowhere: " + href);
    const label = await card(page, pick[0]).getAttribute("aria-label");
    if (!/, found$/.test(label)) throw new Error("a found card isn't said to be found: " + label);
    // The line stays while the next card is turned, so there is time to read it.
    const next = pairs.find((p) => p !== pick)[0];
    await turn(page, next);
    if (!(await page.locator("#status").innerText()).includes("— a pair.")) throw new Error("the line went before it could be read");
    await ctx.close();
  });

  await step("the nudge points only at cards already seen", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    await page.locator("#nudge").click();
    if (await page.locator("#table .card.hint").count()) throw new Error("the nudge pointed before anything was seen");
    await page.getByText("Nothing you've seen makes a pair yet.", { exact: false }).waitFor({ timeout: 3000 });
    const pairs = await pairsOn(page);
    // See both of one plant, in two different misses.
    const [p, q, r] = pairs;
    await turn(page, p[0]); await turn(page, q[0]);
    await turn(page, r[0]); await turn(page, p[1]);
    await turn(page, r[0]); // turns the miss back (r[0] was showing)
    await page.locator("#nudge").click();
    const lit = await page.evaluate(() => [...document.querySelectorAll("#table .card.hint")].map((e) => +e.dataset.card).sort((x, y) => x - y));
    const seenPairs = [p, r].map((x) => [...x].sort((m, n) => m - n));
    if (!seenPairs.some((x) => JSON.stringify(x) === JSON.stringify(lit))) throw new Error("the nudge lit the wrong cards: " + JSON.stringify(lit));
    await ctx.close();
  });

  await step("clearing the table finishes it, counts it, and says how many turns", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    for (const [a, b] of await pairsOn(page)) { await turn(page, a); await turn(page, b); }
    await page.getByText("Nothing forgotten.").waitFor({ timeout: 5000 });
    const line = await page.locator("#win-line").innerText();
    if (line !== "All 8 pairs, in 8 turns, without a nudge.") throw new Error("unexpected win line: " + line);
    const progress = await page.evaluate(() => window.__game.progress());
    if (progress.done !== 1 || progress.bySize.bunch !== 1 || progress.nudgeFree !== 1) throw new Error("not counted: " + JSON.stringify(progress));
    if (shots) await page.screenshot({ path: `${shots}/fmn-03-cleared.png`, fullPage: true });
    await page.locator("#again").click();
    await page.waitForFunction(() => !window.__game.done() && window.__game.position().turns === 0, null, { timeout: 5000 });
    await ctx.close();
  });

  await step("three sizes, and every card stays big enough to hit on a small phone", async () => {
    const { ctx, page } = await fresh({ width: 360, height: 760 });
    await page.goto(base);
    await ready(page);
    for (const [key, count] of [["posy", 12], ["bouquet", 24], ["bunch", 16]]) {
      await page.locator(`[data-size="${key}"]`).click();
      await page.waitForFunction((n) => document.querySelectorAll("#table .card").length === n, count, { timeout: 5000 });
      const box = await card(page, 0).boundingBox();
      if (box.width < 44 || box.height < 44) throw new Error(`${key} cards are too small to hit: ${box.width}x${box.height}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflow) throw new Error(`${key} scrolls sideways on a phone`);
    }
    await page.reload();
    await ready(page);
    if (await page.evaluate(() => window.__game.size()) !== "bunch") throw new Error("the size wasn't remembered");
    await ctx.close();
  });

  await step("practice: a small fixed table that talks you through it, and nothing counted", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base + "/learn");
    await ready(page);
    if ((await page.locator("#table .card").count()) !== 6) throw new Error("practice isn't six cards");
    await page.getByText("Every card has a twin somewhere on the table.", { exact: false }).waitFor({ timeout: 3000 });
    if (await page.locator(".sizes").isVisible()) throw new Error("sizes shown in practice");
    await turn(page, 0);
    await page.getByText("Now turn another, looking for its twin.").waitFor({ timeout: 3000 });
    await turn(page, 1);
    await page.getByText("They'll wait as long as you like.", { exact: false }).waitFor({ timeout: 3000 });
    if (shots) await page.screenshot({ path: `${shots}/fmn-04-practice.png`, fullPage: true });
    await turn(page, 1);
    await page.getByText("Where was the other one?", { exact: false }).waitFor({ timeout: 3000 });
    for (const [a, b] of await pairsOn(page)) { await turn(page, a); await turn(page, b); }
    await page.getByText("That's the whole game. Now a proper table.").waitFor({ timeout: 5000 });
    const progress = await page.evaluate(() => window.__game.progress());
    if (progress.done) throw new Error("practice was counted");
    await page.getByText("Play a proper table").click();
    await page.waitForFunction(() => !window.__game.learning() && document.querySelectorAll("#table .card").length === 16, null, { timeout: 5000 });
    await ctx.close();
  });

  await step("the daily table: the same for everyone, kept across a reload, a share line, and the streak", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base + "/daily");
    await ready(page);
    const info = await page.evaluate(() => ({ daily: window.__game.isDaily(), num: window.__game.board().num, day: window.__game.dayNumber(), cards: window.__game.board().cards }));
    if (!info.daily || info.num !== info.day || info.cards.length !== 16) throw new Error("not today's table: " + JSON.stringify(info));
    // Everyone gets the same: a second browser deals the same cards.
    const other = await fresh();
    await other.page.goto(base + "/daily");
    await ready(other.page);
    const theirs = await other.page.evaluate(() => window.__game.board().cards);
    if (JSON.stringify(theirs) !== JSON.stringify(info.cards)) throw new Error("two browsers got different daily tables");
    await other.ctx.close();
    if (!/the same one for everybody today/.test(await page.locator(".tagline").innerText())) throw new Error("the daily isn't named as today's");
    const pairs = await pairsOn(page);
    await turn(page, pairs[0][0]); await turn(page, pairs[0][1]);
    await page.reload();
    await ready(page);
    if (await page.evaluate(() => window.__game.position().cards.replace(/[^m]/g, "").length) !== 2) throw new Error("the daily's found pair was lost on reload");
    for (const [a, b] of pairs.slice(1)) { await turn(page, a); await turn(page, b); }
    await page.getByText("Nothing forgotten.").waitFor({ timeout: 5000 });
    const share = await page.locator("#share-text").innerText();
    if (!share.includes(`#${info.num}`) || !share.includes("8 turns, no nudges")) throw new Error("bad share line: " + share);
    // Spoiler-free: no plant named, so nobody learns where anything is.
    const names = await page.evaluate(() => window.ForgetMeNotRules.KINDS.map((k) => k.name));
    if (names.some((n) => share.includes(n))) throw new Error("the share line names a plant: " + share);
    const streak = await page.evaluate(() => window.__game.streak());
    if (streak.last !== info.num || streak.streak < 1) throw new Error("streak not recorded: " + JSON.stringify(streak));
    if (shots) await page.screenshot({ path: `${shots}/fmn-05-daily.png`, fullPage: true });
    // Finished stays finished.
    await page.reload();
    await ready(page);
    await page.getByText("Nothing forgotten.").waitFor({ timeout: 5000 });
    await ctx.close();
  });

  await step("the embed is the table and nothing else", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base + "/embed");
    await ready(page);
    for (const sel of ["h1", ".about", ".foot"]) {
      if (await page.locator(sel).isVisible()) throw new Error(`${sel} shows in the embed`);
    }
    if (!(await page.locator("#credit").isVisible())) throw new Error("the embed doesn't say where it's from");
    const targets = await page.evaluate(() => [...document.querySelectorAll("a")].every((a) => a.target === "_blank"));
    if (!targets) throw new Error("an embed link would open inside the frame");
    // The care link written after a pair opens outside the frame too.
    const pairs = await pairsOn(page);
    const kinds = await page.evaluate(() => window.__game.board().cards);
    const pick = pairs.find((p) => kinds[p[0]] !== "forgetmenot");
    await turn(page, pick[0]); await turn(page, pick[1]);
    if (await page.locator("#status a").getAttribute("target") !== "_blank") throw new Error("the care link would open inside the frame");
    await ctx.close();
  });

  await step("playable by keyboard: arrows move, enter turns", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    await card(page, 0).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => +document.activeElement.dataset.card);
    if (focused !== 5) throw new Error("arrows moved to card " + focused + ", expected 5");
    await page.keyboard.press("Enter");
    if (JSON.stringify(await up(page)) !== "[5]") throw new Error("enter didn't turn the card");
    await ctx.close();
  });

  await step("night mode switches and is remembered", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    const was = await page.evaluate(() => document.body.classList.contains("night"));
    await page.locator("#night").click();
    if ((await page.evaluate(() => document.body.classList.contains("night"))) === was) throw new Error("night didn't toggle");
    await page.reload();
    await ready(page);
    if ((await page.evaluate(() => document.body.classList.contains("night"))) === was) throw new Error("night not remembered");
    await ctx.close();
  });

  await step("the hub lists it beside the others", async () => {
    const { ctx, page } = await fresh();
    await page.goto("http://localhost:4614/parlour-games");
    await page.locator('a.game[href="/parlour-games/forget-me-not"]').waitFor({ timeout: 5000 });
    await ctx.close();
  });
} finally {
  await browser.close();
  server.close();
}

if (errors.length) {
  console.log("Browser errors:");
  errors.forEach((e) => console.log("  ", e));
  process.exit(1);
}
console.log("ALL PASSED");
