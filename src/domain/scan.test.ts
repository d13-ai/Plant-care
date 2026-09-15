import { describe, expect, it } from "vitest";
import { scanSummary } from "./scan";

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
