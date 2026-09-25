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

/** A finding as the analyze function returns it. */
export interface Finding {
  observation: string;
  likely_cause: string;
  suggested_action: string;
  kind?: string;
}

/**
 * One finding, written the way it goes on the record as an issue: what was
 * seen, what probably caused it, what to do. The cause is the half that says
 * why, and a record that keeps only the symptom is the weaker half of the
 * story. The health check and the add-plant scan both write issues through
 * this, so the same problem reads the same wherever it was found.
 */
export const issueNote = (f: Finding) => `${f.observation} — likely ${f.likely_cause.toLowerCase()}. ${f.suggested_action}`;

/**
 * Which of a new plant's scan findings to log as issues unless the keeper
 * says otherwise.
 *
 * The add-plant scan used to write its verdict into the history as one AI
 * check note and stop there. The "All good" badge reads open issues, not
 * notes, so on 25 Sep 2026 a zigzag cactus the scan called Unwell — a yellow
 * limp segment, dried-out ones, stretched stems — arrived in the greenhouse
 * wearing "All good", and stayed that way.
 *
 * An Unwell verdict now arrives as open issues: every finding that is a
 * problem, ticked, so adding the plant flags it. "Worth watching" is offered
 * but not ticked — the model says watch, not act, and a new plant should not
 * start life with issues nobody chose. Findings that are fine, or that are
 * about the photo rather than the plant, are never offered at all.
 */
export function preselectedIssues(v: { health: { overall: string; findings: Finding[] } }): string[] {
  return v.health.overall === "unwell" ? problemsIn(v.health.findings).map((f) => f.observation) : [];
}
