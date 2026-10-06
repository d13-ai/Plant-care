/**
 * Bakes the logo in `src/brand/logo.json` into every PNG asset Expo needs,
 * the home-screen icons, the social cards, `public/logo.svg` (the public
 * pages and the tag page link to it) and `public/logo-email.png` (mail
 * clients won't show SVG). Run `npm run icons` after changing that file.
 *
 * Renders through the Playwright Chromium we already use for the smoke test,
 * so there's no image toolchain to install.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const AUBERGINE = "#2E1633";
const LEAF = "#8FC79E";

const g = JSON.parse(readFileSync(new URL("../src/brand/logo.json", import.meta.url)));

/** The logo as an SVG document: Amanda's two golds, or all in `color`. */
function logoSvg({ color, size = "100%" } = {}) {
  const dims = typeof size === "number"
    ? ` width="${Math.round((size * g.width) / g.height)}" height="${size}"`
    : ` width="${size}" height="${size}"`;
  const paint = `fill="${color ?? g.fill}" stroke="${color ?? g.stroke}" stroke-width="${g.strokeWidth}" stroke-miterlimit="10"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${g.viewBox}"${dims}>` +
    g.paths.map((d) => `<path ${paint} d="${d}"/>`).join("") +
    `</svg>`;
}

/** The logo on its own, sized to `scale` of the canvas and centred. */
function mark({ color, scale }) {
  const pad = (100 - 100 * scale) / 2;
  return `<div style="position:absolute;left:${pad}%;top:${pad}%;width:${100 * scale}%;height:${100 * scale}%">${logoSvg({ color })}</div>`;
}

/** Assets Expo reads from app.json. Transparent background where `bg` is null. */
const ASSETS = [
  // Browser tab: needs its own background, it sits on the browser's chrome.
  { file: "favicon.png", size: 96, bg: AUBERGINE, scale: 0.84 },
  // Store icon: must be opaque and full-bleed.
  { file: "icon.png", size: 1024, bg: AUBERGINE, scale: 0.72 },
  // Splash sits on the aubergine background set in app.json.
  { file: "splash-icon.png", size: 512, bg: null, scale: 1 },
  // Android adaptive: foreground keeps to the centre safe zone, the system masks the rest.
  { file: "android-icon-foreground.png", size: 1024, bg: null, scale: 0.56 },
  { file: "android-icon-background.png", size: 1024, bg: AUBERGINE, scale: 0 },
  { file: "android-icon-monochrome.png", size: 1024, bg: null, color: "#FFFFFF", scale: 0.56 },
];

/**
 * Home-screen installs. Expo's static export writes no web manifest, so
 * "Add to Home Screen" would fall back to a screenshot of the page on iOS
 * and a scaled-up favicon on Android. These land in `public/`, which Expo
 * copies to the site root. All opaque: iOS ignores transparency and
 * composites onto black, and Android masks the maskable one to a circle.
 */
const PUBLIC = [
  { file: "apple-touch-icon.png", size: 180, bg: AUBERGINE, scale: 0.72 },
  { file: "icon-192.png", size: 192, bg: AUBERGINE, scale: 0.72 },
  { file: "icon-512.png", size: 512, bg: AUBERGINE, scale: 0.72 },
  // Maskable: content must survive a circular crop, so it keeps to the middle.
  { file: "icon-maskable-512.png", size: 512, bg: AUBERGINE, scale: 0.56 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage();

for (const a of [...ASSETS, ...PUBLIC]) {
  const dir = ASSETS.includes(a) ? "assets/images" : "public";
  const body = a.scale === 0 ? "" : mark({ color: a.color, scale: a.scale });
  await page.setViewportSize({ width: a.size, height: a.size });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;width:${a.size}px;height:${a.size}px;position:relative;
       background:${a.bg ?? "transparent"}}</style>${body}`,
  );
  const png = await page.screenshot({ omitBackground: a.bg === null });
  const out = new URL(`../${dir}/${a.file}`, import.meta.url);
  writeFileSync(out, png);
  console.log(`${dir}/${a.file}`.padEnd(38) + `${a.size}x${a.size}  ${png.length} bytes`);
}

/*
 * The logo for the public pages and the tag page to link to, and a PNG of
 * it on the aubergine tile for email, where SVG doesn't show. Rounded like
 * the app icon so it reads as the same thing in an inbox. The account-email
 * function fetches it and attaches it inline, so the email carries it rather
 * than loading it when opened.
 */
writeFileSync(new URL("../public/logo.svg", import.meta.url), logoSvg() + "\n");
console.log("public/logo.svg");
await page.setViewportSize({ width: 96, height: 96 });
await page.setContent(
  `<!doctype html><meta charset="utf-8">
   <style>html,body{margin:0;width:96px;height:96px;background:transparent}
     .tile{position:relative;width:96px;height:96px;border-radius:21px;background:${AUBERGINE}}</style>
   <div class="tile">${mark({ scale: 0.72 })}</div>`,
);
const emailPng = await page.screenshot({ omitBackground: true });
writeFileSync(new URL("../public/logo-email.png", import.meta.url), emailPng);
console.log(`public/logo-email.png`.padEnd(38) + `96x96  ${emailPng.length} bytes`);

/**
 * Social cards. These are what unfurl in a chat thread, in Slack and on X,
 * and what `og:image` points at. 1200x630 is the size every one of those
 * crops from without letterboxing. One per surface, because a link to a
 * puzzle that previews as the app's front page tells nobody anything.
 */
const CARDS = [
  { file: "og-image.png", title: "PlantParlour", line: "A record for every plant you keep &mdash; and it goes with the plant.", accent: LEAF },
  { file: "og-games.png", title: "Parlour Games", line: "Small, calm puzzles. No timers, no scores, nothing to lose.", accent: "#C9A24B" },
  { file: "og-trickle.png", title: "Trickle", line: "Turn the pipes until the water reaches every plant.", accent: LEAF },
  { file: "og-windowsill.png", title: "Windowsill", line: "Give every plant the light it actually wants.", accent: "#E6C46B" },
  { file: "og-elbow-room.png", title: "Elbow Room", line: "Give every plant room to grow.", accent: "#8FC79E" },
];

for (const c of CARDS) {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>
       html,body{margin:0;width:1200px;height:630px;background:${AUBERGINE};
         display:flex;align-items:center;justify-content:center;gap:48px;
         font-family:Lora,Georgia,"Times New Roman",serif;color:#F3ECDD}
       .mark{width:190px;height:190px;flex:none}
       .words{max-width:640px}
       h1{font-size:74px;line-height:1;margin:0 0 18px;font-weight:600}
       p{font-size:31px;line-height:1.35;margin:0;color:${c.accent};font-style:italic}
       .from{font-size:22px;margin-top:22px;color:#C8B8C2;font-style:normal}
     </style>
     <div class="mark">${logoSvg()}</div>
     <div class="words">
       <h1>${c.title}</h1>
       <p>${c.line}</p>
       ${c.file === "og-image.png" ? "" : '<p class="from">plantparlour.org</p>'}
     </div>`,
  );
  const png = await page.screenshot();
  writeFileSync(new URL(`../public/${c.file}`, import.meta.url), png);
  console.log(`public/${c.file}`.padEnd(38) + `1200x630  ${png.length} bytes`);
}

/*
 * Google Play's feature graphic: 1024x500, shown across the top of the store
 * listing and wherever Play features the app. Kept out of public/, since it
 * belongs to the listing rather than the site; see docs/play-store.md.
 */
mkdirSync(new URL("../store/", import.meta.url), { recursive: true });
await page.setViewportSize({ width: 1024, height: 500 });
await page.setContent(
  `<!doctype html><meta charset="utf-8">
   <style>
     html,body{margin:0;width:1024px;height:500px;background:${AUBERGINE};
       display:flex;align-items:center;justify-content:center;gap:56px;
       font-family:Lora,Georgia,"Times New Roman",serif;color:#F3ECDD}
     .mark{width:250px;height:250px;flex:none}
     .words{max-width:560px}
     h1{font-size:76px;line-height:1;margin:0 0 20px;font-weight:600}
     p{font-size:30px;line-height:1.35;margin:0;color:${LEAF};font-style:italic}
   </style>
   <div class="mark">${logoSvg()}</div>
   <div class="words"><h1>PlantParlour</h1><p>A care record for every plant you keep.</p></div>`,
);
const feature = await page.screenshot();
writeFileSync(new URL("../store/feature-graphic.png", import.meta.url), feature);
console.log("store/feature-graphic.png".padEnd(38) + `1024x500  ${feature.length} bytes`);

await browser.close();
