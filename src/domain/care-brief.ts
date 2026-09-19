/**
 * What the app already knows about a plant, written for the AI that is about
 * to look at a photo of it.
 *
 * A health check used to send pixels and a species name. On 18 Sep 2026 it
 * read a dark, wet-looking soil surface off a photo of a Thai Constellation
 * and correctly warned about drainage — while this app's own record held the
 * fact that the plant had been repotted eleven days earlier and watered twice
 * in under three days against a seven-day cadence. It inferred from a
 * photograph what it could have been told.
 *
 * That is the whole point of the product, so the model should get it:
 * inference beats nothing, and facts beat inference. It costs a few dozen
 * text tokens — a fraction of a cent against a scan's several — and it is
 * the one thing a photo-identification app cannot copy, because it has no
 * record to send.
 *
 * Kept deliberately short and factual. It goes into a prompt, so it is
 * bounded here and bounded again at the edge function; and it states what was
 * logged rather than what it means, because reading it is the model's job.
 */
import { CARE_EVENT_LABELS, type CareType } from "./care";

export type BriefEvent = {
  type: CareType | string;
  occurredAt: string;
  resolvedAt?: string | null;
  notes?: string | null;
};

export type BriefPlant = {
  acquiredAt?: string | null;
  waterEveryDays?: number | null;
  fertilizeEveryDays?: number | null;
  repotEveryDays?: number | null;
};

/** Longest brief we will ever send; the function truncates to the same. */
export const CARE_BRIEF_MAX = 600;

const DAY = 86_400_000;

function daysAgo(iso: string, now: Date): number | null {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.round((now.getTime() - then) / DAY));
}

const ago = (days: number) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

/** The care types worth telling a model about, in the order they are listed. */
const TOLD: CareType[] = ["WATER", "FERTILIZE", "REPOT", "PRUNE", "TREATMENT", "ACQUIRED"];

/**
 * A few plain lines: when each kind of care last happened, how often it is
 * meant to, and what is currently unresolved. Empty string when there is
 * nothing worth saying, so the caller can leave the field off entirely.
 */
export function careBrief(
  events: BriefEvent[],
  plant: BriefPlant = {},
  now: Date = new Date(),
): string {
  const lines: string[] = [];

  for (const type of TOLD) {
    const matching = events
      .filter((e) => e.type === type)
      .map((e) => daysAgo(e.occurredAt, now))
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b);
    if (!matching.length) continue;

    const label = CARE_EVENT_LABELS[type] ?? type;
    const cadence =
      type === "WATER" ? plant.waterEveryDays
      : type === "FERTILIZE" ? plant.fertilizeEveryDays
      : type === "REPOT" ? plant.repotEveryDays
      : null;

    // Two most recent waterings, because the interval between them is the
    // fact that matters and one date cannot show it.
    const when =
      type === "WATER" && matching.length > 1
        ? `${ago(matching[0])} and ${ago(matching[1])}`
        : ago(matching[0]);
    lines.push(`${label}: ${when}${cadence ? ` (reminder set for every ${cadence} days)` : ""}.`);
  }

  const open = events.filter((e) => e.type === "ISSUE" && !e.resolvedAt);
  if (open.length) {
    const newest = open
      .map((e) => ({ e, d: daysAgo(e.occurredAt, now) }))
      .filter((x) => x.d !== null)
      .sort((a, b) => (a.d as number) - (b.d as number))[0];
    if (newest) {
      const note = (newest.e.notes ?? "").split("\n")[0].slice(0, 120).trim();
      lines.push(`Unresolved issue from ${ago(newest.d as number)}${note ? `: ${note}` : ""}.`);
    }
  }

  if (!lines.length) return "";
  const brief = `What this keeper has logged for this plant:\n${lines.join("\n")}`;
  return brief.length > CARE_BRIEF_MAX ? `${brief.slice(0, CARE_BRIEF_MAX - 1).trimEnd()}…` : brief;
}
