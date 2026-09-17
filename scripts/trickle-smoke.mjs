/**
 * Trickle, steps 1–4 — core, persistence, practice, account sync.
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

let learn, learnCtx;
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
    const stored = await page.evaluate(() => localStorage.getItem("pp_trickle_board"));
    if (stored !== "") throw new Error(`a finished board is still saved: ${JSON.stringify(stored)}`);
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
        countLocal: m({ ...base, done: 9 }, { boards_finished: 3, stats: {} }).done,
        countRemote: m({ ...base, done: 3 }, { boards_finished: 9, stats: {} }).done,
        totals: m({ ...base, stats: { total_turns: 120, nudges: 2, best_turns: {} } },
                  { stats: { total_turns: 400, nudges: 9 } }).stats,
        // fewest turns: smaller wins
        bestLocal: m({ ...base, stats: { best_turns: { 6: 21 } } }, { stats: { best_turns: { 6: 44 } } })
          .stats.best_turns[6],
        bestRemote: m({ ...base, stats: { best_turns: { 6: 44 } } }, { stats: { best_turns: { 6: 21 } } })
          .stats.best_turns[6],
        // a size only one side knows about survives
        bySize: m({ ...base, bySize: { 4: 2 } }, { boards_by_size: { 8: 5 }, stats: {} }).bySize,
        // an untouched board never displaces a played one
        untouched: m({ ...base, board: { n: 6, moves: 0, saved_at: "2026-09-17T10:00:00Z" } },
                     { current_board: { n: 4, moves: 12, saved_at: "2026-09-01T10:00:00Z" }, stats: {} }).board,
        // between two played boards, the later one wins
        later: m({ ...base, board: { n: 6, moves: 3, saved_at: "2026-09-17T10:00:00Z" } },
                 { current_board: { n: 4, moves: 12, saved_at: "2026-09-01T10:00:00Z" }, stats: {} }).board,
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
    });
    await signed.route("**://*.supabase.co/rest/v1/game_progress**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify([{
            boards_finished: 11, boards_by_size: { 8: 4 }, current_board: null,
            stats: { total_turns: 900, nudges: 12, best_turns: { 6: 30, 8: 55 } },
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
    const line = await p2.textContent("#save");
    if (!/Saved to your account/.test(line)) throw new Error(`the save line reads "${line}"`);

    await p2.waitForFunction(() => true);
    if (!posted.length) throw new Error("the merge was never written back");
    const body = posted[posted.length - 1];
    if (body.boards_finished !== 11) throw new Error(`pushed boards_finished ${body.boards_finished}`);
    if (body.stats.best_turns["6"] !== 19) throw new Error("pushed the worse record");
    if (body.user_id !== "00000000-0000-4000-8000-00000000abcd") throw new Error("pushed the wrong user");
    await signed.close();
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
