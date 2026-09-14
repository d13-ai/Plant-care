import { describe, expect, it } from "vitest";
import {
  careStatuses,
  keeperHistory,
  openIssues,
  plantAlerts,
  relativeDays,
  loggedToday,
  REPEAT_PROMPT,
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
