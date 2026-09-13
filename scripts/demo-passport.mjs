/**
 * Publish a demo passport to the Supabase project in .env, so there is a
 * real link to show someone before they have the app.
 *
 * Seeds one plant with a year of history — waterings, feeds, a repot, an
 * issue and its treatment, photos over time — plus a cutting that links
 * back to it, under a fresh anonymous keeper. Prints both passport URLs and
 * the keeper id (delete that auth user to take the demo down).
 *
 * The "photos" are drawn here and rendered with Playwright, so it needs a
 * browser like the smoke test does (CHROME=… to point at one).
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, KEY = env.EXPO_PUBLIC_SUPABASE_KEY;
if (!URL_ || !KEY) throw new Error("EXPO_PUBLIC_SUPABASE_URL / _KEY missing from .env");

const now = Date.now();
const ago = (days) => new Date(now - days * 86_400_000).toISOString();

// --- a stylised monstera in a pot; more leaves = older plant
function plantSvg(leaves, seed) {
  const L = [];
  for (let i = 0; i < leaves; i++) {
    const a = -70 + (140 / Math.max(leaves - 1, 1)) * i + ((seed * 7 + i * 13) % 9) - 4;
    const len = 150 + ((seed * 11 + i * 17) % 40);
    const hue = 120 + ((seed * 3 + i * 5) % 20);
    L.push(`
      <g transform="rotate(${a} 400 430)">
        <path d="M400 430 C 400 ${430 - len * 0.5}, 400 ${430 - len * 0.8}, 400 ${430 - len}" stroke="hsl(${hue},35%,30%)" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="400" cy="${430 - len - 60}" rx="52" ry="78" fill="hsl(${hue},45%,32%)"/>
        <ellipse cx="400" cy="${430 - len - 60}" rx="40" ry="66" fill="hsl(${hue},48%,38%)"/>
        <path d="M400 ${430 - len - 130} L400 ${430 - len + 10}" stroke="hsl(${hue},40%,26%)" stroke-width="3"/>
        <ellipse cx="380" cy="${430 - len - 78}" rx="9" ry="16" fill="#f4efe6" transform="rotate(-20 380 ${430 - len - 78})"/>
        <ellipse cx="420" cy="${430 - len - 48}" rx="8" ry="14" fill="#f4efe6" transform="rotate(20 420 ${430 - len - 48})"/>
        <ellipse cx="383" cy="${430 - len - 30}" rx="7" ry="12" fill="#f4efe6" transform="rotate(-15 383 ${430 - len - 30})"/>
      </g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f3ea"/><stop offset="1" stop-color="#e9e2d3"/></linearGradient></defs>
    <rect width="800" height="600" fill="url(#bg)"/>
    <ellipse cx="400" cy="560" rx="170" ry="18" fill="#000" opacity="0.08"/>
    ${L.join("")}
    <path d="M320 440 L480 440 L462 560 L338 560 Z" fill="#b8653f"/>
    <path d="M320 440 L480 440 L462 560 L338 560 Z" fill="#000" opacity="0.08" transform="translate(6 0)"/>
    <rect x="310" y="420" width="180" height="28" rx="6" fill="#c9744c"/>
    <ellipse cx="400" cy="440" rx="80" ry="10" fill="#4a3628"/>
  </svg>`;
}

async function renderJpegs(specs) {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = [];
  for (const { leaves, seed } of specs) {
    await page.setContent(`<body style="margin:0">${plantSvg(leaves, seed)}</body>`);
    out.push(await page.screenshot({ type: "jpeg", quality: 85 }));
  }
  await browser.close();
  return out;
}

const supabase = createClient(URL_, KEY, { auth: { persistSession: false } });
const must = (label) => ({ data, error }) => { if (error) throw new Error(`${label}: ${error.message}`); return data; };

const { data: auth, error: authError } = await supabase.auth.signInAnonymously();
if (authError) throw new Error(`Sign-in: ${authError.message}`);
const keeperId = auth.user.id;

must("keeper")(await supabase.from("keepers").upsert({ id: keeperId, display_name: "Demo greenhouse" }));

async function publishPlant(localId, plant, events, photos) {
  const remote = must("plant")(
    await supabase.from("plants")
      .upsert({ keeper_id: keeperId, local_id: localId, is_public: true, published_at: new Date().toISOString(), ...plant },
        { onConflict: "keeper_id,local_id" })
      .select("id, passport_token").single(),
  );
  must("events")(await supabase.from("care_events").insert(events.map((e) => ({ plant_id: remote.id, ...e }))));
  const rows = [];
  for (const [i, p] of photos.entries()) {
    const path = `${keeperId}/${localId}/${i + 1}.jpg`;
    must("upload")(await supabase.storage.from("plant-photos").upload(path, p.bytes, { contentType: "image/jpeg", upsert: true }));
    rows.push({ plant_id: remote.id, path, caption: p.caption, taken_at: p.taken_at });
  }
  if (rows.length) must("photos")(await supabase.from("photos").insert(rows));
  return remote;
}

const [young, mid, grown, cutting] = await renderJpegs([
  { leaves: 3, seed: 1 }, { leaves: 5, seed: 2 }, { leaves: 7, seed: 3 }, { leaves: 2, seed: 4 },
]);

const mother = await publishPlant(
  1,
  {
    nickname: "Big Monstera", species: "Monstera deliciosa", status: "ACTIVE",
    acquired_at: ago(425), acquired_from: "Cutting from a friend's mother plant",
    notes: "Lives by the east window. Likes to dry out between waterings.",
  },
  [
    { type: "ACQUIRED", occurred_at: ago(425), notes: null },
    { type: "PHOTO", occurred_at: ago(420), notes: null },
    ...[35, 28, 21, 14, 7, 2].map((d) => ({ type: "WATER", occurred_at: ago(d), notes: null })),
    ...[75, 45, 15].map((d) => ({ type: "FERTILIZE", occurred_at: ago(d), notes: d === 15 ? "Half-strength, spring feed" : null })),
    { type: "REPOT", occurred_at: ago(150), notes: "Up to a 10-inch pot, chunky aroid mix" },
    { type: "ISSUE", occurred_at: ago(95), resolved_at: ago(80), notes: "Yellowing lower leaves — soil staying wet too long" },
    { type: "TREATMENT", occurred_at: ago(80), notes: "Let it dry right out, moved closer to the window. New growth is fine." },
    { type: "PHOTO", occurred_at: ago(180), notes: null },
    { type: "PRUNE", occurred_at: ago(60), notes: "Took off two leggy stems" },
    { type: "PROPAGATED", occurred_at: ago(30), notes: "Cutting taken for Little Monstera" },
    { type: "PHOTO", occurred_at: ago(6), notes: null },
  ],
  [
    { bytes: young, caption: "Fresh from the cutting", taken_at: ago(420) },
    { bytes: mid, caption: "Six months in", taken_at: ago(180) },
    { bytes: grown, caption: "After the repot — first fenestrations", taken_at: ago(6) },
  ],
);

const child = await publishPlant(
  2,
  {
    nickname: "Little Monstera", species: "Monstera deliciosa", status: "ACTIVE",
    acquired_at: ago(30), acquired_from: "Propagated from Big Monstera",
    mother_plant_id: mother.id, propagated_at: ago(30), notes: null,
  },
  [
    { type: "ACQUIRED", occurred_at: ago(30), notes: null },
    ...[24, 17, 10, 3].map((d) => ({ type: "WATER", occurred_at: ago(d), notes: null })),
    { type: "PHOTO", occurred_at: ago(3), notes: null },
  ],
  [{ bytes: cutting, caption: "Rooted and potted up", taken_at: ago(3) }],
);

console.log(`keeper:  ${keeperId}`);
console.log(`mother:  ${URL_}/functions/v1/passport?t=${mother.passport_token}`);
console.log(`cutting: ${URL_}/functions/v1/passport?t=${child.passport_token}`);
await supabase.auth.signOut();
