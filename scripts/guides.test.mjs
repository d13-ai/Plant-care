import { describe, expect, test } from "vitest";
import { plantPages } from "./generate-plant-pages.mjs";
import { gather, guidePage, petSafe, petSafePage } from "./generate-guides.mjs";
import { GUIDES, guideFor } from "./guides-data.mjs";
import {
  APCC,
  aspcaFor,
  aspcaNonToxic,
  aspcaText,
  auditToxicity,
  claimsNonToxic,
  petSummary,
  SNAPSHOT,
} from "./pet-safety.mjs";

const pages = plantPages();
const bySlug = (slug) => pages.find((p) => p.slug === slug);

describe("what the library says about pets", () => {
  test("every non-toxic claim is one the ASPCA itself makes", () => {
    // The one check that matters most. Anything here is a page telling
    // someone their cat is safe on nobody's authority but ours.
    expect(auditToxicity(pages)).toEqual([]);
  });

  test("the audit notices when the ASPCA changes its mind", () => {
    const slug = pages.find((p) => claimsNonToxic(p.toxicity)).slug;
    const flipped = structuredClone(SNAPSHOT);
    flipped.plants[slug].cats = { ...flipped.plants[slug].cats, status: "toxic" };
    expect(auditToxicity(pages, flipped).join("\n")).toContain(`${slug}: we say non-toxic`);
  });

  test("a relative on the list is not enough to call a plant safe", () => {
    // Pilea peperomioides: the ASPCA lists other Pileas, not this one.
    expect(aspcaFor("pilea-peperomioides").cats.level).toBe("related");
    expect(aspcaNonToxic("pilea-peperomioides")).toBe(false);
    expect(claimsNonToxic(bySlug("pilea-peperomioides").toxicity)).toBe(false);
    expect(aspcaText(bySlug("pilea-peperomioides"))).toContain("does not list Pilea peperomioides itself");
  });

  test("the pet-safe list holds only plants the ASPCA backs for cats and dogs", () => {
    const safe = petSafe(pages);
    expect(safe.length).toBeGreaterThan(20);
    for (const p of safe) expect(aspcaNonToxic(p.slug)).toBe(true);
    expect(safe.map((p) => p.slug)).not.toContain("tillandsia-ionantha"); // unlisted
    expect(safe.map((p) => p.slug)).toContain("chlorophytum-comosum"); // listed by name
  });

  test("a reassuring summary always names who is reassuring", () => {
    for (const p of pages.filter((p) => claimsNonToxic(p.toxicity))) {
      expect(petSummary(p)).toMatch(/^The ASPCA lists/);
    }
  });

  test("the pet-safe page carries the emergency number and the date checked", () => {
    const html = petSafePage(pages);
    expect(html).toContain(APCC.phone);
    expect(html).toContain('class="notice"');
    expect(html).toMatch(/\d{1,2} [A-Z][a-z]+ 20\d\d/);
  });
});

describe("the problem guides", () => {
  test("every guide gathers something from the library", () => {
    for (const g of GUIDES) expect(gather(g, pages).length, g.slug).toBeGreaterThan(0);
  });

  test("slugs are unique and links between guides point at real ones", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const text = JSON.stringify(GUIDES.map((g) => [g.signs, g.body]));
    for (const [, slug] of text.matchAll(/\[\[([a-z-]+)\|/g)) expect(slugs).toContain(slug);
  });

  test("a plant's problem finds the guide that reads it", () => {
    expect(guideFor("Yellow lower leaves")?.slug).toBe("yellow-leaves");
    expect(guideFor("Fine webbing under the leaves")?.slug).toBe("spider-mites");
    expect(guideFor("Brown tips on long thin leaves")?.slug).toBe("brown-leaf-tips");
    expect(guideFor("Buds dropping before they open")).toBeNull(); // flowers, not leaves
    expect(guideFor("Brown dots in rows under the fronds")).toBeNull(); // spores: normal
  });

  test("the FAQ in the markup is the FAQ on the page", () => {
    const html = guidePage(GUIDES[0], pages);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]))
      .find((d) => d["@type"] === "FAQPage");
    expect(ld.mainEntity).toHaveLength(GUIDES[0].faq.length);
    for (const q of ld.mainEntity) expect(html).toContain(q.name);
  });

  test("the health check is offered as a guess, not a diagnosis", () => {
    expect(guidePage(GUIDES[0], pages)).toContain("not a diagnosis");
  });
});
