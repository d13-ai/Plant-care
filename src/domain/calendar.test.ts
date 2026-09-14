import { describe, expect, it } from "vitest";
import { buildPlantIcs, slugify, tasksFromStatuses } from "./calendar";
import type { CareStatus } from "./care";

const NOW = new Date("2026-09-14T12:00:00Z");

function status(over: Partial<CareStatus>): CareStatus {
  return {
    type: "WATER",
    label: "Water",
    dueLabel: "Needs water",
    everyDays: 7,
    lastAt: null,
    dueAt: "2026-09-16T09:00:00Z",
    state: "OK",
    daysSinceLast: null,
    daysUntilDue: 2,
    ...over,
  };
}

describe("tasksFromStatuses", () => {
  it("keeps only care with a cadence and a due date", () => {
    const tasks = tasksFromStatuses(
      [
        status({ type: "WATER", everyDays: 7 }),
        status({ type: "REPOT", everyDays: null, dueAt: null, state: "OFF" }),
        status({ type: "FERTILIZE", everyDays: 30 }),
      ],
      null,
    );
    expect(tasks.map((t) => t.type)).toEqual(["WATER", "FERTILIZE"]);
  });

  it("folds the matching care-guide field into each task's instructions", () => {
    const [water] = tasksFromStatuses([status({ type: "WATER" })], {
      water: "Water when the top inch dries out.",
      humidity: "60%+",
      feeding: "Monthly in spring.",
    });
    expect(water.instructions).toContain("top inch");
    expect(water.instructions).toContain("Humidity: 60%+");
  });

  it("gives PHOTO a sensible default even with no care guide", () => {
    const [photo] = tasksFromStatuses([status({ type: "PHOTO", label: "New photo" })], null);
    expect(photo.instructions).toMatch(/fresh photo/i);
  });
});

describe("buildPlantIcs", () => {
  const tasks = tasksFromStatuses(
    [
      status({ type: "WATER", everyDays: 7, dueAt: "2026-09-16T09:00:00Z" }),
      status({ type: "FERTILIZE", everyDays: 30, dueAt: "2026-10-14T09:00:00Z" }),
    ],
    { water: "Keep evenly moist.", feeding: "Balanced feed monthly." },
  );

  it("produces one recurring VEVENT per task with the right cadence", () => {
    const ics = buildPlantIcs({ nickname: "Auggie", species: "Monstera deliciosa", tasks, now: NOW });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("RRULE:FREQ=DAILY;INTERVAL=7");
    expect(ics).toContain("RRULE:FREQ=DAILY;INTERVAL=30");
  });

  it("uses floating local 9am start times and carries the instructions", () => {
    const ics = buildPlantIcs({ nickname: "Auggie", tasks, now: NOW });
    // Floating time: no trailing Z on DTSTART.
    expect(ics).toMatch(/DTSTART:\d{8}T090000(?!Z)/);
    expect(ics).toContain("Keep evenly moist.");
    expect(ics).toContain("Balanced feed monthly.");
  });

  it("does not schedule the first reminder in the past", () => {
    const overdue = tasksFromStatuses(
      [status({ type: "WATER", everyDays: 3, dueAt: "2026-09-01T09:00:00Z", state: "OVERDUE" })],
      null,
    );
    const ics = buildPlantIcs({ nickname: "Late", tasks: overdue, now: NOW });
    // Clamped to today (2026-09-14), not the original 2026-09-01.
    expect(ics).toContain("DTSTART:20260914T090000");
    expect(ics).not.toContain("DTSTART:20260901");
  });

  it("escapes commas and semicolons in text fields", () => {
    const ics = buildPlantIcs({
      nickname: "Fern; the bold, one",
      tasks: tasksFromStatuses([status({ type: "WATER" })], { water: "Bright, indirect; never soggy." }),
      now: NOW,
    });
    expect(ics).toContain("Bright\\, indirect\\; never soggy.");
  });
});

describe("slugify", () => {
  it("makes a filesystem-safe slug", () => {
    expect(slugify("Thai Constellation #1!")).toBe("thai-constellation-1");
    expect(slugify("   ")).toBe("plant");
  });
});
