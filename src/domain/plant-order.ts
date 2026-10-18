/**
 * How the greenhouse list is ordered: the plants that want something first
 * (the reason to open the app), or plainly A–Z, for a keeper with a big
 * collection looking for one plant by name. The keeper picks; each phone
 * remembers its own choice.
 */
export type PlantOrder = "needs" | "az";

export const PLANT_ORDERS: { label: string; value: PlantOrder }[] = [
  { label: "Needs me first", value: "needs" },
  { label: "A–Z", value: "az" },
];

export function isPlantOrder(value: unknown): value is PlantOrder {
  return value === "needs" || value === "az";
}

/** Nicknames as people read them: case-blind, and "Pothos 2" before "Pothos 10". */
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

/**
 * `rank` is the plant's urgency, 0 most urgent (see summarize() in
 * plant-card.tsx). Ties, and the whole list in A–Z, go by nickname.
 */
export function orderPlants<T>(rows: { item: T; rank: number; name: string }[], order: PlantOrder): T[] {
  return [...rows]
    .sort((a, b) => (order === "needs" ? a.rank - b.rank : 0) || byName(a.name, b.name))
    .map((r) => r.item);
}
