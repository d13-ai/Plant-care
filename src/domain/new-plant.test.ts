import { describe, expect, test } from "vitest";
import { addHint, defaultName, footerAction, topCandidate } from "./new-plant";

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

describe("the button at the foot of the screen", () => {
  const base = { nickname: "", dateInvalid: false, hasPhotos: false, identified: false, canIdentify: true };

  test("with a photo in and no answer yet, it offers to identify, not a greyed-out Add", () => {
    // 14 Oct 2026: the identify button was below the fold on an iPhone, and the
    // only button in view said "Give it a name to add it".
    expect(footerAction({ ...base, hasPhotos: true }).kind).toBe("identify");
  });

  test("before any photo, and once there's a name, it's Add plant", () => {
    expect(footerAction(base)).toEqual({ kind: "add", hint: "Give it a name to add it." });
    expect(footerAction({ ...base, hasPhotos: true, nickname: "Pothos" }).kind).toBe("add");
  });

  test("with the photo checks used up it never offers to identify", () => {
    expect(footerAction({ ...base, hasPhotos: true, canIdentify: false }).kind).toBe("add");
  });

  test("after an answer it didn't choose, it says to pick one", () => {
    expect(footerAction({ ...base, hasPhotos: true, identified: true })).toEqual({
      kind: "add",
      hint: "Tap one of the answers above, or give it a name to add it.",
    });
  });
});
