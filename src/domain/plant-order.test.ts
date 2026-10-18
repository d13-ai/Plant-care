import { describe, expect, it } from "vitest";
import { isPlantOrder, orderPlants } from "./plant-order";

const rows = [
  { item: "Aloe", rank: 3, name: "Aloe" },
  { item: "pothos 10", rank: 0, name: "pothos 10" },
  { item: "Birkin", rank: 0, name: "Birkin" },
  { item: "Pothos 2", rank: 2, name: "Pothos 2" },
];

describe("ordering the greenhouse", () => {
  it("puts the plants that need something first, A–Z within each", () => {
    expect(orderPlants(rows, "needs")).toEqual(["Birkin", "pothos 10", "Pothos 2", "Aloe"]);
  });

  it("A–Z ignores urgency and case, and counts numbers as numbers", () => {
    expect(orderPlants(rows, "az")).toEqual(["Aloe", "Birkin", "Pothos 2", "pothos 10"]);
  });

  it("leaves the list it was given alone", () => {
    const before = rows.map((r) => r.item);
    orderPlants(rows, "az");
    expect(rows.map((r) => r.item)).toEqual(before);
  });

  it("knows a stored choice from anything else", () => {
    expect(isPlantOrder("az")).toBe(true);
    expect(isPlantOrder("needs")).toBe(true);
    expect(isPlantOrder("zz")).toBe(false);
    expect(isPlantOrder(null)).toBe(false);
  });
});
