import { describe, expect, test } from "vitest";
import { isProblem, issueNote, preselectedIssues, problemsIn } from "./scan";
import type { FindingKind } from "@/lib/ai";

// The real Ring of Fire check, 20 Sep 2026, with the kinds the model would
// now give it. Four findings, of which one is good news.
const RING_OF_FIRE = [
  { kind: "problem", observation: "Two leaves show browning and crisping along the tip and edge" },
  { kind: "observation", observation: "New emerging leaf is unfurling and looks turgid and healthy" },
  { kind: "problem", observation: "One lower leaf is heavily yellowed with brown crisping" },
  { kind: "problem", observation: "Soil surface is dark and moist-looking in both photos" },
];

describe("what a keeper can log as an issue", () => {
  test("good news is not a problem, however it is worded", () => {
    expect(isProblem({ kind: "observation" })).toBe(false);
    expect(problemsIn(RING_OF_FIRE)).toHaveLength(3);
    expect(problemsIn(RING_OF_FIRE).map((f) => f.observation).join(" ")).not.toContain("turgid and healthy");
  });

  test("a limit of the photograph is not a problem with the plant", () => {
    // "These leaves are too dusty to read" is worth showing and worth acting
    // on, but it is not an unresolved issue about the plant.
    expect(isProblem({ kind: "photo_quality" })).toBe(false);
  });

  test("an answer from before the field existed still offers everything", () => {
    // Cached verdicts and anything mid-flight during a deploy. Offering to
    // log something good is a smaller wrong than hiding something bad.
    expect(isProblem({})).toBe(true);
    const cached: { kind?: string; observation: string }[] = [
      { observation: "old" },
      { observation: "answer" },
    ];
    expect(problemsIn(cached)).toHaveLength(2);
  });

  test("an unrecognised kind counts as an observation, not a problem", () => {
    // A kind we don't know isn't one the model was asked for. Silence is the
    // safer reading for a record meant to be true in three years.
    expect(isProblem({ kind: "something_new" })).toBe(false);
  });
});

describe("what a new plant's scan puts on the record", () => {
  const f = (observation: string, kind?: FindingKind) => ({
    observation,
    likely_cause: "Overwatering",
    suggested_action: "Let it dry out.",
    kind,
  });
  const findings = [
    f("One segment is yellow and limp", "problem"),
    f("The flat segments are healthy", "observation"),
    f("Rocks hide the soil", "photo_quality"),
    f("Thin stretched stems", "problem"),
  ];

  test("an unwell plant arrives with every problem ticked, and nothing else", () => {
    // The zigzag cactus of 25 Sep 2026: called Unwell, added, shown "All good".
    expect(preselectedIssues({ health: { overall: "unwell", findings } })).toEqual([
      "One segment is yellow and limp",
      "Thin stretched stems",
    ]);
  });

  test("worth watching is offered, not ticked", () => {
    expect(preselectedIssues({ health: { overall: "watch", findings } })).toEqual([]);
    expect(preselectedIssues({ health: { overall: "healthy", findings: [] } })).toEqual([]);
  });

  test("an issue from the scan reads like one from a health check", () => {
    expect(issueNote(findings[0])).toBe("One segment is yellow and limp — likely overwatering. Let it dry out.");
  });
});
