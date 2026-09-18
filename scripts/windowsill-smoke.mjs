/**
 * Windowsill, step 1 — the shelf, the rules and placing.
 *
 * Drives the real page in Chromium. The point of most of it is that the
 * picture and the rules agree: the light a cell shows, the height a plant is
 * drawn at, and the model's own answer all have to be the same thing, since
 * the game is unplayable if a player cannot see why a plant is unhappy.
 *
 *   node scripts/windowsill-smoke.mjs
 *
 * CHROME=/path/to/chrome overrides the browser.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const FILES = {
  "/parlour-games/windowsill-rules.js": readFileSync("public/parlour-games/windowsill-rules.js", "utf8"),
  "/parlour-games/harness.js": readFileSync("public/parlour-games/harness.js", "utf8"),
};
const PAGE = readFileSync("public/parlour-games/windowsill.html", "utf8");
// Trickle is served here too, at its own paths, so the one claim that spans
// both games -- a single streak -- can actually be played rather than argued.
const TRICKLE = readFileSync("public/parlour-games/trickle.html", "utf8");
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
  if (/^\/parlour-games\/?$/.test(path)) { res.end(HUB); return; }
  res.end(/^\/parlour-games\/trickle(\/|$)/.test(path) ? TRICKLE : PAGE);
}).listen(4611);

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

const step = async (name, fn) => { await fn(); console.log("✓", name); };
const cell = (r, t) => page.locator(`.cell[data-run="${r}"][data-tier="${t}"]`);
const chipFor = async (need, height) => {
  const id = await page.evaluate(([n, h]) => {
    const t = window.__game.tray().find((p) => p.need === n && p.height === h);
    return t ? t.id : null;
  }, [need, height]);
  if (id === null) throw new Error(`no ${need}/${height} left in the tray`);
  return page.locator(`.chip[data-plant="${id}"]`);
};
/** Put a specific plant into a specific place. */
const place = async (need, height, r, t) => {
  await (await chipFor(need, height)).click();
  await cell(r, t).click();
};
/** Deal until the tray holds the plant a test needs, then take it. */
const boardWith = async (...wanted) => {
  for (let i = 0; i < 80; i++) {
    const has = await page.evaluate((w) => w.every(([n, h]) =>
      window.__game.tray().filter((p) => p.need === n && p.height === h).length >=
      w.filter(([n2, h2]) => n2 === n && h2 === h).length), wanted);
    if (has) return;
    await page.click("#new");
  }
  throw new Error(`no board in 80 deals held ${JSON.stringify(wanted)}`);
};

try {
  await page.goto("http://localhost:4611/");
  await page.waitForSelector(".cell");

  await step("the page is Windowsill and points back at the hub", async () => {
    if ((await page.title()) !== "Windowsill — a calm light puzzle") {
      throw new Error(`the title reads "${await page.title()}"`);
    }
    const href = await page.getAttribute('.hub a', "href");
    if (href !== "/parlour-games") throw new Error(`the hub link points at ${href}`);
  });

  await step("a board deals exactly as many plants as there are places", async () => {
    // Standard is the shelf it opens on, and it is meant to be packed: a gap
    // would let everything else slide about behind it.
    const counts = await page.evaluate(() => ({
      cells: document.querySelectorAll(".cell").length,
      chips: document.querySelectorAll(".chip").length,
      w: window.__game.board().w,
      d: window.__game.board().d,
    }));
    if (counts.cells !== counts.w * counts.d) throw new Error(`${counts.cells} cells for a ${counts.w}×${counts.d} shelf`);
    if (counts.chips !== counts.cells) throw new Error(`${counts.chips} plants for ${counts.cells} places`);
    if (await page.evaluate(() => window.__game.solved())) throw new Error("an empty shelf counted as solved");
  });

  await step("every board it deals can be solved, and is the difficulty asked for", async () => {
    const report = await page.evaluate(() => {
      const R = window.WindowsillRules, P = window.Parlour;
      const out = [];
      R.SHELVES.forEach((shelf) => {
        let worst = 0, min = Infinity, max = 0;
        for (let seed = 1; seed <= 120; seed++) {
          const b = R.deal(shelf, P.mulberry32(seed * 7919));
          if (b.tray.length !== shelf.w * shelf.d) return out.push({ shelf: shelf.key, bad: "short tray" });
          if (b.missed) return out.push({ shelf: shelf.key, bad: "missed the band" });
          if (b.ways < shelf.band[0] || b.ways > shelf.band[1]) return out.push({ shelf: shelf.key, bad: `ways ${b.ways}` });
          if (!R.solutions(b.w, b.d, b.tray, 1).length) return out.push({ shelf: shelf.key, bad: "unsolvable" });
          worst = Math.max(worst, b.tries); min = Math.min(min, b.ways); max = Math.max(max, b.ways);
        }
        out.push({ shelf: shelf.key, worstTries: worst, ways: [min, max] });
      });
      return out;
    });
    const broken = report.filter((r) => r.bad);
    if (broken.length) throw new Error(JSON.stringify(broken));
    report.forEach((r) => console.log(`  (${r.shelf}: ${r.ways[0]}–${r.ways[1]} ways out, at worst ${r.worstTries} deals)`));
  });

  await step("dealing a board is quick enough not to be felt", async () => {
    const ms = await page.evaluate(() => {
      const R = window.WindowsillRules, P = window.Parlour;
      const deep = R.SHELVES[R.SHELVES.length - 1];
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) R.deal(deep, P.mulberry32(i + 500));
      return (performance.now() - t0) / 40;
    });
    console.log(`  (${ms.toFixed(1)}ms to deal the largest shelf, counted and filtered)`);
    if (ms > 50) throw new Error(`dealing takes ${ms.toFixed(0)}ms, which a player would see`);
  });

  await step("the three shelves are different sizes and are remembered", async () => {
    const sizes = {};
    for (const key of ["gentle", "standard", "deep"]) {
      await page.click(`[data-shelf="${key}"]`);
      sizes[key] = await page.locator(".cell").count();
    }
    if (!(sizes.gentle < sizes.standard && sizes.standard < sizes.deep)) {
      throw new Error(`the shelves are ${JSON.stringify(sizes)}`);
    }
    await page.click('[data-shelf="gentle"]');
    await page.reload();
    await page.waitForSelector(".cell");
    const back = await page.evaluate(() => window.__game.shelfKind().key);
    if (back !== "gentle") throw new Error(`it came back on ${back}`);
    await page.click('[data-shelf="standard"]');
  });

  await step("a new board is a different board", async () => {
    const trays = new Set();
    for (let i = 0; i < 6; i++) {
      trays.add(await page.evaluate(() => JSON.stringify(window.__game.board().tray)));
      await page.click("#new");
    }
    if (trays.size < 5) throw new Error(`six deals produced ${trays.size} different boards`);
  });

  await step("an empty shelf is in full sun all the way back", async () => {
    const lights = await page.evaluate(() => window.__game.lights());
    if (!lights.every((run) => run.every((l) => l === 3))) {
      throw new Error(`empty shelf lights ${JSON.stringify(lights)}`);
    }
  });

  await step("the pips on screen say what the model says", async () => {
    await boardWith([3, 3]);
    await place(3, 3, 0, 0);            // a tall sun-lover at the glass
    const shown = await cell(0, 1).locator(".pips").evaluate(
      (el) => (el.innerHTML.match(/●/g) || []).length - (el.querySelectorAll("b").length),
    );
    const model = (await page.evaluate(() => window.__game.lights()))[0][1];
    if (shown !== model) throw new Error(`the cell shows ${shown} pips, the model says ${model}`);
    if (model !== 2) throw new Error(`a tall plant at the glass left light ${model} behind it`);
  });

  await step("a low plant at the glass shades nothing behind it", async () => {
    await boardWith([3, 1]);
    await page.click("#clear");
    await place(3, 1, 0, 0);
    const lights = (await page.evaluate(() => window.__game.lights()))[0];
    if (lights[1] !== 3 || lights[2] !== 3) {
      throw new Error(`a low plant at the glass left ${JSON.stringify(lights)}`);
    }
  });

  await step("a mid plant shades the tier behind it but not the one behind that", async () => {
    await boardWith([3, 2]);
    await page.click("#clear");
    await place(3, 2, 0, 0);
    const lights = (await page.evaluate(() => window.__game.lights()))[0];
    if (JSON.stringify(lights) !== JSON.stringify([3, 2, 3])) {
      throw new Error(`a mid plant at the glass left ${JSON.stringify(lights)}`);
    }
  });

  await step("the drawing agrees with the rule about what overtops what", async () => {
    // The picture has to be readable as the reason: a plant's head against
    // the next tier's floor is exactly what the model measures.
    const geometry = await page.evaluate(() => {
      const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
      return {
        // The plant's own ink, not its box: what a player compares against
        // the step behind it is where the leaves actually end.
        midHead: box('.cell[data-run="0"][data-tier="0"] .foliage').top,
        tier1Floor: box('.cell[data-run="0"][data-tier="1"] .plinth').top,
        tier2Floor: box('.cell[data-run="0"][data-tier="2"] .plinth').top,
      };
    });
    // Screen y grows downward, so "higher" is a smaller number.
    if (!(geometry.midHead < geometry.tier1Floor)) {
      throw new Error("the mid plant is drawn below the tier it shades");
    }
    if (!(geometry.midHead >= geometry.tier2Floor - 1)) {
      throw new Error("the mid plant is drawn above a tier it does not shade");
    }
  });

  await step("too much light scorches and too little goes leggy, in words", async () => {
    await boardWith([1, 3]);
    await page.click("#clear");
    await place(1, 3, 0, 0);            // a shade plant, straight into full sun
    if (!/scorching/.test(await cell(0, 0).locator(".verdict").textContent())) {
      throw new Error("a shade plant in full sun was not called scorching");
    }
    if (!/✗/.test(await cell(0, 0).locator(".want").textContent())) {
      throw new Error("an unhappy plant is not marked as unhappy next to what it wants");
    }
    await boardWith([3, 1], [3, 1], [3, 3]);
    await page.click("#clear");
    await place(3, 1, 0, 0);
    await place(3, 3, 1, 0);
    await place(3, 1, 1, 1);            // behind a tall one: light 2, wants 3
    const verdict = await cell(1, 1).locator(".verdict").textContent();
    if (!/leggy/.test(verdict)) throw new Error(`a starved plant reads "${verdict}"`);
  });

  await step("picking up and putting down never loses a plant", async () => {
    await boardWith([3, 1]);
    await page.click("#clear");
    await place(3, 1, 0, 0);
    // Pick it off the shelf and drop it somewhere else.
    await cell(0, 0).click();
    await cell(2, 0).click();
    const counts = await page.evaluate(() => {
      const onShelf = window.__game.shelf().flat().filter(Boolean).length;
      const b = window.__game.board();
      return { onShelf, inTray: window.__game.tray().length, all: b.w * b.d };
    });
    if (counts.onShelf + counts.inTray !== counts.all) {
      throw new Error(`${counts.onShelf} on the shelf and ${counts.inTray} in the tray`);
    }
    if (counts.onShelf !== 1) throw new Error(`moving it left ${counts.onShelf} on the shelf`);
  });

  await step("dropping one onto another swaps them", async () => {
    await boardWith([3, 1], [3, 2]);
    await page.click("#clear");
    await place(3, 1, 0, 0);
    await place(3, 2, 1, 0);
    await cell(0, 0).click();           // pick up the low one
    await cell(1, 0).click();           // drop it on the mid one
    const state = await page.evaluate(() => ({
      a: window.__game.shelf()[0][0],
      b: window.__game.shelf()[1][0],
      tray: window.__game.tray().length,
    }));
    if (state.b.height !== 1) throw new Error("the plant that was dropped did not land");
    if (!state.a || state.a.height !== 2) throw new Error("the one it displaced did not take its place");
    const expect = await page.evaluate(() => window.__game.board().w * window.__game.board().d - 2);
    if (state.tray !== expect) throw new Error(`the swap left ${state.tray} in the tray, not ${expect}`);
  });

  await step("a plant put back in the tray comes back", async () => {
    await boardWith([3, 1]);
    await page.click("#clear");
    await place(3, 1, 0, 0);
    await cell(0, 0).click();           // pick it up off the shelf
    await page.locator(".chip").first().click();   // tap the tray to put it back
    const n = await page.evaluate(() => window.__game.tray().length);
    const all = await page.evaluate(() => window.__game.board().w * window.__game.board().d);
    if (n !== all) throw new Error(`the tray holds ${n} of ${all} after putting one back`);
  });

  await step("solving it is recognised, and counts against par", async () => {
    await page.click("#clear");
    const solution = (await page.evaluate(() => window.__game.solutions()))[0];
    if (!solution) throw new Error("the board has no solution at all");
    for (let r = 0; r < solution.length; r++) {
      for (let t = 0; t < solution[r].length; t++) {
        await place(solution[r][t].need, solution[r][t].height, r, t);
      }
    }
    await page.waitForSelector("#win:not([hidden])", { timeout: 5000 });
    const all = await page.evaluate(() => window.__game.board().w * window.__game.board().d);
    const placements = await page.evaluate(() => window.__game.placements());
    if (placements !== all) throw new Error(`a straight-through solve took ${placements} of ${all} placements`);
    const line = await page.textContent("#win-line");
    if (!/never moved one twice/.test(line)) throw new Error(`par was not recognised: "${line}"`);
    // Counted off what a player can actually see, not off a class name.
    const ticks = await page.evaluate(() => Array.from(document.querySelectorAll(".want"))
      .filter((el) => el.textContent.trim().startsWith("✓")).length);
    if (ticks !== all) throw new Error(`${ticks} of ${all} plants show a tick`);
    const complaints = await page.evaluate(() => Array.from(document.querySelectorAll(".verdict"))
      .filter((el) => el.textContent.trim()).length);
    if (complaints !== 0) throw new Error(`${complaints} plants still complaining on a solved board`);
  });

  await step("a full shelf with one plant misplaced is not solved", async () => {
    await page.click("#clear");
    // A board has several ways out, so swapping any two plants can land on
    // another perfectly good one. Ask the model for a swap that genuinely
    // breaks it, and lay the broken arrangement out directly -- solving it
    // first and then swapping would do nothing, because a solved board is
    // finished and stops taking taps.
    const broken = await page.evaluate(() => {
      const R = window.WindowsillRules, b = window.__game.board();
      const [sol] = R.solutions(b.w, b.d, b.tray, 1);
      const at = [];
      sol.forEach((run, r) => run.forEach((_, t) => at.push([r, t])));
      for (const [r1, t1] of at) {
        for (const [r2, t2] of at) {
          if (r1 === r2 && t1 === t2) continue;
          const copy = sol.map((run) => run.slice());
          [copy[r1][t1], copy[r2][t2]] = [copy[r2][t2], copy[r1][t1]];
          if (!R.isSolved(copy)) return copy;
        }
      }
      return null;
    });
    if (!broken) throw new Error("no two plants on this board can be swapped wrongly");
    for (let r = 0; r < broken.length; r++) {
      for (let t = 0; t < broken[r].length; t++) {
        await place(broken[r][t].need, broken[r][t].height, r, t);
      }
    }
    const full = await page.evaluate(() => window.__game.shelf().flat().every(Boolean));
    if (!full) throw new Error("the shelf did not fill");
    if (await page.evaluate(() => window.__game.solved())) {
      throw new Error("a misplaced plant still counted as solved");
    }
    if (!(await page.locator("#win").isHidden())) throw new Error("the win panel came up on a broken board");
    const unhappy = await page.evaluate(() => Array.from(document.querySelectorAll(".verdict"))
      .filter((el) => el.textContent.trim()).length);
    if (unhappy === 0) throw new Error("nothing on a broken board reads as unhappy");
  });

  await step("every cell and chip says out loud what it is", async () => {
    await boardWith([1, 3]);
    await page.click("#clear");
    await place(1, 3, 0, 2);
    // An empty cell must not be drawing a plant nobody put there.
    const ghosts = await page.evaluate(() => Array.from(document.querySelectorAll(".cell"))
      .filter((c) => !c.querySelector(".plant").hidden).length);
    const onShelf = await page.evaluate(() => window.__game.shelf().flat().filter(Boolean).length);
    if (ghosts !== onShelf) throw new Error(`${ghosts} plants drawn for ${onShelf} on the shelf`);
    const label = await cell(0, 2).getAttribute("aria-label");
    if (!/Light 3 of 3/.test(label) || !/shade, tall/.test(label) || !/too much light/.test(label)) {
      throw new Error(`the cell reads "${label}"`);
    }
    const empty = await cell(1, 0).getAttribute("aria-label");
    if (!/empty/.test(empty)) throw new Error(`an empty cell reads "${empty}"`);
    const chip = await page.locator(".chip").first().getAttribute("aria-label");
    if (!/(sun|bright|shade), (low|mid|tall)/.test(chip)) throw new Error(`a chip reads "${chip}"`);
  });

  await step("it fits a 390px phone with tap targets over 44px", async () => {
    await page.click("#clear");
    const sizes = await page.evaluate(() => {
      const c = document.querySelector(".cell").getBoundingClientRect();
      const chip = document.querySelector(".chip").getBoundingClientRect();
      return { cw: c.width, ch: c.height, chipH: chip.height, scroll: document.documentElement.scrollWidth };
    });
    console.log(`  (cells ${sizes.cw.toFixed(1)}×${sizes.ch.toFixed(1)}px, chips ${sizes.chipH.toFixed(1)}px tall)`);
    if (sizes.cw < 44 || sizes.ch < 44) throw new Error(`cells are ${sizes.cw}×${sizes.ch}`);
    if (sizes.chipH < 44) throw new Error(`tray chips are ${sizes.chipH}px tall`);
    if (sizes.scroll > 390) throw new Error(`the page scrolls sideways at ${sizes.scroll}px`);
  });

  await step("clearing the shelf puts everything back", async () => {
    await boardWith([3, 1]);
    await place(3, 1, 0, 0);
    await page.click("#clear");
    const after = await page.evaluate(() => ({
      tray: window.__game.tray().length,
      placements: window.__game.placements(),
      onShelf: window.__game.shelf().flat().filter(Boolean).length,
      all: window.__game.board().w * window.__game.board().d,
    }));
    if (after.tray !== after.all || after.placements !== 0 || after.onShelf !== 0) {
      throw new Error(`after starting again: ${JSON.stringify(after)}`);
    }
  });

  // ---- practice -------------------------------------------------------
  const learn = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const lp = await learn.newPage();
  lp.on("pageerror", (e) => errors.push("pageerror(learn): " + e.message));
  lp.on("console", (m) => m.type() === "error" && errors.push("console(learn): " + m.text()));
  const lcell = (r, t) => lp.locator(`.cell[data-run="${r}"][data-tier="${t}"]`);
  const lplace = async (need, height, r, t) => {
    const id = await lp.evaluate(([n, h]) => {
      const x = window.__game.tray().find((p) => p.need === n && p.height === h);
      return x ? x.id : null;
    }, [need, height]);
    if (id === null) throw new Error(`practice tray has no ${need}/${height} left`);
    await lp.locator(`.chip[data-plant="${id}"]`).click();
    await lcell(r, t).click();
  };

  await step("practice deals the fixed board and takes its own chrome", async () => {
    await lp.goto("http://localhost:4611/parlour-games/windowsill/learn");
    await lp.waitForSelector(".cell");
    const board = await lp.evaluate(() => window.__game.board());
    if (board.w !== 2 || board.d !== 3) throw new Error(`practice dealt ${board.w}×${board.d}`);
    if (!(await lp.evaluate(() => window.__game.learning()))) throw new Error("not in practice mode");
    // Nothing to choose and nothing to re-deal: it is one board, on purpose.
    if (await lp.locator(".shelves").isVisible()) throw new Error("practice offered a shelf size");
    if (await lp.locator("#new").isVisible()) throw new Error("practice offered a new board");
    if (await lp.locator("#learn-link").isVisible()) throw new Error("practice linked to itself");
    // And it keeps no score.
    if ((await lp.textContent("#moves")).trim()) throw new Error("practice counted placements");
  });

  await step("the same six plants every time, with one way out", async () => {
    const tray = await lp.evaluate(() => window.__game.tray().map((p) => p.need + "/" + p.height));
    await lp.reload();
    await lp.waitForSelector(".cell");
    const again = await lp.evaluate(() => window.__game.tray().map((p) => p.need + "/" + p.height));
    if (JSON.stringify(tray) !== JSON.stringify(again)) throw new Error("practice shuffled itself");
    const ways = await lp.evaluate(() => {
      const b = window.__game.board();
      return window.WindowsillRules.countSolutions(b.w, b.d, b.tray);
    });
    if (ways !== 1) throw new Error(`the practice board has ${ways} ways out, not 1`);
  });

  await step("the coaching answers what you actually did", async () => {
    const opening = await lp.evaluate(() => window.__game.coach());
    if (!/light/i.test(opening)) throw new Error(`it opens with "${opening}"`);

    // A shade plant at the glass: the one mistake everybody makes first.
    await lplace(1, 1, 0, 0);
    let said = await lp.evaluate(() => window.__game.coach());
    if (!/front of a run is always full sun/i.test(said)) throw new Error(`on a scorch it said "${said}"`);

    // Take it back out again: that is the undo, and it should say so.
    await lcell(0, 0).click();
    await lp.locator(".chip").first().click();
    said = await lp.evaluate(() => window.__game.coach());
    if (!/never lost|undo/i.test(said)) throw new Error(`on taking one out it said "${said}"`);

    // Starved behind the tall one, which the line should name.
    await lp.click("#clear");
    await lplace(3, 3, 0, 0);
    await lplace(3, 1, 0, 1);
    said = await lp.evaluate(() => window.__game.coach());
    if (!/tall plant in front/i.test(said)) throw new Error(`on a starved plant it said "${said}"`);
  });

  await step("it teaches both halves of the rule, each as the board shows it", async () => {
    await lp.click("#clear");
    // The run of three sun-lovers: nothing shades anything.
    await lplace(3, 1, 0, 0);
    await lplace(3, 1, 0, 1);
    await lplace(3, 2, 0, 2);
    const low = await lp.evaluate(() => window.__game.coach());
    if (!/blocks nothing|shading another/i.test(low)) throw new Error(`the low lesson read "${low}"`);
    // And the tall one at the glass, stepping the light down.
    await lplace(3, 3, 1, 0);
    await lplace(2, 2, 1, 1);
    await lplace(1, 1, 1, 2);
    const solved = await lp.evaluate(() => window.__game.solved());
    if (!solved) throw new Error("the one solution did not register as solved");
    await lp.waitForSelector("#win:not([hidden])", { timeout: 5000 });
    const end = await lp.evaluate(() => window.__game.coach());
    if (!/built in steps/i.test(end)) throw new Error(`it finished by saying "${end}"`);
  });

  await step("finishing practice hands over to a real board and drops the URL", async () => {
    const label = await lp.textContent("#again");
    if (!/proper board/i.test(label)) throw new Error(`the button reads "${label}"`);
    await lp.click("#again");
    await lp.waitForSelector(".cell");
    const after = await lp.evaluate(() => ({
      learning: window.__game.learning(),
      w: window.__game.board().w,
      path: location.pathname + location.search,
      coachShown: !document.getElementById("coach").hidden,
    }));
    if (after.learning) throw new Error("it stayed in practice");
    if (after.w === 2) throw new Error("it dealt the practice board again");
    if (/learn/.test(after.path)) throw new Error(`the URL still reads ${after.path}`);
    if (after.coachShown) throw new Error("the coaching stayed on a real board");
    // A reload now must not land back in practice.
    await lp.reload();
    await lp.waitForSelector(".cell");
    if (await lp.evaluate(() => window.__game.learning())) throw new Error("a reload went back to practice");
    await learn.close();
  });

  // ---- the daily board ------------------------------------------------
  const daily = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const dp = await daily.newPage();
  dp.on("pageerror", (e) => errors.push("pageerror(daily): " + e.message));
  dp.on("console", (m) => m.type() === "error" && errors.push("console(daily): " + m.text()));
  const dsolve = async () => {
    const sol = (await dp.evaluate(() => window.__game.solutions()))[0];
    for (let r = 0; r < sol.length; r++) {
      for (let t = 0; t < sol[r].length; t++) {
        const id = await dp.evaluate(([n, h]) => {
          const x = window.__game.tray().find((p) => p.need === n && p.height === h);
          return x ? x.id : null;
        }, [sol[r][t].need, sol[r][t].height]);
        if (id === null) throw new Error("the daily solution wants a plant the tray has not got");
        await dp.locator(`.chip[data-plant="${id}"]`).click();
        await dp.locator(`.cell[data-run="${r}"][data-tier="${t}"]`).click();
      }
    }
  };

  await step("the daily board names itself and hides what it should", async () => {
    await dp.goto("http://localhost:4611/parlour-games/windowsill/daily");
    await dp.waitForSelector(".cell");
    if (!(await dp.evaluate(() => window.__game.isDaily()))) throw new Error("not in daily mode");
    const num = await dp.evaluate(() => window.__game.dayNumber());
    const tagline = await dp.textContent(".tagline");
    if (!tagline.includes("Board #" + num)) throw new Error(`the tagline reads "${tagline}"`);
    if (!/same one for everybody/.test(tagline)) throw new Error("it does not say the board is shared");
    // One board, one shape: nothing to choose and nothing to re-deal.
    if (await dp.locator(".shelves").isVisible()) throw new Error("the daily offered a shelf size");
    if (await dp.locator("#new").isVisible()) throw new Error("the daily offered a new board");
    if (await dp.locator("#daily-link").isVisible()) throw new Error("the daily linked to itself");
    if (await dp.locator("#coach").isVisible()) throw new Error("the daily was coaching");
  });

  await step("two devices are dealt the same board on the same day", async () => {
    const other = await browser.newContext();
    const op = await other.newPage();
    await op.goto("http://localhost:4611/parlour-games/windowsill?daily=1");
    await op.waitForSelector(".cell");
    const a = await dp.evaluate(() => JSON.stringify(window.__game.board().tray));
    const b = await op.evaluate(() => JSON.stringify(window.__game.board().tray));
    if (a !== b) throw new Error("two devices were dealt different boards on the same day");
    const nums = await op.evaluate(() => [window.__game.board().num, window.__game.dayNumber()]);
    if (nums[0] !== nums[1]) throw new Error(`the board is numbered ${nums[0]} on day ${nums[1]}`);
    await other.close();
  });

  await step("tomorrow's board is not today's", async () => {
    const differs = await dp.evaluate(() => {
      const R = window.WindowsillRules, P = window.Parlour;
      const shape = R.SHELVES.find((s) => s.key === "standard");
      const seed = (n) => (n * 2246822519 + 374761393) >>> 0;
      const trayOf = (n) => JSON.stringify(R.deal(shape, P.mulberry32(seed(n))).tray);
      const seen = new Set();
      for (let n = 1; n <= 60; n++) seen.add(trayOf(n));
      return seen.size;
    });
    if (differs < 55) throw new Error(`sixty days produced only ${differs} different boards`);
  });

  await step("a part-played daily board comes back after a reload", async () => {
    const sol = (await dp.evaluate(() => window.__game.solutions()))[0];
    const id = await dp.evaluate(([n, h]) => {
      const x = window.__game.tray().find((p) => p.need === n && p.height === h);
      return x ? x.id : null;
    }, [sol[0][0].need, sol[0][0].height]);
    await dp.locator(`.chip[data-plant="${id}"]`).click();
    await dp.locator('.cell[data-run="0"][data-tier="0"]').click();
    const before = await dp.evaluate(() => ({
      placements: window.__game.placements(),
      shelf: JSON.stringify(window.__game.shelf()),
    }));
    await dp.reload();
    await dp.waitForSelector(".cell");
    const after = await dp.evaluate(() => ({
      placements: window.__game.placements(),
      shelf: JSON.stringify(window.__game.shelf()),
    }));
    if (after.shelf !== before.shelf) throw new Error("the board came back different");
    if (after.placements !== before.placements) throw new Error(`placements went ${before.placements} → ${after.placements}`);
  });

  await step("a saved board from another day is ignored, not half-restored", async () => {
    await dp.evaluate(() => {
      const p = window.Parlour.read("pp_windowsill_progress", null);
      p.daily.num -= 1;                     // yesterday's
      window.Parlour.write("pp_windowsill_progress", p);
    });
    await dp.reload();
    await dp.waitForSelector(".cell");
    const state = await dp.evaluate(() => ({
      placements: window.__game.placements(),
      onShelf: window.__game.shelf().flat().filter(Boolean).length,
    }));
    if (state.placements !== 0 || state.onShelf !== 0) {
      throw new Error(`yesterday's board leaked through: ${JSON.stringify(state)}`);
    }
  });

  await step("finishing shows the board number, par and a countdown", async () => {
    await dsolve();
    await dp.waitForSelector("#win:not([hidden])", { timeout: 10000 });
    const num = await dp.evaluate(() => window.__game.dayNumber());
    const line = await dp.textContent("#win-line");
    if (!line.includes("Board #" + num)) throw new Error(`the win line reads "${line}"`);
    if (!/never moved one twice|Par is \d+/.test(line)) throw new Error(`no score in "${line}"`);
    const tally = await dp.textContent("#win-tally");
    if (!/A new board in /.test(tally)) throw new Error(`no countdown: "${tally}"`);
  });

  await step("a reload lands back on the finished board rather than a fresh one", async () => {
    await dp.reload();
    await dp.waitForSelector("#win:not([hidden])", { timeout: 10000 });
    if (!(await dp.evaluate(() => window.__game.solved()))) throw new Error("it came back unsolved");
    const line = await dp.textContent("#win-line");
    if (!/Board #/.test(line)) throw new Error(`the win line reads "${line}" after a reload`);
  });

  await step("leaving the daily board deals one of your own and drops the URL", async () => {
    await dp.click("#again");
    await dp.waitForSelector(".cell");
    const after = await dp.evaluate(() => ({
      daily: window.__game.isDaily(),
      path: location.pathname + location.search,
      num: window.__game.board().num,
      shelves: !!document.querySelector(".shelves").offsetParent,
    }));
    if (after.daily) throw new Error("it stayed on the daily board");
    if (/daily/.test(after.path)) throw new Error(`the URL still reads ${after.path}`);
    if (after.num !== undefined) throw new Error("the new board is still numbered");
    if (!after.shelves) throw new Error("the shelf sizes did not come back");
    await dp.reload();
    await dp.waitForSelector(".cell");
    if (await dp.evaluate(() => window.__game.isDaily())) throw new Error("a reload went back to the daily");
    await daily.close();
  });

  await step("the ordinary board offers no coaching and links to practice", async () => {
    await page.click("#clear");
    if (await page.locator("#coach").isVisible()) throw new Error("a real board was coaching");
    if (!(await page.locator("#learn-link").isVisible())) throw new Error("no way in to practice");
    if (!(await page.locator("#daily-link").isVisible())) throw new Error("no way in to today's board");
  });

  // ---- progress, the streak, and the account ---------------------------
  const solveOn = async (pg) => {
    const sol = (await pg.evaluate(() => window.__game.solutions()))[0];
    for (let r = 0; r < sol.length; r++) {
      for (let t = 0; t < sol[r].length; t++) {
        const id = await pg.evaluate(([n, h]) => {
          const x = window.__game.tray().find((p) => p.need === n && p.height === h);
          return x ? x.id : null;
        }, [sol[r][t].need, sol[r][t].height]);
        await pg.locator(`.chip[data-plant="${id}"]`).click();
        await pg.locator(`.cell[data-run="${r}"][data-tier="${t}"]`).click();
      }
    }
    await pg.waitForSelector("#win:not([hidden])", { timeout: 10000 });
  };

  await step("signed out, nothing is sent anywhere", async () => {
    const quiet = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const calls = [];
    await quiet.route("**://*.supabase.co/**", (route) => {
      calls.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    const qp = await quiet.newPage();
    await qp.goto("http://localhost:4611/parlour-games/windowsill");
    await qp.waitForSelector(".cell");
    await solveOn(qp);
    await qp.waitForTimeout(2200);           // past the debounce
    if (calls.length) throw new Error(`${calls.length} requests while signed out: ${calls[0]}`);
    const line = await qp.textContent("#save");
    if (!/Sign in/.test(line)) throw new Error(`the save line reads "${line}"`);
    // It still keeps a record locally.
    const prog = await qp.evaluate(() => window.__game.progress());
    if (prog.done !== 1) throw new Error(`finished ${prog.done} boards`);
    await quiet.close();
  });

  await step("finishing counts once, and a reload does not count it again", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const cp = await ctx.newPage();
    await cp.goto("http://localhost:4611/parlour-games/windowsill?daily=1");
    await cp.waitForSelector(".cell");
    await solveOn(cp);
    const first = await cp.evaluate(() => ({
      streak: window.__game.streak(), best: window.__game.progress().dailyBest,
    }));
    if (first.streak.streak !== 1 || first.streak.played !== 1) {
      throw new Error(`a first finish recorded ${JSON.stringify(first.streak)}`);
    }
    await cp.reload();
    await cp.waitForSelector("#win:not([hidden])", { timeout: 10000 });
    const again = await cp.evaluate(() => ({
      streak: window.__game.streak(), best: window.__game.progress().dailyBest,
    }));
    if (again.streak.played !== 1) throw new Error(`a reload counted it again: ${JSON.stringify(again.streak)}`);
    if (again.best !== first.best) throw new Error("the daily record moved on a reload");
    await ctx.close();
  });

  await step("signed in, its own row is read and written back", async () => {
    const signed = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const posted = [];
    await signed.addInitScript(() => {
      localStorage.setItem("sb-ixagjvntbgyqemxxinqe-auth-token", JSON.stringify({
        access_token: "test-token", refresh_token: "test-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "00000000-0000-4000-8000-00000000abcd" },
      }));
      // Fewer boards here, a better record here.
      localStorage.setItem("pp_windowsill_progress", JSON.stringify({
        done: 2, byShelf: { standard: 2 }, best: { standard: 13 }, dailyBest: null, daily: null,
      }));
    });
    await signed.route("**://*.supabase.co/rest/v1/game_progress**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify([{
            game: "windowsill",
            progress: { done: 11, byShelf: { standard: 9, deep: 2 }, best: { standard: 30, deep: 40 },
                        dailyBest: 14, daily: null },
          }]),
        });
      }
      posted.push(JSON.parse(route.request().postData() || "{}"));
      return route.fulfill({ status: 201, body: "" });
    });
    const sp = await signed.newPage();
    await sp.goto("http://localhost:4611/parlour-games/windowsill");
    await sp.waitForSelector(".cell");
    await sp.waitForFunction(() => window.__game.progress().done === 11, { timeout: 5000 });

    const prog = await sp.evaluate(() => window.__game.progress());
    if (prog.best.standard !== 13) throw new Error(`the better record was lost: ${JSON.stringify(prog.best)}`);
    if (prog.best.deep !== 40) throw new Error("a record only the account had was dropped");
    if (prog.dailyBest !== 14) throw new Error("the account's daily record was dropped");
    if (!/Saved to your account/.test(await sp.textContent("#save"))) {
      throw new Error(`the save line reads "${await sp.textContent("#save")}"`);
    }
    // It asked for its own row, not Trickle's.
    const asked = await sp.evaluate(() => performance.getEntriesByType("resource")
      .map((e) => e.name).filter((n) => /game_progress/.test(n)));
    if (!asked.some((n) => /windowsill/.test(n))) throw new Error(`it asked for ${asked.join(", ")}`);
    if (asked.some((n) => /trickle/.test(n))) throw new Error("it went looking in Trickle's row");

    if (!posted.length) throw new Error("the merge was never written back");
    const rows = posted[posted.length - 1];
    if (!Array.isArray(rows)) throw new Error("the push should be one row per game, as an array");
    const mine = rows.find((r) => r.game === "windowsill");
    if (!mine) throw new Error(`no windowsill row in ${JSON.stringify(rows.map((r) => r.game))}`);
    if (mine.progress.done !== 11) throw new Error(`pushed done ${mine.progress.done}`);
    if (mine.progress.best.standard !== 13) throw new Error("pushed the worse record");
    if (mine.user_id !== "00000000-0000-4000-8000-00000000abcd") throw new Error("pushed the wrong user");
    await signed.close();
  });

  await step("the streak is shared with the rest of the arcade", async () => {
    // A run kept alive in Trickle: playing Windowsill today should continue
    // it, not start a new one. That is the whole point of one streak.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const today = Math.floor(
      (Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) -
       Date.UTC(2026, 8, 17)) / 86400000) + 1;
    await ctx.addInitScript((yesterday) => {
      localStorage.setItem("pp_streak", JSON.stringify(
        { last: yesterday, streak: 4, longest: 4, played: 4 }));
    }, today - 1);
    const cp = await ctx.newPage();
    await cp.goto("http://localhost:4611/parlour-games/windowsill?daily=1");
    await cp.waitForSelector(".cell");
    await solveOn(cp);
    const streak = await cp.evaluate(() => window.__game.streak());
    if (streak.streak !== 5) throw new Error(`a run of four continued into ${streak.streak}`);
    if (!/5 days running/.test(await cp.textContent("#records"))) {
      throw new Error(`the records line reads "${await cp.textContent("#records")}"`);
    }
    await ctx.close();
  });

  await step("a keeper's own records are shown once there are any", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const cp = await ctx.newPage();
    await cp.goto("http://localhost:4611/parlour-games/windowsill");
    await cp.waitForSelector(".cell");
    if (await cp.locator("#records").isVisible()) throw new Error("records showed before anything was finished");
    await solveOn(cp);
    const line = await cp.textContent("#records");
    if (!/Best on standard/.test(line)) throw new Error(`the records line reads "${line}"`);
    if (!/Finished/.test(line)) throw new Error(`no count of finished boards in "${line}"`);
    await ctx.close();
  });

  await step("every plant is drawn to exactly the height the rule counts", async () => {
    // The art's load-bearing property. A plant that is drawn a little short
    // of its own height makes the game lie about the one thing it is about,
    // and nothing about it looks wrong -- the whole `bright` family was a
    // quarter of a unit short and only this measurement found it.
    const rows = await page.evaluate(() => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
      document.body.appendChild(host);
      const unit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--unit"));
      const out = [];
      for (const need of [3, 2, 1]) for (const height of [1, 2, 3]) {
        const box = document.createElement("div");
        box.className = "plant";
        box.dataset.need = String(need);
        box.style.cssText =
          `position:relative;left:auto;transform:none;width:${unit * 2.4}px;height:${unit * height}px`;
        box.innerHTML = window.__game.art(need, height);
        host.appendChild(box);
        const rect = box.getBoundingClientRect();
        const path = box.querySelector(".foliage");
        const vb = box.querySelector("svg").viewBox.baseVal;
        // How wide the ink is across the topmost slice, so the top of a plant
        // reads as an edge to compare against a step, not as a single point.
        const band = vb.height * 0.06;
        let lo = vb.width, hi = 0;
        for (let x = 0; x <= vb.width; x += 1) {
          for (let y = 0; y <= band; y += 1) {
            if (path.isPointInFill(new DOMPoint(x, y))) { lo = Math.min(lo, x); hi = Math.max(hi, x); break; }
          }
        }
        out.push({
          plant: `${need}/${height}`,
          shortBy: path.getBoundingClientRect().top - rect.top,
          overflow: rect.bottom - box.querySelector(".pot").getBoundingClientRect().bottom,
          topWidth: hi >= lo ? ((hi - lo) / vb.width) * 100 : 0,
        });
        host.removeChild(box);
      }
      host.remove();
      return out;
    });
    rows.forEach((r) => {
      if (r.shortBy > 0.6) {
        throw new Error(`${r.plant} is drawn ${r.shortBy.toFixed(2)}px short of the height the rule gives it`);
      }
      if (r.shortBy < -0.6) {
        throw new Error(`${r.plant} is drawn ${(-r.shortBy).toFixed(2)}px taller than the rule gives it`);
      }
      if (r.overflow < -0.6) throw new Error(`${r.plant} hangs ${(-r.overflow).toFixed(2)}px below its own pot`);
      if (r.topWidth < 15) {
        throw new Error(`${r.plant} comes to a point: only ${r.topWidth.toFixed(0)}% of it is at full height`);
      }
    });
    const widths = rows.map((r) => Math.round(r.topWidth));
    console.log(`  (all nine reach their exact height; tops span ${Math.min(...widths)}–${Math.max(...widths)}% of the plant)`);
  });

  await step("the nine plants are nine different shapes, not one shape resized", async () => {
    const shapes = await page.evaluate(() => {
      const out = {};
      for (const need of [3, 2, 1]) for (const height of [1, 2, 3]) {
        out[`${need}/${height}`] = window.__game.art(need, height)
          .replace(/viewBox="[^"]*"/, "").match(/class="foliage" d="([^"]*)"/)[1];
      }
      return out;
    });
    const seen = new Map();
    for (const [plant, d] of Object.entries(shapes)) {
      if (seen.has(d)) throw new Error(`${plant} is drawn identically to ${seen.get(d)}`);
      seen.set(d, plant);
    }
    // And the three families should not be interchangeable either: count the
    // subpaths, which is a rough stand-in for "is this the same kind of plant".
    const parts = (d) => (d.match(/M/g) || []).length;
    const byNeed = { 3: parts(shapes["3/2"]), 2: parts(shapes["2/2"]), 1: parts(shapes["1/2"]) };
    if (new Set(Object.values(byNeed)).size < 2) {
      throw new Error(`the three families are built the same way: ${JSON.stringify(byNeed)}`);
    }
  });

  await step("night turns the palette down and says so", async () => {
    await page.click("#clear");
    const before = await page.evaluate(() => ({
      night: document.body.classList.contains("night"),
      ink: getComputedStyle(document.body).backgroundColor,
    }));
    await page.click("#night");
    // The page colour is transitioned over 0.8s, so sampling it straight away
    // reads the old value and the check passes or fails on timing alone.
    await page.waitForFunction(
      (was) => getComputedStyle(document.body).backgroundColor !== was,
      before.ink, { timeout: 3000 },
    );
    const after = await page.evaluate(() => ({
      night: document.body.classList.contains("night"),
      pressed: document.getElementById("night").getAttribute("aria-pressed"),
      ink: getComputedStyle(document.body).backgroundColor,
    }));
    if (after.night === before.night) throw new Error("night did not change");
    if (after.pressed !== String(after.night)) throw new Error("the button does not say what it did");
    if (after.ink === before.ink) throw new Error("the page colour did not move");
  });

  await step("both palettes keep every pair readable, measured not eyeballed", async () => {
    // Measured for day AND night explicitly, by reading the variables under
    // each, rather than by toggling and hoping. Night follows the clock when
    // nobody has chosen, so which one a toggle lands on depends on the hour
    // the tests happen to run -- and an earlier version of this measured the
    // day palette twice and called it night.
    const both = await page.evaluate(() => {
      const parse = (raw) => {
        const v = raw.trim();
        let m = /^#([0-9a-f]{3})$/i.exec(v);
        if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
        m = /^#([0-9a-f]{6})$/i.exec(v);
        if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
        m = /^rgba?\(([^)]+)\)$/i.exec(v);
        if (m) {
          const n = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
          return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
        }
        throw new Error("cannot read the colour " + raw);
      };
      const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const over = (fg, bg) => [0, 1, 2].map((i) => fg[3] * fg[i] + (1 - fg[3]) * bg[i]).concat(1);
      const ratio = (a, b) => {
        const fg = a[3] < 1 ? over(a, b) : a;
        const [x, y] = [L(fg), L(b)];
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      const read = () => {
        const css = (n) => parse(getComputedStyle(document.body).getPropertyValue(n));
        const ink = css("--ink"), card = css("--card");
        return {
          text: {
            cream: ratio(css("--cream"), ink),
            muted: ratio(css("--muted"), ink),
            goldLight: ratio(css("--gold-light"), card),
            bad: ratio(css("--bad"), ink),
            leaf: ratio(css("--leaf"), ink),
            onSun: ratio(ink, css("--sun")),
            onBright: ratio(ink, css("--bright")),
            onShade: ratio(ink, css("--shade")),
          },
          graphic: {
            sunOnCard: ratio(css("--sun"), card),
            brightOnCard: ratio(css("--bright"), card),
            shadeOnCard: ratio(css("--shade"), card),
            potOnCard: ratio(css("--pot"), card),
            edge: ratio(css("--edge"), ink),
          },
        };
      };
      const was = document.body.classList.contains("night");
      document.body.classList.remove("night");
      const day = read();
      document.body.classList.add("night");
      const night = read();
      document.body.classList.toggle("night", was);
      return { day, night };
    });

    for (const [when, sets] of Object.entries(both)) {
      const worst = (o) => Object.entries(o).reduce((a, b) => (b[1] < a[1] ? b : a));
      const [wt, wtv] = worst(sets.text);
      const [wg, wgv] = worst(sets.graphic);
      console.log(`  (${when}: worst text ${wt} ${wtv.toFixed(2)}:1, worst graphic ${wg} ${wgv.toFixed(2)}:1)`);
      Object.entries(sets.text).forEach(([k, v]) => {
        if (v < 4.5) throw new Error(`${k} is ${v.toFixed(2)}:1 by ${when}, under 4.5`);
      });
      Object.entries(sets.graphic).forEach(([k, v]) => {
        if (v < 3) throw new Error(`${k} is ${v.toFixed(2)}:1 by ${when}, under 3`);
      });
    }
  });

  await step("the music is audible, calm, and nowhere near clipping", async () => {
    await page.click("#sound");
    if (!(await page.evaluate(() => window.__game.musicPlaying()))) {
      await page.click("#music");
    }
    await page.waitForFunction(() => window.__game.musicPlaying(), { timeout: 5000 });
    // A bar here is sixteen steps at 58bpm -- a little over eight seconds --
    // and the chord lands on the first step of it, so a short sample can miss
    // the loudest moment entirely and call the music inaudible. Sample across
    // a whole bar.
    await page.waitForTimeout(2000);
    const runs = [];
    for (let i = 0; i < 18; i++) {
      await page.waitForTimeout(500);
      runs.push(await page.evaluate(() => window.__game.levels()));
    }
    const peak = Math.max(...runs.map((r) => r.peak));
    const rms = runs.reduce((t, r) => t + r.rms, 0) / runs.length;
    console.log(`  (peak ${peak.toFixed(3)}, mean RMS ${rms.toFixed(3)})`);
    // The band is drawn round what this tune actually measures over three
    // runs -- peak 0.275 to 0.298, mean RMS 0.042 to 0.045 -- which sits
    // within a hair of Trickle's 0.259 and 0.048, so the two games play at
    // the same volume.
    if (peak > 0.45) throw new Error(`peak ${peak.toFixed(3)} is louder than the rest of the arcade`);
    if (peak < 0.18) throw new Error(`peak ${peak.toFixed(3)} is on but inaudible`);
    if (rms < 0.028) throw new Error(`mean RMS ${rms.toFixed(3)} is too quiet to hear`);
    if (rms > 0.09) throw new Error(`mean RMS ${rms.toFixed(3)} is louder than calm`);
  });

  await step("a tab nobody is looking at goes quiet", async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => !window.__game.musicPlaying(), { timeout: 3000 });
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => window.__game.musicPlaying(), { timeout: 3000 });
  });

  await step("one streak across the arcade: Trickle feeds it, Windowsill keeps it", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tp = await ctx.newPage();
    tp.on("pageerror", (e) => errors.push("pageerror(trickle): " + e.message));

    // Play Trickle's daily board to start a run.
    await tp.goto("http://localhost:4611/parlour-games/trickle/daily");
    await tp.waitForSelector(".tile");
    const tiles = await tp.$$(".tile");
    for (const tile of tiles) {
      for (let guard = 0; guard < 5; guard++) {
        const before = await tile.$eval("svg", (el) => el.style.transform);
        const deg = /rotate\((-?\d+)deg\)/.exec(before);
        if (deg && Number(deg[1]) % 360 === 0) break;
        await tile.click();
        if ((await tile.$eval("svg", (el) => el.style.transform)) === before) break;
      }
    }
    await tp.waitForSelector("#win:not([hidden])", { timeout: 20000 });
    const afterTrickle = await tp.evaluate(() => window.__game.streak());
    if (afterTrickle.streak !== 1) throw new Error(`Trickle left the streak at ${afterTrickle.streak}`);

    // Now Windowsill, same browser, same day. It should already know.
    const wp = await ctx.newPage();
    await wp.goto("http://localhost:4611/parlour-games/windowsill?daily=1");
    await wp.waitForSelector(".cell");
    const known = await wp.evaluate(() => window.__game.streak());
    if (known.streak !== 1 || known.played !== 1) {
      throw new Error(`Windowsill did not see Trickle's run: ${JSON.stringify(known)}`);
    }
    // And finishing a second game on the same day must not count twice.
    await solveOn(wp);
    const after = await wp.evaluate(() => window.__game.streak());
    if (after.streak !== 1 || after.played !== 1) {
      throw new Error(`a second game the same day counted again: ${JSON.stringify(after)}`);
    }
    await ctx.close();
  });

  // ---- embedded, and the hub ------------------------------------------
  await step("embedded, it loses its chrome and keeps its game", async () => {
    const ctx = await browser.newContext({ viewport: { width: 560, height: 900 } });
    const host = await ctx.newPage();
    // A page that frames it, the way somebody else's site would.
    await host.setContent(`<!doctype html><title>Host</title>
      <p>Someone else's page.</p>
      <iframe src="http://localhost:4611/parlour-games/windowsill/embed"
              width="520" height="700" style="border:0"></iframe>`);
    const frame = host.frameLocator("iframe");
    await frame.locator(".cell").first().waitFor({ timeout: 20000 });

    const inside = await host.frames()[1].evaluate(() => ({
      embed: window.__game.isEmbed(),
      masthead: !!document.querySelector("h1").offsetParent,
      hub: !!document.querySelector(".hub").offsetParent,
      credit: !!document.getElementById("credit").offsetParent,
      save: document.getElementById("save").textContent.trim(),
      foot: !!document.querySelector(".foot").offsetParent,
      // Every link has to leave the frame rather than replace it.
      links: Array.from(document.querySelectorAll("a")).map((a) => a.target),
      cells: document.querySelectorAll(".cell").length,
    }));
    if (!inside.embed) throw new Error("it did not come up in embed mode");
    if (inside.masthead || inside.hub || inside.foot) throw new Error("the site's own chrome came with it");
    if (!inside.credit) throw new Error("no credit back to Parlour Games");
    if (inside.save) throw new Error(`it asked to be signed into: "${inside.save}"`);
    if (!inside.cells) throw new Error("no shelf");
    if (inside.links.some((t) => t !== "_blank")) {
      throw new Error("a link inside the frame would replace the frame");
    }

    // And it is still a game inside the frame: a tall plant at the glass has
    // to take light off the row behind it, same as anywhere else.
    const tall = await host.frames()[1].evaluate(() => {
      const t = window.__game.tray().find((p) => p.height === 3);
      return t ? t.id : null;
    });
    if (tall === null) throw new Error("this board dealt nothing tall to test with");
    await frame.locator(`.chip[data-plant="${tall}"]`).click();
    await frame.locator('.cell[data-run="0"][data-tier="0"]').click();
    const after = await host.frames()[1].evaluate(() => ({
      placed: window.__game.shelf()[0][0] !== null,
      behind: window.__game.lights()[0][1],
    }));
    if (!after.placed) throw new Error("it would not take a plant inside a frame");
    if (after.behind !== 2) throw new Error(`a tall plant at the glass left light ${after.behind} behind it`);
    console.log("  (framed, playable, and the rule still holds inside the frame)");
    await ctx.close();
  });

  await step("only the embed route says it may be framed", async () => {
    // vercel.json is the thing that decides this, so it is what gets read:
    // the app's block must not claim the embed route, and the frame block
    // must cover both games.
    const { readFileSync } = await import("node:fs");
    const cfg = JSON.parse(readFileSync("vercel.json", "utf8"));
    const app = cfg.headers.find((h) => h.source.startsWith("/((?!"));
    const framed = cfg.headers.find((h) => /embed/.test(h.source) && !h.source.startsWith("/((?!"));
    if (!/parlour-games\/windowsill\/embed\$/.test(app.source)) {
      throw new Error("the app's frame-ancestors block still claims the windowsill embed");
    }
    const csp = app.headers.find((h) => h.key === "Content-Security-Policy");
    if (!/frame-ancestors 'none'/.test(csp.value)) {
      throw new Error(`everything else should refuse framing, not "${csp.value}"`);
    }
    if (!framed || !/windowsill/.test(framed.source) || !/trickle/.test(framed.source)) {
      throw new Error(`the frame block covers ${framed ? framed.source : "nothing"}`);
    }
    if (!framed.headers.some((h) => h.key === "Content-Security-Policy" && /frame-ancestors \*/.test(h.value))) {
      throw new Error("the embed route does not allow framing");
    }
    const rw = cfg.rewrites.map((r) => r.source);
    ["learn", "daily", "embed"].forEach((mode) => {
      const route = `/parlour-games/windowsill/${mode}`;
      if (!rw.includes(route)) throw new Error(`${route} has no rewrite`);
      if (rw.indexOf(route) > rw.indexOf("/(.*)")) throw new Error(`${route} sits after the catch-all`);
    });
  });

  await step("the hub lists it, and carries the streak for both games", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const today = Math.floor(
      (Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) -
       Date.UTC(2026, 8, 17)) / 86400000) + 1;
    const hp = await ctx.newPage();
    hp.on("pageerror", (e) => errors.push("pageerror(hub): " + e.message));

    await hp.goto("http://localhost:4611/parlour-games");
    await hp.waitForSelector(".game");
    // The hub is a list of links first: it must survive the harness failing.
    const brave = await ctx.newPage();
    await brave.route("**/parlour-games/harness.js", (r) => r.fulfill({ status: 404, body: "" }));
    await brave.goto("http://localhost:4611/parlour-games");
    await brave.waitForSelector(".game");
    if ((await brave.locator(".game").count()) < 2) throw new Error("the hub lost its games without the harness");
    await brave.close();
    const games = await hp.$$eval(".game", (els) => els.map((e) => ({
      name: e.querySelector("h2").textContent, href: e.getAttribute("href"),
    })));
    if (!games.some((g) => g.name === "Windowsill" && g.href === "/parlour-games/windowsill")) {
      throw new Error(`the hub lists ${JSON.stringify(games)}`);
    }
    // Nothing played: no streak line, rather than a zero.
    if (await hp.locator("#streak").isVisible()) throw new Error("the hub showed a streak of nothing");

    // A live run shows, and says what keeps it.
    await hp.evaluate((day) => localStorage.setItem("pp_streak", JSON.stringify(
      { last: day - 1, streak: 6, longest: 6, played: 6 })), today);
    await hp.reload();
    await hp.waitForSelector("#streak:not([hidden])");
    const live = await hp.textContent("#streak");
    if (!/6 days running/.test(live) || !/keep it/.test(live)) throw new Error(`it reads "${live}"`);

    // Already played today: it says so rather than nagging.
    await hp.evaluate((day) => localStorage.setItem("pp_streak", JSON.stringify(
      { last: day, streak: 7, longest: 7, played: 7 })), today);
    await hp.reload();
    await hp.waitForSelector("#streak:not([hidden])");
    const done = await hp.textContent("#streak");
    if (!/Today is done/.test(done)) throw new Error(`having played, it reads "${done}"`);

    // A run that already lapsed is over, and saying otherwise would be a lie.
    await hp.evaluate((day) => localStorage.setItem("pp_streak", JSON.stringify(
      { last: day - 3, streak: 9, longest: 9, played: 9 })), today);
    await hp.reload();
    await hp.waitForSelector(".game");
    if (await hp.locator("#streak").isVisible()) {
      throw new Error(`a lapsed run still claims "${await hp.textContent("#streak")}"`);
    }
    await ctx.close();
  });

  if (errors.length) throw new Error("page errors:\n  " + errors.join("\n  "));
  console.log("ALL PASSED");
} finally {
  await browser.close();
  server.close();
}
