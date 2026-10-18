import { describe, expect, it } from "vitest";
import { handleFrom, sameHandle } from "./handle";

describe("finding the handle in what was typed", () => {
  it("takes it bare or with its @", () => {
    expect(handleFrom("ogBondstera")).toBe("ogBondstera");
    expect(handleFrom("  @cjunk21 ")).toBe("cjunk21");
  });

  it("takes it out of a pasted conservatory link", () => {
    expect(handleFrom("https://plantparlour.org/@Mandy_B")).toBe("Mandy_B");
    expect(handleFrom("plantparlour.org/@mandy_b/")).toBe("mandy_b");
    expect(handleFrom("https://plantparlour.org/%40mandy_b?utm_source=sms")).toBe("mandy_b");
  });

  it("refuses what can't be a handle", () => {
    for (const bad of ["", "@", "ab", "a".repeat(21), "has space", "dot.dot", "@@double", "https://plantparlour.org/plants"]) {
      expect(handleFrom(bad), bad).toBeNull();
    }
  });
});

describe("one keeper, whatever the case", () => {
  it("matches regardless of case, never on nothing", () => {
    expect(sameHandle("Amanda", "amanda")).toBe(true);
    expect(sameHandle("amanda", "amanda2")).toBe(false);
    expect(sameHandle(null, null)).toBe(false);
    expect(sameHandle("", "")).toBe(false);
  });
});
