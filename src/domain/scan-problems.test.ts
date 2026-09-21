import { describe, expect, test } from "vitest";
import { isProblem, problemsIn } from "./scan";

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
