/**
 * The rules in the harness that are pure, and therefore the ones worth
 * pinning down: the shared calendar, the mode switch, and the streak merge.
 *
 * The streak merge is here because the version that lived inside Trickle was
 * wrong and nothing could see it. `mergeProgress` rebuilt the stats object
 * from a fixed list of fields and quietly dropped `stats.daily`, so every
 * pull wiped a signed-in keeper's streak and then pushed the wipe back to
 * the server. It passed the smoke test because the smoke test plays signed
 * out. Extracting this was how it became visible; these tests are how it
 * stays fixed.
 */
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parlour = require("./harness.js") as typeof import("./harness.js");

type Streak = { last: number | null; streak: number; longest: number; played: number };
const streak = (last: number | null, s: number, longest = s, played = s): Streak =>
  ({ last, streak: s, longest, played });

describe("the shared calendar", () => {
  it("counts day 1 from the epoch", () => {
    expect(Parlour.dayNumber(new Date(2026, 8, 17))).toBe(1);
    expect(Parlour.dayNumber(new Date(2026, 8, 18))).toBe(2);
    expect(Parlour.dayNumber(new Date(2026, 9, 1))).toBe(15);
  });

  it("is the same number all day, whatever the clock says", () => {
    const early = Parlour.dayNumber(new Date(2026, 9, 1, 0, 0, 1));
    const late = Parlour.dayNumber(new Date(2026, 9, 1, 23, 59, 59));
    expect(early).toBe(late);
  });

  it("counts down to the next local midnight", () => {
    const ms = Parlour.msUntilTomorrow(new Date(2026, 9, 1, 23, 0, 0));
    expect(ms).toBe(60 * 60 * 1000);
  });

  it("deals the same sequence from the same seed", () => {
    const a = Parlour.mulberry32(42), b = Parlour.mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("which page this is", () => {
  const at = (pathname: string, search = "") => Parlour.mode({ pathname, search });

  it("reads practice, daily and embed off the path", () => {
    expect(at("/parlour-games/trickle/learn").learn).toBe(true);
    expect(at("/parlour-games/trickle/daily").daily).toBe(true);
    expect(at("/parlour-games/trickle/embed").embed).toBe(true);
  });

  it("reads them off the query string too", () => {
    expect(at("/parlour-games/trickle", "?learn=1").learn).toBe(true);
    expect(at("/parlour-games/trickle", "?daily=1").daily).toBe(true);
  });

  it("lets practice win over the daily board", () => {
    const m = at("/parlour-games/trickle", "?learn=1&daily=1");
    expect(m.learn).toBe(true);
    expect(m.daily).toBe(false);
  });

  it("lets embed combine with either rather than replacing them", () => {
    expect(at("/parlour-games/trickle/embed", "?daily=1")).toEqual({
      learn: false, daily: true, embed: true,
    });
  });

  it("is plain on the ordinary page", () => {
    expect(at("/parlour-games/trickle")).toEqual({ learn: false, daily: false, embed: false });
  });
});

describe("merging the shared streak", () => {
  it("keeps a streak when the other side has never played", () => {
    expect(Parlour.mergeStreak(streak(5, 5), null)).toEqual(streak(5, 5));
    expect(Parlour.mergeStreak(streak(5, 5), { last: null, streak: 0, longest: 0, played: 0 }))
      .toEqual(streak(5, 5));
  });

  it("takes up a streak when this device has never played", () => {
    expect(Parlour.mergeStreak({ last: null, streak: 0, longest: 0, played: 0 }, streak(5, 5)))
      .toEqual(streak(5, 5));
  });

  // The regression. A five-day run, synced against an account row that has
  // the same history: the run has to survive. It did not, before.
  it("does not drop a live streak on a pull", () => {
    const merged = Parlour.mergeStreak(streak(5, 5), streak(5, 5));
    expect(merged!.streak).toBe(5);
  });

  it("lets the device that played most recently hold the live count", () => {
    // Played on the phone yesterday and today; the laptop stopped on day 4.
    const merged = Parlour.mergeStreak(streak(4, 2), streak(6, 4))!;
    expect(merged.last).toBe(6);
    expect(merged.streak).toBe(4);
  });

  it("remembers the longest run either side ever had", () => {
    const merged = Parlour.mergeStreak(streak(9, 2, 2), streak(4, 11, 11))!;
    expect(merged.streak).toBe(2);
    expect(merged.longest).toBe(11);
  });

  it("takes the larger day count rather than adding them up", () => {
    // Adding would grow the total every time the page was opened.
    const merged = Parlour.mergeStreak(streak(5, 5, 5, 12), streak(5, 5, 5, 9))!;
    expect(merged.played).toBe(12);
  });

  it("is order independent", () => {
    const a = streak(7, 3, 9, 20), b = streak(4, 2, 11, 14);
    expect(Parlour.mergeStreak(a, b)).toEqual(Parlour.mergeStreak(b, a));
  });
});

describe("the arcade's own row", () => {
  it("refuses a game that would collide with it", () => {
    expect(() => Parlour.sync({ game: "parlour" } as never)).toThrow(/reserved/);
  });

  /**
   * The point of moving the streak out of the games. Trickle's merge dropped
   * it; any game's merge could. Here the game's merge is as destructive as a
   * merge can be -- it throws away both sides and returns nothing -- and the
   * streak still has to come through a pull intact, because the game never
   * had its hands on it.
   */
  it("keeps the streak safe from a game that mishandles its own", async () => {
    const store: Record<string, string> = {
      "sb-ixagjvntbgyqemxxinqe-auth-token": JSON.stringify({
        access_token: "t", refresh_token: "r",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "00000000-0000-4000-8000-000000000001" },
      }),
      pp_streak: JSON.stringify(streak(9, 9)),
    };
    const g = globalThis as Record<string, unknown>;
    const before = { window: g.window, fetch: g.fetch };
    g.window = { localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
    } };
    // The account has never seen this keeper's streak, and the game's own
    // row comes back with something it will mangle.
    g.fetch = async (url: string) =>
      /select=/.test(url)
        ? { ok: true, json: async () => [{ game: "trickle", progress: { anything: 1 } }] }
        : { ok: true, json: async () => ({}) };

    try {
      const s = Parlour.sync({
        game: "trickle",
        local: () => ({ anything: 0 }),
        merge: () => undefined,          // as bad as a merge can be
        apply: () => {},
        onStatus: () => {},
      });
      await s.pull();
      expect(JSON.parse(store.pp_streak).streak).toBe(9);
    } finally {
      g.window = before.window;
      g.fetch = before.fetch;
    }
  });
});
