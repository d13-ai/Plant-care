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
