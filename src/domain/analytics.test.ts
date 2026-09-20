import { describe, expect, test } from "vitest";
import { ANALYTICS_SNIPPET, BEFORE_SEND, redactUrl } from "./analytics";

const SITE = "https://plantparlour.org";

describe("what analytics is allowed to learn", () => {
  test("a tag's token never leaves the page", () => {
    // The whole reason this file exists. `t` is what makes an unlisted tag
    // reachable; a dashboard full of them would be a list of every plant
    // record this keeper has ever sent anyone.
    const out = redactUrl(`${SITE}/tag?t=9f3c1a77-4d2b-4a1e-8f60-2c4e9b1d7a55`);
    expect(out).toBe(`${SITE}/tag`);
    expect(out).not.toContain("9f3c");
  });

  test("a conservatory is counted without naming the keeper", () => {
    expect(redactUrl(`${SITE}/@dana`)).toBe(`${SITE}/@`);
    expect(redactUrl(`${SITE}/@bond-creative`)).toBe(`${SITE}/@`);
  });

  test("plant pages collapse to one row instead of one per plant", () => {
    expect(redactUrl(`${SITE}/plant/42`)).toBe(`${SITE}/plant`);
    expect(redactUrl(`${SITE}/plant/42/edit`)).toBe(`${SITE}/plant/edit`);
  });

  test("every query string goes, not only the ones we thought of", () => {
    // A new screen that puts an email or a token in the query should not
    // need this file edited to stay private.
    expect(redactUrl(`${SITE}/account?email=someone%40example.com`)).toBe(`${SITE}/account`);
    expect(redactUrl(`${SITE}/rounds?code=123456#thing`)).toBe(`${SITE}/rounds`);
  });

  test("the pages we actually want to read are left alone", () => {
    expect(redactUrl(`${SITE}/plants/monstera-deliciosa`)).toBe(`${SITE}/plants/monstera-deliciosa`);
    expect(redactUrl(`${SITE}/parlour-games/windowsill`)).toBe(`${SITE}/parlour-games/windowsill`);
    expect(redactUrl(`${SITE}/`)).toBe(`${SITE}/`);
  });

  test("a URL it cannot parse is dropped rather than sent raw", () => {
    expect(redactUrl("not a url")).toBeNull();
  });

  test("the code shipped to the browser is the code these tests ran", () => {
    // BEFORE_SEND is built from the same table redactUrl walks, so a
    // redaction added to one cannot go missing from the other.
    const browser = new Function(`return (${BEFORE_SEND})`)() as (e: { url: string }) => { url: string } | null;
    for (const url of [`${SITE}/tag?t=secret`, `${SITE}/@dana`, `${SITE}/plant/42/edit`, `${SITE}/plants/x`]) {
      expect(browser({ url })?.url).toBe(redactUrl(url));
    }
  });

  test("the stub is registered before the script that reads it", () => {
    // beforeSend has to be queued before the script is appended, or the
    // first pageview — the one that matters — goes out unredacted.
    expect(ANALYTICS_SNIPPET.indexOf("beforeSend")).toBeLessThan(
      ANALYTICS_SNIPPET.indexOf("insights/script.js"),
    );
    expect(ANALYTICS_SNIPPET).toContain("window.vaq");
  });

  test("nothing loads off Vercel, where the path is a 404 that serves HTML", () => {
    // Found by the browser smoke run: a static server answers the missing
    // script with index.html, and every page load throws "Unexpected token
    // '<'". Skipping localhost also keeps our own work out of the numbers.
    expect(ANALYTICS_SNIPPET).toContain("localhost");
    expect(ANALYTICS_SNIPPET.indexOf("localhost")).toBeLessThan(
      ANALYTICS_SNIPPET.indexOf("appendChild"),
    );
  });
});
