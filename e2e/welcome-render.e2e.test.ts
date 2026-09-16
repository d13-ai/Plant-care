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
  expect(html).toContain("A CARFAX for plants.");
  expect(html).toContain('href="/"');
});

test("the account split is stated, not buried", () => {
  const { html } = welcomePage();
  // The promise the README makes: the app works with no account at all.
  expect(html).toContain("The app works with no account at all.");
  // And the part someone would otherwise hit as a surprise.
  expect(html).toMatch(/identification, care guides and tags [\s\S]*need an account/);
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
