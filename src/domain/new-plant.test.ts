import { describe, expect, test } from "vitest";
import { addHint, defaultName, topCandidate } from "./new-plant";

const cand = (common_name: string, confidence: number, cultivar = "") => ({ genus: "Epipremnum", species: "aureum", cultivar, common_name, confidence });

describe("after an identification", () => {
  test("a confident answer is chosen for the keeper, the likeliest first", () => {
    const v = { is_plant: true, species: [cand("Snow Queen pothos", 0.1), cand("Marble Queen pothos", 0.82, "Marble Queen")] };
    expect(topCandidate(v)?.common_name).toBe("Marble Queen pothos");
  });

  test("a guess among look-alikes is left for the keeper to pick", () => {
    expect(topCandidate({ is_plant: true, species: [cand("A", 0.4), cand("B", 0.35)] })).toBeNull();
  });

  test("not a plant, or no answer, chooses nothing", () => {
    expect(topCandidate({ is_plant: false, species: [] })).toBeNull();
    expect(topCandidate(null)).toBeNull();
  });

  test("the name is what shops call it, falling back to the cultivar, then the Latin", () => {
    expect(defaultName(cand("Marble Queen pothos", 0.9, "Marble Queen"))).toBe("Marble Queen pothos");
    expect(defaultName(cand("  ", 0.9, "Marble Queen"))).toBe("Marble Queen");
    expect(defaultName(cand("", 0.9))).toBe("Epipremnum aureum");
  });
});

describe("the line above Add plant", () => {
  test("says what is missing, or what the button will do", () => {
    expect(addHint("", false)).toBe("Give it a name to add it.");
    expect(addHint("Pothos", true)).toBe("Fix the date, or leave it blank for today.");
    expect(addHint(" Pothos ", false)).toBe("Adds “Pothos” to your greenhouse and starts its care schedule.");
  });
});
