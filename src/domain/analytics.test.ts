import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { ANALYTICS_INLINE, ANALYTICS_SNIPPET, BEFORE_SEND, IN_APP_KEY, OPT_OUT_KEY, redactUrl } from "./analytics";

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

describe("our own visits", () => {
  const g = globalThis as { localStorage?: { getItem(k: string): string | null } };
  afterEach(() => {
    delete g.localStorage;
  });
  const browser = () => new Function(`return (${BEFORE_SEND})`)() as (e: { url: string }) => { url: string } | null;

  test("an opted-out browser sends nothing, even if the counter loaded", () => {
    g.localStorage = { getItem: (k) => (k === OPT_OUT_KEY ? "1" : null) };
    expect(browser()({ url: `${SITE}/plants/x` })).toBeNull();
  });

  test("everyone else is counted as before", () => {
    g.localStorage = { getItem: () => null };
    expect(browser()({ url: `${SITE}/plants/x` })?.url).toBe(`${SITE}/plants/x`);
  });

  test("an opted-out browser never loads the counter", () => {
    const check = ANALYTICS_SNIPPET.indexOf(OPT_OUT_KEY, ANALYTICS_SNIPPET.indexOf("(function ()"));
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(ANALYTICS_SNIPPET.indexOf("appendChild"));
  });

  test("the opt-out page sets the key the counter reads, before the counter runs", () => {
    const page = readFileSync("public/count-me-out.html", "utf-8");
    const sets = page.indexOf(`localStorage.setItem("${OPT_OUT_KEY}", "1")`);
    expect(sets).toBeGreaterThan(0);
    expect(sets).toBeLessThan(page.indexOf("insights/script.js"));
    expect(page).toContain('content="noindex');
  });
});


describe("pages the Android app opens", () => {
  /** Runs the real snippet against a fake page; says whether the counter got loaded. */
  function loads(search: string, tab: Record<string, string> = {}): boolean {
    let appended = false;
    const store = (kept: Record<string, string>) => ({
      getItem: (k: string) => (k in kept ? kept[k] : null),
      setItem: (k: string, v: string) => { kept[k] = v; },
    });
    const window = {} as Record<string, unknown>;
    new Function("window", "location", "localStorage", "sessionStorage", "document", ANALYTICS_INLINE)(
      window,
      { hostname: "plantparlour.org", search },
      store({}),
      store(tab),
      { createElement: () => ({}), head: { appendChild: () => { appended = true; } } },
    );
    return appended;
  }

  test("a page opened in the app's sheet is not counted, nor the pages after it in that tab", () => {
    const tab: Record<string, string> = {};
    expect(loads("?from=app", tab)).toBe(false);
    expect(tab[IN_APP_KEY]).toBe("1");
    expect(loads("", tab)).toBe(false);
  });

  test("the website is counted as before", () => {
    expect(loads("")).toBe(true);
    expect(loads("?daily=1")).toBe(true);
  });

  test("the games' harness remembers the sheet under the same key", () => {
    expect(readFileSync("public/parlour-games/harness.js", "utf-8")).toContain(`"${IN_APP_KEY}"`);
  });
});
