/**
 * Trickle, steps 1–7 — core, persistence, practice, sync, sound, daily, embed.
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
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const PAGE = readFileSync("public/parlour-games/trickle.html", "utf8");
const HARNESS = readFileSync("public/parlour-games/harness.js", "utf8");
// The page is served at several paths (the game, practice, daily, embed) and
// the harness at exactly one, the absolute path the page asks for -- so this
// has to route rather than answer everything with the HTML. It did answer
// everything with the HTML, which is how the harness first arrived as a
// text/html 200 and took the board down with it.
const server = createServer((req, res) => {
  if (new URL(req.url, "http://x").pathname === "/parlour-games/harness.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end(HARNESS);
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(PAGE);
}).listen(4610);

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  // Headless Chromium will not start an AudioContext without this, and the
  // audio here cannot be judged by ear from a test run -- only measured.
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));

let learn, learnCtx, dailyPage, dailyCtx;

/** Solve whatever board a given page is showing. */
async function solveOn(pg) {
  const tiles = await pg.$$(".tile");
  for (const tile of tiles) {
    for (let guard = 0; guard < 5; guard++) {
      const before = await tile.$eval("svg", (s) => s.style.transform);
      if (/rotate\((-?\d+)deg\)/.test(before) && Number(/rotate\((-?\d+)deg\)/.exec(before)[1]) % 360 === 0) break;
      await tile.click();
      if ((await tile.$eval("svg", (s) => s.style.transform)) === before) break;
    }
  }
}
const dailyNumberNow = async () => {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:4610/?daily=1");
  await pg.waitForSelector(".tile");
  const n = await pg.evaluate(() => window.__game.dailyNumber());
  await ctx.close();
  return n;
};
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

  await step("a part-played board comes back after a reload", async () => {
    const tiles = await page.$$(".tile");
    for (const t of tiles.slice(0, 5)) await t.click();
    const before = {
      moves: await page.textContent("#moves"),
      rotations: await page.$$eval(".tile svg", (s) => s.map((x) => x.style.transform)),
    };
    if (before.moves === "0") throw new Error("nothing was played, so the test proves nothing");
    await page.reload();
    await page.waitForSelector(".tile");
    const after = {
      moves: await page.textContent("#moves"),
      rotations: await page.$$eval(".tile svg", (s) => s.map((x) => x.style.transform)),
    };
    if (after.moves !== before.moves) {
      throw new Error(`turns went ${before.moves} → ${after.moves} across a reload`);
    }
    if (after.rotations.join("|") !== before.rotations.join("|")) {
      throw new Error("the board came back in a different state");
    }
  });

  await step("solving every tile lights all 36 and shows the win", async () => {
    const total = await solve();
    await page.waitForSelector("#win:not([hidden])", { timeout: 10000 });
    const lit = await page.textContent("#lit");
    if (lit !== `${total} of ${total}`) throw new Error(`flowing says "${lit}"`);
    const line = await page.textContent("#win-line");
    if (!/^6×6 in \d+ turns?\.$/.test(line.trim())) throw new Error(`win line reads "${line}"`);
  });

  await step("finishing clears the board in play and counts it", async () => {
    // Asked of the harness rather than of the raw string, because how a
    // value is encoded on the way in is its business -- what matters is that
    // nothing is left to restore.
    const stored = await page.evaluate(() => window.Parlour.read("pp_trickle_board", null));
    if (stored) throw new Error(`a finished board is still saved: ${JSON.stringify(stored)}`);
    const done = await page.evaluate(() => Number(localStorage.getItem("pp_trickle_done")));
    if (done < 1) throw new Error(`boards finished reads ${done}`);
    const bySize = await page.evaluate(() => JSON.parse(localStorage.getItem("pp_trickle_by_size")));
    if (!bySize || bySize["6"] < 1) throw new Error(`by-size reads ${JSON.stringify(bySize)}`);
  });

  await step("the fewest turns at this size is kept and shown", async () => {
    const best = await page.evaluate(
      () => JSON.parse(localStorage.getItem("pp_trickle_stats")).best_turns["6"],
    );
    if (!(best > 0)) throw new Error(`best turns reads ${best}`);
    const records = await page.textContent("#records");
    if (!records.includes(`Best at 6×6 ${best}`)) throw new Error(`records line reads "${records}"`);
    // A slower board must not overwrite it.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("pp_trickle_stats"));
      s.best_turns["6"] = 1;
      localStorage.setItem("pp_trickle_stats", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".tile");
    await solve();
    await page.waitForSelector("#win:not([hidden])", { timeout: 10000 });
    const after = await page.evaluate(
      () => JSON.parse(localStorage.getItem("pp_trickle_stats")).best_turns["6"],
    );
    if (after !== 1) throw new Error(`a slower board replaced the record: ${after}`);
    const tally = await page.textContent("#win-tally");
    if (!/Your best at this size is 1\./.test(tally)) throw new Error(`tally reads "${tally}"`);
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

  await step("the size you last chose is the one you come back to", async () => {
    await page.click('[data-size="4"]');
    await page.reload();
    await page.waitForSelector(".tile");
    const count = await page.$$eval(".tile", (t) => t.length);
    if (count !== 16) throw new Error(`came back to ${count} tiles, expected 16`);
    const on = await page.$eval("[data-size].on", (b) => b.dataset.size);
    if (on !== "4") throw new Error(`the size picker highlights ${on}`);
  });

  await step("it still plays where localStorage throws", async () => {
    // A private window denies access rather than returning null, which is why
    // every call is wrapped. Nothing here should surface that to the player.
    const locked = await browser.newContext();
    await locked.addInitScript(() => {
      const boom = () => { throw new DOMException("denied", "SecurityError"); };
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => ({ getItem: boom, setItem: boom, removeItem: boom, clear: boom }),
      });
    });
    const shy = await locked.newPage();
    const broke = [];
    shy.on("pageerror", (e) => broke.push(e.message));
    await shy.goto("http://localhost:4610/");
    await shy.waitForSelector(".tile");
    const tiles = await shy.$$(".tile");
    for (const t of tiles.slice(0, 4)) await t.click();
    const moves = await shy.textContent("#moves");
    if (moves === "0") throw new Error("tiles would not turn without storage");
    if (broke.length) throw new Error(`storage errors reached the page: ${broke[0]}`);
    await locked.close();
  });

  await step("practice deals a fixed 3×3 with its own chrome", async () => {
    // A fresh context: practice must not inherit a size or a saved board.
    const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
    learn = await fresh.newPage();
    learnCtx = fresh;
    learn.on("pageerror", (e) => errors.push("learn pageerror: " + e.message));
    await learn.goto("http://localhost:4610/?learn=1");
    await learn.waitForSelector(".tile");
    const count = await learn.$$eval(".tile", (t) => t.length);
    if (count !== 9) throw new Error(`practice dealt ${count} tiles`);
    for (const sel of [".sizes", "#new", "#learn-link"]) {
      if ((await learn.getAttribute(sel, "hidden")) === null) throw new Error(`${sel} is still showing`);
    }
    if ((await learn.getAttribute("#coach", "hidden")) !== null) throw new Error("no coaching card");
    const hints = await learn.$$eval(".tile.hint", (t) => t.length);
    if (hints !== 1) throw new Error(`${hints} tiles are highlighted, expected 1`);
  });

  await step("the coaching reacts to what you tap", async () => {
    const intro = await learn.textContent("#coach-line");
    if (!/glowing/.test(intro)) throw new Error(`intro reads "${intro}"`);

    // A tile that is not the hinted one gets told so.
    const hinted = await learn.$eval(".tile.hint", (t) => Number(t.dataset.i));
    const other = await learn.$$eval(".tile", (t, h) =>
      t.map((x) => Number(x.dataset.i)).find((i) => i !== h), hinted);
    await learn.click(`.tile[data-i="${other}"]`);
    const wrong = await learn.textContent("#coach-line");
    if (!/can wait/.test(wrong)) throw new Error(`tapping elsewhere said "${wrong}"`);

    // The two-turn tile is the one that ever says "one more turn".
    const lines = new Set();
    for (let i = 0; i < 8; i++) {
      const hint = await learn.$(".tile.hint");
      if (!hint) break;
      await hint.click();
      lines.add((await learn.textContent("#coach-line")).trim());
    }
    if (![...lines].some((l) => /moved on/.test(l))) throw new Error("never said the water moved on");
    if (![...lines].some((l) => /one more turn/.test(l))) {
      throw new Error("the two-turn tile never asked for another turn");
    }
  });

  await step("practice finishes in six taps and counts towards nothing", async () => {
    const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await fresh.newPage();
    await p2.goto("http://localhost:4610/?learn=1");
    await p2.waitForSelector(".tile");
    let taps = 0;
    while (taps < 12) {
      const hint = await p2.$(".tile.hint");
      if (!hint) break;
      await hint.click();
      taps++;
      if (await p2.$("#win:not([hidden])")) break;
    }
    await p2.waitForSelector("#win:not([hidden])", { timeout: 5000 });
    if (taps !== 6) throw new Error(`practice took ${taps} taps, expected 6`);
    const done = await p2.evaluate(() => localStorage.getItem("pp_trickle_done"));
    if (done !== null) throw new Error(`practice moved the boards-finished count to ${done}`);
    const board = await p2.evaluate(() => localStorage.getItem("pp_trickle_board"));
    if (board !== null) throw new Error("practice saved a board in play");

    // And it hands off to a real board, with the URL back at the base.
    await p2.click("#again");
    await p2.waitForFunction(() => document.querySelectorAll(".tile").length === 36);
    if (new URL(p2.url()).search !== "") throw new Error(`the URL kept ${p2.url()}`);
    if ((await p2.getAttribute(".sizes", "hidden")) !== null) throw new Error("the size picker stayed hidden");
    if ((await p2.getAttribute("#coach", "hidden")) === null) throw new Error("the coaching card stayed");
    await fresh.close();
  });

  await learnCtx.close();

  await step("signed out, nothing is sent anywhere", async () => {
    const quiet = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const calls = [];
    await quiet.route("**://*.supabase.co/**", (route) => {
      calls.push(route.request().url());
      route.abort();
    });
    const p2 = await quiet.newPage();
    await p2.goto("http://localhost:4610/");
    await p2.waitForSelector(".tile");
    for (const t of (await p2.$$(".tile")).slice(0, 4)) await t.click();
    await p2.waitForTimeout(2200);   // past the 1.5s debounce
    if (calls.length) throw new Error(`${calls.length} requests while signed out: ${calls[0]}`);
    const line = await p2.textContent("#save");
    if (!/Sign in/.test(line)) throw new Error(`the save line reads "${line}"`);
    await quiet.close();
  });

  await step("merging keeps the better half of every pair", async () => {
    const cases = await page.evaluate(() => {
      const m = window.__game.mergeProgress;
      const base = { done: 0, bySize: {}, stats: { total_turns: 0, nudges: 0, best_turns: {} }, board: null };
      return {
        // counts and totals: larger wins, whichever side holds it
        countLocal: m({ ...base, done: 9 }, { ...base, done: 3 }).done,
        countRemote: m({ ...base, done: 3 }, { ...base, done: 9 }).done,
        totals: m({ ...base, stats: { total_turns: 120, nudges: 2, best_turns: {} } },
                  { stats: { total_turns: 400, nudges: 9 } }).stats,
        // fewest turns: smaller wins
        bestLocal: m({ ...base, stats: { best_turns: { 6: 21 } } }, { stats: { best_turns: { 6: 44 } } })
          .stats.best_turns[6],
        bestRemote: m({ ...base, stats: { best_turns: { 6: 44 } } }, { stats: { best_turns: { 6: 21 } } })
          .stats.best_turns[6],
        // a size only one side knows about survives
        bySize: m({ ...base, bySize: { 4: 2 } }, { ...base, bySize: { 8: 5 } }).bySize,
        // an untouched board never displaces a played one
        untouched: m({ ...base, board: { n: 6, moves: 0, saved_at: "2026-09-17T10:00:00Z" } },
                     { ...base, board: { n: 4, moves: 12, saved_at: "2026-09-01T10:00:00Z" } }).board,
        // between two played boards, the later one wins
        later: m({ ...base, board: { n: 6, moves: 3, saved_at: "2026-09-17T10:00:00Z" } },
                 { ...base, board: { n: 4, moves: 12, saved_at: "2026-09-01T10:00:00Z" } }).board,
        // fewest turns on the daily board: smaller wins, like the per-size best
        dailyBest: m({ ...base, stats: { ...base.stats, daily_best: 14 } },
                     { ...base, stats: { ...base.stats, daily_best: 9 } }).stats.daily_best,
        // nothing on the account at all leaves local untouched
        noRemote: m({ ...base, done: 7 }, null).done,
      };
    });
    const want = (label, got, expected) => {
      if (JSON.stringify(got) !== JSON.stringify(expected)) {
        throw new Error(`${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
      }
    };
    want("larger count (local)", cases.countLocal, 9);
    want("larger count (remote)", cases.countRemote, 9);
    want("totals take the max", { t: cases.totals.total_turns, n: cases.totals.nudges }, { t: 400, n: 9 });
    want("fewest turns (local better)", cases.bestLocal, 21);
    want("fewest turns (remote better)", cases.bestRemote, 21);
    want("per-size counts union", cases.bySize, { 4: 2, 8: 5 });
    want("fewest turns on the daily board", cases.dailyBest, 9);
    want("played board beats untouched", cases.untouched.n, 4);
    want("later played board wins", cases.later.n, 6);
    want("no account row", cases.noRemote, 7);
  });

  await step("signed in, the account is read and the merge is written back", async () => {
    const signed = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const posted = [];
    await signed.addInitScript(() => {
      localStorage.setItem("sb-ixagjvntbgyqemxxinqe-auth-token", JSON.stringify({
        access_token: "test-token",
        refresh_token: "test-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "00000000-0000-4000-8000-00000000abcd" },
      }));
      // Something worth merging: fewer boards here, a better record here.
      localStorage.setItem("pp_trickle_done", "2");
      localStorage.setItem("pp_trickle_stats", JSON.stringify({
        total_turns: 50, nudges: 1, best_turns: { 6: 19 }, last_played: "2026-09-16T00:00:00Z",
      }));
      // A run going on this device that the account has never heard of. It
      // has to survive the pull: the version of this that lived inside the
      // game rebuilt the stats object field by field and dropped the streak
      // every time, which reset a signed-in keeper to day one daily.
      localStorage.setItem("pp_streak", JSON.stringify({ last: 40, streak: 6, longest: 6, played: 6 }));
    });
    await signed.route("**://*.supabase.co/rest/v1/game_progress**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify([{
            game: "trickle",
            progress: {
              done: 11, bySize: { 8: 4 }, board: null,
              stats: { total_turns: 900, nudges: 12, best_turns: { 6: 30, 8: 55 } },
            },
          }]),
        });
      }
      posted.push(JSON.parse(route.request().postData() || "{}"));
      return route.fulfill({ status: 201, body: "" });
    });
    const p2 = await signed.newPage();
    await p2.goto("http://localhost:4610/");
    await p2.waitForSelector(".tile");
    await p2.waitForFunction(() => Number(localStorage.getItem("pp_trickle_done")) === 11, { timeout: 5000 });

    const best = await p2.evaluate(
      () => JSON.parse(localStorage.getItem("pp_trickle_stats")).best_turns,
    );
    if (best["6"] !== 19) throw new Error(`the better record was lost: ${JSON.stringify(best)}`);
    if (best["8"] !== 55) throw new Error(`a record only the account had was dropped`);
    const kept = await p2.evaluate(() => window.__game.streak());
    if (kept.streak !== 6) throw new Error(`the pull reset the streak to ${kept.streak}`);
    const line = await p2.textContent("#save");
    if (!/Saved to your account/.test(line)) throw new Error(`the save line reads "${line}"`);

    await p2.waitForFunction(() => true);
    if (!posted.length) throw new Error("the merge was never written back");
    const rows = posted[posted.length - 1];
    if (!Array.isArray(rows)) throw new Error("the push is one row per game, so it sends an array");
    const mine = rows.find((r) => r.game === "trickle");
    const arcade = rows.find((r) => r.game === "parlour");
    if (!mine) throw new Error(`no trickle row in ${JSON.stringify(rows.map((r) => r.game))}`);
    if (mine.progress.done !== 11) throw new Error(`pushed done ${mine.progress.done}`);
    if (mine.progress.stats.best_turns["6"] !== 19) throw new Error("pushed the worse record");
    if (mine.user_id !== "00000000-0000-4000-8000-00000000abcd") throw new Error("pushed the wrong user");
    if (!arcade || arcade.progress.streak !== 6) throw new Error("the streak was not written back");
    await signed.close();
  });

  await step("the streak is the arcade's, and one game cannot spend it", async () => {
    // Two things at once: a streak the account holds and this device does
    // not is taken up, and the game's own row coming back empty does not
    // take the streak down with it.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => {
      localStorage.setItem("sb-ixagjvntbgyqemxxinqe-auth-token", JSON.stringify({
        access_token: "test-token", refresh_token: "test-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "00000000-0000-4000-8000-00000000abcd" },
      }));
    });
    await ctx.route("**://*.supabase.co/rest/v1/game_progress**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify([{ game: "parlour", progress: { last: 12, streak: 4, longest: 7, played: 30 } }]),
        });
      }
      return route.fulfill({ status: 201, body: "" });
    });
    const pg = await ctx.newPage();
    await pg.goto("http://localhost:4610/");
    await pg.waitForSelector(".tile");
    await pg.waitForFunction(() => window.__game.streak().streak === 4, { timeout: 5000 });
    const got = await pg.evaluate(() => window.__game.streak());
    if (got.longest !== 7) throw new Error(`the longest run was lost: ${JSON.stringify(got)}`);
    // The GET named both rows in one request rather than one request each.
    const asked = await pg.evaluate(() => performance.getEntriesByType("resource")
      .map((e) => e.name).filter((n) => /game_progress/.test(n)));
    if (!asked.some((n) => /game=in\./.test(n))) {
      throw new Error(`the pull did not ask for both rows at once: ${asked.join(", ")}`);
    }
    await ctx.close();
  });

  await step("night flips the palette and the theme colour", async () => {
    const before = await page.evaluate(() => ({
      night: document.body.classList.contains("night"),
      theme: document.querySelector('meta[name="theme-color"]').content,
      ink: getComputedStyle(document.body).backgroundColor,
    }));
    await page.click("#night");
    // The page colour is transitioned over 0.8s, so sampling it straight away
    // reads the old value and the assertion passes or fails on timing alone.
    await page.waitForFunction(
      (was) => getComputedStyle(document.body).backgroundColor !== was,
      before.ink,
      { timeout: 3000 },
    );
    const after = await page.evaluate(() => ({
      night: document.body.classList.contains("night"),
      theme: document.querySelector('meta[name="theme-color"]').content,
      ink: getComputedStyle(document.body).backgroundColor,
      pressed: document.getElementById("night").getAttribute("aria-pressed"),
    }));
    if (after.night === before.night) throw new Error("night did not change");
    if (after.theme === before.theme) throw new Error(`theme-color stayed ${after.theme}`);
    if (after.ink === before.ink) throw new Error("the page colour did not move");
    if (after.pressed !== String(after.night)) throw new Error("aria-pressed disagrees with the state");
    // And it is remembered rather than re-read from the clock.
    const stored = await page.evaluate(() => localStorage.getItem("pp_trickle_night"));
    if (stored !== String(after.night)) throw new Error(`night stored as ${stored}`);
  });

  await step("the music is audible, calm, and nowhere near clipping", async () => {
    const audio = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await audio.addInitScript(() => localStorage.setItem("pp_trickle_music", "true"));
    const p2 = await audio.newPage();
    await p2.goto("http://localhost:4610/");
    await p2.waitForSelector(".tile");

    // A remembered preference waits for a gesture: nothing plays until a tap.
    if (await p2.evaluate(() => window.__game.musicPlaying())) {
      throw new Error("music started with no gesture, which a browser would have blocked anyway");
    }
    await (await p2.$(".tile")).click();
    await p2.waitForFunction(() => window.__game.musicPlaying(), { timeout: 5000 });

    await p2.waitForTimeout(3000);                    // past the 2.5s fade-in
    const readings = await p2.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 40; i++) {
        out.push(window.__game.levels());
        await new Promise((r) => setTimeout(r, 25));
      }
      return out;
    });
    const usable = readings.filter(Boolean);
    if (usable.length < 20) throw new Error("no analyser readings; the audio graph never ran");
    const peak = Math.max(...usable.map((r) => r.peak));
    const rms = usable.reduce((a, r) => a + r.rms, 0) / usable.length;
    console.log(`  (peak ${peak.toFixed(3)}, mean RMS ${rms.toFixed(3)})`);
    // The spec's reference measures peak 0.30 and mean RMS 0.06. The band is
    // wide enough for the 8% random sparkle to move it between runs and tight
    // enough to catch a mix that has drifted inaudible or loud.
    if (peak === 0) throw new Error("silence: the music is not reaching the bus");
    if (peak >= 0.8) throw new Error(`peak ${peak.toFixed(3)} is close to clipping`);
    if (peak < 0.08) throw new Error(`peak ${peak.toFixed(3)} is far below the reference 0.30`);
    if (rms < 0.02) throw new Error(`mean RMS ${rms.toFixed(4)} is too quiet to hear`);
    if (rms > 0.12) throw new Error(`mean RMS ${rms.toFixed(3)} is louder than a background should be`);

    // Turning it off stops scheduling anything further.
    await p2.click("#music");
    if (await p2.evaluate(() => window.__game.musicPlaying())) throw new Error("music kept scheduling");
    await p2.waitForTimeout(1600);                    // past the 1.2s fade-out
    const after = await p2.evaluate(() => window.__game.levels());
    if (after.rms > 0.01) throw new Error(`still playing after the fade: RMS ${after.rms.toFixed(3)}`);
    await audio.close();
  });

  await step("a tab nobody is looking at goes quiet", async () => {
    const audio = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await audio.addInitScript(() => {
      localStorage.setItem("pp_trickle_music", "true");
      // document.hidden is read-only, so it is made settable for the test.
      let hidden = false;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
      window.__setHidden = (v) => { hidden = v; document.dispatchEvent(new Event("visibilitychange")); };
    });
    const p2 = await audio.newPage();
    await p2.goto("http://localhost:4610/");
    await p2.waitForSelector(".tile");
    await (await p2.$(".tile")).click();
    await p2.waitForFunction(() => window.__game.musicPlaying(), { timeout: 5000 });

    await p2.evaluate(() => window.__setHidden(true));
    if (await p2.evaluate(() => window.__game.musicPlaying())) {
      throw new Error("the schedule kept running with the tab hidden");
    }
    await p2.evaluate(() => window.__setHidden(false));
    await p2.waitForFunction(() => window.__game.musicPlaying(), { timeout: 3000 });
    await audio.close();
  });

  await step("two devices deal the same board on the same day", async () => {
    const one = await browser.newContext();
    const two = await browser.newContext();
    const [a, b] = [await one.newPage(), await two.newPage()];
    for (const pg of [a, b]) {
      await pg.goto("http://localhost:4610/?daily=1");
      await pg.waitForSelector(".tile");
    }
    const boardOf = (pg) => pg.evaluate(() => {
      const g = window.__game;
      return { num: g.state.num, masks: g.state.masks.join(","), turns: g.state.turns.join(",") };
    });
    const [ba, bb] = [await boardOf(a), await boardOf(b)];
    if (ba.masks !== bb.masks || ba.turns !== bb.turns) {
      throw new Error("two contexts were dealt different boards on the same day");
    }
    // And the next day's is a different board.
    const next = await a.evaluate((n) => {
      const d = window.__game.dailyBoard(n + 1);
      return { masks: d.masks.join(","), turns: d.turns.join(",") };
    }, ba.num);
    if (next.masks === ba.masks && next.turns === ba.turns) {
      throw new Error("tomorrow deals the same board as today");
    }
    // Every board it can deal is actually solvable and actually scrambled.
    const sane = await a.evaluate(() => {
      const out = [];
      for (let n = 1; n <= 60; n++) {
        const d = window.__game.dailyBoard(n);
        out.push(d && d.par > 0 && d.masks.length === 36 ? null : n);
      }
      return out.filter((v) => v !== null);
    });
    if (sane.length) throw new Error(`board numbers dealt badly: ${sane.join(", ")}`);
    await one.close(); await two.close();
  });

  await step("the daily board hides what it should and names itself", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    dailyPage = await ctx.newPage();
    dailyCtx = ctx;
    await dailyPage.goto("http://localhost:4610/?daily=1");
    await dailyPage.waitForSelector(".tile");
    for (const sel of [".sizes", "#new", "#daily-link"]) {
      if ((await dailyPage.getAttribute(sel, "hidden")) === null) throw new Error(`${sel} is still showing`);
    }
    const tagline = await dailyPage.textContent(".tagline");
    if (!/Board #\d+ — the same one for everybody today\./.test(tagline)) {
      throw new Error(`the tagline reads "${tagline}"`);
    }
  });

  await step("finishing shows par and a countdown, and does not double count", async () => {
    await solveOn(dailyPage);
    await dailyPage.waitForSelector("#win:not([hidden])", { timeout: 15000 });
    const line = await dailyPage.textContent("#win-line");
    if (!/Board #\d+ in \d+ turns? · fewest possible was \d+\./.test(line)) {
      throw new Error(`the win line reads "${line}"`);
    }
    const tally = await dailyPage.textContent("#win-tally");
    if (!/A new board in /.test(tally)) throw new Error(`no countdown: "${tally}"`);

    const after = await dailyPage.evaluate(() => window.__game.streak());
    if (after.played !== 1 || after.streak !== 1) {
      throw new Error(`first finish recorded ${JSON.stringify(after)}`);
    }
    // A reload lands on the finished board and must not count it again.
    await dailyPage.reload();
    await dailyPage.waitForSelector("#win:not([hidden])", { timeout: 10000 });
    const again = await dailyPage.evaluate(() => window.__game.streak());
    if (again.played !== 1 || again.streak !== 1) {
      throw new Error(`a reload counted it again: ${JSON.stringify(again)}`);
    }
    await dailyCtx.close();
  });

  await step("a streak runs on consecutive days and resets after a gap", async () => {
    const run = async (seed) => {
      const ctx = await browser.newContext();
      await ctx.addInitScript((s) => {
        if (s.streak) localStorage.setItem("pp_streak", JSON.stringify(s.streak));
        if (s.legacy) {
          localStorage.setItem("pp_trickle_stats", JSON.stringify({
            total_turns: 0, nudges: 0, best_turns: {}, last_played: null, daily: s.legacy,
          }));
        }
      }, seed);
      const pg = await ctx.newPage();
      await pg.goto("http://localhost:4610/?daily=1");
      await pg.waitForSelector(".tile");
      await solveOn(pg);
      await pg.waitForSelector("#win:not([hidden])", { timeout: 15000 });
      const out = await pg.evaluate(() => window.__game.streak());
      const stats = await pg.evaluate(() => JSON.parse(localStorage.getItem("pp_trickle_stats")));
      await ctx.close();
      return { out, stats };
    };
    const today = await dailyNumberNow();
    const carried = await run({ streak: { last: today - 1, streak: 1, longest: 1, played: 1 } });
    if (carried.out.streak !== 2) throw new Error(`yesterday then today gave streak ${carried.out.streak}`);
    const broken = await run({ streak: { last: today - 3, streak: 9, longest: 9, played: 9 } });
    if (broken.out.streak !== 1) throw new Error(`a three-day gap kept streak ${broken.out.streak}`);
    if (broken.out.longest !== 9) throw new Error(`a broken run forgot its longest: ${broken.out.longest}`);

    // Anybody mid-run when this shipped had their streak inside the game's
    // own stats. It has to be carried across, not dropped on the floor.
    const lifted = await run({ legacy: { last: today - 1, streak: 5, best: 31, played: 5 } });
    if (lifted.out.streak !== 6) throw new Error(`an old run did not carry over: ${lifted.out.streak}`);
    if (lifted.stats.daily) throw new Error("the old streak is still being kept in two places");
    if (lifted.stats.daily_best !== 31) throw new Error(`the old daily best was lost: ${lifted.stats.daily_best}`);
  });

  await step("embedded, it loses its chrome and keeps its game", async () => {
    const ctx = await browser.newContext({ viewport: { width: 560, height: 900 } });
    const host = await ctx.newPage();
    // A page that frames it, the way somebody else's site would.
    await host.setContent(`<!doctype html><title>Host</title>
      <p>Someone else's page.</p>
      <iframe src="http://localhost:4610/?embed=1" width="100%" height="700"
              style="border:0" title="Trickle"></iframe>`);
    const frame = host.frameLocator("iframe");
    await frame.locator(".tile").first().waitFor({ timeout: 10000 });

    // Evaluated inside the frame: the host page is a different origin, so
    // reaching in through contentDocument gets null.
    const inner = host.frames().find((f) => f.url().includes("embed=1"));
    if (!inner) throw new Error("the iframe never loaded");
    const hidden = await inner.evaluate(() => {
      const gone = (sel) => {
        const el = document.querySelector(sel);
        return !el || getComputedStyle(el).display === "none" || el.hidden;
      };
      return {
        masthead: gone("h1"),
        tagline: gone(".tagline"),
        nav: gone(".hub"),
        save: gone(".save"),
        credit: !document.getElementById("credit").hidden,
        targets: [...document.querySelectorAll("a")].every((a) => a.target === "_blank"),
      };
    });
    for (const [what, ok] of Object.entries(hidden)) {
      if (!ok) throw new Error(`embed: ${what} is wrong`);
    }

    // And it is still a game, not a picture of one.
    const before = await frame.locator("#moves").textContent();
    await frame.locator(".tile").nth(3).click();
    const after = await frame.locator("#moves").textContent();
    if (after === before) throw new Error("the framed board does not respond to a tap");
    await ctx.close();
  });

  await step("only the embed route is allowed to be framed", async () => {
    // The header lives in vercel.json, which the local server does not run,
    // so this asserts the config rather than a live response. The live check
    // happens against the deploy.
    const config = JSON.parse(await readFile("vercel.json", "utf8"));
    const embed = config.headers.find((h) => h.source === "/parlour-games/trickle/embed");
    if (!embed) throw new Error("no header rule for the embed route");
    const csp = embed.headers.find((h) => h.key === "Content-Security-Policy");
    if (!csp || !/frame-ancestors \*/.test(csp.value)) {
      throw new Error(`the embed route's CSP reads ${JSON.stringify(csp && csp.value)}`);
    }
    const app = config.headers[0];
    const appCsp = app.headers.find((h) => h.key === "Content-Security-Policy");
    if (!appCsp || !/frame-ancestors 'none'/.test(appCsp.value)) {
      throw new Error("the app's own routes are still framable");
    }
    // The app block must exclude the embed route, or both rules fight over it.
    if (!app.source.includes("parlour-games/trickle/embed$")) {
      throw new Error("the embed route is not excluded from the app's header rule");
    }
    const rewrite = config.rewrites.find((r) => r.source === "/parlour-games/trickle/embed");
    if (!rewrite) throw new Error("no rewrite for the embed route");
    const catchAll = config.rewrites.findIndex((r) => r.source === "/(.*)");
    if (config.rewrites.indexOf(rewrite) > catchAll) {
      throw new Error("the embed rewrite sits after the catch-all, so it never runs");
    }
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
