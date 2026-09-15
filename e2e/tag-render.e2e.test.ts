/**
 * The tag page's lineage section, rendered directly. Offline — render() is a
 * pure function of what passport() returned; what reaches it from the server
 * is covered by tag-handler.e2e.test.ts.
 */
import { expect, test } from "vitest";
import { render, type Tag } from "../api/tag";

const tag = (mother: Tag["mother"]): Tag => ({
  plant: {
    nickname: "Little Pothos",
    species: "Epipremnum aureum",
    status: "ACTIVE",
    acquired_at: "2026-08-01T00:00:00.000Z",
    acquired_from: null,
    notes: null,
    propagated_at: "2026-08-01T00:00:00.000Z",
    published_at: "2026-09-01T00:00:00.000Z",
    passport_token: "a".repeat(32),
  },
  keeper: { display_name: "Ada" },
  mother,
  cuttings: [],
  events: [],
  photos: [],
});

test("a published mother is named and linked", () => {
  const html = render(tag({ nickname: "Big Pothos", passport_token: "b".repeat(32) }));
  expect(html).toContain("Big Pothos");
  expect(html).toContain(`?t=${"b".repeat(32)}`);
});

test("an unpublished mother's name never reaches the page", () => {
  // passport() withholds both fields when the mother isn't public. The page
  // still says this plant is a cutting — that much is the keeper's own
  // published record — but it cannot name someone's unpublished plant.
  const html = render(tag({ nickname: null, passport_token: null }));
  expect(html).toContain("Cutting from");
  expect(html).toContain("a plant that isn't published");
  expect(html).not.toContain("Big Pothos");
  expect(html, "no empty link where the name would have been").not.toMatch(/<a href="\?t=">/);
});

test("a plant with no mother still reads as an original", () => {
  const html = render(tag(null));
  expect(html).toContain("Original plant");
});
