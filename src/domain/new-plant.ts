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

/** The line above "Add plant": what tapping it does, or what it still needs. */
export function addHint(nickname: string, dateInvalid: boolean): string {
  if (!nickname.trim()) return "Give it a name to add it.";
  if (dateInvalid) return "Fix the date, or leave it blank for today.";
  return `Adds “${nickname.trim()}” to your greenhouse and starts its care schedule.`;
}
