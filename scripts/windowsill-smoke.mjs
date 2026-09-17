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

const PAGE = readFileSync("public/parlour-games/windowsill.html", "utf8");
const RULES = readFileSync("public/parlour-games/windowsill-rules.js", "utf8");
const server = createServer((req, res) => {
  if (new URL(req.url, "http://x").pathname === "/parlour-games/windowsill-rules.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end(RULES);
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

  await step("a fixed board deals nine plants to a 3×3 shelf and no more", async () => {
    const cells = await page.locator(".cell").count();
    const chips = await page.locator(".chip").count();
    if (cells !== 9) throw new Error(`${cells} cells`);
    if (chips !== 9) throw new Error(`${chips} plants in the tray`);
    // Exactly as many plants as cells: the shelf is meant to be packed.
    const solved = await page.evaluate(() => window.__game.solved());
    if (solved) throw new Error("an empty shelf counted as solved");
  });

  await step("an empty shelf is in full sun all the way back", async () => {
    const lights = await page.evaluate(() => window.__game.lights());
    if (!lights.every((run) => run.every((l) => l === 3))) {
      throw new Error(`empty shelf lights ${JSON.stringify(lights)}`);
    }
  });

  await step("the pips on screen say what the model says", async () => {
    await place(3, 3, 0, 0);            // a tall sun-lover at the glass
    const shown = await cell(0, 1).locator(".pips").evaluate(
      (el) => (el.innerHTML.match(/●/g) || []).length - (el.querySelectorAll("b").length),
    );
    const model = (await page.evaluate(() => window.__game.lights()))[0][1];
    if (shown !== model) throw new Error(`the cell shows ${shown} pips, the model says ${model}`);
    if (model !== 2) throw new Error(`a tall plant at the glass left light ${model} behind it`);
  });

  await step("a low plant at the glass shades nothing behind it", async () => {
    await page.click("#clear");
    await place(3, 1, 0, 0);
    const lights = (await page.evaluate(() => window.__game.lights()))[0];
    if (lights[1] !== 3 || lights[2] !== 3) {
      throw new Error(`a low plant at the glass left ${JSON.stringify(lights)}`);
    }
  });

  await step("a mid plant shades the tier behind it but not the one behind that", async () => {
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
    await page.click("#clear");
    await place(1, 3, 0, 0);            // the shade plant, straight into full sun
    if (!/scorching/.test(await cell(0, 0).locator(".verdict").textContent())) {
      throw new Error("a shade plant in full sun was not called scorching");
    }
    if (!/✗/.test(await cell(0, 0).locator(".want").textContent())) {
      throw new Error("an unhappy plant is not marked as unhappy next to what it wants");
    }
    await page.click("#clear");
    await place(3, 1, 0, 0);
    await place(3, 3, 1, 0);
    await place(3, 1, 1, 1);            // behind a tall one: light 2, wants 3
    const verdict = await cell(1, 1).locator(".verdict").textContent();
    if (!/leggy/.test(verdict)) throw new Error(`a starved plant reads "${verdict}"`);
  });

  await step("picking up and putting down never loses a plant", async () => {
    await page.click("#clear");
    await place(3, 1, 0, 0);
    // Pick it off the shelf and drop it somewhere else.
    await cell(0, 0).click();
    await cell(2, 0).click();
    const counts = await page.evaluate(() => {
      const onShelf = window.__game.shelf().flat().filter(Boolean).length;
      return { onShelf, inTray: window.__game.tray().length };
    });
    if (counts.onShelf + counts.inTray !== 9) {
      throw new Error(`${counts.onShelf} on the shelf and ${counts.inTray} in the tray`);
    }
    if (counts.onShelf !== 1) throw new Error(`moving it left ${counts.onShelf} on the shelf`);
  });

  await step("dropping one onto another swaps them", async () => {
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
    if (state.tray !== 7) throw new Error(`the swap changed the tray to ${state.tray}`);
  });

  await step("a plant put back in the tray comes back", async () => {
    await page.click("#clear");
    await place(3, 1, 0, 0);
    await cell(0, 0).click();           // pick it up off the shelf
    await page.locator(".chip").first().click();   // tap the tray to put it back
    const n = await page.evaluate(() => window.__game.tray().length);
    if (n !== 9) throw new Error(`the tray holds ${n} after putting one back`);
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
    const placements = await page.evaluate(() => window.__game.placements());
    if (placements !== 9) throw new Error(`a straight-through solve took ${placements} placements`);
    const line = await page.textContent("#win-line");
    if (!/never moved one twice/.test(line)) throw new Error(`par was not recognised: "${line}"`);
    // Counted off what a player can actually see, not off a class name.
    const ticks = await page.evaluate(() => Array.from(document.querySelectorAll(".want"))
      .filter((el) => el.textContent.trim().startsWith("✓")).length);
    if (ticks !== 9) throw new Error(`${ticks} of 9 plants show a tick`);
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

  await step("start again puts everything back", async () => {
    await place(3, 1, 0, 0);
    await page.click("#clear");
    const after = await page.evaluate(() => ({
      tray: window.__game.tray().length,
      placements: window.__game.placements(),
      onShelf: window.__game.shelf().flat().filter(Boolean).length,
    }));
    if (after.tray !== 9 || after.placements !== 0 || after.onShelf !== 0) {
      throw new Error(`after starting again: ${JSON.stringify(after)}`);
    }
  });

  if (errors.length) throw new Error("page errors:\n  " + errors.join("\n  "));
  console.log("ALL PASSED");
} finally {
  await browser.close();
  server.close();
}
