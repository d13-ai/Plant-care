/**
 * Builds the plant care library: /plants and a page per plant.
 *
 * Why static HTML and not a route in the app: the app is an Expo static
 * export whose every route renders client-side into one shell, so a crawler
 * — and an answer engine, which usually doesn't run JavaScript at all —
 * sees an empty page. These are plain documents with the answer in the
 * markup. They are also the reason the site has anything to rank for: an
 * app's own screens are not content.
 *
 * Data comes from two places and neither is duplicated here:
 *   src/domain/species.ts  — which plants exist, and their care cadences.
 *                            The same file the app's species picker reads,
 *                            so a page can never disagree with a reminder.
 *   scripts/plants-data.mjs — the care knowledge the cadences can't carry.
 *
 * Every page carries the AEO furniture the WrenchBid pages proved out: a
 * liftable one-paragraph answer, a Quick facts list of complete one-line
 * sentences, a visible FAQ that the FAQPage JSON-LD is generated *from* so
 * the two cannot drift, plus WebPage/speakable, HowTo and BreadcrumbList.
 *
 * Usage: node scripts/generate-plant-pages.mjs [outDir]   (default public/plants)
 */
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SPECIES, SPECIES_GROUPS, scientificName } from "../src/domain/species.ts";
import { ANALYTICS_SNIPPET } from "../src/domain/analytics.ts";
import { GENUS, PLANTS } from "./plants-data.mjs";
import { guideFor } from "./guides-data.mjs";
import { aspcaFor, aspcaHtml, aspcaText, EMERGENCY_TEXT, PET_NOTICE_HTML, petSummary, saysUnlisted } from "./pet-safety.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = process.argv[2] ? join(ROOT, process.argv[2]) : join(ROOT, "public", "plants");
export const SITE = "https://plantparlour.org";

// --------------------------------------------------------------- helpers
export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Lower-cases a field's first letter so it can be dropped mid-sentence. */
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, "");

/** "a Swiss cheese plant" / "an African violet". */
const indef = (s) => `${/^[aeiou]/i.test(s) ? "an" : "a"} ${s}`;

/** A cadence in days, said the way a person would say it. */
const everyDays = (d) => {
  if (d % 365 === 0 && d >= 365) return d === 365 ? "once a year" : `every ${d / 365} years`;
  if (d >= 365) return `every ${Math.round((d / 365) * 10) / 10} years`;
  if (d % 30 === 0 && d >= 60) return `every ${d / 30} months`;
  if (d === 30) return "monthly";
  if (d % 7 === 0 && d >= 14) return `every ${d / 7} weeks`;
  if (d === 7) return "weekly";
  return `every ${d} days`;
};

/** A genus record with its `inherit` chain flattened. */
const genusOf = (name, seen = new Set()) => {
  const g = GENUS[name];
  if (!g) throw new Error(`No GENUS record for ${name}`);
  if (!g.inherit) return g;
  if (seen.has(name)) throw new Error(`Circular inherit at ${name}`);
  seen.add(name);
  const { inherit, ...own } = g;
  return { ...genusOf(inherit, seen), ...own };
};

/** Everything a page needs about one plant, genus defaults and all. */
export function resolve(entry) {
  const sci = scientificName(entry);
  const slug = slugify(sci);
  const g = genusOf(entry.genus);
  const p = PLANTS[slug] ?? {};
  const merged = { ...g, ...p };
  // problems and faq accumulate rather than replace.
  merged.problems = [...(g.problems ?? []), ...(p.problems ?? [])];
  merged.faq = [...(p.faq ?? [])];
  const common = entry.common[0] ?? null;
  return {
    entry,
    slug,
    sci,
    common,
    // What the prose calls it. Common names are proper-ish nouns ("Swiss
    // cheese plant", "ZZ plant") and are never case-folded; a plant with no
    // common name is called by its scientific name and never twice over.
    label: common ?? sci,
    full: common ? `${common} (${sci})` : sci,
    url: `${SITE}/plants/${slug}`,
    ...merged,
    cultivars: SPECIES.filter(
      (c) => c.cultivar && c.genus === entry.genus && c.species === entry.species && c !== entry,
    ),
  };
}

/** The pages we generate: every base species, plus cultivars with no parent. */
export function plantPages() {
  const hasBase = (e) => SPECIES.some((b) => !b.cultivar && b.genus === e.genus && b.species === e.species);
  return SPECIES.filter((e) => !e.cultivar || !hasBase(e)).map(resolve);
}

export const ld = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;

export const head = ({ title, description, canonical, extra = "" }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#2E1633">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="PlantParlour">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/plants/plants.css">
${ANALYTICS_SNIPPET}
${extra}</head>
<body>
<div class="top">
  <a class="brand" href="/">Plant<b>Parlour</b></a>
  <a class="btn" href="/">Open the app</a>
</div>
<div class="wrap">
<main>`;

export const foot = `</main>
</div>
<footer>
  <a href="/plants">Plant care library</a> &middot;
  <a href="/problems">Plant problems</a> &middot;
  <a href="/pet-safe-houseplants">Pet-safe plants</a> &middot;
  <a href="/">PlantParlour</a> &middot;
  <a href="/parlour-games">Parlour Games</a> &middot;
  <a href="/privacy">Privacy</a> &middot;
  <a href="/terms">Terms</a>
</footer>
</body>
</html>
`;

// ------------------------------------------------------------- one plant
export function plantPage(p) {
  const waterEvery = everyDays(p.entry.waterEveryDays);
  const feedEvery = everyDays(p.entry.fertilizeEveryDays);
  const repotEvery = everyDays(p.entry.repotEveryDays);

  // Google truncates a title around 60-ish characters, and a long
  // cultivar name eats that on its own — so the brand suffix is only added
  // when there is room for it. The plant's name always comes first.
  const titleBase = p.common ? `${p.common} care (${p.sci})` : `${p.sci} care`;
  const title = titleBase.length <= 54 ? `${titleBase} | PlantParlour` : titleBase;
  const description =
    `How to care for ${p.full}: water ${waterEvery}, ${lc(p.light)}. Feeding, repotting, ` +
    `propagation, toxicity to cats and dogs, and what to do when it goes wrong.`;

  // The liftable answer. Short sentences, no hedging, in the order someone
  // asks: light, water, mix, food, repotting, humidity, is it safe. This is
  // the paragraph an answer engine quotes, so it has to stand alone.
  //
  // The pet line is the one sentence here that can hurt somebody if it is
  // wrong, so when it reassures it says whose reassurance it is.
  const answer =
    `${p.full} wants ${lc(p.light)}. Water it ${waterEvery}. ${p.waterHow} ` +
    `Pot it in ${lc(p.soil)}. ${p.feed}, and repot ${repotEvery}. ` +
    `Humidity: ${lc(p.humidity)}. ${petSummary(p)}`;

  // Who says so, and when we looked. Left out only where the ASPCA has
  // nothing to say and the toxicity line has already said as much.
  const aspca = aspcaFor(p.slug);
  const petSource = saysUnlisted(p.toxicity) && !aspca.cats && !aspca.dogs ? "" : ` ${aspcaText(p)}`;

  const facts = [
    ["Water", `Water ${waterEvery}. ${p.waterHow}`],
    ["Light", `${p.light}.`],
    ["Humidity", `${p.humidity}.`],
    ["Soil", `${p.soil}.`],
    ["Feeding", `${p.feed}.`],
    ["Repotting", `Repot ${repotEvery}.`],
    ["Toxic to pets", `${p.toxicity}${petSource}`],
    // difficulty, size and origin come only from PLANTS, and plants-data.mjs
    // promises a species with no PLANTS entry still renders from its genus.
    // It didn't: these three were read unconditionally, so adding a species
    // to the catalogue without also writing its blurb crashed `npm run
    // plants` on `undefined.toLowerCase()`. A missing fact is now a row that
    // isn't there, which is what the file said all along.
    ...(p.difficulty ? [["Difficulty", `${p.difficulty}.`]] : []),
    ...(p.size ? [["Mature size", `${p.size}.`]] : []),
    ...(p.origin ? [["Native to", `${p.origin}.`]] : []),
  ];

  // Hand-written questions first, then the four every plant page is asked.
  // Both the visible FAQ and the FAQPage block are rendered from this one
  // array, so they cannot disagree.
  const faq = [
    ...p.faq,
    [
      `How often should you water ${indef(p.label)}?`,
      `Water ${waterEvery} as a starting point — that is the cadence PlantParlour sets for ${p.sci}. ${p.waterHow} Light, pot size and the time of year all move that number, so treat it as a reminder to go and check rather than a rule.`,
    ],
    [
      `How much light does ${indef(p.label)} need?`,
      p.lightLong,
    ],
    [
      `Is ${p.label} toxic to cats and dogs?`,
      `${p.toxicity}${petSource} ${EMERGENCY_TEXT}`,
    ],
    [
      `How do you propagate ${indef(p.label)}?`,
      p.propagation,
    ],
  ];

  const related = relatedTo(p);

  const jsonld = [
    ld({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${p.sci} care`,
      description,
      url: p.url,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "PlantParlour", url: `${SITE}/` },
      about: {
        "@type": "Thing",
        name: p.sci,
        alternateName: p.entry.common,
        description: p.blurb,
      },
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: [".answer", ".facts"],
      },
      publisher: { "@type": "Organization", name: "PlantParlour", url: `${SITE}/` },
    }),
    ld({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    }),
    ld({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How to care for ${p.full}`,
      description: answer,
      step: [
        { "@type": "HowToStep", position: 1, name: "Put it in the right light", text: p.lightLong },
        { "@type": "HowToStep", position: 2, name: "Water it on the right rhythm", text: `Water ${waterEvery}. ${p.waterHow}` },
        { "@type": "HowToStep", position: 3, name: "Get the mix right", text: p.soilLong },
        { "@type": "HowToStep", position: 4, name: "Feed it in the growing season", text: `${p.feed}. Stop feeding in autumn and winter.` },
        { "@type": "HowToStep", position: 5, name: "Repot when it needs it", text: `Repot ${repotEvery}. ${p.repotNote}` },
      ],
    }),
    ld({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "PlantParlour", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Plant care", item: `${SITE}/plants` },
        { "@type": "ListItem", position: 3, name: `${p.sci} care`, item: p.url },
      ],
    }),
  ].join("\n");

  return `${head({ title, description, canonical: p.url, extra: jsonld + "\n" })}
<nav class="crumbs"><a href="/">PlantParlour</a> / <a href="/plants">Plant care</a> / ${esc(p.sci)}</nav>

<h1>${esc(p.full)} care</h1>
<p class="sub">${esc(p.entry.group)}${p.difficulty ? ` &middot; ${esc(p.difficulty.toLowerCase())} to keep` : ""}</p>

<div class="answer">
  <p>${esc(answer)}</p>
</div>

<p>${esc(p.blurb)}</p>

<h2 id="quick-facts">Quick facts</h2>
<dl class="facts">
${facts.map(([k, v]) => `  <dt>${esc(k)}</dt>\n  <dd>${esc(v)}</dd>`).join("\n")}
</dl>

<h2 id="water">Watering ${esc(indef(p.label))}</h2>
<p>Water ${esc(waterEvery)}. ${esc(p.waterHow)}</p>
<p>That cadence is the one PlantParlour sets for this species when you name it, and it is deliberately on the cautious side — a plant that asks a day early is safer than one that asks a day late. Log each watering and the reminder moves with the plant rather than with the calendar.</p>

<h2 id="light">Light</h2>
<p>${esc(p.lightLong)}</p>

<h2 id="humidity">Humidity and temperature</h2>
<p>${esc(p.humidity)}. Central heating in winter is what turns a comfortable room into a dry one, and it is the usual reason an established plant suddenly browns at the edges or picks up spider mites.</p>

<h2 id="soil">Soil and potting</h2>
<p>${esc(p.soilLong)}</p>

<h2 id="feeding">Feeding</h2>
<p>${esc(p.feed)}. Stop feeding in autumn and start again when you see new growth in spring — feeding a plant that isn't growing just builds up salts in the pot.</p>

<h2 id="repotting">Repotting</h2>
<p>Repot ${esc(repotEvery)}. ${esc(p.repotNote)}</p>

<h2 id="problems">Common problems</h2>
<ul class="problems">
${p.problems
  .map(
    ([symptom, why, fix]) => {
      // A problem that has a guide links to it: the guide reads the symptom
      // across every plant, which is what someone unsure of the cause needs.
      const guide = guideFor(symptom);
      return `  <li>
    <b>${esc(symptom)}</b>
    <p>${esc(why)}</p>
    <p class="fix"><strong>Fix:</strong> ${esc(fix)}</p>${
      guide ? `\n    <p class="more"><a href="/problems/${guide.slug}">${esc(guide.name)}: how to read it on any plant</a></p>` : ""
    }
  </li>`;
    },
  )
  .join("\n")}
</ul>

<h2 id="propagation">Propagation</h2>
<p>${esc(p.propagation)}</p>
<p>A cutting taken in PlantParlour keeps its link to the plant it came from, so a propagation years later still traces back to the mother plant — which is the point if you ever sell or trade it.</p>

<h2 id="toxicity">Toxicity and safety</h2>
<p>${esc(p.toxicity)}</p>
${petSource ? `<p class="source">${aspcaHtml(p)}</p>\n` : ""}${PET_NOTICE_HTML}
<p><a href="/pet-safe-houseplants">Every houseplant in the library the ASPCA lists as non-toxic to cats and dogs</a></p>
${
  p.cultivars.length
    ? `
<h2 id="cultivars">Named cultivars and variegations</h2>
<p>${esc(p.sci)} is sold under several cultivar names. Care is the same unless noted; variegated forms carry less chlorophyll, so they grow more slowly and want more light than the plain species.</p>
<table>
  <thead><tr><th>Cultivar</th><th>Also sold as</th><th>Water</th></tr></thead>
  <tbody>
${p.cultivars
  .map(
    (c) =>
      `    <tr><td>${esc(`'${c.cultivar}'`)}</td><td>${esc(c.common.join(", ") || "—")}</td><td>${esc(everyDays(c.waterEveryDays))}</td></tr>`,
  )
  .join("\n")}
  </tbody>
</table>`
    : ""
}

<h2 id="faq">Questions people ask</h2>
<div class="faq">
${faq.map(([q, a]) => `  <h3>${esc(q)}</h3>\n  <p>${esc(a)}</p>`).join("\n")}
</div>

${
  related.length
    ? `<h2 id="related">Related plants</h2>
<ul class="chips">
${related.map((r) => `  <li><a href="/plants/${r.slug}">${esc(r.sci)}</a></li>`).join("\n")}
</ul>
<p class="muted"><small>Or browse <a href="/plants">every plant in the library</a>.</small></p>`
    : `<p class="muted"><small>Browse <a href="/plants">every plant in the library</a>.</small></p>`
}

<div class="cta">
  <h2>Keep this plant's record</h2>
  <p>PlantParlour gives your ${esc(p.label)} its own page: a photo timeline, reminders set to the cadences above, and every watering, feed, repot and problem written down. Trade or sell it and the whole history goes with it.</p>
  <a class="btn btn-lg" href="/">Start your greenhouse — free, no account needed</a>
</div>
${foot}`;
}

/** Same genus first, then the rest of the group. Keeps the library walkable. */
function relatedTo(p) {
  const all = plantPagesCache();
  const sameGenus = all.filter((o) => o.slug !== p.slug && o.entry.genus === p.entry.genus);
  const sameGroup = all.filter(
    (o) => o.slug !== p.slug && o.entry.genus !== p.entry.genus && o.entry.group === p.entry.group,
  );
  return [...sameGenus, ...sameGroup].slice(0, 8);
}

let _cache = null;
const plantPagesCache = () => (_cache ??= plantPages());

// ----------------------------------------------------------------- the hub
export function hubPage(pages) {
  // Counted, not typed. The catalogue grows -- it gained Dracaena sanderiana
  // the day lucky bamboo turned out to be filed under a true bamboo -- and a
  // number written into the title is wrong from then on while the page body
  // right underneath it says something else.
  const title = `Plant care library: how to care for ${pages.length} houseplants | PlantParlour`;
  const description =
    `Watering cadence, light, humidity, soil, feeding, propagation, toxicity and common problems for ${pages.length} houseplants — from monstera and pothos to lithops and living stones. Free, no account needed.`;
  const canonical = `${SITE}/plants`;

  const answer =
    `The PlantParlour plant care library has a page for each of ${pages.length} houseplants, covering how often to water it, ` +
    `how much light it needs, the soil and humidity it wants, how to feed and repot it, how to propagate it, whether it is ` +
    `toxic to cats and dogs, and what the usual problems look like. Every watering cadence here is the same one the ` +
    `PlantParlour app sets as a reminder when you name that plant, so the advice and the app never disagree.`;

  const byGroup = SPECIES_GROUPS.map((g) => ({
    group: g,
    plants: pages.filter((p) => p.entry.group === g),
  })).filter((s) => s.plants.length);
  const other = pages.filter((p) => !SPECIES_GROUPS.includes(p.entry.group));
  if (other.length) byGroup.push({ group: "Other", plants: other });

  const jsonld = [
    ld({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Plant care library",
      description,
      url: canonical,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "PlantParlour", url: `${SITE}/` },
      speakable: { "@type": "SpeakableSpecification", cssSelector: [".answer"] },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: pages.length,
        itemListElement: pages.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${p.sci} care`,
          url: p.url,
        })),
      },
    }),
    ld({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "PlantParlour", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Plant care", item: canonical },
      ],
    }),
  ].join("\n");

  return `${head({ title, description, canonical, extra: jsonld + "\n" })}
<nav class="crumbs"><a href="/">PlantParlour</a> / Plant care</nav>

<h1>Plant care library</h1>
<p class="sub">${pages.length} houseplants, with the cadences the app actually uses</p>

<div class="answer">
  <p>${esc(answer)}</p>
</div>

<p>Each page covers one plant: how often to water it and how to tell when it needs it, the light and humidity it wants, the mix to pot it in, feeding, repotting, propagation, whether it is safe around cats and dogs, and the handful of things that actually go wrong with it — with the fix.</p>
<p>Something going wrong and not sure what? The <a href="/problems">plant problems guides</a> start from what you can see — yellow leaves, brown tips, spider mites, leaf drop — and work back to the cause. Keeping a cat or a dog? See the <a href="/pet-safe-houseplants">houseplants the ASPCA lists as pet-safe</a>.</p>
<p>These are the same plants the app's species picker knows, and the same watering, feeding and repotting cadences it sets as reminders when you name a plant. Named cultivars are listed on their parent species' page.</p>

${byGroup
  .map(
    (s) => `<h2 id="${slugify(s.group)}">${esc(s.group)} <span class="muted">(${s.plants.length})</span></h2>
<ul class="index">
${s.plants
  .map(
    (p) =>
      `  <li><a href="/plants/${p.slug}">${esc(p.sci)}</a>${p.common ? ` <span class="cv">${esc(p.common)}</span>` : ""}</li>`,
  )
  .join("\n")}
</ul>`,
  )
  .join("\n\n")}

<div class="cta">
  <h2>A record for every plant you keep</h2>
  <p>PlantParlour photographs each plant, tells you what needs doing today, and keeps the whole history — so when you trade or sell one, its record goes with it. Cuttings trace back to the plant they came from.</p>
  <a class="btn btn-lg" href="/">Start your greenhouse — free, no account needed</a>
</div>
${foot}`;
}

// ---------------------------------------------------------------- write it
function main() {
  const pages = plantPagesCache();
  mkdirSync(OUT, { recursive: true });
  // Clear out pages for plants that have since left the catalogue, but leave
  // plants.css (which is committed, not generated) where it is.
  for (const f of readdirSync(OUT)) {
    if (f.endsWith(".html")) rmSync(join(OUT, f));
  }
  writeFileSync(join(OUT, "index.html"), hubPage(pages), "utf-8");
  for (const p of pages) writeFileSync(join(OUT, `${p.slug}.html`), plantPage(p), "utf-8");
  console.log(`Generated ${pages.length + 1} pages in ${OUT.replace(ROOT + "/", "")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
