import { describe, expect, it } from "vitest";
import {
  careStatuses,
  keeperHistory,
  openIssues,
  plantAlerts,
  relativeDays,
  loggedToday,
  moistSnoozeDays,
  REPEAT_PROMPT,
  slowerWatering,
} from "./care";

const now = new Date("2026-09-13T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

const cadence = {
  waterEveryDays: 7,
  fertilizeEveryDays: 30,
  repotEveryDays: 365,
  photoEveryDays: 180,
  acquiredAt: daysAgo(40),
  createdAt: daysAgo(40),
};

const byType = (statuses: ReturnType<typeof careStatuses>) =>
  Object.fromEntries(statuses.map((s) => [s.type, s]));

describe("careStatuses", () => {
  it("flags overdue, due-soon and ok from the last logged event", () => {
    const s = byType(
      careStatuses(
        cadence,
        [
          { type: "WATER", occurredAt: daysAgo(9) },
          { type: "WATER", occurredAt: daysAgo(20) },
          { type: "FERTILIZE", occurredAt: daysAgo(29) },
          { type: "PHOTO", occurredAt: daysAgo(10) },
        ],
        now,
      ),
    );
    expect(s.WATER.state).toBe("OVERDUE");
    expect(s.WATER.daysUntilDue).toBe(-2);
    expect(s.WATER.daysSinceLast).toBe(9); // most recent watering, not the older one
    expect(s.FERTILIZE.state).toBe("DUE_SOON");
    expect(s.FERTILIZE.daysUntilDue).toBe(1);
    expect(s.PHOTO.state).toBe("OK");
    expect(s.PHOTO.daysUntilDue).toBe(170);
  });

  it("counts from acquisition when nothing has been logged yet", () => {
    const fresh = { ...cadence, acquiredAt: now, createdAt: now };
    const s = byType(careStatuses(fresh, [], now));
    expect(s.WATER.state).toBe("OK");
    expect(s.WATER.daysUntilDue).toBe(7);
    expect(s.REPOT.state).toBe("OK");
    expect(s.REPOT.lastAt).toBeNull();
  });

  it("does make a never-watered plant overdue once its cadence has passed", () => {
    const s = byType(careStatuses(cadence, [], now)); // acquired 40 days ago
    expect(s.WATER.state).toBe("OVERDUE");
    expect(s.FERTILIZE.state).toBe("OVERDUE");
    expect(s.REPOT.state).toBe("OK");
  });

  it("treats a blank or zero cadence as the reminder being off", () => {
    const s = byType(
      careStatuses(
        { ...cadence, waterEveryDays: null, fertilizeEveryDays: 0 },
        [{ type: "WATER", occurredAt: daysAgo(90) }],
        now,
      ),
    );
    expect(s.WATER.state).toBe("OFF");
    expect(s.WATER.daysSinceLast).toBe(90); // still reports history
    expect(s.FERTILIZE.state).toBe("OFF");
  });

  it("counts calendar days, so last night's watering is 'yesterday' this morning", () => {
    // Local times on purpose: 21:00 yesterday → 11:00 today is 14 hours,
    // which the old 24-hour bucket reported as "today".
    const lastNight = new Date(2026, 8, 13, 21, 0);
    const thisMorning = new Date(2026, 8, 14, 11, 0);
    const s = byType(careStatuses(cadence, [{ type: "WATER", occurredAt: lastNight }], thisMorning));
    expect(s.WATER.daysSinceLast).toBe(1);
    expect(relativeDays(s.WATER.daysSinceLast)).toBe("yesterday");
    expect(s.WATER.daysUntilDue).toBe(6); // due on the 20th, counted in days not hours
    // And on the due date itself it's due from the morning, not from 21:00.
    const dueMorning = new Date(2026, 8, 20, 8, 0);
    expect(byType(careStatuses(cadence, [{ type: "WATER", occurredAt: lastNight }], dueMorning)).WATER.state).toBe("OVERDUE");
  });

  it("caps the due-soon window so annual care doesn't nag for weeks", () => {
    const s = byType(
      careStatuses(cadence, [{ type: "REPOT", occurredAt: daysAgo(365 - 5) }], now),
    );
    expect(s.REPOT.daysUntilDue).toBe(5);
    expect(s.REPOT.state).toBe("OK"); // 5 days out, window is capped at 3
  });
});

describe("openIssues / plantAlerts", () => {
  const events = [
    { type: "ISSUE", occurredAt: daysAgo(3), notes: "spider mites", resolvedAt: null },
    { type: "ISSUE", occurredAt: daysAgo(60), notes: "old", resolvedAt: daysAgo(55) },
    { type: "WATER", occurredAt: daysAgo(9) },
  ];

  it("only counts unresolved issues", () => {
    expect(openIssues(events).map((i) => i.notes)).toEqual(["spider mites"]);
  });

  it("puts special care first, then overdue, then due-soon", () => {
    const statuses = careStatuses(
      cadence,
      [...events, { type: "FERTILIZE", occurredAt: daysAgo(29) }],
      now,
    );
    const alerts = plantAlerts(statuses, openIssues(events).length);
    expect(alerts[0]).toEqual({ label: "Special care needed", tone: "critical" });
    expect(alerts.map((a) => a.label)).toEqual([
      "Special care needed",
      "Needs water",
      "Needs fertilizer soon",
    ]);
  });

  it("reports nothing for a plant that's fine", () => {
    const statuses = careStatuses(
      cadence,
      [
        { type: "WATER", occurredAt: daysAgo(1) },
        { type: "FERTILIZE", occurredAt: daysAgo(2) },
        { type: "REPOT", occurredAt: daysAgo(3) },
        { type: "PHOTO", occurredAt: daysAgo(4) },
      ],
      now,
    );
    expect(plantAlerts(statuses, 0)).toEqual([]);
  });
});

describe("keeperHistory", () => {
  it("is a single stint when the plant has never changed hands", () => {
    expect(keeperHistory("Mine", new Date("2025-01-05"), new Date("2025-02-01"), [])).toEqual([
      { greenhouseName: "Mine", from: "2025-01-05T00:00:00.000Z", to: null },
    ]);
  });

  it("chains accepted transfers in order and ignores pending ones", () => {
    const stints = keeperHistory("Mine", new Date("2024-01-01"), new Date("2024-01-01"), [
      { status: "ACCEPTED", resolvedAt: new Date("2026-02-14"), fromGreenhouse: { name: "Middle" } },
      { status: "PENDING", resolvedAt: null, fromGreenhouse: { name: "Mine" } },
      { status: "ACCEPTED", resolvedAt: new Date("2025-06-01"), fromGreenhouse: { name: "Origin" } },
    ]);
    expect(stints.map((s) => s.greenhouseName)).toEqual(["Origin", "Middle", "Mine"]);
    expect(stints[0].to).toBe("2025-06-01T00:00:00.000Z");
    expect(stints[1].from).toBe("2025-06-01T00:00:00.000Z");
    expect(stints[2].to).toBeNull();
  });
});

describe("relativeDays", () => {
  it("reads naturally", () => {
    expect(relativeDays(null)).toBe("never logged");
    expect(relativeDays(0)).toBe("today");
    expect(relativeDays(1)).toBe("yesterday");
    expect(relativeDays(9)).toBe("9 days ago");
  });
});

describe("loggedToday", () => {
  const now = new Date("2026-09-13T15:00:00");
  it("sees a watering earlier the same day, not one yesterday", () => {
    expect(loggedToday([{ type: "WATER", occurredAt: "2026-09-13T08:00:00" }], "WATER", now)).toBe(true);
    expect(loggedToday([{ type: "WATER", occurredAt: "2026-09-12T23:30:00" }], "WATER", now)).toBe(false);
  });
  it("only counts the same kind of care", () => {
    expect(loggedToday([{ type: "FERTILIZE", occurredAt: "2026-09-13T08:00:00" }], "WATER", now)).toBe(false);
  });
  it("has wording for the care people double-log, and none for photos or notes", () => {
    expect(REPEAT_PROMPT.WATER).toEqual({ past: "watered", gerund: "watering" });
    expect(REPEAT_PROMPT.PHOTO).toBeUndefined();
    expect(REPEAT_PROMPT.NOTE).toBeUndefined();
  });
});

describe("soil still moist", () => {
  const water = (events: { type: string; occurredAt: Date }[]) =>
    byType(careStatuses(cadence, events, now)).WATER;

  it("puts an overdue watering off, without counting as one", () => {
    // Weekly plant, last watered 9 days ago: overdue. Checked today, still
    // wet: look again in 2 days, and "last watered" is still 9 days ago.
    const s = water([
      { type: "WATER", occurredAt: daysAgo(9) },
      { type: "STILL_MOIST", occurredAt: now },
    ]);
    expect(s.state).toBe("OK");
    expect(s.daysUntilDue).toBe(2);
    expect(s.daysSinceLast).toBe(9);
    expect(s.lastCheckedAt).toBe(now.toISOString());
  });

  it("never brings watering forward", () => {
    // Checked early, the day after watering: the normal date still stands.
    const s = water([
      { type: "WATER", occurredAt: daysAgo(1) },
      { type: "STILL_MOIST", occurredAt: now },
    ]);
    expect(s.daysUntilDue).toBe(6);
  });

  it("is forgotten once the plant is watered", () => {
    const s = water([
      { type: "STILL_MOIST", occurredAt: daysAgo(3) },
      { type: "WATER", occurredAt: daysAgo(2) },
    ]);
    expect(s.daysUntilDue).toBe(5);
    expect(s.lastCheckedAt).toBeNull();
  });

  it("takes the latest check when there have been several", () => {
    const s = water([
      { type: "WATER", occurredAt: daysAgo(12) },
      { type: "STILL_MOIST", occurredAt: daysAgo(5) },
      { type: "STILL_MOIST", occurredAt: daysAgo(1) },
    ]);
    expect(s.daysUntilDue).toBe(1);
  });

  it("puts nothing else off", () => {
    const s = byType(
      careStatuses(cadence, [{ type: "FERTILIZE", occurredAt: daysAgo(31) }, { type: "STILL_MOIST", occurredAt: now }], now),
    );
    expect(s.FERTILIZE.state).toBe("OVERDUE");
    expect(s.FERTILIZE.lastCheckedAt).toBeUndefined();
  });

  it("waits longer for plants that are watered less often", () => {
    expect(moistSnoozeDays(3)).toBe(1);
    expect(moistSnoozeDays(7)).toBe(2);
    expect(moistSnoozeDays(10)).toBe(3);
    expect(moistSnoozeDays(30)).toBe(7);
    expect(moistSnoozeDays(1)).toBe(1);
  });
});

describe("suggesting a slower watering schedule", () => {
  // Waterings 9 days apart on a 7-day reminder, the soil found still moist
  // when each one came due: the pot dries in about 9 days, not 7.
  const W = (d: number) => ({ type: "WATER", occurredAt: daysAgo(d) });
  const M = (d: number) => ({ type: "STILL_MOIST", occurredAt: daysAgo(d) });

  it("suggests the gaps the keeper actually leaves, after two moist checks in a row", () => {
    const s = slowerWatering([W(27), M(20), W(18), M(11), W(9)], 7);
    expect(s).toMatchObject({ everyDays: 9, cycles: 2, moist: 2 });
  });

  it("needs two moist gaps out of the last three", () => {
    expect(slowerWatering([W(36), W(27), M(20), W(18), W(9)], 7)).toBeNull();
    expect(slowerWatering([W(36), M(29), W(27), W(18), M(11), W(9)], 7)?.everyDays).toBe(9);
  });

  it("says nothing on one gap's evidence", () => {
    expect(slowerWatering([W(18), M(11), W(9)], 7)).toBeNull();
  });

  it("only ever suggests longer, never shorter", () => {
    // Checks on a plant already on a 10-day schedule, watered every 9 days.
    expect(slowerWatering([W(27), M(20), W(18), M(11), W(9)], 10)).toBeNull();
  });

  it("ignores checks in the gap that hasn't finished yet", () => {
    expect(slowerWatering([W(18), M(11), W(9), M(2)], 7)).toBeNull();
  });

  it("asks again only when there is new evidence", () => {
    const before = slowerWatering([W(27), M(20), W(18), M(11), W(9)], 7)!;
    const same = slowerWatering([W(27), M(20), W(18), M(11), W(9), M(1)], 7)!;
    const after = slowerWatering([W(27), M(20), W(18), M(11), W(9), M(1), W(0)], 7)!;
    expect(same.basis).toBe(before.basis);
    expect(after.basis).not.toBe(before.basis);
  });

  it("stays quiet with no reminder set", () => {
    expect(slowerWatering([W(27), M(20), W(18), M(11), W(9)], null)).toBeNull();
  });
});

