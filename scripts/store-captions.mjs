// Captioned Play Store screenshots: each app screenshot framed on the
// aubergine page under a headline and a line of detail, at 1080x1920 (9:16).
// The first two or three are what most people see before deciding, so they
// lead with what the app does for you, in the words people search with.
//
// Usage: node scripts/store-captions.mjs [in-dir] [out-dir]
//   defaults: store/screenshots -> store/captioned
// The raw screenshots come from scripts/store-screenshots.mjs (and the
// opening-sequence frames from the web build with ?threshold).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [inDir, outDir] = [
  path.resolve(process.argv[2] ?? path.join(ROOT, "store", "screenshots")),
  path.resolve(process.argv[3] ?? path.join(ROOT, "store", "captioned")),
];

/** In store order. */
export const SLIDES = [
  { file: "1-greenhouse.png", title: "Every plant, and what it needs today", line: "Watering, feeding and repotting at a glance." },
  { file: "3-identify.png", title: "Snap a photo. Know what you’ve got.", line: "Plant ID down to the cultivar, rare and variegated too." },
  { file: "2-plant.png", title: "Never miss a watering", line: "Reminders for each plant, at a time you choose." },
  { file: "4-health-check.png", title: "Catch trouble early", line: "Health checks that compare with last time." },
  { file: "5-care-guide.png", title: "A care guide for every plant", line: "160+ houseplants from the PlantParlour library." },
  { file: "7-doors.png", title: "Come in.", line: "A parlour for the plants you’re proud of.", italic: true },
];

// Inlined, so the page needs nothing from disk or the network.
const font = (pkg, file) =>
  `data:font/ttf;base64,${fs.readFileSync(path.join(ROOT, "node_modules", "@expo-google-fonts", pkg, file)).toString("base64")}`;
const css = `
@font-face { font-family: Lora; font-weight: 600; src: url(${font("lora", "600SemiBold/Lora_600SemiBold.ttf")}); }
@font-face { font-family: Lora; font-style: italic; font-weight: 400; src: url(${font("lora", "400Regular_Italic/Lora_400Regular_Italic.ttf")}); }
@font-face { font-family: Source; font-weight: 400; src: url(${font("source-sans-3", "400Regular/SourceSans3_400Regular.ttf")}); }
* { margin: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; }
body { background: radial-gradient(120% 70% at 50% 100%, #4B2142 0%, #2E1633 60%); color: #F3ECDD; position: relative; overflow: hidden; }
.head { position: absolute; top: 96px; left: 80px; right: 80px; text-align: center; }
.rule { width: 72px; height: 3px; background: #C9A24B; margin: 0 auto 34px; }
h1 { font: 600 74px/1.12 Lora, serif; letter-spacing: -0.3px; text-wrap: balance; }
h1.italic { font: italic 400 92px/1.1 Lora, serif; }
p { font: 400 40px/1.3 Source, sans-serif; color: #E6C46B; margin-top: 22px; }
.shot { position: absolute; left: 140px; width: 800px; height: 1422px; top: 470px; border-radius: 40px;
  border: 3px solid #C9A24B; box-shadow: 0 30px 90px rgba(0,0,0,.5); overflow: hidden; background: #2E1633; }
.shot img { width: 100%; height: 100%; display: block; }
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const [i, s] of SLIDES.entries()) {
    const src = path.join(inDir, s.file);
    if (!fs.existsSync(src)) throw new Error(`missing ${src}`);
    const img = `data:image/png;base64,${fs.readFileSync(src).toString("base64")}`;
    await page.setContent(
      `<!doctype html><html><head><style>${css}</style></head><body>
        <div class="head"><div class="rule"></div><h1${s.italic ? ' class="italic"' : ""}>${esc(s.title)}</h1><p>${esc(s.line)}</p></div>
        <div class="shot"><img src="${img}"></div>
      </body></html>`,
      { waitUntil: "load" },
    );
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(outDir, `${i + 1}-${s.file.replace(/^\d+-/, "")}`);
    await page.screenshot({ path: out });
    console.log("wrote", path.relative(ROOT, out));
  }
  await browser.close();
}
