import { describe, expect, test } from "vitest";
import { AI_REPORT_ANSWER_MAX, AI_REPORT_NOTE_MAX, aiReportNote, answerForReport } from "./ai-report";

describe("an AI report", () => {
  test("leads with where and why, so it sorts out of the bug queue at a glance", () => {
    expect(aiReportNote("care_guide", "unsafe", "  far too much water ")).toBe(
      "AI report (care guide): Unsafe advice — far too much water",
    );
    expect(aiReportNote("identify", "wrong", "")).toBe("AI report (identification): It's wrong");
  });

  test("bounds the keeper's note", () => {
    const note = aiReportNote("health_check", "other", "x".repeat(AI_REPORT_NOTE_MAX + 50));
    expect(note.endsWith("x".repeat(AI_REPORT_NOTE_MAX))).toBe(true);
    expect(note).not.toContain("x".repeat(AI_REPORT_NOTE_MAX + 1));
  });

  test("keeps the answer as it was shown, as plain data", () => {
    const answer = { species: [{ genus: "Primulina", confidence: 0.8 }], when: new Date("2026-10-06T00:00:00Z") };
    expect(answerForReport(answer)).toEqual({
      species: [{ genus: "Primulina", confidence: 0.8 }],
      when: "2026-10-06T00:00:00.000Z",
    });
  });

  test("caps a huge answer instead of storing all of it", () => {
    const out = answerForReport({ notes: "y".repeat(AI_REPORT_ANSWER_MAX * 2) }) as { truncated: boolean; text: string };
    expect(out.truncated).toBe(true);
    expect(out.text.length).toBe(AI_REPORT_ANSWER_MAX);
  });

  test("survives an answer that can't be written down", () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(answerForReport(loop)).toEqual({ unreadable: true });
  });
});
