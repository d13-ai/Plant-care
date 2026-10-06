// Play Store screenshots from the web build, at 1080x1920 (9:16).
// Usage: node scripts/store-screenshots.mjs dist <photos-dir> <out-dir>
// The photos are the owner's own plants (Birkin, Thai Constellation, White
// Wizard), cropped to 3:4; they are not in the repo. Everything the server
// would answer is stubbed, so this never spends an AI call.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [root, photos, out] = process.argv.slice(2).map((p) => path.resolve(p));
fs.mkdirSync(out, { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".ttf": "font/ttf" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(root, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) file = path.join(root, p + ".html");
  if (!fs.existsSync(file) && /^\/plant\/[^/]+\/edit$/.test(p)) file = path.join(root, "plant/_id/edit.html");
  if (!fs.existsSync(file) && /^\/plant\/[^/]+$/.test(p)) file = path.join(root, "plant/_id.html");
  if (!fs.existsSync(file)) file = path.join(root, "index.html");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME });
const VIEW = { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true };

const ref = "ixagjvntbgyqemxxinqe";
const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "dana@example.com", is_anonymous: false, app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date(0).toISOString() };
const session = { access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
const asJson = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

let verdict = null;
const card = {
  summary: "A compact, slow-growing philodendron with cream pinstripes on deep green leaves. Forgiving, and at its best in bright, indirect light.",
  difficulty: "easy",
  light: "Bright, indirect light. Too little and new leaves come in plain green; direct afternoon sun scorches them.",
  water: "When the top 2–3 cm of soil is dry. Water thoroughly and let it drain; never leave it standing in water.",
  humidity: "Average room humidity is fine; it grows faster above 50%.",
  temperature: "18–27 °C (65–80 °F). Keep it away from cold drafts below 13 °C.",
  soil: "Chunky aroid mix: potting soil with bark and perlite.",
  feeding: "Balanced liquid feed at half strength every 4 weeks in spring and summer.",
  repotting: "Every 1–2 years, one pot size up, when roots circle the pot.",
  common_problems: [
    { problem: "Yellow lower leaves", fix: "Usually too much water. Let the top of the soil dry before watering again." },
    { problem: "New leaves losing their stripes", fix: "Move it somewhere brighter, out of direct sun." },
  ],
  toxicity: "Toxic to cats and dogs if chewed: like all philodendrons it contains calcium oxalate crystals, which irritate the mouth and throat.",
};

async function makeContext(signedIn) {
  const context = await browser.newContext(VIEW);
  if (!signedIn) return context;
  await context.route("**/auth/v1/user**", (r) => r.fulfill(asJson(user)));
  await context.route("**/auth/v1/token**", (r) => r.fulfill(asJson(session)));
  await context.route("**/functions/v1/account-email", (r) => r.fulfill(asJson({ sent: false, reason: "already_welcomed" })));
  await context.route("**/functions/v1/analyze", (r) => r.fulfill(asJson({ verdict, remaining: 18, photos_left: 3 })));
  await context.route("**/functions/v1/care", (r) => r.fulfill(asJson({ card })));
  await context.route("**/storage/v1/**", (r) => r.fulfill(asJson({ Key: "x" })));
  await context.route("**/rest/v1/**", (r) => {
    const m = r.request().method();
    const accept = r.request().headers()["accept"] ?? "";
    if (accept.includes("vnd.pgrst.object")) return r.fulfill(asJson({ photo_calls: 2, ai_unlimited: false }));
    return r.fulfill(asJson([], m === "POST" ? 201 : 200));
  });
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  return context;
}

const daysAgo = (n) => { const d = new Date(Date.now() - n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const snap = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`) });

// 1. The welcome screen, signed out.
{
  const ctx = await makeContext(false);
  const page = await ctx.newPage();
  await page.goto(base + "/");
  await page.getByText("A room for the plants").waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await snap(page, "6-welcome");
  await ctx.close();
}

const ctx = await makeContext(true);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));

async function addPlant({ photo, name, species, acquired, location }) {
  await page.goto(base + "/plant/new");
  await page.getByPlaceholder("Big Monstera").waitFor({ timeout: 20000 });
  if (photo) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByText("Choose from library", { exact: true }).click();
    await (await chooser).setFiles(path.join(photos, photo));
    await page.waitForTimeout(800);
  }
  await page.getByPlaceholder("Big Monstera").fill(name);
  await page.getByPlaceholder("Monstera deliciosa").fill(species);
  if (location) await page.getByPlaceholder("South window").fill(location);
  await page.getByPlaceholder("Today if blank").fill(daysAgo(acquired));
  await page.getByText("Add plant", { exact: true }).last().click();
  await page.waitForURL(/\/plant\/\d+$/, { timeout: 20000 });
  await page.getByText("Care schedule").waitFor({ timeout: 20000 });
  return page.url();
}
async function logPast(chip, days) {
  const matches = page.getByText(chip, { exact: true });
  await (chip === "Still moist" ? matches.last() : matches.first()).click();
  await page.getByPlaceholder("0").fill(String(days));
  await page.getByText("Add to history").click();
  await page.waitForTimeout(300);
}

const birkin = await addPlant({ photo: "birkin2.jpg", name: "Birdie", species: "Philodendron 'Birkin'", acquired: 60, location: "Bathroom shelf" });
await logPast("Watered", 9); await logPast("Watered", 2); await logPast("Fertilized", 20);
const monstera = await addPlant({ photo: "monstera.jpg", name: "Thai Con", species: "Monstera deliciosa 'Thai Constellation'", acquired: 120, location: "Living room" });
await logPast("Watered", 8);
const wizard = await addPlant({ photo: "wizard.jpg", name: "The Wizard", species: "Philodendron 'White Wizard'", acquired: 30, location: "Stairs" });
await logPast("Watered", 4);

// 2. The greenhouse.
await page.goto(base + "/");
await page.getByText("Birdie").waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
await snap(page, "1-greenhouse");

// 3. A plant's page.
await page.goto(birkin);
await page.getByText("Care schedule").waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
await page.getByText("Care schedule").scrollIntoViewIfNeeded();
await page.evaluate(() => { const h = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim() === "Care schedule"); h?.scrollIntoView({ block: "center" }); });
await page.waitForTimeout(800);
await snap(page, "2-plant");

// 4. The care guide.
await page.getByText("Care guide").first().scrollIntoViewIfNeeded();
await page.getByText("Chunky aroid mix", { exact: false }).waitFor({ timeout: 20000 });
await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim().startsWith("Care guide")); el?.scrollIntoView({ block: "start" }); });
await page.waitForTimeout(800);
await snap(page, "5-care-guide");

// 5. Identification on Add plant.
verdict = {
  is_plant: true,
  species: [
    { genus: "Philodendron", species: "", cultivar: "White Wizard", common_name: "White Wizard philodendron", confidence: 0.86 },
    { genus: "Philodendron", species: "", cultivar: "White Knight", common_name: "White Knight philodendron", confidence: 0.09 },
  ],
  health: { overall: "healthy", findings: [{ observation: "New leaf unfurling cleanly with good white variegation", kind: "observation", likely_cause: "Healthy growth", suggested_action: "Keep it in bright, indirect light to hold the variegation.", severity: "low" }] },
  notes: "Variegation is sectoral, so expect some leaves mostly green and some mostly white.",
};
await page.goto(base + "/plant/new");
await page.getByPlaceholder("Big Monstera").waitFor({ timeout: 20000 });
{
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Choose from library", { exact: true }).click();
  await (await chooser).setFiles(path.join(photos, "wizard.jpg"));
}
await page.getByText("Identify with AI").click();
await page.getByText("Looks like").waitFor({ timeout: 20000 });
await page.getByText("White Wizard philodendron").first().click();
await page.waitForTimeout(600);
await page.getByText("Looks like").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -140));
await page.waitForTimeout(600);
await snap(page, "3-identify");

// 6. A health check.
verdict = {
  is_plant: true,
  species: [{ genus: "Monstera", species: "deliciosa", cultivar: "Thai Constellation", common_name: "Thai Constellation monstera", confidence: 0.93 }],
  health: {
    overall: "watch",
    findings: [
      { observation: "Brown, crispy edge on the newest leaf", kind: "problem", likely_cause: "Low humidity or uneven watering", suggested_action: "Water when the top few centimetres are dry, and keep it away from heating vents.", severity: "low" },
      { observation: "Strong, even variegation across the leaves", kind: "observation", likely_cause: "Good light", suggested_action: "Keep it where it is.", severity: "low" },
    ],
  },
  notes: "",
};
await page.goto(monstera);
await page.getByText("Check health with AI").waitFor({ timeout: 20000 });
await page.getByText("Check health with AI").click();
await page.getByText("Health: watch").waitFor({ timeout: 20000 });
await page.getByText("Check health with AI").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 170));
await page.waitForTimeout(800);
await snap(page, "4-health-check");

await browser.close();
server.close();
console.log("done");
