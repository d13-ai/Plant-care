/**
 * Windowsill's light model.
 *
 * Written before the page, because the rule is the game: an earlier version
 * of it -- light dropping by the height of whatever stands in front, on a
 * flat sill -- looked fine and admitted exactly one shape of filled run,
 * which would have made the whole thing a sorting exercise. The counts below
 * are what tells the two apart, and they match what
 * scripts/windowsill-model.py measures independently.
 */
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const R = require("./windowsill-rules.js") as typeof import("./windowsill-rules.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parlour = require("./harness.js") as typeof import("./harness.js");

const sun = (height: number) => ({ need: 3, height });
const bright = (height: number) => ({ need: 2, height });
const shade = (height: number) => ({ need: 1, height });

describe("light down one run", () => {
  it("gives full sun at the glass, always", () => {
    expect(R.lightsFor([sun(3), null, null])[0]).toBe(3);
    expect(R.lightsFor([sun(1), sun(1), sun(1)])[0]).toBe(3);
  });

  // The worked example in the spec, section 1.
  it("steps 3 → 2 → 1 behind a tall plant", () => {
    expect(R.lightsFor([sun(3), bright(2), shade(1)])).toEqual([3, 2, 1]);
  });

  // The other worked example: the one that looks wrong and is not.
  it("leaves the raised rows in full sun behind a low plant", () => {
    // 0+1 is not above 1, and 1+1 is not above 2, so nothing shades anything.
    expect(R.lightsFor([sun(1), sun(1), sun(2)])).toEqual([3, 3, 3]);
  });

  it("is the whole point: a low plant shades nothing, a tall one shades two rows", () => {
    expect(R.lightsFor([sun(1), sun(1), sun(1)])).toEqual([3, 3, 3]);
    expect(R.lightsFor([sun(2), bright(1), sun(1)])).toEqual([3, 2, 3]);
    expect(R.lightsFor([sun(3), bright(1), bright(1)])).toEqual([3, 2, 2]);
  });

  it("does not let an empty cell shade anything", () => {
    expect(R.lightsFor([null, sun(3), bright(1)])).toEqual([3, 3, 2]);
  });

  /**
   * Worth pinning down, because it is not obvious and the game depends on it:
   * with heights capped at 3, no cell can ever be shaded into darkness, so
   * the shelf has no dead squares. A tier is shaded only by plants that
   * overtop it, and a plant at tier t reaches t + 3 -- which clears tier
   * t + 3's base but not tier t + 1's and t + 2's. That leaves at most two
   * blockers on any cell, so the floor is one level, never zero.
   */
  it("never shades a cell into darkness, so every cell can hold something", () => {
    expect(R.lightsFor([sun(3), bright(3), shade(3), { need: 1, height: 3 }]))
      .toEqual([3, 2, 1, 1]);

    const worst = (depth: number) => {
      let floor = R.MAX_LIGHT;
      const every = (run: (typeof sun extends never ? never : { need: number; height: number })[]) => {
        R.lightsFor(run).forEach((l) => { floor = Math.min(floor, l); });
      };
      // Every arrangement of heights, which is what decides the shading.
      const walk = (run: { need: number; height: number }[]) => {
        if (run.length === depth) return every(run);
        [1, 2, 3].forEach((height) => { run.push({ need: 1, height }); walk(run); run.pop(); });
      };
      walk([]);
      return floor;
    };
    expect(worst(3)).toBe(1);
    expect(worst(5)).toBe(1);
  });
});

describe("naming what is doing the shading", () => {
  it("names nobody at the glass", () => {
    expect(R.blockersOf([sun(3), bright(2), shade(1)], 0)).toEqual([]);
  });

  it("names the tall plant at the front, for both rows behind it", () => {
    const run = [sun(3), bright(2), shade(1)];
    expect(R.blockersOf(run, 1)).toEqual([0]);
    expect(R.blockersOf(run, 2)).toEqual([0, 1]);
  });

  it("names nobody behind a low plant", () => {
    expect(R.blockersOf([sun(1), sun(1), sun(2)], 1)).toEqual([]);
    expect(R.blockersOf([sun(1), sun(1), sun(2)], 2)).toEqual([]);
  });

  // The count of blockers is exactly what the light subtracts, so the
  // explanation can never disagree with the number it explains.
  it("always accounts for the light the model takes away", () => {
    R.fullRuns(3).forEach((run) => {
      const lights = R.lightsFor(run);
      run.forEach((_, t) => {
        expect(lights[t]).toBe(Math.max(0, R.MAX_LIGHT - R.blockersOf(run, t).length));
      });
    });
  });
});

describe("how a plant is doing", () => {
  it("is happy only on an exact match", () => {
    expect(R.stateOf(bright(1), 2)).toBe("happy");
  });

  it("scorches in too much light and goes leggy in too little", () => {
    expect(R.stateOf(shade(1), 3)).toBe("scorching");
    expect(R.stateOf(sun(1), 1)).toBe("leggy");
  });

  it("says nothing about an empty cell", () => {
    expect(R.stateOf(null, 3)).toBe(null);
  });

  it("reads a whole shelf at once", () => {
    expect(R.shelfStates([[sun(3), bright(2), shade(1)], [shade(1), sun(1), sun(1)]]))
      .toEqual([["happy", "happy", "happy"], ["scorching", "happy", "happy"]]);
  });
});

describe("solved", () => {
  const good = [
    [sun(1), sun(2), bright(1)],
    [sun(2), bright(1), sun(1)],
    [sun(3), bright(3), shade(3)],
  ];

  it("accepts a full shelf where everything is happy", () => {
    expect(R.isSolved(good)).toBe(true);
  });

  it("refuses a shelf with a gap in it, however happy the rest", () => {
    const gappy = [[sun(3), null, null], [sun(3), null, null], [sun(3), null, null]];
    expect(R.shelfStates(gappy)[0][0]).toBe("happy");
    expect(R.isSolved(gappy)).toBe(false);
  });

  it("refuses a full shelf with one plant in the wrong place", () => {
    // Swap the two plants in the front row of the first two runs.
    const swapped = good.map((r) => r.slice());
    [swapped[0][0], swapped[1][0]] = [swapped[1][0], swapped[0][0]];
    expect(R.isSolved(swapped)).toBe(false);
  });
});

describe("the filled runs a board can be dealt from", () => {
  // These four numbers are the difference between a game and a sorting
  // exercise, and they are measured, not assumed. scripts/windowsill-model.py
  // arrives at the same ones by a different route.
  it("admits 27 filled runs at three tiers, in 5 patterns of need", () => {
    const runs = R.fullRuns(3);
    expect(runs.length).toBe(27);
    expect(new Set(runs.map((r) => r.map((p) => p.need).join(""))).size).toBe(5);
  });

  it("admits 81 at four tiers", () => {
    expect(R.fullRuns(4).length).toBe(81);
  });

  it("puts a sun-lover at the glass in every single one of them", () => {
    expect(R.fullRuns(3).every((r) => r[0].need === R.MAX_LIGHT)).toBe(true);
  });

  it("deals only runs that are actually solved as dealt", () => {
    expect(R.fullRuns(3).every((run) => R.isSolved([run]))).toBe(true);
  });
});

describe("counting the ways out of a board", () => {
  const pool = (runs: { need: number; height: number }[][]) => runs.flat();

  it("counts an arrangement once however its runs are ordered", () => {
    // Two different runs. Laid out either way round it is one answer, not two.
    const a = [sun(1), sun(1), sun(1)];
    const b = [sun(3), bright(2), shade(1)];
    expect(R.countSolutions(2, 3, pool([a, b]))).toBe(1);
  });

  it("agrees with the arrangements it can actually produce", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const board = R.deal(R.SHELVES[0], Parlour.mulberry32(seed));
      const found = R.solutions(board.w, board.d, board.tray, 500);
      expect(found.length).toBe(board.ways);
    }
  });

  it("produces arrangements that are genuinely solved", () => {
    const board = R.deal(R.SHELVES[1], Parlour.mulberry32(7));
    const found = R.solutions(board.w, board.d, board.tray, 5);
    expect(found.length).toBeGreaterThan(0);
    found.forEach((shelf) => expect(R.isSolved(shelf)).toBe(true));
  });

  it("says a pool that cannot be laid out at all has no ways out", () => {
    // Three shade plants: nothing can sit at the glass, which is always
    // full sun, so there is no arrangement.
    expect(R.countSolutions(1, 3, [shade(1), shade(1), shade(1)])).toBe(0);
  });
});

describe("dealing a board", () => {
  // The proof the spec asks for: a few hundred boards at every shape, each
  // one full, solvable, and the difficulty it was asked for.
  R.SHELVES.forEach((shelf) => {
    it(`deals ${shelf.label} boards that are full, solvable and inside their band`, () => {
      let worstTries = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const board = R.deal(shelf, Parlour.mulberry32(seed));
        expect(board.tray.length).toBe(shelf.w * shelf.d);
        expect(board.ways).toBeGreaterThan(0);
        expect(board.ways).toBeGreaterThanOrEqual(shelf.band[0]);
        expect(board.ways).toBeLessThanOrEqual(shelf.band[1]);
        expect(board.missed).toBeUndefined();
        worstTries = Math.max(worstTries, board.tries);
      }
      // If it ever needed most of its attempts the band is too narrow for
      // the shape, and a player would feel it as a pause.
      expect(worstTries).toBeLessThan(30);
    });
  });

  it("deals the same board twice from the same seed", () => {
    const a = R.deal(R.SHELVES[1], Parlour.mulberry32(99));
    const b = R.deal(R.SHELVES[1], Parlour.mulberry32(99));
    expect(a).toEqual(b);
  });

  it("deals different boards from different seeds", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      seen.add(JSON.stringify(R.deal(R.SHELVES[1], Parlour.mulberry32(seed)).tray));
    }
    expect(seen.size).toBeGreaterThan(40);
  });

  it("still hands back a board when it cannot hit the band", () => {
    // One attempt is almost never enough, so this is the give-up path.
    const impossible = { key: "x", label: "x", w: 3, d: 3, band: [9999, 9999] as [number, number] };
    const board = R.deal(impossible, Parlour.mulberry32(3), 2);
    expect(board.tray.length).toBe(9);
    expect(board.missed).toBe(true);
    expect(board.ways).toBeGreaterThan(0);
  });

  it("shuffles the tray, so the answer is not the order it is handed to you", () => {
    const board = R.deal(R.SHELVES[2], Parlour.mulberry32(5));
    // Dealt in runs of three, the tray would read sun-first every third
    // plant. It should not.
    const everyThird = [0, 3, 6, 9, 12].map((i) => board.tray[i].need);
    expect(everyThird.every((n) => n === 3)).toBe(false);
  });
});

describe("the practice board", () => {
  // The coaching is written for this exact board, so its shape and its being
  // the only way out are both load-bearing.
  it("is two runs of three, dealt with exactly as many plants as places", () => {
    expect(R.PRACTICE.w).toBe(2);
    expect(R.PRACTICE.d).toBe(3);
    expect(R.PRACTICE.tray.length).toBe(6);
  });

  it("has exactly one way out", () => {
    expect(R.countSolutions(R.PRACTICE.w, R.PRACTICE.d, R.PRACTICE.tray)).toBe(1);
  });

  it("teaches both halves of the rule in its one solution", () => {
    const [shelf] = R.solutions(R.PRACTICE.w, R.PRACTICE.d, R.PRACTICE.tray, 1);
    expect(R.isSolved(shelf)).toBe(true);
    const fronts = shelf.map((run) => run[0].height).sort();
    // One run led by a low plant, which shades nothing; one led by a tall
    // plant, which shades both rows behind it.
    expect(fronts).toEqual([1, 3]);
    const lowRun = shelf.find((run) => run[0].height === 1)!;
    const tallRun = shelf.find((run) => run[0].height === 3)!;
    expect(R.lightsFor(lowRun)).toEqual([3, 3, 3]);
    expect(R.lightsFor(tallRun)).toEqual([3, 2, 1]);
  });

  it("uses all three needs, so nothing about it is a special case", () => {
    expect(new Set(R.PRACTICE.tray.map((p) => p.need)).size).toBe(3);
  });
});

describe("saying it out loud", () => {
  it("names a plant by what it wants and how big it is", () => {
    expect(R.describe(shade(3))).toBe("shade, tall");
    expect(R.describe(null)).toBe("empty");
  });
});
