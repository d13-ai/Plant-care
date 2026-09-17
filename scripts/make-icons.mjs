/**
 * Bakes the brand mark in `src/brand/monstera.json` into every PNG asset
 * Expo needs. Run `npm run icons` after changing that file — and when Amanda's
 * real logo replaces the placeholder.
 *
 * Renders through the Playwright Chromium we already use for the smoke test,
 * so there's no image toolchain to install.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const AUBERGINE = "#2E1633";
const LEAF = "#8FC79E";

const g = JSON.parse(readFileSync(new URL("../src/brand/monstera.json", import.meta.url)));

/** The mark on its own, sized to `scale` of the canvas and centred. */
function mark({ color, scale }) {
  const pad = (100 - 100 * scale) / 2;
  const splits = g.splits
    .map(
      (d) =>
        `<path d="${d}" stroke="#000" stroke-width="${g.splitWidth}" stroke-linecap="round" fill="none"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs><mask id="m">
      <path d="${g.blade}" fill="#fff"/>
      ${splits}
      <path d="${g.notch}" stroke="#000" stroke-width="${g.notchWidth}" stroke-linecap="round" fill="none"/>
    </mask></defs>
    <g transform="translate(${pad} ${pad}) scale(${scale})">
      <path d="${g.petiole}" stroke="${color}" stroke-width="${g.petioleWidth}" stroke-linecap="round" fill="none"/>
      <path d="${g.blade}" fill="${color}" mask="url(#m)"/>
    </g>
  </svg>`;
}

/** Assets Expo reads from app.json. Transparent background where `bg` is null. */
const ASSETS = [
  // Browser tab: needs its own background, it sits on the browser's chrome.
  { file: "favicon.png", size: 96, bg: AUBERGINE, color: LEAF, scale: 0.78 },
  // Store icon: must be opaque and full-bleed.
  { file: "icon.png", size: 1024, bg: AUBERGINE, color: LEAF, scale: 0.72 },
  // Splash sits on the aubergine background set in app.json.
  { file: "splash-icon.png", size: 512, bg: null, color: LEAF, scale: 1 },
  // Android adaptive: foreground keeps to the centre safe zone, the system masks the rest.
  { file: "android-icon-foreground.png", size: 1024, bg: null, color: LEAF, scale: 0.56 },
  { file: "android-icon-background.png", size: 1024, bg: AUBERGINE, color: AUBERGINE, scale: 0 },
  { file: "android-icon-monochrome.png", size: 1024, bg: null, color: "#FFFFFF", scale: 0.56 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage();

for (const a of ASSETS) {
  const body = a.scale === 0 ? "" : mark({ color: a.color, scale: a.scale });
  await page.setViewportSize({ width: a.size, height: a.size });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;width:${a.size}px;height:${a.size}px;
       background:${a.bg ?? "transparent"}}</style>${body}`,
  );
  const png = await page.screenshot({ omitBackground: a.bg === null });
  const out = new URL(`../assets/images/${a.file}`, import.meta.url);
  writeFileSync(out, png);
  console.log(`${a.file.padEnd(30)} ${a.size}x${a.size}  ${png.length} bytes`);
}

await browser.close();
