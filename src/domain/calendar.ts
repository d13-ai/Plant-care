/**
 * Turn a plant's care schedule into calendar reminders (an iCalendar / .ics
 * feed) that any phone's Calendar app can subscribe to. Pure string building,
 * no framework or storage — unit-tested in calendar.test.ts. The platform
 * save (browser download vs. share sheet) lives in src/lib/calendar.ts.
 *
 * Reminders are recurring all-day-ish events at 9am *local* time (floating
 * time, so "9am" follows the keeper wherever they are), repeating on the
 * plant's cadence, and each one carries the actual care instructions in its
 * notes — so the calendar ping tells you not just *that* it needs water but
 * *how* to water it.
 */
import type { CareStatus, CareType } from "./care";

/** The care-guide fields we fold into reminder notes. Structural so this
 *  module stays free of the storage-layer CareCard type. */
export interface CareInstructionsSource {
  water?: string | null;
  feeding?: string | null;
  repotting?: string | null;
  soil?: string | null;
  humidity?: string | null;
}

export interface CalendarTask {
  type: CareType;
  /** Human label, e.g. "Water". */
  label: string;
  /** Cadence in days (the repeat interval). */
  everyDays: number;
  /** ISO timestamp of the next time it's due. */
  firstDueAt: string;
  /** Care instructions to show in the reminder's notes (may be empty). */
  instructions: string;
}

const EMOJI: Partial<Record<CareType, string>> = {
  WATER: "💧",
  FERTILIZE: "🌱",
  REPOT: "🪴",
  PHOTO: "📸",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build the reminder list from the app's own care statuses plus (optionally)
 * the species care guide, so the calendar matches exactly what the plant page
 * shows. Only care with a cadence set becomes a reminder.
 */
export function tasksFromStatuses(
  statuses: CareStatus[],
  care: CareInstructionsSource | null,
): CalendarTask[] {
  const instructionsFor = (type: CareType): string => {
    if (!care) {
      if (type === "PHOTO") return "Take a fresh photo so the plant's health timeline stays useful.";
      return "";
    }
    switch (type) {
      case "WATER":
        return [care.water, care.humidity && `Humidity: ${care.humidity}`].filter(Boolean).join("\n");
      case "FERTILIZE":
        return care.feeding ?? "";
      case "REPOT":
        return [care.repotting, care.soil && `Soil: ${care.soil}`].filter(Boolean).join("\n");
      case "PHOTO":
        return "Take a fresh photo so the plant's health timeline stays useful.";
      default:
        return "";
    }
  };

  return statuses
    .filter((s) => s.everyDays && s.everyDays > 0 && s.dueAt)
    .map((s) => ({
      type: s.type,
      label: s.label,
      everyDays: s.everyDays as number,
      firstDueAt: s.dueAt as string,
      instructions: instructionsFor(s.type),
    }));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Floating local wall-clock stamp (no timezone) — "9am wherever you are". */
function floatingStamp(d: Date, hour: number): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hour)}0000`;
}

/** UTC stamp with trailing Z, for DTSTAMP. */
function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape a value for an iCalendar text field (RFC 5545 §3.3.11). */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to 75 octets with CRLF + space continuations. Works
 *  on code units; SUMMARY (the only line with emoji) stays well under 75. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  parts.push(" " + rest);
  return parts.join("\r\n");
}

export interface BuildIcsOptions {
  nickname: string;
  species?: string | null;
  /** Stable per-plant id for reminder UIDs (the tag token if published). */
  token?: string | null;
  tasks: CalendarTask[];
  /** The app link to show in reminder notes, if any. */
  tagUrl?: string | null;
  now?: Date;
}

/**
 * Produce a complete .ics document with one recurring reminder per care task.
 * Overdue tasks start today rather than in the past.
 */
export function buildPlantIcs(opts: BuildIcsOptions): string {
  const now = opts.now ?? new Date();
  const stamp = utcStamp(now);
  const uidBase = (opts.token || slugify(opts.nickname) || "plant").replace(/[^A-Za-z0-9-]/g, "");
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PlantParlour//Care Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${esc(`${opts.nickname} — care`)}`),
  ];

  for (const task of opts.tasks) {
    const due = new Date(task.firstDueAt);
    // Don't schedule the first ping in the past; an overdue plant reminds today.
    const start = due.getTime() < todayMidnight.getTime() ? todayMidnight : due;
    const startStr = floatingStamp(start, 9);
    const endStr = floatingStamp(new Date(start.getTime()), 9).replace("T090000", "T091500");

    const emoji = EMOJI[task.type] ? `${EMOJI[task.type]} ` : "";
    const summary = `${emoji}${task.label} ${opts.nickname}`;
    const speciesLine = opts.species ? `${opts.species}\n\n` : "";
    const linkLine = opts.tagUrl ? `\n\nOpen in PlantParlour: ${opts.tagUrl}` : "";
    const cadence = task.everyDays === 1 ? "every day" : `every ${task.everyDays} days`;
    const desc = `${speciesLine}${task.instructions || `${task.label} — ${cadence}.`}${linkLine}`;

    lines.push(
      "BEGIN:VEVENT",
      fold(`UID:${uidBase}-${task.type.toLowerCase()}@plantparlour`),
      `DTSTAMP:${stamp}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `RRULE:FREQ=DAILY;INTERVAL=${task.everyDays}`,
      fold(`SUMMARY:${esc(summary)}`),
      fold(`DESCRIPTION:${esc(desc)}`),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:PT0S",
      fold(`DESCRIPTION:${esc(summary)}`),
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** A filesystem/URL-friendly slug for a plant nickname. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "plant"
  );
}

// Re-exported for callers that clamp their own dates.
export const CALENDAR_DAY_MS = DAY_MS;
