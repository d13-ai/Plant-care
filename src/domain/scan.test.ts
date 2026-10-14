import { describe, expect, it } from "vitest";
import { findingLine, scanSummary } from "./scan";

describe("scanSummary", () => {
  it("writes the overall read, each finding with its action, then the notes", () => {
    const text = scanSummary({
      is_plant: true,
      health: {
        overall: "watch",
        findings: [
          { observation: "Brown tips on two leaves.", suggested_action: "Raise humidity to ~60%" },
          { observation: "Soil looks compacted", suggested_action: "" },
        ],
      },
      notes: "Pink petioles point to 'White Princess'.",
    });
    expect(text).toBe(
      "Worth watching.\nBrown tips on two leaves — Raise humidity to ~60%\nSoil looks compacted\nPink petioles point to 'White Princess'.",
    );
  });

  it("is one line for a healthy plant with nothing to add", () => {
    expect(scanSummary({ is_plant: true, health: { overall: "healthy", findings: [] }, notes: "" })).toBe("Looks healthy.");
  });
});

describe("a finding as a line of text", () => {
  it("an observation with nothing to do ends where it ends, with no dangling dash", () => {
    expect(findingLine({ observation: "Leaves are glossy and evenly green.", likely_cause: "", suggested_action: "" })).toBe(
      "Leaves are glossy and evenly green.",
    );
    expect(findingLine({ observation: "New leaf unfurling.", likely_cause: "", suggested_action: "" }, true)).toBe("New leaf unfurling.");
  });

  it("a problem says what was seen, then the cause if asked for, then what to do", () => {
    const f = { observation: "Brown tips on two leaves.", likely_cause: "Dry air.", suggested_action: "Group it with other plants." };
    expect(findingLine(f)).toBe("Brown tips on two leaves — Group it with other plants.");
    expect(findingLine(f, true)).toBe("Brown tips on two leaves — likely dry air. Group it with other plants.");
  });
});
