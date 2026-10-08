/**
 * Vercel Web Analytics, and the redaction that has to come with it.
 *
 * The counting itself is ordinary: a script Vercel serves from our own
 * origin, cookieless, no fingerprinting, nothing stored on the visitor's
 * device. What is not ordinary is what our URLs carry.
 *
 * A published plant tag is reachable at `/tag?t=<token>`, and that token IS
 * the secret — it is the whole of what makes an unlisted link unlisted.
 * Analytics reports the URL it saw. Left alone, every tag a keeper has ever
 * sent to a buyer would sit in a dashboard, and the privacy notice's promise
 * that a tag link is "unlisted, not secret, and yours to hand out" would be
 * false in a way nobody could see from the outside.
 *
 * So `beforeSend` runs before anything leaves the page: query strings go
 * entirely, and the parts of a path that name a particular keeper or plant
 * are collapsed to the shape of the page. What is left is what we actually
 * wanted to know — how many people opened a tag, not whose.
 *
 * It is also why this lives in one file and is pasted nowhere by hand. The
 * snippet goes into every HTML surface we serve, and a surface that got the
 * script without the redaction would quietly leak; `npm run seo` fails if
 * one of them is missing it.
 */

/**
 * Paths whose identifying part is replaced by the shape of the page.
 * `/tag?t=abc123` and `/@dana` both become a page we can count without
 * knowing which keeper it belongs to.
 *
 * First match wins, and the order is load-bearing: the more specific rule
 * comes first. Applying every rule in turn instead meant `/plant/42/edit`
 * became `/plant/edit` and then got eaten by the next rule down to
 * `/plant`, quietly merging two different screens into one row.
 */
const REDACTIONS: [RegExp, string][] = [
  [/^\/@[^/]+/, "/@"],
  [/^\/plant\/[^/]+\/edit/, "/plant/edit"],
  [/^\/plant\/[^/]+/, "/plant"],
];

/**
 * A browser that has opted out of being counted: ours. Set by visiting
 * /count-me-out, which is how the people building PlantParlour keep their
 * own testing out of the numbers -- on 27 Sep 2026 the most-visited pages
 * were the home page and the app, which is where our own work happens.
 *
 * Per browser, not per person: localStorage is all a static page can read
 * before deciding whether to load the counter, and there is no account to
 * consult on the library pages. Visit the link once on each device.
 */
export const OPT_OUT_KEY = "pp:not-counted";

/**
 * A page shown inside the Android app's browser sheet: Parlour Games, opened
 * with `?from=app` (src/lib/links.ts, openInApp), remembered for the tab so
 * the hub's links on to each game stay uncounted too. The app itself carries
 * no analytics, and Play's Data safety form says so; a page it opens counts
 * as the app collecting, so those pages don't count either. The games'
 * harness reads the same key to point their links back at the app.
 */
export const IN_APP_KEY = "pp:in-app";

/** The redaction, as source, so the browser and the tests share one copy. */
export const BEFORE_SEND = `function (event) {
  try {
    if (localStorage.getItem(${JSON.stringify(OPT_OUT_KEY)}) === "1") return null;
  } catch (e) {}
  try {
    var u = new URL(event.url);
    u.search = "";
    u.hash = "";
    var p = u.pathname;
${REDACTIONS.map(
  ([re, to]) => `    if (${re.toString()}.test(p)) p = p.replace(${re.toString()}, ${JSON.stringify(to)});`,
).join("\n    else")}
    u.pathname = p;
    return { ...event, url: u.toString() };
  } catch (e) {
    return null;
  }
}`;

/** Where Vercel serves the counter from — our own origin, so COEP is happy. */
const ANALYTICS_SCRIPT_SRC_LITERAL = "/_vercel/insights/script.js";
export const ANALYTICS_SCRIPT_SRC = ANALYTICS_SCRIPT_SRC_LITERAL;

/**
 * The whole of it: a queue stub, the redaction registered into it, and then
 * the counter itself — but only where the counter exists.
 *
 * The script is served by Vercel at our own origin, so anywhere else that
 * path is just a 404. A static file server answers a 404 with the app's
 * index.html, the browser parses HTML as JavaScript, and every local page
 * load throws "Unexpected token '<'" — which is how the browser smoke run
 * found this. Skipping localhost fixes the error and is right anyway: our
 * own development should not turn up in the numbers as visitors.
 *
 * The stub and `beforeSend` are registered first regardless, so the script
 * can never load into a page where the redaction has not been set up.
 */
export const ANALYTICS_INLINE = `window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
window.va('beforeSend', ${BEFORE_SEND});
(function () {
  var h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "" || h.endsWith(".local")) return;
  // A browser that opted out never loads the counter at all.
  try {
    if (localStorage.getItem(${JSON.stringify(OPT_OUT_KEY)}) === "1") return;
  } catch (e) {}
  // Nor does a page opened inside the app, which counts nothing.
  var fromApp = /[?&]from=app(&|$)/.test(location.search);
  try {
    if (fromApp) sessionStorage.setItem(${JSON.stringify(IN_APP_KEY)}, "1");
    if (sessionStorage.getItem(${JSON.stringify(IN_APP_KEY)}) === "1") return;
  } catch (e) {
    if (fromApp) return;
  }
  var s = document.createElement("script");
  s.defer = true;
  s.src = ${JSON.stringify(ANALYTICS_SCRIPT_SRC_LITERAL)};
  document.head.appendChild(s);
})();`;

/** One script tag, for every surface that emits HTML as a string. */
export const ANALYTICS_SNIPPET = `<script>
${ANALYTICS_INLINE}
</script>`;

/**
 * The same redaction as a function, so a test can run the real thing over
 * real URLs rather than checking that a string contains a regex.
 */
export function redactUrl(url: string): string | null {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    let p = u.pathname;
    for (const [re, to] of REDACTIONS) {
      if (!re.test(p)) continue;
      p = p.replace(re, to);
      break;
    }
    u.pathname = p;
    return u.toString();
  } catch {
    return null;
  }
}
