/**
 * Forget-Me-Not's rules: the deal, a turn, the nudge and the merge.
 *
 * The page only draws what these say, so these are where the house rules are
 * kept: a miss waits for the player rather than a clock, a nudge only points
 * at what has already been seen, and signing in never loses anything.
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const R = require("./forget-me-not-rules.js") as typeof import("./forget-me-not-rules.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parlour = require("./harness.js") as typeof import("./harness.js");

type Board = ReturnType<typeof R.deal>;
type Position = ReturnType<typeof R.start>;

/** Play a list of taps from the start, returning the last turn. */
const play = (b: Board, taps: number[], from: Position = R.start(b)) => {
  let st = from;
  let last = { st, event: "ignored" } as ReturnType<typeof R.turn>;
  for (const i of taps) {
    last = R.turn(b, st, i);
    st = last.st;
  }
  return last;
};

/** Card indices of each plant on the board. */
const pairsOf = (b: Board) => {
  const at: Record<string, number[]> = {};
  b.cards.forEach((k, i) => (at[k] = [...(at[k] ?? []), i]));
  return Object.values(at);
};

describe("the plants", () => {
  it("are each drawn, named and told apart", () => {
    const keys = R.KINDS.map((k) => k.key);
    const names = R.KINDS.map((k) => k.name);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(names).size).toBe(names.length);
    for (const k of R.KINDS) {
      expect(k.art.startsWith('<svg viewBox="0 0 40 40" aria-hidden="true">')).toBe(true);
      expect(k.art.endsWith("</svg>")).toBe(true);
      expect(k.fact.length).toBeGreaterThan(20);
    }
    // No two plants share a drawing.
    expect(new Set(R.KINDS.map((k) => k.art)).size).toBe(R.KINDS.length);
  });

  it("link only to care-library pages that exist", () => {
    for (const k of R.KINDS) {
      if (k.slug) expect(existsSync(`public/plants/${k.slug}.html`), k.slug).toBe(true);
    }
  });

  it("are enough for the biggest table", () => {
    const most = Math.max(...R.SIZES.map((s) => s.pairs));
    expect(R.KINDS.length).toBeGreaterThanOrEqual(most);
  });
});

describe("the deal", () => {
  it("lays every plant twice, in a full grid", () => {
    for (const size of R.SIZES) {
      const b = R.deal(size.key, Parlour.mulberry32(7));
      expect(b.cards.length).toBe(size.pairs * 2);
      expect(b.cols * b.rows).toBe(b.cards.length);
      for (const pair of pairsOf(b)) expect(pair.length).toBe(2);
      expect(pairsOf(b).length).toBe(size.pairs);
    }
  });

  it("deals the same table from the same seed, and another from another", () => {
    const one = R.deal("bunch", Parlour.mulberry32(42)).cards;
    expect(R.deal("bunch", Parlour.mulberry32(42)).cards).toEqual(one);
    expect(R.deal("bunch", Parlour.mulberry32(43)).cards).not.toEqual(one);
  });

  it("gives everyone the same daily table, and a new one tomorrow", () => {
    const day = (n: number) => R.deal(R.DAILY_SIZE, Parlour.mulberry32(R.dailySeed(n))).cards;
    expect(day(33)).toEqual(day(33));
    expect(day(34)).not.toEqual(day(33));
  });

  it("keeps a pinned daily board, so a change to the deal is never an accident", () => {
    // If this fails, the deal changed: bump VERSION, and update this pin.
    const b = R.deal(R.DAILY_SIZE, Parlour.mulberry32(R.dailySeed(33)));
    expect(R.VERSION).toBe(1);
    expect(b.cards.slice(0, 4)).toEqual(PINNED_DAY_33);
  });

  it("starts the practice board on a top row with no pair in it", () => {
    const top = R.PRACTICE.cards.slice(0, R.PRACTICE.cols);
    expect(new Set(top).size).toBe(top.length);
    for (const pair of pairsOf(R.PRACTICE)) expect(pair.length).toBe(2);
  });
});

describe("a turn", () => {
  const b = R.PRACTICE; // monstera cactus fern / cactus fern monstera

  it("shows the first card and waits for the second", () => {
    const t = play(b, [0]);
    expect(t.event).toBe("first");
    expect(t.st.up).toEqual([0]);
    expect(t.st.turns).toBe(0);
  });

  it("keeps a pair face up", () => {
    const t = play(b, [0, 5]);
    expect(t.event).toBe("match");
    expect(t.kind).toBe("monstera");
    expect(t.st.cards[0]).toBe("m");
    expect(t.st.cards[5]).toBe("m");
    expect(t.st.up).toEqual([]);
    expect(t.st.turns).toBe(1);
  });

  it("leaves a miss showing until the next tap -- never on a timer", () => {
    const t = play(b, [0, 1]);
    expect(t.event).toBe("miss");
    expect(t.st.up).toEqual([0, 1]);
    expect(t.st.cards.slice(0, 2)).toBe("ss");
  });

  it("turns a miss back when one of its cards is tapped, and nothing else", () => {
    const t = play(b, [0, 1, 1]);
    expect(t.event).toBe("hide");
    expect(t.st.up).toEqual([]);
    expect(t.st.turns).toBe(1);
  });

  it("turns a miss back and a fresh card over in one tap", () => {
    const t = play(b, [0, 1, 2]);
    expect(t.event).toBe("first");
    expect(t.hid).toBe(true);
    expect(t.st.up).toEqual([2]);
  });

  it("ignores a card that is already up or already found", () => {
    expect(play(b, [0, 0]).event).toBe("ignored");
    expect(play(b, [0, 5, 0]).event).toBe("ignored");
    expect(play(b, [0, 5, 0]).st.turns).toBe(1);
  });

  it("counts turns as pairs of cards, not taps", () => {
    const t = play(b, [0, 1, 2, 3, 1, 3]);
    expect(t.event).toBe("match");
    expect(t.st.turns).toBe(3);
  });

  it("is solved when every pair is found", () => {
    const t = play(b, [0, 5, 1, 3, 2, 4]);
    expect(R.isSolved(b, t.st)).toBe(true);
    expect(R.found(t.st)).toBe(3);
    expect(t.st.turns).toBe(3);
  });

  it("solves any dealt table by turning each pair together", () => {
    for (const size of R.SIZES) {
      const big = R.deal(size.key, Parlour.mulberry32(99));
      const t = play(big, pairsOf(big).flat());
      expect(R.isSolved(big, t.st)).toBe(true);
      expect(t.st.turns).toBe(size.pairs);
    }
  });
});

describe("the nudge", () => {
  const b = R.PRACTICE;

  it("points at two seen cards that make a pair", () => {
    // Monstera at 0 and fern at 2 seen, then the fern at 4 and monstera at 5.
    const st = play(b, [0, 2, 4, 5]).st; // second turn misses: fern 4, monstera 5
    const n = R.nudge(b, { ...st, up: [] })!;
    expect(n.cells.sort()).toEqual([0, 5]);
  });

  it("points at the twin of the card showing, once the twin has been seen", () => {
    const st = play(b, [0, 1, 5]).st; // monstera 0 seen, then the other monstera up
    const n = R.nudge(b, { ...st, up: [3] })!; // cactus 3 up; its twin 1 was seen
    expect(n.cells).toEqual([1]);
    expect(n.why).toMatch(/twin/);
  });

  it("never points at a card nobody has seen", () => {
    const n = R.nudge(b, R.start(b))!;
    expect(n.cells).toEqual([]);
    const one = R.nudge(b, play(b, [0]).st)!;
    expect(one.cells).toEqual([]);
  });

  it("says to turn a miss back first", () => {
    expect(R.nudge(b, play(b, [0, 1]).st)!.why).toMatch(/turn these two back/);
  });

  it("has nothing to say once the table is clear", () => {
    expect(R.nudge(b, play(b, [0, 5, 1, 3, 2, 4]).st)).toBeNull();
  });
});

describe("words", () => {
  const b = R.PRACTICE;

  it("describe a card for a screen reader, face down, up and found", () => {
    expect(R.describeCard(b, R.start(b), 2)).toBe("card 3 of 6, face down");
    expect(R.describeCard(b, play(b, [2]).st, 2)).toBe("card 3 of 6, Boston fern");
    expect(R.describeCard(b, play(b, [2, 4]).st, 4)).toBe("card 5 of 6, Boston fern, found");
  });

  it("share a daily result without giving the table away", () => {
    const text = R.shareText(33, 8, 14, false);
    expect(text).toContain("#33");
    expect(text).toContain("14 turns, no nudges");
    expect(text).toContain("plantparlour.org/parlour-games/forget-me-not/daily");
    for (const k of R.KINDS) expect(text).not.toContain(k.name);
  });
});

describe("signing in", () => {
  it("never loses a count, a size or a daily", () => {
    const local = { done: 3, bySize: { posy: 3 }, nudgeFree: 1, daily: { num: 33, cards: "mm..", turns: 2, done: false } };
    const remote = { done: 5, bySize: { bunch: 5 }, nudgeFree: 0, daily: { num: 32, cards: "mmmm", turns: 4, done: true } };
    const merged = R.mergeProgress(local, remote);
    expect(merged.done).toBe(5);
    expect(merged.nudgeFree).toBe(1);
    expect(merged.bySize).toEqual({ posy: 3, bunch: 5 });
    expect(merged.daily!.num).toBe(33);
  });

  it("prefers a finished daily, then the one further along", () => {
    const a = { num: 33, cards: "mm..", turns: 2, done: false };
    const b = { num: 33, cards: "mmmm", turns: 3, done: true };
    expect(R.laterDaily(a, b)).toBe(b);
    const c = { num: 33, cards: "mmm.", turns: 3, done: false };
    expect(R.laterDaily(a, c)).toBe(c);
  });

  it("keeps the local progress when there is nothing remote", () => {
    const local = R.emptyProgress();
    expect(R.mergeProgress(local, null)).toBe(local);
  });
});

/* The first four cards of day 33's daily table, as dealt by VERSION 1. */
const PINNED_DAY_33 = ["aloe", "fern", "pilea", "zz"];
