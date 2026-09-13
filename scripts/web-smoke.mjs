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
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

const daysAgo = (n) => { const d = new Date(Date.now() - n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const shot = (name) => (shots ? page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true }) : Promise.resolve());
const step = async (name, fn) => { await fn(); console.log("✓", name); };

try {
  await page.goto(base + "/");
  await step("empty greenhouse renders", () => page.getByText("Start your greenhouse").waitFor({ timeout: 20000 }));
  await shot("01-empty");

  await step("open add-plant", async () => {
    await page.getByText("Add your first plant").click();
    await page.getByPlaceholder("Big Monstera").waitFor();
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
    await page.getByPlaceholder("YYYY-MM-DD (today if blank)").fill(daysAgo(40));
    await page.getByText("Add plant", { exact: true }).last().click();
    await page.getByText("Care schedule").waitFor();
  });
  await step("overdue for water and fertilizer, not repotting", async () => {
    await page.getByText("Needs water").first().waitFor();
    await page.getByText("Needs fertilizer").first().waitFor();
    if (await page.getByText("Needs repotting").count()) throw new Error("repot should not be due after 40 days");
  });
  await shot("02-detail-overdue");

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
  });
  await shot("05-list");
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
