/**
 * Elbow Room's rules and generator.
 *
 * Written alongside the measurements in docs/elbow-room-spec.md, section 2:
 * random beds almost never have one answer, so the generator repairs them,
 * and a twist only matters if the board is built around it. These tests are
 * what keeps those promises true of the shipped module rather than of the
 * prototype they were measured on.
 */
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const R = require("./elbow-room-rules.js") as typeof import("./elbow-room-rules.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parlour = require("./harness.js") as typeof import("./harness.js");

type Board = ReturnType<typeof R.fromPicture>;

/** The player's string with plants at the given cells. */
const planted = (b: Board, cells: number[]) => {
  const s = Array(b.n * b.n).fill(".");
  cells.forEach((c) => (s[c] = "p"));
  return s.join("");
};
const answerCells = (b: Board) => b.answer.map((c, r) => r * b.n + c);
const blank = (b: Board) => ".".repeat(b.n * b.n);

describe("the rules", () => {
  const b = R.PRACTICE;

  it("call the practice board's answer solved", () => {
    expect(R.isSolved(b, planted(b, answerCells(b)))).toBe(true);
  });

  it("are not solved until every bed has its plant", () => {
    expect(R.isSolved(b, planted(b, answerCells(b).slice(1)))).toBe(false);
    expect(R.isSolved(b, blank(b))).toBe(false);
  });

  it("see two plants touching corner to corner", () => {
    // Row 1 column 1 and row 2 column 2 are diagonal neighbours.
    const clash = R.clashes(b, planted(b, [0 * 5 + 0, 1 * 5 + 1]));
    expect(clash.some((c) => c.type === "touch" && c.words === "too close")).toBe(true);
  });

  it("see two in a row, a column and a bed", () => {
    expect(R.clashes(b, planted(b, [0, 2])).map((c) => c.type)).toContain("row");
    expect(R.clashes(b, planted(b, [0, 10])).map((c) => c.type)).toContain("col");
    // Cells 1 and 3 are both in bed A, and in the same row.
    expect(R.clashes(b, planted(b, [1, 3])).map((c) => c.type)).toContain("bed");
  });

  it("say what is wrong in words, never only by colour", () => {
    for (const c of R.clashes(b, planted(b, [0, 1, 6]))) expect(c.words.length).toBeGreaterThan(3);
  });

  it("describe a cell for a screen reader", () => {
    expect(R.describeCell(b, planted(b, [4]), 4)).toBe("row 1, column 5, bed A, planted");
  });
});

describe("dead ends", () => {
  const b = R.PRACTICE;

  // The board a player sent on 4 Oct 2026: brown planted in the top row
  // instead of the third. Nothing was said, so it looked unwinnable.
  it("say so as soon as the plants leave a bed no room -- the reported board", () => {
    const early = planted(b, [0 * 5 + 0, 1 * 5 + 2]);
    expect(R.deadEnds(b, early)).toEqual([]);
    const stuck = planted(b, [0 * 5 + 0, 1 * 5 + 2, 3 * 5 + 3, 4 * 5 + 1]);
    const dead = R.deadEnds(b, stuck);
    expect(dead.map((d) => [d.kind, d.index])).toContainEqual(["bed", 0]); // the purple bed, A
  });

  it("never fire on the way to the answer", () => {
    const cells = answerCells(b);
    for (let k = 0; k <= cells.length; k++) expect(R.deadEnds(b, planted(b, cells.slice(0, k)))).toEqual([]);
  });

  it("ignore bare-soil marks: they are notes, not rules", () => {
    const allMarked = "x".repeat(25);
    expect(R.deadEnds(b, allMarked)).toEqual([]);
  });
});

describe("the twists", () => {
  // A 3x3 is too small for a real board but fine for a rule.
  const base = (twists: Record<string, "cactus" | "fern" | "climber" | "succulent">) =>
    R.fromPicture(["A B C", "A B C", "A B C"], { twists });

  it("let a cactus touch its neighbours, and only a cactus", () => {
    const plain = base({});
    const cactus = base({ 0: "cactus" });
    const touching = planted(plain, [0, 4]); // row 1 col 1, row 2 col 2: beds A and B
    expect(R.clashes(plain, touching).some((c) => c.type === "touch")).toBe(true);
    expect(R.clashes(cactus, touching).some((c) => c.type === "touch")).toBe(false);
  });

  it("keep a fern out of the sun", () => {
    const b = base({ 0: "fern" });
    b.sun = b.sun.map((_, i) => i < 3);
    expect(R.clashes(b, planted(b, [0])).map((c) => c.words)).toContain("too much sun");
    expect(R.clashes(b, planted(b, [3]))).toEqual([]);
  });

  it("keep a succulent in the sun", () => {
    const b = base({ 0: "succulent" });
    b.sun = b.sun.map((_, i) => i < 3);
    expect(R.clashes(b, planted(b, [3])).map((c) => c.words)).toContain("wants the sun");
    expect(R.clashes(b, planted(b, [0]))).toEqual([]);
  });

  it("give a climber nothing to climb away from the trellis", () => {
    const b = base({ 0: "climber" });
    b.trellis = b.trellis.map((_, i) => (i === 6 ? "left" : null));
    expect(R.clashes(b, planted(b, [0])).map((c) => c.words)).toContain("nothing to climb");
    expect(R.clashes(b, planted(b, [6]))).toEqual([]);
  });

  it("can say when a cactus is the reason two plants may touch", () => {
    const cactus = base({ 0: "cactus" });
    expect(R.cactusTouches(cactus, planted(cactus, [0, 4]))).toEqual([[0, 4]]);
    expect(R.cactusTouches(base({}), planted(base({}), [0, 4]))).toEqual([]);
  });

  it("explain themselves in one line each", () => {
    for (const k of R.KINDS) expect(R.TWIST_LINES[k]).toMatch(/\.$/);
  });
});

describe("solving", () => {
  it("finds the practice board's one answer, and only that", () => {
    const sols = R.solutions(R.PRACTICE, 5);
    expect(sols).toEqual([R.PRACTICE.answer]);
  });

  it("solves the practice board by reasoning, using nothing past confinement", () => {
    const how = R.reason(R.PRACTICE);
    expect(how.solved).toBe(true);
    expect(how.hardest).toBe("confine");
  });

  it("starts the practice board at one of the two ways in the spec names", () => {
    // Bed C runs straight down column 1; bed E is two cells in the bottom row.
    const step = R.nudge(R.PRACTICE, blank(R.PRACTICE))!;
    expect(step.technique).toBe("confine");
    expect(step.units[0]).toMatchObject({ kind: "bed", index: 2 });
    expect(step.why).toMatch(/column 1/);
  });

  it("points at a wrong plant rather than reasoning past it", () => {
    const b = R.PRACTICE;
    const wrong = planted(b, [0]); // the answer's row-1 plant is in column 5
    expect(R.nudge(b, wrong)).toMatchObject({ technique: "wrong", cells: [0] });
  });

  it("doesn't nudge towards something already on the board", () => {
    const b = R.PRACTICE;
    const first = R.nudge(b, blank(b))!;
    const marked = blank(b).split("");
    first.cells.forEach((c) => (marked[c] = "x"));
    const second = R.nudge(b, marked.join(""))!;
    expect(second.cells).not.toEqual(first.cells);
  });

  it("has nothing to nudge on a finished board", () => {
    const b = R.PRACTICE;
    expect(R.nudge(b, planted(b, answerCells(b)))).toBeNull();
  });
});

describe("the generator", () => {
  const check = (b: Board | null, size: string) => {
    expect(b).not.toBeNull();
    const board = b!;
    const spec = R.sizeOf(size);
    expect(board.n).toBe(spec.n);
    // Exactly one answer, and it is the one the board says.
    expect(R.solutions(board, 3)).toEqual([board.answer]);
    expect(R.isSolved(board, planted(board, answerCells(board)))).toBe(true);
    // Reachable by reasoning, inside the size's band.
    const how = R.reason(board);
    expect(how.solved).toBe(true);
    expect(R.TECHNIQUES.indexOf(how.hardest)).toBeLessThanOrEqual(R.TECHNIQUES.indexOf(spec.max));
    expect(R.TECHNIQUES.indexOf(how.hardest)).toBeGreaterThanOrEqual(R.TECHNIQUES.indexOf(spec.min));
    // No bed is a free answer.
    for (let k = 0; k < board.n; k++) expect(board.beds.filter((x) => x === k).length).toBeGreaterThan(1);
    // Every bed is one piece.
    for (let k = 0; k < board.n; k++) {
      const cells = board.beds.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0);
      const seen = new Set([cells[0]]);
      const stack = [cells[0]];
      while (stack.length) {
        const i = stack.pop()!;
        for (const j of [i - board.n, i + board.n, i % board.n ? i - 1 : -1, (i + 1) % board.n ? i + 1 : -1]) {
          if (j >= 0 && j < board.n * board.n && board.beds[j] === k && !seen.has(j)) { seen.add(j); stack.push(j); }
        }
      }
      expect(seen.size).toBe(cells.length);
    }
    // Twists are needed: without them this would not be the one answer.
    if (Object.keys(board.twists).length) {
      const plain = R.solutions(board, 2, { plain: true });
      expect(plain.length === 1 && plain[0].join() === board.answer.join()).toBe(false);
    }
    return board;
  };

  it("makes seedling boards with no twists", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const b = check(R.generate("seedling", Parlour.mulberry32(seed)), "seedling");
      expect(Object.keys(b.twists)).toEqual([]);
    }
  });

  it("makes plain border boards, the rules Meowdoku and Queens players already know", () => {
    for (let seed = 1; seed <= 4; seed++) {
      const b = check(R.generate("border", Parlour.mulberry32(seed * 13)), "border");
      expect(Object.keys(b.twists)).toEqual([]);
    }
  });

  for (const kind of ["cactus", "fern", "climber", "succulent"] as const) {
    it(`makes border boards around a ${kind}, which they need`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const b = check(R.generate("border", Parlour.mulberry32(seed * 101), { twists: [kind] }), "border");
        expect(Object.values(b.twists)).toEqual([kind]);
      }
    });
  }

  it("makes allotment boards with two twists", () => {
    for (let seed = 1; seed <= 2; seed++) {
      const b = check(R.generate("allotment", Parlour.mulberry32(seed * 7)), "allotment");
      expect(Object.keys(b.twists)).toHaveLength(2);
    }
  });

  it("is the same board from the same seed", () => {
    const a = R.generate("border", Parlour.mulberry32(42));
    const b = R.generate("border", Parlour.mulberry32(42));
    expect(a).toEqual(b);
  });

  it("makes a meet-the-twist board for each twist, small and gentle", () => {
    for (const kind of R.KINDS) {
      const b = check(R.generate("seedling", Parlour.mulberry32(R.MEET_SEEDS[kind]), { twists: [kind] }), "seedling");
      expect(Object.values(b.twists)).toEqual([kind]);
    }
  });
});

describe("the daily board", () => {
  it("rotates through all four twists, one a day", () => {
    expect(new Set([0, 1, 2, 3].map(R.dailyTwist))).toEqual(new Set(R.KINDS));
  });

  /*
   * Pinned. The daily is made in the browser from its seed, so any change to
   * the generator changes every future daily for everybody. If this fails,
   * that is what is happening: bump VERSION on purpose, then re-pin.
   */
  it("is pinned for version 1", () => {
    const day = Parlour.dayNumber(new Date("2026-10-05T12:00:00Z"));
    expect(R.VERSION).toBe(1);
    const b = R.generate("border", Parlour.mulberry32(R.dailySeed(day)), { twists: [R.dailyTwist(day)] })!;
    expect(R.dailyTwist(day)).toBe("succulent");
    expect(b.beds.join("")).toBe("2201111200111620011162203466533344655566665556666");
    expect(b.answer).toEqual([2, 4, 0, 3, 5, 1, 6]);
  });
});

describe("progress", () => {
  const p = (over: Partial<ReturnType<typeof R.emptyProgress>>) => ({ ...R.emptyProgress(), ...over });

  it("never goes backwards when an account is merged in", () => {
    const merged = R.mergeProgress(p({ done: 5, bySize: { border: 3 } }), p({ done: 2, bySize: { border: 4, allotment: 1 } }));
    expect(merged.done).toBe(5);
    expect(merged.bySize).toEqual({ border: 4, allotment: 1 });
  });

  it("keeps the later daily, and a finished one over one in play", () => {
    const d = (num: number, state: string, done: boolean) => ({ num, state, done });
    expect(R.laterDaily(d(3, "p..", false), d(4, "...", false))!.num).toBe(4);
    expect(R.laterDaily(d(4, "ppp", false), d(4, "p..", true))!.done).toBe(true);
    expect(R.laterDaily(d(4, "p..", false), d(4, "pp.", false))!.state).toBe("pp.");
  });
});
