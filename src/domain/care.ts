/**
 * Plant care domain logic. Pure functions, no framework, no storage —
 * everything here is unit-tested against fixed dates in care.test.ts.
 *
 * The one rule: history belongs to the plant, not the keeper. Trading a
 * plant hands the new keeper everything that ever happened to it.
 */

export type CareType =
  | "WATER"
  | "FERTILIZE"
  | "REPOT"
  | "PRUNE"
  | "PHOTO"
  | "ISSUE"
  | "TREATMENT"
  | "NOTE"
  | "ACQUIRED"
  | "PROPAGATED"
  | "TRANSFERRED";

export const CARE_EVENT_LABELS: Record<CareType, string> = {
  WATER: "Watered",
  FERTILIZE: "Fertilized",
  REPOT: "Repotted",
  PRUNE: "Pruned",
  PHOTO: "Photo taken",
  ISSUE: "Issue reported",
  TREATMENT: "Treatment applied",
  NOTE: "Note",
  ACQUIRED: "Added to greenhouse",
  PROPAGATED: "Propagated",
  TRANSFERRED: "Changed keeper",
};

/** Care types a keeper can log by hand, in the order the UI offers them. */
export const LOGGABLE_CARE_TYPES: CareType[] = [
  "WATER",
  "FERTILIZE",
  "REPOT",
  "PRUNE",
  "PHOTO",
  "ISSUE",
  "TREATMENT",
  "NOTE",
];

/** The care types that carry a reminder cadence. */
export const SCHEDULED_CARE: {
  type: CareType;
  label: string;
  cadenceField: "waterEveryDays" | "fertilizeEveryDays" | "repotEveryDays" | "photoEveryDays";
  dueLabel: string;
}[] = [
  { type: "WATER", label: "Water", cadenceField: "waterEveryDays", dueLabel: "Needs water" },
  { type: "FERTILIZE", label: "Fertilize", cadenceField: "fertilizeEveryDays", dueLabel: "Needs fertilizer" },
  { type: "REPOT", label: "Repot", cadenceField: "repotEveryDays", dueLabel: "Needs repotting" },
  { type: "PHOTO", label: "New photo", cadenceField: "photoEveryDays", dueLabel: "New photo due" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export type DueState = "OVERDUE" | "DUE_SOON" | "OK" | "OFF";

export interface CareStatus {
  type: CareType;
  label: string;
  dueLabel: string;
  everyDays: number | null;
  lastAt: string | null;
  dueAt: string | null;
  state: DueState;
  daysSinceLast: number | null;
  daysUntilDue: number | null;
}

interface EventLike {
  type: string;
  occurredAt: Date | string;
  resolvedAt?: Date | string | null;
  notes?: string | null;
}

interface CadenceLike {
  waterEveryDays: number | null;
  fertilizeEveryDays: number | null;
  repotEveryDays: number | null;
  photoEveryDays: number | null;
  // Fallback clock for care that has never been logged.
  acquiredAt?: Date | string | null;
  createdAt?: Date | string | null;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Warn a little before something is actually due — a fifth of the cadence,
 * capped at three days so an annual repotting doesn't nag for ten weeks.
 */
function dueSoonWindowDays(everyDays: number): number {
  return Math.min(3, Math.max(1, Math.round(everyDays * 0.2)));
}

export function careStatuses(
  plant: CadenceLike,
  events: EventLike[],
  now: Date = new Date(),
): CareStatus[] {
  return SCHEDULED_CARE.map(({ type, label, cadenceField, dueLabel }) => {
    const everyDays = plant[cadenceField];
    const last = events
      .filter((e) => e.type === type)
      .map((e) => toDate(e.occurredAt))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const lastAt = last ? last.toISOString() : null;
    const daysSinceLast = last
      ? Math.floor((now.getTime() - last.getTime()) / DAY_MS)
      : null;

    if (!everyDays || everyDays <= 0) {
      return {
        type, label, dueLabel, everyDays: null, lastAt, dueAt: null,
        state: "OFF" as DueState, daysSinceLast, daysUntilDue: null,
      };
    }

    // Nothing logged yet: count from when the plant arrived rather than
    // declaring a plant you added this morning overdue for repotting.
    const baseline =
      last ??
      (plant.acquiredAt ? toDate(plant.acquiredAt) : null) ??
      (plant.createdAt ? toDate(plant.createdAt) : null) ??
      now;

    const dueAt = new Date(baseline.getTime() + everyDays * DAY_MS);
    const daysUntilDue = Math.ceil((dueAt.getTime() - now.getTime()) / DAY_MS);
    const state: DueState =
      daysUntilDue <= 0
        ? "OVERDUE"
        : daysUntilDue <= dueSoonWindowDays(everyDays)
          ? "DUE_SOON"
          : "OK";

    return {
      type, label, dueLabel, everyDays,
      lastAt, dueAt: dueAt.toISOString(),
      state, daysSinceLast, daysUntilDue,
    };
  });
}

/**
 * Has this kind of care already been logged today (the keeper's local day)?
 * A second tap on "water" the same day is usually a slip, so the app asks
 * before logging it again — it never refuses.
 */
export function loggedToday(events: EventLike[], type: CareType, now: Date = new Date()): boolean {
  return events.some((e) => {
    if (e.type !== type) return false;
    const d = toDate(e.occurredAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });
}

/** The wording for that question, for the kinds of care where a repeat is worth asking about. */
export const REPEAT_PROMPT: Partial<Record<CareType, { past: string; gerund: string }>> = {
  WATER: { past: "watered", gerund: "watering" },
  FERTILIZE: { past: "fertilized", gerund: "fertilizing" },
  REPOT: { past: "repotted", gerund: "repotting" },
  PRUNE: { past: "pruned", gerund: "pruning" },
};

/** Reported problems nobody has cleared yet — the "special care needed" flag. */
export function openIssues<T extends EventLike>(events: T[]): T[] {
  return events
    .filter((e) => e.type === "ISSUE" && !e.resolvedAt)
    .sort((a, b) => toDate(b.occurredAt).getTime() - toDate(a.occurredAt).getTime());
}

export interface PlantAlert {
  label: string;
  tone: "critical" | "warning" | "attention";
}

export function plantAlerts(statuses: CareStatus[], issueCount: number): PlantAlert[] {
  const alerts: PlantAlert[] = [];
  if (issueCount > 0) {
    alerts.push({
      label: issueCount === 1 ? "Special care needed" : `${issueCount} issues open`,
      tone: "critical",
    });
  }
  for (const status of statuses) {
    if (status.state === "OVERDUE") {
      alerts.push({ label: status.dueLabel, tone: "warning" });
    } else if (status.state === "DUE_SOON") {
      alerts.push({ label: `${status.dueLabel} soon`, tone: "attention" });
    }
  }
  return alerts;
}

export function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  return toDate(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeDays(days: number | null): string {
  if (days === null) return "never logged";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export interface KeeperStint {
  greenhouseName: string;
  from: string | null;
  to: string | null;
}

/**
 * The ownership chain — who kept this plant and when. Built from accepted
 * transfers, ending with whoever holds it now.
 */
export function keeperHistory(
  currentGreenhouseName: string,
  acquiredAt: Date | string | null,
  createdAt: Date | string,
  transfers: {
    status: string;
    resolvedAt: Date | string | null;
    fromGreenhouse: { name: string };
    toGreenhouse?: { name: string } | null;
  }[],
): KeeperStint[] {
  const accepted = transfers
    .filter((t) => t.status === "ACCEPTED" && t.resolvedAt)
    .sort((a, b) => toDate(a.resolvedAt!).getTime() - toDate(b.resolvedAt!).getTime());

  const start = acquiredAt ? toDate(acquiredAt) : toDate(createdAt);

  if (accepted.length === 0) {
    return [{ greenhouseName: currentGreenhouseName, from: start.toISOString(), to: null }];
  }

  const stints: KeeperStint[] = [];
  let from: string | null = start.toISOString();
  for (const transfer of accepted) {
    stints.push({
      greenhouseName: transfer.fromGreenhouse.name,
      from,
      to: toDate(transfer.resolvedAt!).toISOString(),
    });
    from = toDate(transfer.resolvedAt!).toISOString();
  }
  stints.push({ greenhouseName: currentGreenhouseName, from, to: null });
  return stints;
}
