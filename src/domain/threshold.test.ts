import { describe, expect, test } from "vitest";
import { planLength, REPLAY_AFTER_MS, replayOnReturn, SKIP_FADE_MS, thresholdPlan } from "./threshold";

describe("the opening sequence", () => {
  test("every opening: doors over 1.6 s, the wordmark, a long hold on the room, about 4 s", () => {
    const plan = thresholdPlan({ reduceMotion: false });
    expect(plan.kind).toBe("full");
    expect(plan.doorsSwing && plan.wordmark).toBe(true);
    expect(plan.doorsMs).toBe(1600);
    // The wordmark comes up as the doors clear it, not after a pause.
    expect(plan.wordmarkDelayMs).toBeLessThan(plan.doorsDelayMs + plan.doorsMs);
    // Held on the lit room for over a second before the fade.
    expect(plan.fadeDelayMs - (plan.wordmarkDelayMs + plan.wordmarkMs)).toBeGreaterThanOrEqual(1000);
    expect(planLength(plan)).toBeLessThan(4500);
  });

  test("reduce motion: nothing swings, only a fade", () => {
    const plan = thresholdPlan({ reduceMotion: true });
    expect(plan.kind).toBe("fade");
    expect(plan.doorsSwing).toBe(false);
    expect(planLength(plan)).toBeLessThan(1000);
  });

  test("coming back after a while opens the doors again; a quick detour doesn't", () => {
    expect(replayOnReturn(20 * 1000)).toBe(false); // the photo picker
    expect(replayOnReturn(REPLAY_AFTER_MS - 1)).toBe(false);
    expect(replayOnReturn(REPLAY_AFTER_MS)).toBe(true);
    expect(replayOnReturn(3 * 60 * 60 * 1000)).toBe(true);
  });

  test("a skip clears it quickly", () => {
    expect(SKIP_FADE_MS).toBeLessThanOrEqual(250);
  });
});
