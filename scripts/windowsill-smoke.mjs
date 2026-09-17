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
const server = createServer((req, res) => {
  const js = FILES[new URL(req.url, "http://x").pathname];
  if (js) {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end(js);
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(PAGE);
}).listen(4611);

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
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
        midHead: box('.cell[data-run="0"][data-tier="0"] .crown').top,
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
    const solution = (await page.evaluate(() => window.__game.solutions()))[0];
    const order = [];
    for (let r = 0; r < solution.length; r++) for (let t = 0; t < solution[r].length; t++) order.push([r, t]);
    // Fill it correctly except for the last two, which go in swapped.
    for (let i = 0; i < order.length - 2; i++) {
      const [r, t] = order[i];
      await place(solution[r][t].need, solution[r][t].height, r, t);
    }
    const [[r1, t1], [r2, t2]] = order.slice(-2);
    await place(solution[r2][t2].need, solution[r2][t2].height, r1, t1);
    await place(solution[r1][t1].need, solution[r1][t1].height, r2, t2);
    const full = await page.evaluate(() => window.__game.shelf().flat().every(Boolean));
    if (!full) throw new Error("the shelf did not fill");
    if (await page.evaluate(() => window.__game.solved())) {
      // Only a real failure if the swap actually changed anything -- two
      // identical plants swap to the same board.
      const same = await page.evaluate(([a, b, c, d]) => {
        const s = window.__game.shelf();
        return s[a][b].need === s[c][d].need && s[a][b].height === s[c][d].height;
      }, [r1, t1, r2, t2]);
      if (!same) throw new Error("a misplaced plant still counted as solved");
    }
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

  await step("the ordinary board offers no coaching and links to practice", async () => {
    await page.click("#clear");
    if (await page.locator("#coach").isVisible()) throw new Error("a real board was coaching");
    if (!(await page.locator("#learn-link").isVisible())) throw new Error("no way in to practice");
  });

  if (errors.length) throw new Error("page errors:\n  " + errors.join("\n  "));
  console.log("ALL PASSED");
} finally {
  await browser.close();
  server.close();
}
