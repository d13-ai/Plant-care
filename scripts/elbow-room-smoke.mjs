/**
 * Elbow Room in a real browser.
 *
 * Drives the page in Chromium: solving a board by tapping, clashes shown in
 * words, undo, the nudge, tidy-up, the size choice (an Allotment's cells
 * stay big enough to hit on a phone), practice, the
 * daily board with its share line and streak, the embed, the keyboard, and
 * no console errors anywhere.
 *
 *   node scripts/elbow-room-smoke.mjs
 *
 * CHROME=/path/to/chrome overrides the browser.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const FILES = {
  "/parlour-games/elbow-room-rules.js": readFileSync("public/parlour-games/elbow-room-rules.js", "utf8"),
  "/parlour-games/harness.js": readFileSync("public/parlour-games/harness.js", "utf8"),
};
const PAGE = readFileSync("public/parlour-games/elbow-room.html", "utf8");
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
}).listen(4613);
const base = "http://localhost:4613/parlour-games/elbow-room";

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const errors = [];
const step = async (name, fn) => { await fn(); console.log("✓", name); };
const fresh = async (viewport = { width: 420, height: 900 }) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  // Nothing in the page needs confirming in a test run.
  page.on("dialog", (d) => d.accept());
  return { ctx, page };
};
const ready = (page) => page.waitForFunction(() => window.__game && window.__game.board() && document.querySelectorAll("#plot .cell").length > 0, null, { timeout: 15000 });
const answerCells = (page) => page.evaluate(() => { const b = window.__game.board(); return b.answer.map((c, r) => r * b.n + c); });
const tapCell = (page, cell) => page.locator(`#plot .cell[data-cell="${cell}"]`).click();

try {
  await step("a board of your own is a plain 7x7: the rules Meowdoku players already know", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    const n = await page.evaluate(() => window.__game.board().n);
    if (n !== 7) throw new Error(`expected a 7x7 Border by default, got ${n}`);
    if ((await page.locator("#plot .cell").count()) !== 49) throw new Error("wrong number of cells");
    // The plain rules and nothing else: no twists, no sun patches, no trellis.
    const keys = await page.evaluate(() => Object.keys(window.__game.board()).sort().join());
    if (/twists|sun|trellis/.test(keys)) throw new Error("the board carries more than the plain rules: " + keys);
    if (!(await page.locator('[data-size="border"].on').count())) throw new Error("Border isn't shown as chosen");
    await ctx.close();
  });

  await step("tapping marks, then plants, then clears", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    await tapCell(page, 0);
    if ((await page.evaluate(() => window.__game.state()[0])) !== "x") throw new Error("first tap should mark");
    await tapCell(page, 0);
    if ((await page.evaluate(() => window.__game.state()[0])) !== "p") throw new Error("second tap should plant");
    await tapCell(page, 0);
    if ((await page.evaluate(() => window.__game.state()[0])) !== ".") throw new Error("third tap should clear");
    await ctx.close();
  });

  await step("two plants touching say so in words, and undo takes one back", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    await page.locator('[data-tool="plant"]').click();
    // Row 1 column 1 and row 2 column 2: diagonal neighbours. Find a pair
    const pair = await page.evaluate(() => {
      const b = window.__game.board(), n = b.n;
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
        const a = r * n + c, d = (r + 1) * n + c + 1;
        if (b.beds[a] !== b.beds[d]) return [a, d];
      }
      return null;
    });
    await tapCell(page, pair[0]);
    await tapCell(page, pair[1]);
    await page.getByText("Too close").waitFor({ timeout: 5000 });
    if ((await page.locator("#plot .cell.clash").count()) < 2) throw new Error("both plants should be ringed");
    await page.locator("#undo").click();
    if ((await page.evaluate(() => window.__game.state().split("").filter((c) => c === "p").length)) !== 1) throw new Error("undo didn't take the last plant back");
    await ctx.close();
  });

  await step("a nudge points and explains, and places nothing", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    const before = await page.evaluate(() => window.__game.state());
    await page.locator("#nudge").click();
    const status = await page.locator("#status").innerText();
    if (status.length < 20) throw new Error("the nudge said nothing useful: " + status);
    if ((await page.locator("#plot .cell.hint-cell").count()) === 0) throw new Error("the nudge didn't point at anything");
    if ((await page.evaluate(() => window.__game.state())) !== before) throw new Error("the nudge changed the board");
    await ctx.close();
  });

  await step("tidy up marks the cells a plant rules out", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    await page.locator("#tidy").click();
    await page.locator('[data-tool="plant"]').click();
    await tapCell(page, 24);
    const marks = await page.evaluate(() => window.__game.state().split("").filter((c) => c === "x").length);
    // Its row, its column, its bed and its diagonals: well over a dozen.
    if (marks < 12) throw new Error(`tidy marked only ${marks}`);
    await ctx.close();
  });

  await step("planting the answer finishes the board and counts it", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    await page.locator('[data-tool="plant"]').click();
    for (const cell of await answerCells(page)) await tapCell(page, cell);
    await page.getByText("Room for everyone.").waitFor({ timeout: 5000 });
    if (!(await page.evaluate(() => window.__game.done()))) throw new Error("not marked done");
    const p = await page.evaluate(() => window.__game.progress());
    if (p.done !== 1 || p.bySize.border !== 1 || p.nudgeFree !== 1) throw new Error("not counted: " + JSON.stringify(p));
    await page.getByText("Finished 1").waitFor({ timeout: 3000 });
    await ctx.close();
  });

  await step("a dead end is said at once: the board a player reported as unwinnable", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base + "/learn");
    await ready(page);
    await page.locator('[data-tool="plant"]').click();
    // Brown in the top row instead of the third, then green, blue, pink.
    for (const cell of [0, 7, 18, 21]) await tapCell(page, cell);
    await page.getByText("No room left for the outlined bed — one of your plants needs to move.").waitFor({ timeout: 5000 });
    if ((await page.locator("#plot .cell.dead").count()) < 2) throw new Error("the stuck bed isn't outlined");
    // Moving brown to the third row clears it.
    await tapCell(page, 0);
    await tapCell(page, 10);
    if ((await page.locator("#plot .cell.dead").count()) !== 0) throw new Error("still outlined after the fix");
    await ctx.close();
  });

  await step("the practice coach walks the whole board, one deduction at a time, with no guess anywhere", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base + "/learn");
    await ready(page);
    const first = await page.locator("#coach").innerText();
    if (!/column 1/.test(first) || !/Mark the ringed cell bare/.test(first)) throw new Error("first step isn't spelled out: " + first);
    if ((await page.locator("#plot .cell.hint-cell").count()) === 0) throw new Error("nothing lit up");
    for (let i = 0; i < 60 && !(await page.evaluate(() => window.__game.done())); i++) {
      const g = await page.evaluate(() => window.__game.guide());
      if (!g) throw new Error("the coach ran out of steps before the end");
      await page.locator(`[data-tool="${g.action === "plant" ? "plant" : "mark"}"]`).click();
      for (const cell of g.cells) await tapCell(page, cell);
    }
    if (!(await page.evaluate(() => window.__game.done()))) throw new Error("following the coach didn't finish the board");
    await ctx.close();
  });

  await step("an Allotment is 9x9, and its cells stay hittable on a phone", async () => {
    const { ctx, page } = await fresh({ width: 360, height: 780 });
    await page.goto(base);
    await ready(page);
    await page.locator('[data-size="allotment"]').click();
    await page.waitForFunction(() => window.__game.board().n === 9, null, { timeout: 15000 });
    const w = await page.locator("#plot .cell").first().evaluate((el) => el.getBoundingClientRect().width);
    if (w < 39.5) throw new Error(`cells are ${w}px, under the 40 a thumb needs`);
    // And the choice is remembered.
    await page.reload();
    await ready(page);
    if ((await page.evaluate(() => window.__game.size())) !== "allotment") throw new Error("size not remembered");
    await ctx.close();
  });

  await step("practice: the fixed board, then a proper one, and nothing counted", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base + "/learn");
    await ready(page);
    if (!(await page.evaluate(() => window.__game.learning()))) throw new Error("not in practice");
    if ((await page.evaluate(() => window.__game.board().n)) !== 5) throw new Error("practice should be 5x5");
    await page.locator("#coach").waitFor();
    if (await page.locator(".sizes").isVisible()) throw new Error("sizes shown in practice");
    await page.locator('[data-tool="plant"]').click();
    for (const cell of await answerCells(page)) await tapCell(page, cell);
    await page.getByText("Play a proper board", { exact: true }).waitFor({ timeout: 5000 });
    // Practice counts nothing.
    if ((await page.evaluate(() => window.__game.progress().done)) !== 0) throw new Error("practice was counted");
    await page.getByText("Play a proper board", { exact: true }).click();
    await page.waitForFunction(() => !window.__game.learning() && window.__game.board().n === 7, null, { timeout: 15000 });
    await ctx.close();
  });

  await step("the daily board: the same for everyone, a share line, and the streak", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base + "/daily");
    await ready(page);
    const info = await page.evaluate(() => ({ daily: window.__game.isDaily(), num: window.__game.board().num, day: window.__game.dayNumber(), n: window.__game.board().n }));
    if (!info.daily || info.num !== info.day || info.n !== 7) throw new Error("not today's 7x7: " + JSON.stringify(info));
    const tag = await page.locator(".tagline").innerText();
    if (!/the same one for everybody today/.test(tag)) throw new Error("the daily isn't named as today's: " + tag);
    await page.locator('[data-tool="plant"]').click();
    const cells = await answerCells(page);
    await tapCell(page, cells[0]);
    // A reload lands back on the same board, half-played.
    await page.reload();
    await ready(page);
    if ((await page.evaluate(() => window.__game.state().split("").filter((c) => c === "p").length)) !== 1) throw new Error("daily progress lost on reload");
    await page.locator('[data-tool="plant"]').click();
    for (const cell of cells.slice(1)) await tapCell(page, cell);
    await page.getByText("Room for everyone.").waitFor({ timeout: 5000 });
    const share = await page.locator("#share-text").innerText();
    if (!share.includes(`#${info.num}`) || !share.includes("no nudges") || /\d,\d/.test(share)) throw new Error("bad share line: " + share);
    // Spoiler-free: nothing in it says where a plant went.
    const streak = await page.evaluate(() => window.__game.streak());
    if (streak.last !== info.num || streak.streak < 1) throw new Error("streak not recorded: " + JSON.stringify(streak));
    // Finished stays finished, without counting twice.
    await page.reload();
    await ready(page);
    await page.getByText("Room for everyone.").waitFor({ timeout: 5000 });
    await ctx.close();
  });

  await step("the embed is the board and nothing else", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base + "/embed");
    await ready(page);
    if (await page.locator("h1").isVisible()) throw new Error("masthead shown in embed");
    if (await page.locator(".about").isVisible()) throw new Error("about block shown in embed");
    if (!(await page.locator("#credit").isVisible())) throw new Error("no credit line in embed");
    await ctx.close();
  });

  await step("playable by keyboard: arrows move, space taps, p switches to planting", async () => {
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    await page.locator('#plot .cell[data-cell="0"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("p");
    await page.keyboard.press("Space");
    const n = await page.evaluate(() => window.__game.board().n);
    const ch = await page.evaluate((cell) => window.__game.state()[cell], n + 1);
    if (ch !== "p") throw new Error(`expected a plant at row 2 column 2, got "${ch}"`);
    const label = await page.locator(`#plot .cell[data-cell="${n + 1}"]`).getAttribute("aria-label");
    if (!/^row 2, column 2, bed [A-I]/.test(label) || !/planted/.test(label)) throw new Error("screen reader label: " + label);
    await ctx.close();
  });

  await step("plants, markers, walls and the clash ring stand out from every bed, day and night", async () => {
    // 3:1 is the bar for graphics. Read from the live page, so the numbers are
    // what is actually drawn rather than what the stylesheet was meant to say.
    const { ctx, page } = await fresh();
    await page.goto(base);
    await ready(page);
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    let worst = { r: 99 };
    for (const mode of ["day", "night"]) {
      const isNight = await page.evaluate(() => document.body.classList.contains("night"));
      if ((mode === "night") !== isNight) await page.locator("#night").click();
      const c = await page.evaluate(() => {
        const css = getComputedStyle(document.body);
        const v = (name) => { const d = document.createElement("div"); d.style.color = css.getPropertyValue(name); document.body.appendChild(d); const out = getComputedStyle(d).color; d.remove(); return out; };
        const beds = [...new Set([...document.querySelectorAll("#plot .cell")].map((el) => getComputedStyle(el).backgroundColor))];
        return { beds, leaf: v("--plot-leaf"), soil: v("--plot-soil"), bad: v("--plot-bad"), wall: v("--plot-wall"), filter: getComputedStyle(document.querySelector("#plot .cell")).filter };
      });
      if (c.filter && c.filter !== "none") throw new Error(`the plot is filtered at ${mode}: ${c.filter}`);
      for (const bed of c.beds) {
        for (const [name, fg] of [["plant", c.leaf], ["marker", c.soil], ["clash ring", c.bad], ["wall", c.wall]]) {
          const r = ratio(fg, bed);
          if (r < worst.r) worst = { r, name, mode };
          if (r < 3) throw new Error(`${mode}: ${name} on ${bed} is ${r.toFixed(2)}:1`);
        }
      }
    }
    console.log(`  (worst: ${worst.name} at ${worst.mode}, ${worst.r.toFixed(2)}:1)`);
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
