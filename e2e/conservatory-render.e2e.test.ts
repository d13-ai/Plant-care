/**
 * The conservatory page, rendered directly from a fixture. Offline: what matters
 * here is what the page does with what the RPC hands it — the RPC's own job of
 * withholding private plants is enforced in SQL and checked in the live suite.
 */
import { expect, test } from "vitest";
import { HANDLE, conservatoryPage, renderConservatory, type Conservatory } from "../api/conservatory";
import { page } from "../api/tag";

const fixture: Conservatory = {
  keeper: { handle: "amanda", display_name: "Amanda", keeping_since: "2026-01-04T00:00:00.000Z" },
  plants: [
    {
      nickname: "Ring of Fire",
      species: "Philodendron 'Ring of Fire'",
      status: "ACTIVE",
      acquired_at: "2025-06-01T00:00:00.000Z",
      propagated_at: null,
      passport_token: "a".repeat(32),
      photo: "keeper/plant/photo.jpg",
    },
    {
      nickname: "Thai Cutting",
      species: null,
      status: "ACTIVE",
      acquired_at: "2026-03-02T00:00:00.000Z",
      propagated_at: "2026-03-02T00:00:00.000Z",
      passport_token: "b".repeat(32),
      photo: null,
    },
  ],
};

test("it shows the keeper and every plant they have on show", () => {
  const html = renderConservatory(fixture);
  expect(html).toContain("Amanda");
  expect(html).toContain("@amanda");
  expect(html).toContain("2 plants on show");
  expect(html).toContain("Ring of Fire");
  expect(html).toContain("Thai Cutting");
});

test("each plant links to its own tag, which is the only way in", () => {
  const html = renderConservatory(fixture);
  for (const p of fixture.plants) expect(html).toContain(`href="/tag?t=${p.passport_token}"`);
  // Nothing on the page reaches a plant by anything but its published token.
  expect(html).not.toMatch(/\/plant\/\d/);
});

test("a plant with no photo still gets a tile", () => {
  const html = renderConservatory({ ...fixture, plants: [{ ...fixture.plants[1] }] });
  expect(html).toContain("Thai Cutting");
  expect(html).toContain("noshot");
});

test("an empty conservatory says so rather than looking broken", () => {
  const html = renderConservatory({ ...fixture, plants: [] });
  expect(html).toContain("hasn't published a plant");
  expect(html).not.toContain("plants on show");
});

test("a keeper's own words are escaped, not rendered", () => {
  const html = renderConservatory({
    ...fixture,
    keeper: { ...fixture.keeper, display_name: '<img src=x onerror="alert(1)">' },
    plants: [{ ...fixture.plants[0], nickname: "</a><script>alert(2)</script>" }],
  });
  expect(html).not.toContain("<script>");
  expect(html).not.toContain('onerror="');
  expect(html).toContain("&lt;script&gt;");
});

test("it is meant to be found and shared", async () => {
  // Rendered through page() with the head the handler passes.
  const { html } = page("Amanda · PlantParlour", renderConservatory(fixture), 200, '<meta property="og:title" content="x">');
  expect(html).toContain('<meta property="og:title"');
  expect(html).not.toContain("noindex");
});

test("a handle that could never exist is a 404 without asking the server", async () => {
  for (const bad of ["", "no", "has space", "a".repeat(21), "../../etc", "admin'--"]) {
    const { status } = await conservatoryPage(bad);
    expect(status, `${bad} should not reach the database`).toBe(404);
  }
});

test("the handle rule matches the database's own constraint", () => {
  expect(HANDLE.test("Amanda_9")).toBe(true);
  expect(HANDLE.test("ab")).toBe(false);
  expect(HANDLE.test("a".repeat(21))).toBe(false);
  expect(HANDLE.test("has space")).toBe(false);
  expect(HANDLE.test("dot.dot")).toBe(false);
});
