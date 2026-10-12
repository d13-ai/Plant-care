import { describe, expect, test } from "vitest";
import { planLength, SKIP_FADE_MS, thresholdPlan } from "./threshold";

describe("the opening sequence", () => {
  test("first launch: doors over about 1.2 s, the wordmark, half a second's hold, all under 3 s", () => {
    const plan = thresholdPlan({ seenBefore: false, reduceMotion: false });
    expect(plan.kind).toBe("full");
    expect(plan.doorsSwing && plan.wordmark).toBe(true);
    expect(plan.doorsMs).toBe(1200);
    // The wordmark comes up as the doors clear it, not after a pause.
    expect(plan.wordmarkDelayMs).toBeLessThan(plan.doorsDelayMs + plan.doorsMs);
    // Held for about half a second before the fade.
    expect(plan.fadeDelayMs - (plan.wordmarkDelayMs + plan.wordmarkMs)).toBe(500);
    expect(planLength(plan)).toBeLessThan(3000);
  });

  test("every launch after: the doors alone, about a second", () => {
    const plan = thresholdPlan({ seenBefore: true, reduceMotion: false });
    expect(plan.kind).toBe("short");
    expect(plan.wordmark).toBe(false);
    expect(planLength(plan)).toBeGreaterThanOrEqual(800);
    expect(planLength(plan)).toBeLessThanOrEqual(1100);
  });

  test("reduce motion: nothing swings, only a fade, first launch or not", () => {
    for (const seenBefore of [false, true]) {
      const plan = thresholdPlan({ seenBefore, reduceMotion: true });
      expect(plan.kind).toBe("fade");
      expect(plan.doorsSwing).toBe(false);
      expect(planLength(plan)).toBeLessThan(1000);
    }
  });

  test("a skip clears it quickly", () => {
    expect(SKIP_FADE_MS).toBeLessThanOrEqual(250);
  });
});
