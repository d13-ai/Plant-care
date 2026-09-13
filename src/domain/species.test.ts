import { describe, expect, it } from "vitest";
import { SPECIES, SPECIES_GROUPS, displayName, findSpecies, matchCandidate, scientificName, searchSpecies } from "./species";

describe("species catalogue", () => {
  it("has no duplicate scientific names", () => {
    const names = SPECIES.map(scientificName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every entry sane cadences", () => {
    for (const e of SPECIES) {
      expect(e.waterEveryDays, scientificName(e)).toBeGreaterThan(0);
      expect(e.fertilizeEveryDays, scientificName(e)).toBeGreaterThanOrEqual(e.waterEveryDays);
      expect(e.repotEveryDays, scientificName(e)).toBeGreaterThanOrEqual(180);
    }
  });

  it("suggests scientific names first for a genus prefix", () => {
    const [first] = searchSpecies("mon");
    expect(first.genus).toBe("Monstera");
    expect(searchSpecies("mon").map(scientificName)).toContain("Monstera deliciosa");
  });

  it("finds by common name, any word", () => {
    expect(searchSpecies("pothos").map(scientificName)).toContain("Epipremnum aureum");
    expect(searchSpecies("snake")[0].common[0]).toBe("Snake plant");
    expect(searchSpecies("fiddle")[0].species).toBe("lyrata");
  });

  it("ignores case, accents and apostrophes", () => {
    expect(searchSpecies("MOTHER-IN-LAWS").length).toBeGreaterThan(0);
    expect(searchSpecies("birds nest")[0].species).toBe("nidus");
  });

  it("needs two characters and caps results", () => {
    expect(searchSpecies("m")).toEqual([]);
    expect(searchSpecies("a", 100)).toEqual([]);
    expect(searchSpecies("an", 3)).toHaveLength(3);
  });

  it("resolves a stored species string back to its entry", () => {
    expect(findSpecies("Monstera deliciosa")?.waterEveryDays).toBe(7);
    expect(findSpecies("swiss cheese plant")?.genus).toBe("Monstera");
    expect(findSpecies("Something made up")).toBeNull();
    expect(findSpecies("")).toBeNull();
  });

  it("shows the common name with the scientific one behind it", () => {
    expect(displayName(findSpecies("Ficus lyrata")!)).toBe("Fiddle-leaf fig (Ficus lyrata)");
    expect(displayName(findSpecies("Monstera obliqua")!)).toBe("Monstera obliqua");
  });
});

describe("browse groups", () => {
  it("puts every entry in a listed group, in list order", () => {
    for (const e of SPECIES) expect(SPECIES_GROUPS, scientificName(e)).toContain(e.group);
    const seen = [...new Set(SPECIES.map((e) => e.group))];
    expect(seen).toEqual(SPECIES_GROUPS);
  });
  it("files the obvious ones where a keeper would look", () => {
    expect(findSpecies("Monstera deliciosa")?.group).toBe("Aroids");
    expect(findSpecies("Aloe vera")?.group).toBe("Succulents & cacti");
    expect(findSpecies("Boston fern")?.group).toBe("Ferns");
  });
});

describe("matching an AI identification", () => {
  it("takes the exact species when the catalogue has it", () => {
    expect(matchCandidate({ genus: "Ficus", species: "lyrata" })?.common[0]).toBe("Fiddle-leaf fig");
  });
  it("falls back to the genus when the species is unknown or missing", () => {
    expect(matchCandidate({ genus: "Monstera", species: "" })?.genus).toBe("Monstera");
    expect(matchCandidate({ genus: "Hoya", species: "australis" })?.genus).toBe("Hoya");
  });
  it("gives nothing for a genus it doesn't know", () => {
    expect(matchCandidate({ genus: "Welwitschia", species: "mirabilis" })).toBeNull();
    expect(matchCandidate({ genus: "" })).toBeNull();
  });
});

describe("cultivars and variegations", () => {
  it("knows the ones collectors ask for", () => {
    expect(searchSpecies("thai constellation")[0].cultivar).toBe("Thai Constellation");
    expect(searchSpecies("thai")[0].genus).toBe("Monstera");
    expect(searchSpecies("albo").every((e) => /albo/i.test(e.cultivar ?? ""))).toBe(true);
    expect(searchSpecies("marble queen")[0].species).toBe("aureum");
    expect(searchSpecies("pink princess")[0].cultivar).toBe("Pink Princess");
  });
  it("writes the cultivar the way a label does, and reads it back", () => {
    const thai = findSpecies("Thai Constellation")!;
    expect(scientificName(thai)).toBe("Monstera deliciosa 'Thai Constellation'");
    expect(findSpecies("Monstera deliciosa 'Thai Constellation'")).toBe(thai);
    expect(scientificName(findSpecies("Prince of Orange")!)).toBe("Philodendron 'Prince of Orange'");
  });
  it("inherits its parent's group and care", () => {
    const parent = findSpecies("Monstera deliciosa")!;
    const thai = findSpecies("Thai Constellation")!;
    expect(thai.group).toBe(parent.group);
    expect(thai.waterEveryDays).toBe(parent.waterEveryDays);
    expect(findSpecies("Raven ZZ")!.waterEveryDays).toBe(findSpecies("ZZ plant")!.waterEveryDays);
  });
  it("sits right under its parent in the list", () => {
    const i = SPECIES.findIndex((e) => scientificName(e) === "Monstera deliciosa");
    expect(SPECIES[i + 1].cultivar).toBe("Thai Constellation");
  });
  it("matches an AI identification down to the cultivar, or falls back", () => {
    expect(matchCandidate({ genus: "Monstera", species: "deliciosa", cultivar: "Thai Constellation" })?.cultivar).toBe("Thai Constellation");
    expect(matchCandidate({ genus: "Monstera", species: "deliciosa", cultivar: "" })?.cultivar).toBeUndefined();
    expect(matchCandidate({ genus: "Monstera", species: "deliciosa", cultivar: "Not A Thing" })?.cultivar).toBeUndefined();
  });
});
