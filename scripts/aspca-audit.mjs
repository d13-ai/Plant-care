/**
 * Checks every plant in the library against the ASPCA's toxic and non-toxic
 * plant lists, and records what it found in scripts/aspca-snapshot.json.
 *
 * Why this exists: the library tells people whether a plant is safe around
 * their cat. Until 24 Sep 2026 that was a sentence in plants-data.mjs with
 * nothing behind it on the page. "Non-toxic to cats and dogs" is a claim
 * somebody can act on, so the page now says who makes it -- the ASPCA Animal
 * Poison Control Center -- links to the entry, and says when we last looked.
 * A plant the ASPCA does not list is not called pet-safe at all.
 *
 * The page generator reads only the snapshot, never the network, so a build
 * is reproducible and never depends on aspca.org being up. Run this by hand
 * when the catalogue grows, or every few months to catch the list changing:
 *
 *   node scripts/aspca-audit.mjs          # fetch, match, write the snapshot
 *
 * It exits non-zero if any plant we call non-toxic is missing from the
 * ASPCA's non-toxic list for cats or dogs, or appears on a toxic list --
 * fix plants-data.mjs (conservatively) before committing the snapshot.
 *
 * Only the matched entries are stored, not the ASPCA's list itself.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { plantPages } from "./generate-plant-pages.mjs";
import { auditToxicity } from "./pet-safety.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "https://www.aspca.org";
const LIST = (animal) => `${BASE}/pet-care/animal-poison-control/${animal}-plant-list`;

/**
 * Genera the ASPCA still files under an older name. Matching is on the
 * scientific name, so without these a renamed genus reads as "not listed".
 * Only renames go here — never a guess that two genera are alike.
 */
const SYNONYMS = {
  Goeppertia: "Calathea", // most Calathea species moved to Goeppertia in 2012
  Haworthiopsis: "Haworthia", // split from Haworthia in 2013
};

/**
 * Species the ASPCA lists under another name — a botanical synonym, or once
 * a plain misspelling. Checked one by one; add only what you have checked.
 */
const SPECIES_SYNONYMS = {
  "Cissus discolor": ["Cissus dicolor"], // the ASPCA's spelling
  "Rhapis excelsa": ["Rhapis flabelliformus", "Rhapis flabelliformis"], // old name for R. excelsa
  "Fittonia albivenis": ["Fittonia verschaffeltii"], // now included in F. albivenis
  "Anthurium scherzerianum": ["Anthurium scherzeranum"], // the ASPCA's spelling
  "Cordyline fruticosa": ["Cordyline terminalis"], // old name
  "Crassula ovata": ["Crassula argentea"], // old name
};

const unescape = (s) =>
  s.replace(/&#0?39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Every entry on one animal's page, marked toxic or not by which list it is under. */
async function fetchList(animal) {
  const res = await fetch(LIST(animal), { headers: { "User-Agent": "Mozilla/5.0 (PlantParlour library audit)" } });
  if (!res.ok) throw new Error(`${LIST(animal)} answered ${res.status}`);
  const html = await res.text();
  const split = html.indexOf(`Plants Non-Toxic to ${animal[0].toUpperCase()}${animal.slice(1)}`);
  if (split < 0) throw new Error(`The ${animal} page no longer has a non-toxic heading — the parser needs a look`);
  const rows = [];
  const re =
    /toxic-and-non-toxic-plants\/([^"]+)">([^<]+)<\/a>\s*\(([^)]*)\)\s*\|\s*<b>Scientific Names:<\/b>\s*<i>([^<]*)<\/i>/g;
  for (const m of html.matchAll(re)) {
    rows.push({
      path: `/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/${m[1]}`,
      name: unescape(m[2]).trim(),
      sci: unescape(m[4]).trim(),
      toxic: m.index < split,
    });
  }
  if (rows.length < 500) throw new Error(`Only ${rows.length} entries parsed from the ${animal} page — the markup has changed`);
  return rows;
}

const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const names = (row) => row.sci.split(/[,;]/).map(norm);

/**
 * The ASPCA entries that speak for one plant: the species if it is named,
 * otherwise the genus. A genus-level match is recorded as such so the page
 * can say so rather than implying the species itself was assessed.
 */
function lookup(rows, genus, species) {
  const g = SYNONYMS[genus] ?? genus;
  const wants = [norm(`${g} ${species}`), ...(SPECIES_SYNONYMS[`${genus} ${species}`] ?? []).map(norm)];
  const bySpecies = rows.filter((r) => names(r).some((n) => wants.some((w) => n === w || n.startsWith(`${w} `))));
  if (bySpecies.length) return { level: "species", rows: bySpecies };
  const byGenus = rows.filter((r) => names(r).some((n) => n.split(" ")[0] === g.toLowerCase()));
  if (!byGenus.length) return null;
  // "Calathea spp." speaks for every calathea; "Pilea cadieri" speaks only
  // for Pilea cadieri. The first is good enough to call a species safe on,
  // the second is only a relative, and the page has to say which.
  const wide = byGenus.filter((r) => names(r).some((n) => n === g.toLowerCase() || /^\S+ (spp|sp|species)\b/.test(n)));
  return wide.length ? { level: "genus", rows: wide.concat(byGenus.filter((r) => r.toxic && !wide.includes(r))) } : { level: "related", rows: byGenus };
}

/**
 * The entry to show a reader, out of the several the ASPCA may have for one
 * plant: one under a name they'd recognise, then the whole-genus entry
 * ("Calathea spp."), then whichever came first.
 */
function representative(rows, p) {
  const commons = p.entry.common.map((c) => c.toLowerCase());
  const genus = (SYNONYMS[p.entry.genus] ?? p.entry.genus).toLowerCase();
  return (
    rows.find((r) => commons.includes(r.name.toLowerCase())) ??
    rows.find((r) => /\b(spp|species)\b/i.test(r.sci) || r.name.toLowerCase() === genus) ??
    rows[0]
  );
}

/** One animal's verdict: toxic if any matched entry is on the toxic list. */
function verdict(found, p) {
  if (!found) return null;
  const toxic = found.rows.filter((r) => r.toxic);
  const pick = representative(toxic.length ? toxic : found.rows, p);
  return {
    status: toxic.length ? "toxic" : "non-toxic",
    level: found.level,
    name: pick.name,
    sci: pick.sci,
    url: `${BASE}${pick.path}`,
  };
}

async function main() {
  const [cats, dogs] = await Promise.all([fetchList("cats"), fetchList("dogs")]);
  const plants = {};
  for (const p of plantPages()) {
    plants[p.slug] = {
      cats: verdict(lookup(cats, p.entry.genus, p.entry.species), p),
      dogs: verdict(lookup(dogs, p.entry.genus, p.entry.species), p),
    };
  }
  const snapshot = {
    checked: new Date().toISOString().slice(0, 10),
    source: `${BASE}/pet-care/animal-poison-control/toxic-and-non-toxic-plants`,
    plants,
  };
  writeFileSync(join(__dirname, "aspca-snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n", "utf-8");

  const problems = auditToxicity(plantPages(), snapshot);
  const listed = Object.values(plants).filter((v) => v.cats || v.dogs).length;
  console.log(`Matched ${listed} of ${Object.keys(plants).length} plants to an ASPCA entry; snapshot written.`);
  for (const p of problems) console.error(`  ${p}`);
  if (problems.length) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
