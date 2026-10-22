import { describe, expect, it } from "vitest";
import type { CareType } from "./care";
import { careDays, RATING_AFTER_DAYS, RATING_ASK, shouldAskForRating } from "./rating";

const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).toISOString();
const ev = (type: CareType, day: number, hour?: number) => ({ type, occurredAt: at(day, hour) });

describe("days with care logged", () => {
  it("counts each day once, however much was logged on it", () => {
    expect(careDays([ev("WATER", 1, 9), ev("WATER", 1, 18), ev("FERTILIZE", 1), ev("WATER", 2)])).toBe(2);
  });

  it("counts only care the keeper logged, not a new plant's first entry or the app's own checks", () => {
    expect(careDays([ev("ACQUIRED", 1), ev("AI_CHECK", 2), ev("PROPAGATED", 3), ev("STILL_MOIST", 4), ev("NOTE", 5)])).toBe(2);
  });
});

describe("asking for a rating", () => {
  const ready = { androidApp: true, answered: false, careDays: RATING_AFTER_DAYS };

  it("asks once care has been logged on five different days", () => {
    expect(shouldAskForRating(ready)).toBe(true);
    expect(shouldAskForRating({ ...ready, careDays: RATING_AFTER_DAYS - 1 })).toBe(false);
  });

  it("never asks twice, whichever way it was answered", () => {
    expect(shouldAskForRating({ ...ready, answered: true, careDays: 40 })).toBe(false);
  });

  it("only asks in the Android app, which has a listing to rate", () => {
    expect(shouldAskForRating({ ...ready, androidApp: false })).toBe(false);
  });

  it("asks without fishing for stars or offering anything for them", () => {
    const words = Object.values(RATING_ASK).join(" ");
    expect(words).not.toMatch(/star|5|five|reward|free|unlock/i);
  });
});
