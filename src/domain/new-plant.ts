/**
 * What the add-plant screen fills in for a keeper after an identification.
 * Pure, tested in new-plant.test.ts.
 *
 * Nothing used to be chosen: the keeper had to tap a candidate, then tap or
 * type a name, then find "Add plant" at the foot of the form -- and the first
 * keepers from outside left before doing all three. A confident answer now
 * arrives chosen and named, both a tap to change.
 */
export interface Candidate {
  genus: string;
  species: string;
  cultivar: string;
  common_name: string;
  confidence: number;
}

/** Below this the answer is a guess among look-alikes, and the keeper should pick. */
export const CHOOSE_FOR_THEM_AT = 0.5;

/** The answer to pre-select, if the AI was sure enough of one. */
export function topCandidate(verdict: { is_plant: boolean; species: Candidate[] } | null): Candidate | null {
  if (!verdict?.is_plant || !verdict.species.length) return null;
  const top = [...verdict.species].sort((a, b) => b.confidence - a.confidence)[0];
  return top.confidence >= CHOOSE_FOR_THEM_AT ? top : null;
}

/** A first name for the plant: what people in shops call it. */
export function defaultName(c: Candidate): string {
  const common = c.common_name.trim();
  if (common) return common;
  if (c.cultivar.trim()) return c.cultivar.trim();
  return [c.genus, c.species].filter(Boolean).join(" ").trim();
}

/**
 * What the button at the foot of the add-plant screen is for right now.
 *
 * 14 Oct 2026: a new keeper on an iPhone chose a photo and left. "Identify
 * with AI" sat just below the bottom of the screen, and the one button in
 * view was a greyed-out "Add plant" saying "Give it a name to add it" -- an
 * invitation to type, not to identify. With a photo in and no answer yet, the
 * bar offers the identification instead; once there is a name it goes back to
 * adding the plant.
 */
export type FooterAction = { kind: "identify" | "add"; hint: string };

export function footerAction(s: {
  nickname: string;
  dateInvalid: boolean;
  hasPhotos: boolean;
  identified: boolean;
  /** Whether a photo check can be spent: signed in to a server, with some left. */
  canIdentify: boolean;
}): FooterAction {
  if (!s.nickname.trim() && s.hasPhotos && !s.identified && s.canIdentify) {
    return { kind: "identify", hint: "Find out what it is from the photo, or give it a name to add it." };
  }
  if (!s.nickname.trim() && s.identified) {
    return { kind: "add", hint: "Tap one of the answers above, or give it a name to add it." };
  }
  return { kind: "add", hint: addHint(s.nickname, s.dateInvalid) };
}

/** The line above "Add plant": what tapping it does, or what it still needs. */
export function addHint(nickname: string, dateInvalid: boolean): string {
  if (!nickname.trim()) return "Give it a name to add it.";
  if (dateInvalid) return "Fix the date, or leave it blank for today.";
  return `Adds “${nickname.trim()}” to your greenhouse and starts its care schedule.`;
}
