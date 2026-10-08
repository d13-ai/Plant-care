import { describe, expect, test } from "vitest";
import { describeShots, healthCheckShots } from "./health-shots";

// Local wall-clock times, so the tests mean the same in any timezone.
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();
const photo = (name: string, day: number, hour = 12) => ({ uri: name, takenAt: at(day, hour) });
const NOW = new Date(2026, 9, 8, 20);

describe("which photos a health check sends", () => {
  test("one new photo goes with the newest earlier one, not the whole history", () => {
    const shots = healthCheckShots([photo("old", 14 - 30), photo("sep19", 19 - 30), photo("today", 8)]);
    expect(shots.map((s) => [s.uri, s.role])).toEqual([
      ["today", "current"],
      ["sep19", "earlier"],
    ]);
  });

  test("several taken the same day all count as now, with room left for one earlier", () => {
    const shots = healthCheckShots([photo("a", 8, 9), photo("b", 8, 10), photo("before", 1)]);
    expect(shots.map((s) => [s.uri, s.role])).toEqual([
      ["b", "current"],
      ["a", "current"],
      ["before", "earlier"],
    ]);
  });

  test("a full set from today leaves no room for a comparison", () => {
    const shots = healthCheckShots([photo("a", 8, 9), photo("b", 8, 10), photo("c", 8, 11), photo("before", 1)]);
    expect(shots.every((s) => s.role === "current")).toBe(true);
    expect(shots).toHaveLength(3);
  });

  test("a plant with one photo sends just that", () => {
    expect(healthCheckShots([photo("only", 3)])).toEqual([{ ...photo("only", 3), role: "current" }]);
    expect(healthCheckShots([])).toEqual([]);
  });
});

describe("what the button says", () => {
  test("today's photo and the comparison, by date", () => {
    const shots = healthCheckShots([photo("sep19", 19 - 30), photo("today", 8)]);
    expect(describeShots(shots, NOW)).toBe("Sends today's photo, and one from Sep 19 to compare against.");
  });

  test("no new photo today says which day it is reading", () => {
    const shots = healthCheckShots([photo("a", 3), photo("b", 1)]);
    expect(describeShots(shots, NOW)).toBe("Sends the Oct 3 photo, and one from Oct 1 to compare against.");
  });

  test("several today, nothing earlier", () => {
    const shots = healthCheckShots([photo("a", 8, 9), photo("b", 8, 10)]);
    expect(describeShots(shots, NOW)).toBe("Sends 2 of today's photos.");
  });
});
