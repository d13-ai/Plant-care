import { describe, expect, test } from "vitest";
import { careStatuses } from "./care";
import {
  DEFAULT_REMINDER_PREFS,
  formatReminderTime,
  MAX_QUEUED,
  nameList,
  outstanding,
  PLAN_DAYS,
  planReminders,
  shortHowTo,
  staleShown,
  type ReminderPlant,
} from "./reminders";

// Local wall-clock times throughout, so the tests mean the same in any timezone.
const day = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m);
const NOW = day(7, 8); // 7 Oct, 8am — before the 9am reminder time

/** A plant watered on `wateredOn` (an October date) on a `every`-day cadence, with nothing else scheduled. */
function plant(id: number, nickname: string, wateredOn: number, every = 7, extra: Partial<ReminderPlant> = {}): ReminderPlant {
  const statuses = careStatuses(
    { waterEveryDays: every, fertilizeEveryDays: null, repotEveryDays: null, photoEveryDays: null },
    [{ type: "WATER", occurredAt: day(wateredOn, 19) }],
    NOW,
  );
  return { id, nickname, statuses, ...extra };
}

describe("due alerts", () => {
  test("ping on the day something falls due, at the reminder time", () => {
    const plan = planReminders([plant(1, "Monstera", 3)], { ...DEFAULT_REMINDER_PREFS, overdueNudge: false }, NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      id: "due:1:20261010",
      title: "💧 Monstera needs water",
      body: "Due today. Open Monstera to log it.",
      items: ["1:WATER"],
      plantId: 1,
    });
    expect(plan[0].at).toEqual(day(10, 9));
  });

  test("carry the species guide's advice when the guide is on the phone", () => {
    const [alert] = planReminders(
      [plant(1, "Monstera", 3, 7, { howTo: { WATER: "Water when the top two inches are dry." } })],
      { ...DEFAULT_REMINDER_PREFS, overdueNudge: false },
      NOW,
    );
    expect(alert.body).toBe("Water when the top two inches are dry.");
  });

  test("one ping per plant when two things fall due the same day", () => {
    const statuses = careStatuses(
      { waterEveryDays: 7, fertilizeEveryDays: 7, repotEveryDays: null, photoEveryDays: null },
      [
        { type: "WATER", occurredAt: day(3, 19) },
        { type: "FERTILIZE", occurredAt: day(3, 19) },
      ],
      NOW,
    );
    const plan = planReminders([{ id: 4, nickname: "Fern", statuses }], { ...DEFAULT_REMINDER_PREFS, overdueNudge: false }, NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].title).toBe("Fern needs care today");
    expect(plan[0].body).toBe("💧 Water · 🌱 Fertilize");
    expect(plan[0].items).toEqual(["4:WATER", "4:FERTILIZE"]);
  });

  test("today's ping is planned while the reminder time is still to come, and not after", () => {
    const dueToday = plant(1, "Monstera", 0); // watered 30 Sep, due 7 Oct
    const prefs = { ...DEFAULT_REMINDER_PREFS, overdueNudge: false };
    expect(planReminders([dueToday], prefs, day(7, 8))[0]?.at).toEqual(day(7, 9));
    expect(planReminders([dueToday], prefs, day(7, 10))).toEqual([]);
  });

  test("nothing past the planning window, and nothing for care that's switched off", () => {
    const far = plant(1, "Cactus", 6, 30);
    const off: ReminderPlant = {
      id: 2,
      nickname: "Ivy",
      statuses: careStatuses({ waterEveryDays: null, fertilizeEveryDays: null, repotEveryDays: null, photoEveryDays: null }, [], NOW),
    };
    expect(planReminders([far, off], DEFAULT_REMINDER_PREFS, NOW)).toEqual([]);
  });
});

describe("the daily nudge", () => {
  test("takes up what's left from an earlier day, every day until it's done", () => {
    const plan = planReminders([plant(1, "Pothos", 3)], DEFAULT_REMINDER_PREFS, NOW);
    // Due alert on the 10th, then a nudge each morning after.
    expect(plan[0].id).toBe("due:1:20261010");
    const nudges = plan.filter((p) => p.id.startsWith("nudge:"));
    expect(nudges[0]).toMatchObject({ id: "nudge:20261011", title: "💧 Pothos needs water", body: "Due yesterday. Open Pothos to log it." });
    expect(nudges[1].body).toBe("Due 2 days ago. Open Pothos to log it.");
    expect(nudges.at(-1)!.at).toEqual(day(7 + PLAN_DAYS - 1, 9));
  });

  test("gathers several plants into one, a line per kind of care", () => {
    const statuses = careStatuses(
      { waterEveryDays: null, fertilizeEveryDays: 30, repotEveryDays: null, photoEveryDays: null },
      [{ type: "FERTILIZE", occurredAt: new Date(2026, 8, 1) }],
      NOW,
    );
    const plants = [plant(1, "Pothos", 0), plant(2, "Fern", 1), { id: 3, nickname: "Monstera", statuses }];
    const [first] = planReminders(plants, DEFAULT_REMINDER_PREFS, NOW).filter((p) => p.id.startsWith("nudge:"));
    // 7 Oct: Fern (due the 8th) isn't waiting yet; Pothos is due today, so it gets its own alert.
    expect(first).toMatchObject({ id: "nudge:20261007", title: "🌱 Monstera needs fertilizer", plantId: 3 });
    const next = planReminders(plants, DEFAULT_REMINDER_PREFS, NOW).find((p) => p.id === "nudge:20261009")!;
    expect(next.title).toBe("3 plants need care");
    expect(next.body).toBe("💧 Water: Pothos and Fern\n🌱 Fertilize: Monstera");
    expect(next.plantId).toBeNull();
  });

  test("with due alerts off, it takes in the day's own care too", () => {
    const plan = planReminders([plant(1, "Pothos", 3)], { ...DEFAULT_REMINDER_PREFS, dueAlerts: false }, NOW);
    expect(plan[0]).toMatchObject({ id: "nudge:20261010", body: "Due today. Open Pothos to log it." });
  });

  test("both off plans nothing at all", () => {
    expect(planReminders([plant(1, "Pothos", 0)], { ...DEFAULT_REMINDER_PREFS, dueAlerts: false, overdueNudge: false }, NOW)).toEqual([]);
  });
});

describe("keeping the queue honest", () => {
  test("logging the care takes its reminders out of the plan", () => {
    const before = planReminders([plant(1, "Pothos", 3)], DEFAULT_REMINDER_PREFS, NOW);
    // Watered this morning instead: next due the 14th.
    const after = planReminders([plant(1, "Pothos", 7)], DEFAULT_REMINDER_PREFS, NOW);
    expect(before[0].id).toBe("due:1:20261010");
    expect(after[0].id).toBe("due:1:20261014");
  });

  test("never more than the phone will hold, soonest kept", () => {
    const many = Array.from({ length: 80 }, (_, i) => plant(i + 1, `Plant ${i + 1}`, (i % 7) + 1));
    const plan = planReminders(many, DEFAULT_REMINDER_PREFS, NOW);
    expect(plan).toHaveLength(MAX_QUEUED);
    const times = plan.map((p) => p.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  test("a shown reminder goes once none of its care is still waiting", () => {
    const plants = [plant(1, "Pothos", 0), plant(2, "Fern", 6)];
    const waiting = outstanding(plants, NOW);
    expect([...waiting]).toEqual(["1:WATER"]);
    expect(
      staleShown(
        [
          { id: "a", items: ["1:WATER", "2:WATER"] },
          { id: "b", items: ["2:WATER"] },
          { id: "c", items: [] },
        ],
        waiting,
      ),
    ).toEqual(["b"]);
  });
});

describe("wording", () => {
  test("name lists stay short", () => {
    expect(nameList(["A"])).toBe("A");
    expect(nameList(["A", "B"])).toBe("A and B");
    expect(nameList(["A", "B", "C"])).toBe("A, B and C");
    expect(nameList(["A", "B", "C", "D", "E"])).toBe("A, B and 3 more");
  });

  test("a guide's advice is cut to its first sentence", () => {
    expect(shortHowTo("Water when dry. Never let it sit in water.")).toBe("Water when dry.");
    expect(shortHowTo("  ")).toBeUndefined();
    expect(shortHowTo("x".repeat(200))!.length).toBe(140);
  });

  test("times read the way people say them", () => {
    expect(formatReminderTime(9, 0)).toBe("9am");
    expect(formatReminderTime(12, 0)).toBe("12pm");
    expect(formatReminderTime(18, 30)).toBe("6:30pm");
    expect(formatReminderTime(0, 0)).toBe("12am");
  });
});
