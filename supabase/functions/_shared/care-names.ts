/**
 * How the care function finds a guide it already has before paying for a new
 * one. Pure -- no Deno, no Supabase -- so scripts/care-names.test.mjs can hold
 * it to its rules under vitest, and scripts/care-library.mjs files the library
 * under the same keys.
 *
 * A guide is about a species, so three kinds of name should all land on one:
 *
 *  - the scientific name, however it is capitalised or quoted;
 *  - a common name we know ("snake plant" is Dracaena trifasciata);
 *  - a cultivar of a species we have ('Silvery Ann' is grown the way
 *    Scindapsus pictus is). The library says the same: care is the same
 *    across a species' cultivars unless noted, and variegated forms want a
 *    little more light.
 *
 * A cultivar with no species ("Philodendron 'Prince of Orange'", a hybrid)
 * stays itself -- a genus alone is not a guide.
 */

export interface SpeciesName {
  /** "Monstera deliciosa" or "Monstera deliciosa 'Thai Constellation'". */
  sci: string;
  common: string[];
}

/** How a name is filed: case, spacing and quote style don't make a new plant. */
export function careKey(name: string): string {
  return name
    .trim()
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„″"]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const CULTIVAR = /\s+(?:'[^']+'|cv\.?\s+.+)$/i;

/** The cultivar part of a name, as written ("'Silvery Ann'"), or null. */
export function cultivarOf(name: string): string | null {
  const tidy = name.trim().replace(/[‘’“”"]/g, "'");
  const m = tidy.match(CULTIVAR);
  if (!m) return null;
  const raw = m[0].trim();
  return raw.startsWith("'") ? raw : `'${raw.replace(/^cv\.?\s+/i, "")}'`;
}

/**
 * The species a cultivar belongs to ("Scindapsus pictus"), or null when the
 * name has no cultivar part or nothing but a genus is left.
 */
export function baseSpecies(name: string): string | null {
  const tidy = name.trim().replace(/[‘’“”"]/g, "'");
  if (!CULTIVAR.test(tidy)) return null;
  const base = tidy.replace(CULTIVAR, "").trim();
  return base.split(/\s+/).length >= 2 ? base : null;
}

/** The scientific name for a common name we know, when only one plant goes by it. */
export function resolveCommon(name: string, names: SpeciesName[]): string | null {
  const key = careKey(name);
  const matches = new Set(names.filter((n) => n.common.some((c) => careKey(c) === key)).map((n) => n.sci));
  return matches.size === 1 ? [...matches][0] : null;
}

export interface CarePlan {
  /** Keys to try in care_cards, best first. */
  lookups: { key: string; species: string; via: "exact" | "common" | "species" }[];
  /** What to ask the model for if none of them is there: the species, not the cultivar. */
  generate: { species: string; via: "exact" | "common" | "species" };
}

export function carePlan(name: string, names: SpeciesName[]): CarePlan {
  const asked = name.trim().replace(/\s+/g, " ");
  const known = names.find((n) => careKey(n.sci) === careKey(asked))?.sci;
  const common = known ? null : resolveCommon(asked, names);
  const resolved = known ?? common ?? asked;
  const base = baseSpecies(resolved);

  const lookups: CarePlan["lookups"] = [];
  const add = (species: string, via: CarePlan["lookups"][number]["via"]) => {
    const key = careKey(species);
    if (!lookups.some((l) => l.key === key)) lookups.push({ key, species, via });
  };
  add(asked, "exact");
  if (common) add(common, "common");
  if (base) add(base, "species");
  return { lookups, generate: { species: base ?? resolved, via: base ? "species" : common ? "common" : "exact" } };
}

/** Said under a guide that is the species' guide, not the cultivar's own. */
export function cultivarNote(asked: string, species: string): string {
  const cv = cultivarOf(asked);
  const which = cv ? `${cv} is grown` : "It is grown";
  return `This is the guide for ${species}. ${which} the same way; if yours is variegated, give it a little more light — it will grow more slowly than the plain species.`;
}

/**
 * Worth asking the model about at all: some letters, and nothing that is
 * plainly not a plant name. The model is the real judge (it says when it
 * doesn't recognise a name, and that answer is never filed); this only stops
 * the obvious before it costs anything.
 */
export function plausiblePlantName(name: string): boolean {
  const s = name.trim();
  if (s.length < 3 || s.length > 120) return false;
  if (/https?:|www\.|@|[<>{}\\]/i.test(s)) return false;
  const letters = (s.match(/\p{L}/gu) ?? []).length;
  return letters >= 3 && letters / s.replace(/\s/g, "").length >= 0.6;
}
