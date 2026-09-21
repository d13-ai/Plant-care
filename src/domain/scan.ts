/**
 * What an AI photo check said, written down for the plant's history so it
 * syncs to every phone and stays after the screen is gone.
 */
export interface ScanVerdict {
  is_plant: boolean;
  health: {
    overall: "healthy" | "watch" | "unwell" | "unknown";
    findings: { observation: string; suggested_action: string }[];
  };
  notes: string;
}

const OVERALL: Record<ScanVerdict["health"]["overall"], string> = {
  healthy: "Looks healthy",
  watch: "Worth watching",
  unwell: "Unwell",
  unknown: "Health unclear from the photo",
};

/** One entry's worth of text: the overall read, each finding with its action, then the notes. */
export function scanSummary(v: ScanVerdict): string {
  const lines = [`${OVERALL[v.health.overall] ?? v.health.overall}.`];
  for (const f of v.health.findings) {
    const observation = f.observation.trim().replace(/\.$/, "");
    const action = f.suggested_action.trim();
    lines.push(action ? `${observation} — ${action}` : observation);
  }
  if (v.notes.trim()) lines.push(v.notes.trim());
  return lines.join("\n");
}

/**
 * Which findings a keeper can put on the record as an open issue.
 *
 * A health check returns three different kinds of thing under one heading:
 * something is wrong, this part is fine, and I can't read this photograph
 * well. "Log all as issues" promoted all three. On 20 Sep 2026 a Ring of
 * Fire came back with "New emerging leaf is unfurling and looks turgid and
 * healthy — no action needed" sitting on its record as an unresolved
 * problem, where it would have been read back to the model as one on every
 * future check, and where it ate 240 characters of a care brief that a real
 * issue needed.
 *
 * The model now says which kind each finding is. A finding from before that
 * field existed has no `kind`, and counts as a problem: offering to log
 * something good is a smaller wrong than hiding something bad.
 */
export const isProblem = (f: { kind?: string }) => f.kind === undefined || f.kind === "problem";

/** Just the findings worth a row in the plant's history. */
export const problemsIn = <T extends { kind?: string }>(findings: T[]): T[] => findings.filter(isProblem);
