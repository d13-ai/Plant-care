import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { AI_TOXICITY_NOTICE, APCC, ASPCA_PLANT_LIST, POISON_HELP } from "./pet-safety";

describe("what the app says beside a toxicity line", () => {
  test("names the ASPCA as the authority, and both emergency lines", () => {
    expect(AI_TOXICITY_NOTICE).toMatch(/Written by AI/);
    expect(AI_TOXICITY_NOTICE).toContain("ASPCA");
    expect(AI_TOXICITY_NOTICE).toContain(APCC.phone);
    expect(AI_TOXICITY_NOTICE).toContain(POISON_HELP.phone);
  });

  test("the app and the website give the same number and the same list", () => {
    // Two runtimes, one fact each: a number that differs between the app and
    // the site is wrong in one of them.
    const site = readFileSync("scripts/pet-safety.mjs", "utf-8");
    expect(site).toContain(`phone: "${APCC.phone}"`);
    expect(APCC.tel.replace("tel:", "")).toBe(site.match(/APCC = \{[^}]*tel: "([^"]+)"/)?.[1]);
    const snapshot = JSON.parse(readFileSync("scripts/aspca-snapshot.json", "utf-8"));
    expect(snapshot.source).toBe(ASPCA_PLANT_LIST);
  });

  test("the care guide never renders a toxicity line without the notice", () => {
    const guide = readFileSync("src/components/care-guide.tsx", "utf-8");
    const line = guide.indexOf("{card.toxicity}");
    const notice = guide.indexOf("{AI_TOXICITY_NOTICE}");
    expect(line).toBeGreaterThan(0);
    expect(notice).toBeGreaterThan(line);
    expect(notice - line).toBeLessThan(800); // right under it, not elsewhere on the screen
  });
});
