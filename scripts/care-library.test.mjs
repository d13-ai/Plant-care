import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { JSON_OUT, libraryCards, libraryJson, librarySql } from "./care-library.mjs";
import { OUT, speciesNamesSource } from "./generate-species-names.mjs";
import { GENUS } from "./plants-data.mjs";
import { TEMPERATURE } from "./temperature-data.mjs";
import {
  baseSpecies,
  careKey,
  carePlan,
  cultivarNote,
  cultivarOf,
  plausiblePlantName,
  resolveCommon,
} from "../supabase/functions/_shared/care-names.ts";
import { SPECIES_NAMES } from "../supabase/functions/_shared/species-names.ts";

describe("the library as care guides", () => {
  const rows = libraryCards();

  test("every plant page becomes a complete guide", () => {
    expect(rows.length).toBeGreaterThan(150);
    for (const { species, card } of rows) {
      for (const field of ["summary", "light", "water", "humidity", "temperature", "soil", "feeding", "repotting", "toxicity"]) {
        expect(card[field], `${species}: ${field}`).toMatch(/\S/);
      }
      expect(["easy", "moderate", "fussy"]).toContain(card.difficulty);
      expect(card.common_problems.length).toBeGreaterThan(0);
      expect(card.common_problems.length).toBeLessThanOrEqual(5);
      expect(card.source).toBe("library");
      expect(card.url).toMatch(/^https:\/\/plantparlour\.org\/plants\//);
    }
  });

  test("filed under the keys the care function looks up, once each", () => {
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("epipremnum aureum");
    expect(keys.every((k) => k === careKey(k))).toBe(true);
  });

  test("every genus says its own temperature, never inherited", () => {
    expect(Object.keys(GENUS).filter((g) => !TEMPERATURE[g])).toEqual([]);
  });

  test("the SQL quotes names with apostrophes", () => {
    const sql = librarySql([{ key: "x 'y'", species: "X 'Y'", card: { a: "it's" } }]);
    expect(sql).toContain("('x ''y''', 'X ''Y''', '{\"a\":\"it''s\"}'::jsonb, 'library')");
  });

  test("the copy the site serves is current", () => {
    expect(readFileSync(JSON_OUT, "utf8")).toBe(libraryJson(rows));
  });

  test("the function's copy of the species list is current", () => {
    expect(readFileSync(OUT, "utf8")).toBe(speciesNamesSource());
  });
});

describe("finding a guide we already have", () => {
  test("case, spacing and curly quotes don't make a new plant", () => {
    expect(careKey("  Scindapsus   pictus ‘Silvery Ann’ ")).toBe("scindapsus pictus 'silvery ann'");
  });

  test("a cultivar belongs to its species; a hybrid with no species doesn't", () => {
    expect(baseSpecies("Scindapsus pictus 'Silvery Ann'")).toBe("Scindapsus pictus");
    expect(baseSpecies("Epipremnum aureum cv. Marble Queen")).toBe("Epipremnum aureum");
    expect(baseSpecies("Philodendron 'Prince of Orange'")).toBeNull();
    expect(baseSpecies("Monstera deliciosa")).toBeNull();
    expect(cultivarOf("Epipremnum aureum cv. Marble Queen")).toBe("'Marble Queen'");
  });

  test("a common name finds its species, unless two plants share it", () => {
    expect(resolveCommon("Snake Plant", SPECIES_NAMES)).toBe("Dracaena trifasciata");
    expect(resolveCommon("elephant ear", SPECIES_NAMES)).toBeNull();
  });

  test("a cultivar tries itself, then its species, and is written as the species", () => {
    const plan = carePlan("Scindapsus pictus 'Silvery Ann'", SPECIES_NAMES);
    expect(plan.lookups.map((l) => [l.key, l.via])).toEqual([
      ["scindapsus pictus 'silvery ann'", "exact"],
      ["scindapsus pictus", "species"],
    ]);
    expect(plan.generate).toEqual({ species: "Scindapsus pictus", via: "species" });
  });

  test("a common name for a cultivar tries the cultivar, then the species", () => {
    const sci = SPECIES_NAMES.find((n) => n.sci === "Monstera deliciosa 'Thai Constellation'");
    const plan = carePlan(sci.common[0], SPECIES_NAMES);
    expect(plan.lookups.map((l) => l.via)).toEqual(["exact", "common", "species"]);
    expect(plan.generate.species).toBe("Monstera deliciosa");
  });

  test("a species asked plainly is just itself", () => {
    expect(carePlan("ficus lyrata", SPECIES_NAMES)).toEqual({
      lookups: [{ key: "ficus lyrata", species: "ficus lyrata", via: "exact" }],
      generate: { species: "Ficus lyrata", via: "exact" },
    });
  });

  test("the note names the species and the cultivar", () => {
    expect(cultivarNote("Scindapsus pictus 'Silvery Ann'", "Scindapsus pictus")).toMatch(
      /^This is the guide for Scindapsus pictus\. 'Silvery Ann' is grown the same way; if yours is variegated/,
    );
  });

  test("plainly-not-a-plant names never reach the model", () => {
    for (const bad of ["", "ab", "12345", "https://example.com", "a@b.com", "<script>"]) expect(plausiblePlantName(bad), bad).toBe(false);
    for (const ok of ["qfabrv", "Pilea peperomioides", "Hoya 'Krimson Queen'", "Perle von Nürnberg"]) expect(plausiblePlantName(ok), ok).toBe(true);
  });
});
