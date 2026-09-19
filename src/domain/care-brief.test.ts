import { describe, expect, test } from "vitest";
import { careBrief, CARE_BRIEF_MAX } from "./care-brief";

const NOW = new Date("2026-09-18T23:30:00.000Z");
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

// The real record that prompted this: Gepetto Two-step, repotted 7 Sep,
// watered on the 14th and the 16th, on a seven-day reminder.
const GEPETTO = [
  { type: "ACQUIRED", occurredAt: daysBefore(12) },
  { type: "REPOT", occurredAt: daysBefore(11) },
  { type: "WATER", occurredAt: daysBefore(5) },
  { type: "WATER", occurredAt: daysBefore(2) },
  { type: "PHOTO", occurredAt: daysBefore(0) },
];

describe("what the AI is told about a plant's record", () => {
  test("the watering interval is visible, not just the last date", () => {
    const brief = careBrief(GEPETTO, { waterEveryDays: 7 }, NOW);
    // Both waterings, so a model can see 2 and 5 days and read the gap.
    expect(brief).toContain("Watered: 2 days ago and 5 days ago");
    expect(brief).toContain("every 7 days");
  });

  test("a recent repot is stated, because it changes what wet soil means", () => {
    expect(careBrief(GEPETTO, {}, NOW)).toContain("Repotted: 11 days ago");
  });

  test("an unresolved issue comes along, resolved ones do not", () => {
    const events = [
      ...GEPETTO,
      { type: "ISSUE", occurredAt: daysBefore(1), resolvedAt: null, notes: "Cream section going papery" },
      { type: "ISSUE", occurredAt: daysBefore(40), resolvedAt: daysBefore(35), notes: "Spider mites" },
    ];
    const brief = careBrief(events, {}, NOW);
    expect(brief).toContain("Unresolved issue, first logged yesterday: Cream section going papery");
    expect(brief).not.toContain("Spider mites");
  });

  test("every open issue travels, not just the newest", () => {
    // Gepetto had two confirmed problems at once -- a papery cream section
    // and dark blotches in the green tissue. Sending one meant the model was
    // told about half the plant's known state.
    const events = [
      ...GEPETTO,
      { type: "ISSUE", occurredAt: daysBefore(1), resolvedAt: null, notes: "Cream section going papery" },
      { type: "ISSUE", occurredAt: daysBefore(3), resolvedAt: null, notes: "Dark grey-purple blotches in the green tissue" },
    ];
    const brief = careBrief(events, {}, NOW);
    expect(brief).toContain("Cream section going papery");
    expect(brief).toContain("Dark grey-purple blotches");
    // Newest first, so the most recent problem leads.
    expect(brief.indexOf("Cream section")).toBeLessThan(brief.indexOf("Dark grey-purple"));
  });

  test("an issue arrives whole, with its cause and its remedy", () => {
    // The old bound was 120 characters, which cut a logged finding off before
    // its likely cause -- the half that says why.
    const long =
      "A large fully cream section on one leaf has gone papery pale-tan with brown flecks — likely sun scorch on chlorophyll-free tissue. Move it back from the glass.";
    const brief = careBrief([{ type: "ISSUE", occurredAt: daysBefore(1), resolvedAt: null, notes: long }], {}, NOW);
    expect(brief).toContain("likely sun scorch");
    expect(brief).toContain("Move it back from the glass");
  });

  test("the keeper's notes go too, because a photo cannot read a pot", () => {
    const brief = careBrief(GEPETTO, { notes: "Glazed pot, drainage hole, sits on a saucer. Bark, perlite and sphagnum mix." }, NOW);
    expect(brief).toContain("drainage hole");
    expect(brief).toContain("perlite");
  });

  test("notes alone are worth sending, with nothing else logged", () => {
    const brief = careBrief([], { notes: "Terracotta, no saucer." }, NOW);
    expect(brief).toContain("Terracotta");
  });

  test("nothing logged and nothing noted still sends nothing", () => {
    expect(careBrief([], { notes: "   " }, NOW)).toBe("");
  });

  test("today and yesterday read as words, not as 0 days ago", () => {
    const brief = careBrief([{ type: "WATER", occurredAt: daysBefore(0) }], {}, NOW);
    expect(brief).toContain("Watered: today");
    expect(brief).not.toMatch(/0 days/);
  });

  test("a plant with nothing logged sends nothing at all", () => {
    // An empty brief means the caller leaves the field off rather than
    // spending tokens to say "no information".
    expect(careBrief([], {}, NOW)).toBe("");
    expect(careBrief([{ type: "PHOTO", occurredAt: daysBefore(1) }], {}, NOW)).toBe("");
  });

  test("it stays inside the bound, however long the record", () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ type: "WATER", occurredAt: daysBefore(i) }));
    const brief = careBrief(
      [...many, { type: "ISSUE", occurredAt: daysBefore(1), resolvedAt: null, notes: "x".repeat(4000) }],
      { waterEveryDays: 7 },
      NOW,
    );
    expect(brief.length).toBeLessThanOrEqual(CARE_BRIEF_MAX);
  });

  test("rubbish dates are dropped rather than sent as NaN", () => {
    const brief = careBrief(
      [{ type: "WATER", occurredAt: "not a date" }, { type: "REPOT", occurredAt: daysBefore(3) }],
      {},
      NOW,
    );
    expect(brief).not.toMatch(/NaN/);
    expect(brief).toContain("Repotted: 3 days ago");
    expect(brief).not.toContain("Watered");
  });

  test("it states what was logged, and never what it means", () => {
    // Reading the record is the model's job; a brief that editorialises is
    // the app guessing, and the app is the one thing here that cannot see
    // the plant.
    const brief = careBrief(GEPETTO, { waterEveryDays: 7 }, NOW);
    expect(brief).not.toMatch(/overwater|too (often|much)|rot|should|probably/i);
  });
});
