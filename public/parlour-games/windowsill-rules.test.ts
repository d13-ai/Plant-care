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

describe("saying it out loud", () => {
  it("names a plant by what it wants and how big it is", () => {
    expect(R.describe(shade(3))).toBe("shade, tall");
    expect(R.describe(null)).toBe("empty");
  });
});
