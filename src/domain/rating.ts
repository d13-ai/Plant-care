/**
 * When the app asks for a rating on Google Play.
 *
 * Once, ever, and only once someone is actually using PlantParlour: after
 * they have logged care on five different days. The same card for everyone
 * who gets there -- no asking whether they like it first and sending only the
 * happy ones to the store, which Google's rules forbid, and no reward.
 *
 * Only in the Android app. The website has no store listing to rate, and an
 * iPhone has no PlantParlour app at all.
 */
import { LOGGABLE_CARE_TYPES, type CareType } from "./care";

/** Days with care logged before the card appears. */
export const RATING_AFTER_DAYS = 5;

/** Set once the card has been answered either way. Per device, like a
 *  Play rating, which belongs to the Google account on the phone. */
export const RATING_ASKED_KEY = "pp:rating-asked";

/** The words on the card and beside the link in Account, from the two of us. */
export const RATING_ASK = {
  title: "A note from David and Amanda",
  body: "PlantParlour is made by the two of us, because we love plants. If it's been useful, a rating on Google Play helps other plant people find it, and we read every review.",
  rate: "Rate on Google Play",
  later: "Not now",
} as const;

/** Care the keeper logged themselves -- not the "brought home" entry every
 *  new plant starts with, or a check the app ran. */
const BY_HAND = new Set<CareType>(LOGGABLE_CARE_TYPES);

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** How many different days, in this phone's time, care was logged on. */
export function careDays(events: { type: CareType; occurredAt: string }[]): number {
  const days = new Set<string>();
  for (const e of events) if (BY_HAND.has(e.type)) days.add(localDay(e.occurredAt));
  return days.size;
}

export function shouldAskForRating(opts: { androidApp: boolean; answered: boolean; careDays: number }): boolean {
  return opts.androidApp && !opts.answered && opts.careDays >= RATING_AFTER_DAYS;
}
