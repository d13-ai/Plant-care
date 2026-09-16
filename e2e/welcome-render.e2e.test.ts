/**
 * The public welcome page, rendered directly. Offline by nature: unlike the
 * tag page it reads nothing, which is most of the point — it is the page a
 * stranger loads before the app bundle exists.
 */
import { expect, test } from "vitest";
import { welcomePage } from "../api/welcome";
import { page } from "../api/tag";

test("it says what the app is and offers a way in", () => {
  const { status, html } = welcomePage();
  expect(status).toBe(200);
  expect(html).toContain("Every plant, on the record.");
  expect(html).toContain('href="/"');
});

test("it is the same welcome as the app's own screen, in the same voice", () => {
  const { html } = welcomePage();
  // Whoever is behind this, by name — the part a stranger being asked for an
  // email actually wants to know.
  expect(html).toContain("We're David and Amanda");
  // And the invitation the whole page is built on.
  expect(html).toMatch(/A parlour is the room\s+you bring people into to show them what you love/);
  expect(html).toContain("So bring yours in.");
});

test("it says an account is needed, rather than letting it be a surprise", () => {
  const { html } = welcomePage();
  expect(html).toMatch(/a parlour belongs to a keeper, so it starts with an[\s\S]*account/);
  // And that going offline doesn't cost anyone a photo.
  expect(html).toMatch(/photo taken where there is no signal[\s\S]*uploads/);
});

test("every way in is the sign-in screen", () => {
  const { html } = welcomePage();
  const targets = [...html.matchAll(/<a class="btn[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
  expect(targets.length).toBeGreaterThan(0);
  // /account is behind the gate, so a stranger sent there sees the same
  // screen with an extra redirect: point them straight at it.
  expect(new Set(targets)).toEqual(new Set(["/"]));
});

test("it is meant to be found and shared, and indexable", () => {
  const { html } = welcomePage();
  expect(html).toContain('<meta name="description"');
  expect(html).toContain('<link rel="canonical" href="https://plantparlour.org/welcome">');
  expect(html).toContain('<meta property="og:title"');
  expect(html).not.toContain("noindex");
});

test("nothing on it touches a keeper's data", () => {
  const { html } = welcomePage();
  expect(html).not.toContain("supabase");
  expect(html).not.toContain("passport_token");
});

test("the extra head markup stays opt-in for the tag page", () => {
  const { html } = page("Plant Tag", "<p>body</p>");
  expect(html).not.toContain('<meta name="description"');
  expect(html).not.toContain("og:title");
});
