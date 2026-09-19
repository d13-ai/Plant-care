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
  /**
   * The keeper's own notes. This is where the standing facts live -- what
   * the plant is potted in, whether the pot drains, what sits under it.
   *
   * Worth its tokens because those are the facts a photograph is worst at.
   * Across four plants read by two models, the soil and pot were where they
   * contradicted each other three times out of four: peaty against
   * bark-and-perlite, mossy against clean, "no visible drainage hole" on a
   * pot that has one. None of it is guessable and all of it is knowable.
   */
  notes?: string | null;
};

/** Longest brief we will ever send; the function truncates to the same. */
export const CARE_BRIEF_MAX = 1200;
/** Per open issue. Enough for an observation, its cause and what to do. */
const ISSUE_MAX = 240;
/** The keeper's standing notes about the plant and its pot. */
const NOTES_MAX = 240;

const DAY = 86_400_000;

function daysAgo(iso: string, now: Date): number | null {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.round((now.getTime() - then) / DAY));
}

const ago = (days: number) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

/** Cut to a bound without leaving a word in half or a dangling space. */
const clip = (text: string, max: number) => {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

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

  // Every unresolved issue, not just the newest, and in full rather than cut
  // to a stub. The first version sent one issue truncated at 120 characters,
  // which meant a keeper who had logged two problems saw one of them reach
  // the model, shorn of its cause and its remedy. An open issue is the
  // keeper's own assertion about the plant -- the one thing here that beats
  // anything a photograph can offer -- so it travels whole.
  const open = events
    .filter((e) => e.type === "ISSUE" && !e.resolvedAt)
    .map((e) => ({ e, d: daysAgo(e.occurredAt, now) }))
    .filter((x): x is { e: BriefEvent; d: number } => x.d !== null)
    .sort((a, b) => a.d - b.d);
  for (const { e, d } of open) {
    const note = clip((e.notes ?? "").replace(/\s+/g, " "), ISSUE_MAX);
    lines.push(`Unresolved issue, first logged ${ago(d)}${note ? `: ${note}` : ""}.`);
  }

  if (!lines.length && !plant.notes) return "";
  const parts = [];
  if (lines.length) parts.push(`What this keeper has logged for this plant:\n${lines.join("\n")}`);
  const notes = clip((plant.notes ?? "").replace(/\s+/g, " "), NOTES_MAX);
  if (notes) parts.push(`The keeper's own notes on this plant and its pot: ${notes}`);
  const brief = parts.join("\n\n");
  return clip(brief, CARE_BRIEF_MAX);
}
