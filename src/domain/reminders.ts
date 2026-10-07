/**
 * Care reminders: which notifications the phone should have queued, worked
 * out from the same care statuses the greenhouse shows. Pure — no Expo, no
 * storage — and unit-tested in reminders.test.ts. src/lib/reminders.ts hands
 * the plan to the phone.
 *
 * Two kinds:
 *
 *  - A due alert, on the day something falls due, at the keeper's reminder
 *    time: "💧 Monstera needs water". One per plant per day, so a plant that
 *    wants water and fertilizer on the same morning pings once.
 *  - A daily nudge for whatever is still waiting from an earlier day:
 *    "3 plants need care". With due alerts switched off it takes in the day's
 *    new care too, so turning one off never hides anything.
 *
 * The phone holds these as a queue planned ahead of time, so the plan assumes
 * nothing gets logged. That is what makes it right: the moment something is
 * logged the app plans again, and the reminder it no longer needs is gone.
 */
import type { CareStatus, CareType } from "./care";

export interface ReminderPrefs {
  /** A ping on the day each thing falls due. */
  dueAlerts: boolean;
  /** One ping a day for anything left from an earlier day. */
  overdueNudge: boolean;
  /** Local time of day both go out at. */
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  dueAlerts: true,
  overdueNudge: true,
  hour: 9,
  minute: 0,
};

/** The times the settings offer, as [hour, minute]. */
export const REMINDER_TIMES: [number, number][] = [
  [7, 0],
  [8, 0],
  [9, 0],
  [12, 0],
  [18, 0],
  [20, 0],
];

export interface ReminderPlant {
  id: number;
  nickname: string;
  statuses: CareStatus[];
  /** The species guide's word on each kind of care, when the guide is on the phone. */
  howTo?: Partial<Record<CareType, string>>;
}

export interface PlannedReminder {
  /** The same reminder planned twice gets the same id. */
  id: string;
  at: Date;
  title: string;
  body: string;
  /** What it is about, as `plantId:TYPE` — how a reminder for care since done gets cleared. */
  items: string[];
  /** The plant a tap opens; null opens the greenhouse. */
  plantId: number | null;
}

/** How far ahead the queue is planned. Anyone who opens the app inside a fortnight never runs off the end. */
export const PLAN_DAYS = 14;
/** iOS keeps 64 queued notifications per app and drops the rest; stay under it everywhere. */
export const MAX_QUEUED = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

const EMOJI: Partial<Record<CareType, string>> = { WATER: "💧", FERTILIZE: "🌱", REPOT: "🪴", PHOTO: "📸" };

/** "Monstera needs water" and friends, for one kind of care. */
function oneThing(type: CareType, name: string): string {
  switch (type) {
    case "WATER":
      return `${name} needs water`;
    case "FERTILIZE":
      return `${name} needs fertilizer`;
    case "REPOT":
      return `${name} is due for repotting`;
    case "PHOTO":
      return `Time for a new photo of ${name}`;
    default:
      return `${name} needs care`;
  }
}

/** The short word for each kind of care, for lists. */
const VERB: Partial<Record<CareType, string>> = { WATER: "Water", FERTILIZE: "Fertilize", REPOT: "Repot", PHOTO: "New photo" };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole local days from `a` to `b`. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/** "Pothos", "Pothos and Fern", "Pothos, Fern and Ivy", "Pothos, Fern and 3 more". */
export function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** A guide's advice cut down to fit a notification: its first sentence, at most ~140 characters. */
export function shortHowTo(text: string | null | undefined): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  const first = clean.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? clean;
  return first.length <= 140 ? first : `${first.slice(0, 139).trimEnd()}…`;
}

interface Item {
  plant: ReminderPlant;
  type: CareType;
  /** The local day it falls due. */
  dueDay: Date;
}

function dueItems(plants: ReminderPlant[]): Item[] {
  const items: Item[] = [];
  for (const plant of plants) {
    for (const s of plant.statuses) {
      if (!s.everyDays || s.everyDays <= 0 || !s.dueAt) continue;
      items.push({ plant, type: s.type, dueDay: startOfDay(new Date(s.dueAt)) });
    }
  }
  return items;
}

const itemKey = (i: Item) => `${i.plant.id}:${i.type}`;

/**
 * Everything the phone should have queued from `now`, soonest first. Nothing
 * in the past: a reminder time already gone today is simply not planned —
 * whoever is planning it has the app open.
 */
export function planReminders(plants: ReminderPlant[], prefs: ReminderPrefs, now: Date = new Date()): PlannedReminder[] {
  if (!prefs.dueAlerts && !prefs.overdueNudge) return [];
  const today = startOfDay(now);
  const items = dueItems(plants);
  const planned: PlannedReminder[] = [];

  for (let offset = 0; offset < PLAN_DAYS; offset++) {
    const day = addDays(today, offset);
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), prefs.hour, prefs.minute);
    if (at.getTime() <= now.getTime()) continue;

    if (prefs.dueAlerts) {
      // Grouped by plant, in the order the plants came in.
      const byPlant = new Map<number, Item[]>();
      for (const item of items) {
        if (item.dueDay.getTime() !== day.getTime()) continue;
        byPlant.set(item.plant.id, [...(byPlant.get(item.plant.id) ?? []), item]);
      }
      for (const [plantId, mine] of byPlant) {
        const plant = mine[0].plant;
        const single = mine.length === 1;
        const type = mine[0].type;
        const title = single
          ? `${EMOJI[type] ?? ""} ${oneThing(type, plant.nickname)}`.trim()
          : `${plant.nickname} needs care today`;
        const how = mine.map((i) => plant.howTo?.[i.type]).find(Boolean);
        const body = single
          ? (how ?? `Due today. Open ${plant.nickname} to log it.`)
          : [mine.map((i) => `${EMOJI[i.type] ?? ""} ${VERB[i.type] ?? i.type}`.trim()).join(" · "), how].filter(Boolean).join("\n");
        planned.push({
          id: `due:${plantId}:${dayKey(day)}`,
          at,
          title,
          body,
          items: mine.map(itemKey),
          plantId,
        });
      }
    }

    if (prefs.overdueNudge) {
      // Waiting from an earlier day; and today's own care too when nothing
      // else is going to mention it.
      const waiting = items.filter((i) =>
        prefs.dueAlerts ? i.dueDay.getTime() < day.getTime() : i.dueDay.getTime() <= day.getTime(),
      );
      if (waiting.length > 0) planned.push(nudge(waiting, day, at));
    }
  }

  return planned.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_QUEUED);
}

function nudge(waiting: Item[], day: Date, at: Date): PlannedReminder {
  const plants = [...new Set(waiting.map((i) => i.plant.id))];
  const id = `nudge:${dayKey(day)}`;
  const items = waiting.map(itemKey);

  if (waiting.length === 1) {
    const [only] = waiting;
    const late = daysBetween(only.dueDay, day);
    return {
      id,
      at,
      title: `${EMOJI[only.type] ?? ""} ${oneThing(only.type, only.plant.nickname)}`.trim(),
      body:
        late <= 0
          ? `Due today. Open ${only.plant.nickname} to log it.`
          : `Due ${late === 1 ? "yesterday" : `${late} days ago`}. Open ${only.plant.nickname} to log it.`,
      items,
      plantId: only.plant.id,
    };
  }

  // One line per kind of care, in the greenhouse's order.
  const order: CareType[] = ["WATER", "FERTILIZE", "REPOT", "PHOTO"];
  const lines = order
    .map((type) => {
      const names = waiting.filter((i) => i.type === type).map((i) => i.plant.nickname);
      return names.length ? `${EMOJI[type]} ${VERB[type]}: ${nameList(names)}` : null;
    })
    .filter(Boolean);
  return {
    id,
    at,
    title: plants.length === 1 ? `${waiting[0].plant.nickname} needs care` : `${plants.length} plants need care`,
    body: lines.join("\n"),
    items,
    plantId: plants.length === 1 ? plants[0] : null,
  };
}

/**
 * What is due or overdue right now, as `plantId:TYPE` — anything on the lock
 * screen that mentions none of it has been dealt with and can go.
 */
export function outstanding(plants: ReminderPlant[], now: Date = new Date()): Set<string> {
  const today = startOfDay(now).getTime();
  return new Set(dueItems(plants).filter((i) => i.dueDay.getTime() <= today).map(itemKey));
}

/** The ids of shown reminders whose care has all been done since. */
export function staleShown(shown: { id: string; items: string[] }[], stillOutstanding: Set<string>): string[] {
  return shown.filter((n) => n.items.length > 0 && !n.items.some((k) => stillOutstanding.has(k))).map((n) => n.id);
}

/** "9am", "12pm", "6:30pm". */
export function formatReminderTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "am" : "pm";
  return minute ? `${h}:${String(minute).padStart(2, "0")}${suffix}` : `${h}${suffix}`;
}
