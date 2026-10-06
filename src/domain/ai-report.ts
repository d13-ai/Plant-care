/**
 * "Report this answer": a keeper flags something the AI said.
 *
 * Google Play asks every app that shows AI-generated content to let people
 * report it from inside the app. It is also simply useful: a wrong
 * identification or a bad piece of advice is the thing we most want to hear
 * about, and the keeper looking at it is the only one who can tell us.
 *
 * Reports ride in bug_reports (one triage queue, one dashboard), marked by
 * `app.report = "ai_answer"` and a note that starts with the reason, so they
 * sort out of the queue at a glance.
 */

export type AiSurface = "identify" | "health_check" | "care_guide";

export type AiReportReason = "wrong" | "unsafe" | "offensive" | "other";

export const AI_REPORT_REASONS: { value: AiReportReason; label: string }[] = [
  { value: "wrong", label: "It's wrong" },
  { value: "unsafe", label: "Unsafe advice" },
  { value: "offensive", label: "Offensive" },
  { value: "other", label: "Something else" },
];

const SURFACE_NAMES: Record<AiSurface, string> = {
  identify: "identification",
  health_check: "health check",
  care_guide: "care guide",
};

/** The keeper's note, bounded like every other free-text field. */
export const AI_REPORT_NOTE_MAX = 1000;

/** "AI report (care guide): Unsafe advice — the watering is far too often" */
export function aiReportNote(surface: AiSurface, reason: AiReportReason, note: string): string {
  const label = AI_REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  const said = note.trim().slice(0, AI_REPORT_NOTE_MAX);
  return `AI report (${SURFACE_NAMES[surface]}): ${label}${said ? ` — ${said}` : ""}`;
}

/**
 * What the AI said, as it was shown, kept small: the report needs the answer
 * to be judged, not the photos behind it. Anything that isn't plain data is
 * dropped, and the whole thing is capped so a report can't become storage.
 */
export const AI_REPORT_ANSWER_MAX = 8000;

export function answerForReport(answer: unknown): unknown {
  let text: string;
  try {
    text = JSON.stringify(answer) ?? "null";
  } catch {
    return { unreadable: true };
  }
  if (text.length <= AI_REPORT_ANSWER_MAX) return JSON.parse(text);
  return { truncated: true, text: text.slice(0, AI_REPORT_ANSWER_MAX) };
}
