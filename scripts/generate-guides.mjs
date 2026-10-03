/**
 * Builds the pages that cut across the plant library rather than living
 * under one plant:
 *
 *   /problems              the index of problem guides
 *   /problems/<symptom>    one page per thing a keeper can see going wrong
 *   /pet-safe-houseplants  which plants the ASPCA lists as non-toxic
 *
 * Same reasoning as the plant pages (see generate-plant-pages.mjs): plain
 * documents with the answer in the markup, readable by anything that can't
 * run the app. The written half of each guide lives in guides-data.mjs; the
 * plant-by-plant half is gathered from plants-data.mjs, so it grows with the
 * library. Pet safety comes from aspca-snapshot.json via pet-safety.mjs and
 * nowhere else.
 *
 * Usage: node scripts/generate-guides.mjs   (writes into public/)
 */
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SPECIES_GROUPS } from "../src/domain/species.ts";
import { esc, foot, head, ld, plantPages, SITE, slugify } from "./generate-plant-pages.mjs";
import { GUIDES } from "./guides-data.mjs";
import { pageDates } from "./page-dates.mjs";
import {
  APCC,
  aspcaFor,
  aspcaNonToxic,
  CHECKED,
  claimsNonToxic,
  PET_NOTICE_HTML,
  PPH,
  saysUnlisted,
  SNAPSHOT,
  warnsToxic,
} from "./pet-safety.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

/** Google truncates around 60 characters; the brand goes on only if it fits. */
const titled = (t) => (t.length <= 54 ? `${t} | PlantParlour` : t);

/** Escape, then turn [[slug|words]] into a link to that guide. */
const rich = (text) =>
  esc(text).replace(/\[\[([a-z-]+)\|([^\]]+)\]\]/g, (_, slug, words) => `<a href="/problems/${slug}">${words}</a>`);

/** "Swiss cheese plant" if it has one, else the scientific name. */
const called = (p) => p.common ?? p.sci;

const byName = (a, b) => called(a).localeCompare(called(b));

/** The health check, described as what it is: a second pair of eyes, not a diagnosis. */
const HEALTH_CTA = `<div class="cta">
  <h2>Not sure which one it is?</h2>
  <p>PlantParlour's health check looks at up to three photos of your plant alongside the care you've logged for it — when you last watered, when it was repotted, problems it has had before — and tells you what it sees. Log the problem as an issue, take another photo in a few days, and the next check compares the two, so you can tell whether it is spreading or settling. It is an AI's considered guess, not a diagnosis. <a href="/plant-care-app">More about the app</a>.</p>
  <a class="btn btn-lg" href="/">Open PlantParlour</a>
</div>`;

/** Set at the foot of every guide, because a guide can only speak in general. */
const GUIDE_NOTE = `<p class="muted"><small>General guidance for houseplants, written to be careful rather than clever. It can't see your plant, so treat it as a starting point, not a diagnosis. See our <a href="/terms">terms</a>.</small></p>`;

const breadcrumb = (items) =>
  ld({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
  });

const faqLd = (faq) =>
  ld({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  });

const faqHtml = (faq) => `<div class="faq">
${faq.map(([q, a]) => `  <h3>${esc(q)}</h3>\n  <p>${esc(a)}</p>`).join("\n")}
</div>`;

// ----------------------------------------------------------- one guide

/**
 * Every problem on a plant page that describes this symptom, with identical
 * entries folded together: a genus-level problem is the same words on every
 * species in the genus, and listing it once with all its plants is both
 * shorter and more useful than repeating it twelve times.
 */
export function gather(guide, pages) {
  const byText = new Map();
  for (const p of pages) {
    for (const [symptom, why, fix] of p.problems) {
      if (!guide.match(symptom.toLowerCase())) continue;
      const key = `${symptom}\u0000${why}\u0000${fix}`;
      const hit = byText.get(key) ?? { symptom, why, fix, plants: [] };
      hit.plants.push(p);
      byText.set(key, hit);
    }
  }
  return [...byText.values()].sort((a, b) => b.plants.length - a.plants.length || a.symptom.localeCompare(b.symptom));
}

export function guidePage(guide, pages) {
  const url = `${SITE}/problems/${guide.slug}`;
  const entries = gather(guide, pages);
  const plantCount = new Set(entries.flatMap((e) => e.plants.map((p) => p.slug))).size;
  const others = GUIDES.filter((g) => g !== guide);

  const jsonld = [
    ld({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: guide.title,
      description: guide.description,
      url,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "PlantParlour", url: `${SITE}/` },
      speakable: { "@type": "SpeakableSpecification", cssSelector: [".answer"] },
      publisher: { "@type": "Organization", name: "PlantParlour", url: `${SITE}/` },
    }),
    faqLd(guide.faq),
    breadcrumb([
      ["PlantParlour", `${SITE}/`],
      ["Plant problems", `${SITE}/problems`],
      [guide.name, url],
    ]),
  ].join("\n");

  const section = ([heading, content]) =>
    `<h2 id="${slugify(heading)}">${esc(heading)}</h2>\n` +
    (Array.isArray(content)
      ? `<ol class="steps">\n${content.map((c) => `  <li>${rich(c)}</li>`).join("\n")}\n</ol>`
      : `<p>${rich(content)}</p>`);

  return `${head({ title: titled(guide.title), description: guide.description, canonical: url, extra: jsonld + "\n" })}
<nav class="crumbs"><a href="/">PlantParlour</a> / <a href="/problems">Plant problems</a> / ${esc(guide.name)}</nav>

<h1>${esc(guide.title)}</h1>
<p class="sub">A PlantParlour plant problems guide</p>

<div class="answer">
  <p>${esc(guide.answer)}</p>
</div>

<h2 id="read-the-pattern">Read the pattern first</h2>
<ul class="problems">
${guide.signs.map(([sign, meaning]) => `  <li>\n    <b>${esc(sign)}</b>\n    <p>${rich(meaning)}</p>\n  </li>`).join("\n")}
</ul>

${guide.body.map(section).join("\n\n")}

<h2 id="plant-by-plant">Plant by plant</h2>
<p>Where this is a known problem on ${plantCount} of the plants in the <a href="/plants">PlantParlour care library</a>, with that plant's own cause and fix. Entries shared by a whole genus are listed once.</p>
<ul class="problems">
${entries
  .map(
    (e) => `  <li>
    <b>${esc(e.symptom)}</b>
    <p>${esc(e.why)}</p>
    <p class="fix"><strong>Fix:</strong> ${esc(e.fix)}</p>
    <ul class="chips">${[...e.plants]
      .sort(byName)
      .map((p) => `<li><a href="/plants/${p.slug}#problems">${esc(called(p))}</a></li>`)
      .join("")}</ul>
  </li>`,
  )
  .join("\n")}
</ul>

<h2 id="faq">Questions people ask</h2>
${faqHtml(guide.faq)}

<h2 id="more">Other problems</h2>
<ul class="chips">
${others.map((g) => `  <li><a href="/problems/${g.slug}">${esc(g.name)}</a></li>`).join("\n")}
</ul>

${HEALTH_CTA}
${GUIDE_NOTE}
${foot}`;
}

// ------------------------------------------------------------ the index

export function problemsHub(pages) {
  const url = `${SITE}/problems`;
  const title = "Houseplant problems: what's wrong with my plant? | PlantParlour";
  const description =
    "Start from what you can see — yellow leaves, brown tips, spider mites, leggy growth, leaves falling off, variegation fading — and work back to the cause and the fix, with notes for each plant in the PlantParlour library.";
  const answer =
    "Most houseplant problems show up as one of a handful of symptoms, and most of those come down to water, light or dry air. Each guide here starts from what you can see, shows how to read the pattern — which leaves, how fast, what the compost feels like — and then lists every plant in the PlantParlour care library where that symptom is a known problem, with its own cause and fix.";
  const jsonld = [
    ld({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Houseplant problems",
      description,
      url,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "PlantParlour", url: `${SITE}/` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: GUIDES.length,
        itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.title, url: `${SITE}/problems/${g.slug}` })),
      },
    }),
    breadcrumb([
      ["PlantParlour", `${SITE}/`],
      ["Plant problems", url],
    ]),
  ].join("\n");

  return `${head({ title, description, canonical: url, extra: jsonld + "\n" })}
<nav class="crumbs"><a href="/">PlantParlour</a> / Plant problems</nav>

<h1>What's wrong with my plant?</h1>
<p class="sub">Houseplant problems, by what you can see</p>

<div class="answer">
  <p>${esc(answer)}</p>
</div>

<ul class="problems">
${GUIDES.map(
  (g) => `  <li>
    <b><a href="/problems/${g.slug}">${esc(g.title)}</a></b>
    <p>${esc(g.answer.split(/(?<=\.)\s/)[0])}</p>
  </li>`,
).join("\n")}
</ul>

<p>Looking for one plant? The <a href="/plants">care library</a> has a page for each of ${pages.length} houseplants, with its own common problems. Worried about a pet? See the <a href="/pet-safe-houseplants">houseplants the ASPCA lists as non-toxic to cats and dogs</a>.</p>

${HEALTH_CTA}
${GUIDE_NOTE}
${foot}`;
}

// ------------------------------------------------------------ pet safety

/** Plants we call non-toxic. Both conditions, though the audit makes them one. */
export const petSafe = (pages) => pages.filter((p) => claimsNonToxic(p.toxicity) && aspcaNonToxic(p.slug));

export function petSafePage(pages) {
  const url = `${SITE}/pet-safe-houseplants`;
  const safe = petSafe(pages);
  const toxic = pages.filter((p) => warnsToxic(p.toxicity)).sort(byName);
  const unlisted = pages.filter((p) => saysUnlisted(p.toxicity)).sort(byName);

  const title = "Pet-safe houseplants: non-toxic to cats and dogs | PlantParlour";
  const description = `${safe.length} houseplants the ASPCA lists as non-toxic to both cats and dogs, the ${toxic.length} common ones that aren't, and what to do if your pet eats a plant. Checked against the ASPCA's plant list on ${CHECKED}.`;

  const answer =
    `These ${safe.length} houseplants from the PlantParlour care library are on the ASPCA Animal Poison Control Center's list of plants that are non-toxic to both cats and dogs, as it stood on ${CHECKED}. ` +
    `Non-toxic means not poisonous — not that a pet can eat as much as it likes: any plant can upset a stomach in quantity. ` +
    `If your pet has eaten a plant and you are worried, call your vet or the ${APCC.name} on ${APCC.phone}.`;

  // Examples for the FAQ: species-level listings only, so the answer names
  // plants the ASPCA itself names.
  const examples = safe
    .filter((p) => aspcaFor(p.slug).cats?.level === "species" && aspcaFor(p.slug).dogs?.level === "species" && p.common)
    .sort(byName)
    .slice(0, 10)
    .map((p) => `${p.common} (${p.sci})`);

  const faq = [
    [
      "Which houseplants are safe for cats and dogs?",
      `Among the plants in the PlantParlour library, the ASPCA lists these as non-toxic to both cats and dogs: ${examples.join(", ")} — and ${safe.length - examples.length} more on this page. Non-toxic means not poisonous; a pet that eats a lot of any plant can still be sick.`,
    ],
    [
      "What should I do if my cat or dog ate a houseplant?",
      `Call your vet or the ${APCC.name} on ${APCC.phone} straight away; the ${PPH.name} is on ${PPH.phone}. Both run around the clock and may charge a consultation fee. Don't try to make your pet vomit unless a vet tells you to. Have the plant, its label or a photo to hand, and note roughly how much was eaten and when.`,
    ],
    [
      "Is a non-toxic plant safe for my pet to eat?",
      "Not exactly. Non-toxic means the plant isn't poisonous. A pet that eats a lot of any plant can still vomit or have an upset stomach, and fertiliser, pesticide or leaf shine on the plant can harm it. Keep plants out of reach of a pet that makes a habit of chewing them.",
    ],
    [
      "Why isn't a plant I've heard is pet-safe on this list?",
      "We only call a plant non-toxic when the ASPCA lists it as non-toxic to both cats and dogs. Some plants often described as pet-safe elsewhere — air plants and maidenhair fern among them — aren't on the ASPCA's list either way, so we don't call them safe. That isn't a finding that they are toxic; it means nobody we rely on has said.",
    ],
    [
      "Does this list cover rabbits, birds or children?",
      "No. The ASPCA's list, and this page, cover cats and dogs. Ask a vet who treats the animal you keep, and a doctor or your local poison control centre about children.",
    ],
  ];

  const groups = SPECIES_GROUPS.map((g) => ({ g, list: safe.filter((p) => p.entry.group === g).sort(byName) })).filter(
    (x) => x.list.length,
  );
  const other = safe.filter((p) => !SPECIES_GROUPS.includes(p.entry.group));
  if (other.length) groups.push({ g: "Other", list: other.sort(byName) });

  const aspcaCell = (p) => {
    const e = aspcaFor(p.slug).cats;
    const level = e.level === "species" ? "" : ` <span class="cv">— listed for the whole genus</span>`;
    return `<a href="${esc(e.url)}" rel="nofollow noopener" target="_blank">${esc(e.name)}</a> <span class="cv">(${esc(e.sci)})</span>${level}`;
  };

  const toxicRow = (p) => {
    const a = aspcaFor(p.slug);
    const listed = [a.cats, a.dogs].find((e) => e?.status === "toxic");
    const aspcaNote = listed
      ? `ASPCA: <a href="${esc(listed.url)}" rel="nofollow noopener" target="_blank">toxic</a>`
      : a.cats || a.dogs
        ? "ASPCA: listed non-toxic; we are more cautious"
        : "ASPCA: not listed";
    return `  <li><a href="/plants/${p.slug}#toxicity">${esc(called(p))}</a> <span class="cv">${esc(p.sci)}</span> — ${esc(p.toxicity.split(/(?<=\.)\s/)[0])} <span class="cv">${aspcaNote}</span></li>`;
  };

  const jsonld = [
    ld({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Pet-safe houseplants",
      description,
      url,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "PlantParlour", url: `${SITE}/` },
      speakable: { "@type": "SpeakableSpecification", cssSelector: [".answer"] },
      citation: { "@type": "WebPage", name: "ASPCA Toxic and Non-Toxic Plant List", url: SNAPSHOT.source },
      publisher: { "@type": "Organization", name: "PlantParlour", url: `${SITE}/` },
    }),
    faqLd(faq),
    breadcrumb([
      ["PlantParlour", `${SITE}/`],
      ["Pet-safe houseplants", url],
    ]),
  ].join("\n");

  return `${head({ title, description, canonical: url, extra: jsonld + "\n" })}
<nav class="crumbs"><a href="/">PlantParlour</a> / Pet-safe houseplants</nav>

<h1>Pet-safe houseplants</h1>
<p class="sub">${safe.length} houseplants the ASPCA lists as non-toxic to cats and dogs</p>

<div class="answer">
  <p>${esc(answer)}</p>
</div>

${PET_NOTICE_HTML}

<h2 id="how-we-decide">How this list is made</h2>
<p>We don't test plants and we are not vets. A plant is on this list only if the <a href="${esc(SNAPSHOT.source)}" rel="nofollow noopener" target="_blank">ASPCA's toxic and non-toxic plant list</a> names it as non-toxic to <em>both</em> cats and dogs. Each row links to the ASPCA's own entry. Where the ASPCA lists the genus rather than the exact species, the row says so: the ASPCA is speaking for relatives of the plant, not the plant itself. We last compared the two lists on ${CHECKED}; the ASPCA's list can change after that, and theirs is the one to trust.</p>

${groups
  .map(
    ({ g, list }) => `<h2 id="${slugify(g)}">${esc(g)} <span class="muted">(${list.length})</span></h2>
<table>
  <thead><tr><th>Plant</th><th>ASPCA entry</th></tr></thead>
  <tbody>
${list
  .map(
    (p) =>
      `    <tr><td><a href="/plants/${p.slug}">${esc(called(p))}</a>${p.common ? `<br><span class="cv">${esc(p.sci)}</span>` : ""}</td><td>${aspcaCell(p)}</td></tr>`,
  )
  .join("\n")}
  </tbody>
</table>`,
  )
  .join("\n\n")}

<h2 id="toxic">Houseplants that are toxic to cats and dogs</h2>
<p>These plants in the library are toxic, or mildly toxic, to cats and dogs. Keep them out of reach, or out of the house, if you have a pet that chews. Where we are more cautious than the ASPCA, the plant stays on this list.</p>
<ul class="plainlist">
${toxic.map(toxicRow).join("\n")}
</ul>

<h2 id="unlisted">Not on the ASPCA's list</h2>
<p>The ASPCA doesn't list these either way. Some are often called pet-safe elsewhere, but we don't call a plant safe on anyone's word but the ASPCA's — so treat them as unknown, and keep them out of reach of a pet that chews.</p>
<ul class="chips">
${unlisted.map((p) => `  <li><a href="/plants/${p.slug}#toxicity">${esc(called(p))}</a></li>`).join("\n")}
</ul>

<h2 id="faq">Questions people ask</h2>
${faqHtml(faq)}

<div class="cta">
  <h2>Know exactly what you have</h2>
  <p>The first thing a vet or a poison line will ask is what the plant is. PlantParlour keeps a record for every plant you own — its name, its photos, and everything you've done for it — so the answer is in your pocket.</p>
  <a class="btn btn-lg" href="/">Start your greenhouse — free</a>
</div>
${foot}`;
}

// ------------------------------------------------------------ the app itself

/**
 * What the app does, said plainly, at a URL a search engine can read.
 *
 * The home page is the app, and to anyone without an account it is the
 * welcome screen: a story and a sign-in. That is the right front door for a
 * person who has already decided to come in, and it gave Google nothing to
 * match "plant care app" against -- neither word was on it. This page is the
 * other half: every feature, what it costs, which phones it runs on, and the
 * questions people ask before installing anything.
 *
 * Every claim here was checked against the code on 27 Sep 2026, and three
 * are worded carefully because the true answer is narrower than the usual
 * one: an account is needed; AI scans are a free allowance, not unlimited;
 * and reminders come from the calendar, not push notifications.
 */
export const APP_FEATURES = [
  ["Care reminders set for each plant", "Every plant gets its own schedule for watering, feeding, repotting and a fresh photo, starting from the cadence in the PlantParlour care library for its species. Log a watering and the next one counts from that day, not from the calendar. If the soil is still wet when watering comes due, tap Still moist and it checks back in a couple of days instead — and if the pot keeps staying wet, it suggests watering that plant less often. The greenhouse shows what's due today, and Add to calendar puts a plant's dates in your phone's calendar so your phone does the reminding."],
  ["Identify a plant from a photo", "Photograph the whole plant, then a close-up or two, and the AI reads them together to name it — the species, and often the named cultivar, with how sure it is. You choose the answer, and it sets the reminders from there. Or skip the camera and pick from a built-in list of houseplants and named cultivars."],
  ["A health check that remembers", "Ask about a plant that looks off and the AI reads its photos alongside what you've logged for it — when it was watered, when it was repotted, what went wrong before — and says what it sees and the likely cause. Take another photo a few days later and it compares the two. It's an AI's considered guess, not a diagnosis."],
  ["Problems and fixes on the record", "Report an issue and the plant is marked Special care needed until it's resolved. What you did about it is written down with it, so the plant's history shows what went wrong and what fixed it."],
  ["A photo timeline", "Every photo of a plant is kept in order, so you can see it grow — or see exactly when the yellowing started."],
  ["Cuttings that trace back", "Log a propagation and the cutting becomes a plant of its own, linked to the plant it came from. Years later, it still traces back to its mother."],
  ["A record that goes with the plant", "Publish a plant's tag and its whole story — photos, care, issues and what fixed them — is at a link you can send to whoever buys, trades for or is given the plant. Tags are unlisted: they're for the person you hand them to, not for search results."],
  ["A care guide for every species", "Each plant has a care guide for its species: light, water, humidity, soil, feeding, repotting and the usual problems. Anything it says about toxicity comes with a reminder to check the ASPCA's plant list."],
];

export const APP_FAQ = [
  // Worded for today, not for ever: a paid plan is planned (docs/PRICING.md),
  // and "there's no subscription" would be quoted back by every search
  // result and AI answer that had read it, long after it stopped being true.
  ["Is PlantParlour free?", "Yes, it's free to use, with no advertising. Your account includes a number of free AI photo scans; everything else — reminders, the care record, photos, care guides and tags — is free, and keeps working after the scans are used."],
  ["Does it work on iPhone and Android?", "Yes. It runs in the browser on both, and you can add it to your home screen so it opens like any other app. There's no App Store or Google Play download — if you see a PlantParlour app in a store, it isn't this one."],
  ["Do I need an account?", "Yes. Sign in with Google, or with an email and password. The account is what backs your plants up and keeps them in step across your phones. The care library, the problem guides and the pet-safe list need no account at all."],
  ["Does it work offline?", "Yes. Your plants live on your phone, so you can log care with no signal. A photo taken offline uploads the next time you have a connection."],
  ["Does it send notifications?", "Not push notifications. The app shows what's due each time you open it, and Add to calendar puts a plant's watering, feeding and repotting dates into your phone's calendar, which reminds you."],
  ["Can it tell me what my plant is?", "Usually, from a photo — down to the species and often the named cultivar. It can be wrong, especially between look-alikes, so it shows how sure it is and you make the final call."],
  ["Is it useful if I sell or trade plants?", "That's what it was built for. A plant's tag carries its whole record — where it came from, how it's been cared for, what went wrong and what fixed it — and a cutting traces back to the plant it was taken from."],
];

export function appPage(pages) {
  const url = `${SITE}/plant-care-app`;
  const title = titled("Free plant care app with watering reminders");
  const description =
    "PlantParlour is a free plant care app: watering and feeding reminders set for each plant, AI plant identification and health checks from a photo, a care history for every plant, and a record that goes with it when you sell or trade. Runs in your phone's browser.";
  const answer =
    "PlantParlour is a free plant care app that runs in your phone's browser. Add a plant from a photo and it works out what it is, sets watering, feeding and repotting reminders for that plant, and keeps a record of everything you do for it — every watering, repot, problem and fix. When you sell, trade or give a plant away, its whole history can go with it at a link. It works on iPhone and Android without an app store, keeps working offline, and keeps your plants in step across your phones once you sign in.";

  const jsonld = [
    ld({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "PlantParlour: a free plant care app",
      description,
      url,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "PlantParlour", url: `${SITE}/` },
      speakable: { "@type": "SpeakableSpecification", cssSelector: [".answer"] },
      about: {
        "@type": "WebApplication",
        name: "PlantParlour",
        url: `${SITE}/`,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web, iOS, Android",
        featureList: APP_FEATURES.map(([name]) => name),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      publisher: { "@type": "Organization", name: "PlantParlour", url: `${SITE}/` },
    }),
    faqLd(APP_FAQ),
    breadcrumb([
      ["PlantParlour", `${SITE}/`],
      ["The plant care app", url],
    ]),
  ].join("\n");

  return `${head({ title, description, canonical: url, extra: jsonld + "\n" })}
<nav class="crumbs"><a href="/">PlantParlour</a> / The plant care app</nav>

<h1>A free plant care app for the plants you're proud of</h1>
<p class="sub">What PlantParlour does, and what it doesn't</p>

<div class="answer">
  <p>${esc(answer)}</p>
</div>

<h2 id="what-it-does">What it does</h2>
<ul class="problems">
${APP_FEATURES.map(([name, body]) => `  <li>\n    <b>${esc(name)}</b>\n    <p>${esc(body)}</p>\n  </li>`).join("\n")}
</ul>

<h2 id="who-its-for">Who it's for</h2>
<p>People with more plants than they can keep in their head. Collectors who want to stop losing the fussy ones and start showing off the rare ones. Propagators and small sellers, for whom a plant with a traceable history is worth more than one without. And anyone who has ever bought a plant and wondered what the last person did to it.</p>

<h2 id="faq">Questions people ask</h2>
${faqHtml(APP_FAQ)}

<h2 id="free-guides">Free without an account</h2>
<p>The <a href="/plants">care library</a> has a page for each of ${pages.length} houseplants, with the same watering, feeding and repotting cadences the app uses. The <a href="/problems">plant problems guides</a> start from what you can see — yellow leaves, brown tips, spider mites — and work back to the cause. And the <a href="/pet-safe-houseplants">pet-safe houseplants list</a> shows which plants the ASPCA lists as non-toxic to cats and dogs.</p>

<div class="cta">
  <h2>Start your greenhouse</h2>
  <p>Free, in your phone's browser. Sign in with Google or an email, add your first plant from a photo, and it takes it from there.</p>
  <a class="btn btn-lg" href="/">Open PlantParlour</a>
</div>
${foot}`;
}

// ------------------------------------------------------------ write it

function main() {
  const pages = plantPages();
  const dir = join(PUBLIC, "problems");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith(".html")) rmSync(join(dir, f));
  const dates = pageDates();
  writeFileSync(join(dir, "index.html"), dates.stamp(`${SITE}/problems`, problemsHub(pages)), "utf-8");
  for (const g of GUIDES) {
    writeFileSync(join(dir, `${g.slug}.html`), dates.stamp(`${SITE}/problems/${g.slug}`, guidePage(g, pages)), "utf-8");
  }
  writeFileSync(join(PUBLIC, "pet-safe-houseplants.html"), dates.stamp(`${SITE}/pet-safe-houseplants`, petSafePage(pages)), "utf-8");
  writeFileSync(join(PUBLIC, "plant-care-app.html"), dates.stamp(`${SITE}/plant-care-app`, appPage(pages)), "utf-8");
  dates.save();
  console.log(`Generated ${GUIDES.length + 1} problem pages and the pet-safe page (${petSafe(pages).length} plants)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
