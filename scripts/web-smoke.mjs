/**
 * End-to-end check of the exported web build in headless Chromium:
 * add a plant → see what's due → log care → report and resolve an issue →
 * take a cutting → back to the list → reload. Run via `npm run smoke`.
 *
 * Needs a browser once: `npx playwright install chromium`
 * (or set CHROME to an existing Chromium binary).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(process.argv[2] ?? "dist");
const shots = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

// --- static server with the cross-origin isolation expo-sqlite's wasm needs
const types = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(root, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) file = path.join(root, p + ".html");
  // The same rewrites vercel.json has, so a direct load of a plant URL is tested here too.
  if (!fs.existsSync(file) && /^\/plant\/[^/]+\/edit$/.test(p)) file = path.join(root, "plant/_id/edit.html");
  if (!fs.existsSync(file) && /^\/plant\/[^/]+$/.test(p)) file = path.join(root, "plant/_id.html");
  if (!fs.existsSync(file)) file = path.join(root, "index.html");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}`;

// --- drive it
const errors = [];
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
// An explicit context, so a second tab can be opened on the same origin --
// which is what the database-locking check at the end needs.
const context = await browser.newContext({ viewport: { width: 420, height: 860 } });

// The parlour is behind an account now, so this run needs to be signed in.
// supabase-js keeps the session as plain JSON under sb-<project ref>-auth-token,
// and the auth endpoints are stubbed so the client can confirm the user it
// finds there -- without that it decides the token is no good and signs out
// mid-run. Everything else stays offline, as before.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ixagjvntbgyqemxxinqe.supabase.co";
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "smoke@plantparlour.test",
  is_anonymous: false,
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date(0).toISOString(),
};
const session = {
  access_token: "smoke-access-token",
  refresh_token: "smoke-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};
const asJson = (body) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
await context.route("**/auth/v1/user**", (route) => route.fulfill(asJson(user)));
await context.route("**/auth/v1/token**", (route) => route.fulfill(asJson(session)));
await context.addInitScript(
  ([key, value]) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode: the first step will fail loudly enough */
    }
  },
  [`sb-${ref}-auth-token`, JSON.stringify(session)],
);

const page = await context.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  // This is the offline SQLite-on-wasm build; reaching Supabase is out of
  // scope here. "Add to calendar" tries to fetch the care guide to enrich the
  // reminders and falls back cleanly when it can't — so ignore the network
  // reset that failed fetch logs, but keep every real app/JS error.
  if (/net::ERR_/.test(m.text())) return;
  errors.push("console: " + m.text());
});

const daysAgo = (n) => { const d = new Date(Date.now() - n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const shot = (name) => (shots ? page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true }) : Promise.resolve());
const step = async (name, fn) => { await fn(); console.log("✓", name); };

try {
  await page.goto(base + "/");
  await step("empty greenhouse renders", () => page.getByText("Your parlour's empty").waitFor({ timeout: 20000 }));
  await shot("01-empty");

  await step("open add-plant", async () => {
    await page.getByText("Add your first plant").click();
    await page.getByPlaceholder("Big Monstera").waitFor();
  });
  await step("the AI allowance is stated before anything is spent, and no price is", async () => {
    // It used to be discoverable only by watching it count down, and the wall
    // at zero arrived unannounced. And the note that carried it led with what
    // the scan cost -- a number that answers the owner's question, not the
    // keeper's, and is recorded in ai_usage either way.
    await page.getByText(/AI identifications/).first().waitFor({ timeout: 20000 });
    const body = await page.evaluate(() => document.body.innerText);
    if (/¢|cost about|\$\d/.test(body)) {
      throw new Error(`the add-plant screen quotes a price: ${/[^\n]*(¢|cost about|\$\d)[^\n]*/.exec(body)?.[0]}`);
    }
  });

  await step("browse the species list and pick one", async () => {
    await page.getByText("Browse", { exact: true }).click();
    await page.getByText("Pick a species").waitFor();
    await page.getByText("Ferns", { exact: true }).click();
    await page.getByText("Boston fern").click();
    if ((await page.getByPlaceholder("Monstera deliciosa").inputValue()) !== "Nephrolepis exaltata") throw new Error("pick didn't fill the species");
    await page.getByText(/reminders set: water every 4 days/).waitFor();
  });
  await step("a typed cultivar is suggested and filled", async () => {
    await page.getByPlaceholder("Monstera deliciosa").fill("thai con");
    await page.getByText(/Thai Constellation \(Monstera deliciosa/).click();
    if ((await page.getByPlaceholder("Monstera deliciosa").inputValue()) !== "Monstera deliciosa 'Thai Constellation'") throw new Error("cultivar suggestion didn't fill");
  });
  await step("fill and save a plant acquired 40 days ago", async () => {
    await page.getByPlaceholder("Big Monstera").fill("Big Monstera");
    await page.getByPlaceholder("Monstera deliciosa").fill("Monstera deliciosa");
    await page.getByPlaceholder("South window").fill("South window");
    await page.getByPlaceholder("Today if blank").fill(daysAgo(40));
    await page.getByText("Add plant", { exact: true }).last().click();
    await page.getByText("Care schedule").waitFor();
  });
  await step("overdue for water and fertilizer, not repotting", async () => {
    await page.getByText("Needs water").first().waitFor();
    await page.getByText("Needs fertilizer").first().waitFor();
    if (await page.getByText("Needs repotting").count()) throw new Error("repot should not be due after 40 days");
  });
  await shot("02-detail-overdue");

  await step("add to calendar exports a recurring .ics with reminders", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("Add to calendar").click(),
    ]);
    const stream = await download.createReadStream();
    let ics = "";
    for await (const chunk of stream) ics += chunk;
    if (!ics.includes("BEGIN:VCALENDAR")) throw new Error("not an iCalendar file");
    if (!/RRULE:FREQ=DAILY;INTERVAL=\d+/.test(ics)) throw new Error("no recurring reminder in the .ics");
    if (!/SUMMARY:.*Water Big Monstera/.test(ics)) throw new Error("no water reminder for the plant");
  });
  await step("a chosen photo is kept and survives a reload", async () => {
    const hasStoredPhoto = () => page.waitForFunction(() => [...document.images].some((i) => i.src.startsWith("data:image/jpeg")), null, { timeout: 20000 });
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByText("Choose", { exact: true }).click()]);
    // A 2x2 PNG; the app re-encodes whatever it's given as an inline JPEG.
    await chooser.setFiles({ name: "leaf.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGNgYPjPwMAAAAQEAQAv0f9pAAAAAElFTkSuQmCC", "base64") });
    await hasStoredPhoto();
    // The bug this guards: a blob: URL is gone after a reload; a data: URL isn't.
    await page.goto(base + "/");
    await page.getByText("Big Monstera").waitFor({ timeout: 20000 });
    await page.getByText("Big Monstera").first().click();
    await page.getByText("Care schedule").waitFor();
    await hasStoredPhoto();
  });

  await step("log water clears the water alert", async () => {
    await page.getByText("Log", { exact: true }).first().click();
    await page.getByText("Watered", { exact: true }).first().waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes("Needs water"));
  });
  await step("watering again the same day asks first", async () => {
    const watered = () => page.getByText("Watered", { exact: true }).count();
    const before = await watered();
    page.once("dialog", (d) => { if (!/already watered today/.test(d.message())) throw new Error("wrong prompt: " + d.message()); d.dismiss(); });
    await page.getByText("Log", { exact: true }).first().click();
    await page.waitForTimeout(300);
    if ((await watered()) !== before) throw new Error("declined, but a watering was logged");
    page.once("dialog", (d) => d.accept());
    await page.getByText("Log", { exact: true }).first().click();
    await page.waitForFunction((n) => document.body.innerText.split("Watered").length - 1 > n, before);
  });
  await step("report an issue → special care needed", async () => {
    await page.getByText("Issue reported").first().click();
    await page.getByPlaceholder("Spider mites on new growth").fill("Spider mites");
    await page.getByText("Add to history").click();
    await page.getByText("Special care needed").first().waitFor();
  });
  await shot("03-issue");
  await step("resolve it → treatment on record", async () => {
    await page.getByText("Mark resolved").click();
    await page.getByText("Treatment applied").first().waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes("Special care needed"));
  });
  await step("create a cutting → lineage links back", async () => {
    await page.getByPlaceholder("Big Monstera cutting").fill("Cutting #1");
    await page.getByText("Create cutting").click();
    await page.getByText(/Cutting from Big Monstera/).waitFor();
  });
  await shot("04-cutting");
  await step("greenhouse lists both plants, needy one first", async () => {
    await page.goto(base + "/");
    await page.getByText("Water due").waitFor({ timeout: 20000 });
    await page.getByText("All plants").waitFor({ timeout: 20000 });
    await page.getByText("1 needs attention").waitFor();
    const text = await page.locator("body").innerText();
    const i = text.indexOf("Big Monstera"), j = text.indexOf("Cutting #1");
    if (i < 0 || j < 0) throw new Error("missing plant in list");
    if (i > j) throw new Error("Big Monstera (needs fertilizer) should sort before the fresh cutting");
    await page.getByText("Needs fertilizer").first().waitFor();
    await page.getByText("All good").first().waitFor();
    // The games link is at the foot of the list on every visit; the card is
    // only for a day when nothing is asking for anything, and today one of
    // them is.
    if (await page.getByLabel("Parlour Games").count() !== 1)
      throw new Error("expected exactly the footer link to Parlour Games");
    if ((await page.locator("body").innerText()).includes("Nothing needs you today"))
      throw new Error("the games card showed while a plant needed attention");
  });
  await shot("05-list");
  await step("the card's drop logs water without leaving the greenhouse", async () => {
    await page.getByLabel("Log water for Cutting #1").click();
    await page.getByText("Watered Cutting #1").waitFor();
    await page.getByText("All plants").waitFor();
    if (/doesn.t exist|404/.test(await page.evaluate(() => document.body.innerText))) throw new Error("left the app");
  });
  await step("undo takes that watering back", async () => {
    await page.getByText("Undo", { exact: true }).click();
    await page.waitForFunction(() => !document.body.innerText.includes("Watered Cutting #1"));
    await page.getByText("Cutting #1").first().click();
    await page.getByText("History", { exact: true }).waitFor();
    // "Watered" is also the log-care chip, so count the history rows by their remove buttons.
    if (await page.getByLabel(/^Remove Watered/).count()) throw new Error("undone watering is still in the history");
  });
  await step("a history entry can be removed, after asking", async () => {
    await page.getByText("Log", { exact: true }).first().click();
    await page.getByLabel(/^Remove Watered/).waitFor();
    page.once("dialog", (d) => { if (!/Remove "Watered"/.test(d.message())) throw new Error("wrong confirm text: " + d.message()); d.dismiss(); });
    await page.getByLabel(/^Remove Watered/).click();
    await page.waitForTimeout(300);
    if (!(await page.getByLabel(/^Remove Watered/).count())) throw new Error("declined, but the entry went");
    page.once("dialog", (d) => d.accept());
    await page.getByLabel(/^Remove Watered/).click();
    await page.waitForFunction(() => !document.querySelector('[aria-label^="Remove Watered"]'));
    await page.getByText("Never logged").first().waitFor();
    if (await page.getByLabel(/^Remove Brought home/).count()) throw new Error("the brought-home entry must not be removable");
  });
  await step("a plant page loads straight from its URL", async () => {
    await page.goto(`${base}/plant/1`);
    await page.getByText("Care schedule").waitFor({ timeout: 20000 });
    await page.getByText("Big Monstera").first().waitFor();
    await page.goto(base);
    await page.getByText("All plants").waitFor({ timeout: 20000 });
  });
  await step("remove a plant asks, then removes", async () => {
    await page.getByText("Cutting #1").first().click();
    await page.getByText("Remove plant").waitFor();
    page.once("dialog", (d) => { if (!/Remove Cutting #1\?/.test(d.message())) throw new Error("wrong confirm text: " + d.message()); d.dismiss(); });
    await page.getByText("Remove plant").click();
    await page.getByText("Remove plant").waitFor(); // dismissed: still here
    page.once("dialog", (d) => d.accept());
    await page.getByText("Remove plant").click();
    await page.getByText("All plants").waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !document.body.innerText.includes("Cutting #1"));
  });
  await step("data survives a reload", async () => {
    await page.reload();
    await page.getByText("All plants").waitFor({ timeout: 20000 });
    await page.getByText("Big Monstera").waitFor();
    if (await page.getByText("Cutting #1").count()) throw new Error("removed plant came back after reload");
  });
  await step("with nothing due, the greenhouse offers Parlour Games", async () => {
    await page.getByText("Big Monstera").first().click();
    await page.getByText("Fertilized", { exact: true }).first().click();
    await page.getByText("Add to history").click();
    await page.waitForFunction(() => !document.body.innerText.includes("Needs fertilizer"));
    await page.goto(base + "/");
    await page.getByText("1 plant · all good").waitFor({ timeout: 20000 });
    await page.getByText("Nothing needs you today.").waitFor();
    if (await page.getByLabel("Parlour Games").count() !== 2)
      throw new Error("expected both the card and the footer link");
  });
  await shot("06-games");
  await step("it goes to the hub, in the same tab", async () => {
    const tabs = context.pages().length;
    await page.getByLabel("Parlour Games").first().click();
    await page.waitForURL("**/parlour-games");
    await page.getByText("Trickle").first().waitFor({ timeout: 20000 });
    if (context.pages().length !== tabs) throw new Error("opened a new tab instead of navigating");
    await page.goto(base + "/");
    await page.getByText("All plants").waitFor({ timeout: 20000 });
  });

  await step("what's on show lists the greenhouse with a switch each", async () => {
    // Publishing itself needs the server, which this run doesn't have; what is
    // checked here is that the screen is reachable and lists every plant with
    // its own control, which is the part that used to mean opening each plant.
    await page.goto(base + "/on-show");
    await page.getByText("What's on show").first().waitFor({ timeout: 20000 });
    await page.getByText("Nothing is on show yet").waitFor();
    await page.getByText("Big Monstera").waitFor();
    const switches = await page.getByRole("switch").count();
    if (switches < 1) throw new Error("no per-plant control on the on-show screen");
    await shot("03-on-show");
    await page.getByText("Done", { exact: true }).click();
    await page.getByText("All plants").waitFor({ timeout: 20000 });
  });
  await step("your rounds is reachable and empty before any card is left", async () => {
    // The rounds themselves need the server; what's checked offline is that the
    // screen stands up, says what it's for, and doesn't pretend to have data.
    await page.route("**/rest/v1/rpc/rounds", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.goto(base + "/rounds");
    await page.getByText("Your rounds").first().waitFor({ timeout: 20000 });
    await page.getByText("No cards left yet").waitFor();
    await page.getByText("Leave a card", { exact: true }).waitFor();
    await page.getByText("Done", { exact: true }).click();
    await page.getByText("All plants").waitFor({ timeout: 20000 });
    await page.unroute("**/rest/v1/rpc/rounds");
  });
  await step("a second tab says so instead of showing nothing", async () => {
    // The database lives in the browser's origin-private filesystem, which
    // only one tab can hold open. The second used to throw
    // NoModificationAllowedError out of SQLiteProvider, render nothing, and
    // sit blank until the +html.tsx watchdog reloaded it twenty seconds on.
    // Same context as `page`, so it is genuinely the same origin and file.
    const second = await context.newPage();
    try {
      await second.goto(base, { waitUntil: "domcontentloaded" });
      // Either it got the file (the first tab yielded it) or it says why not.
      await second.getByText("Already open in another tab").waitFor({ timeout: 15000 });
    } finally {
      await second.close();
    }
  });
  await step("without an account there is a welcome screen and no way past it", async () => {
    // A clean context: no session in storage, no stubbed auth. The parlour
    // belongs to an account, so this is all anyone sees -- including on a
    // direct link to a plant, which waits for them until they are in.
    const stranger = await browser.newContext({ viewport: { width: 420, height: 860 } });
    try {
      const visitor = await stranger.newPage();
      // No database at all: SQLite's wasm never loads. Signing in must still
      // work, because someone without an account has nothing on this device to
      // read -- and while the provider sat in front of the sign-in screen, a
      // database that wouldn't open took the login page down with it.
      await visitor.route("**/*.wasm", (route) => route.abort());
      for (const route of ["/", "/plant/1", "/account"]) {
        await visitor.goto(base + route, { waitUntil: "domcontentloaded" });
        await visitor.getByText("Start your parlour").waitFor({ timeout: 15000 });
        if (await visitor.getByText("All plants").count()) throw new Error(`${route} showed the greenhouse to a stranger`);
        if (await visitor.getByText("Big Monstera").count()) throw new Error(`${route} leaked a plant to a stranger`);
      }
    } finally {
      await stranger.close();
    }
  });
  await step("a tester can reach the bug report screen", async () => {
    await page.goto(base + "/account", { waitUntil: "domcontentloaded" });
    await page.getByText("Found a bug?").waitFor({ timeout: 15000 });
    await page.getByText("Report a bug", { exact: true }).last().click();
    await page.getByText("Something not right?").waitFor({ timeout: 15000 });
    // Sending needs a real session, which this run does not have, so the
    // check stops at the screen -- but it must say plainly what it collects.
    await page.getByText("What gets sent").waitFor({ timeout: 5000 });
    await shot("26-report");
  });
  await step("iPhone visitors are told how to install; nobody else is", async () => {
    // The hint is the only thing standing in for an install prompt on iOS,
    // which never offers one -- and it is the one piece of this that cannot be
    // checked on a real iPhone from here. So check the decision itself: an
    // iPhone user agent sees it, a desktop one must not.
    const IPHONE =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    for (const [label, userAgent, expected] of [
      ["iPhone", IPHONE, true],
      ["desktop", undefined, false],
    ]) {
      const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, userAgent });
      try {
        const visitor = await ctx.newPage();
        await visitor.goto(base + "/", { waitUntil: "domcontentloaded" });
        await visitor.getByText("Start your parlour").waitFor({ timeout: 15000 });
        const hint = visitor.getByText("Add to Home Screen");
        if (expected) await hint.waitFor({ timeout: 15000 });
        // The hint decides after mount, so give it the same beat before
        // concluding it stayed away.
        else if (await hint.count()) throw new Error("install hint shown to a " + label + " visitor");
      } finally {
        await ctx.close();
      }
    }
  });
} finally {
  await browser.close();
  server.close();
}

if (errors.length) {
  console.log("Browser errors:");
  errors.forEach((e) => console.log("  ", e));
  process.exit(1);
}
console.log("ALL PASSED");
