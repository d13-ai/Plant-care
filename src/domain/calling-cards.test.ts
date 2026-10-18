import { describe, expect, it } from "vitest";
import { cardsLine, whatsNew } from "./calling-cards";

describe("what's new since the last visit", () => {
  it("says nothing when nothing is new", () => {
    expect(whatsNew(0, 0)).toBeNull();
  });
  it("counts plants and photos, singular and plural", () => {
    expect(whatsNew(1, 0)).toBe("1 new plant");
    expect(whatsNew(0, 3)).toBe("3 new photos");
    expect(whatsNew(2, 1)).toBe("2 new plants · 1 new photo");
  });
});

describe("how many cards", () => {
  it("tells the keeper, even when there are none", () => {
    expect(cardsLine(0, "yours")).toMatch(/^No calling cards yet/);
    expect(cardsLine(1, "yours")).toBe("1 keeper has left their card at your conservatory.");
    expect(cardsLine(4, "yours")).toBe("4 keepers have left their card at your conservatory.");
  });
  it("tells a visitor only when there is something to say", () => {
    expect(cardsLine(0, "theirs")).toBe("");
    expect(cardsLine(2, "theirs")).toBe("2 keepers have left their card here.");
  });
});
