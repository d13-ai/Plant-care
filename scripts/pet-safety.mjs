/**
 * What the library is allowed to say about a plant and a pet, and on whose
 * authority.
 *
 * The rule: we only call a plant non-toxic when the ASPCA Animal Poison
 * Control Center lists it as non-toxic to both cats and dogs, and every page
 * that says so names the ASPCA, links to its entry, and gives the date we
 * checked. A plant the ASPCA does not list is described as unlisted, never
 * as safe. Warnings are never softened by this file: where plants-data.mjs is
 * more cautious than the ASPCA, the caution stays and the ASPCA's view is
 * shown next to it.
 *
 * The ASPCA's verdicts come from scripts/aspca-snapshot.json, written by
 * scripts/aspca-audit.mjs. Nothing here touches the network.
 *
 * None of this makes the site a vet. The notice below goes on every page
 * that talks about toxicity, and the terms say the same thing in legal form.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { longDate } from "./page-dates.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Empty until the audit has run once; the audit itself imports this file. */
export const SNAPSHOT = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, "aspca-snapshot.json"), "utf-8"));
  } catch {
    return { checked: "1970-01-01", source: "", plants: {} };
  }
})();

export const CHECKED = longDate(SNAPSHOT.checked);

/** Phone lines, checked against each service's own site on 24 Sep 2026. */
export const APCC = { name: "ASPCA Animal Poison Control Center", phone: "(888) 426-4435", tel: "+18884264435" };
export const PPH = { name: "Pet Poison Helpline", phone: "(855) 764-7661", tel: "+18557647661" };

/** How plants-data.mjs words each kind of line. The audit holds it to these. */
export const claimsNonToxic = (text) => /^Non-toxic\b/.test(text);
export const warnsToxic = (text) => /^(Mildly toxic|Toxic)\b/.test(text);
export const saysUnlisted = (text) => /^Not on the ASPCA/.test(text);

/** The ASPCA's view of one plant: { cats, dogs }, each null when unlisted. */
export const aspcaFor = (slug) => SNAPSHOT.plants[slug] ?? { cats: null, dogs: null };

/**
 * Whether an entry speaks for this plant: the species itself ("species"), or
 * a whole-genus entry like "Calathea spp." ("genus"). An entry for another
 * species in the genus ("related") does not — relatives are not always alike.
 */
const speaksFor = (e) => e?.level === "species" || e?.level === "genus";

/** True only when the ASPCA itself lists it non-toxic for cats AND dogs. */
export const aspcaNonToxic = (slug) => {
  const a = aspcaFor(slug);
  return ["cats", "dogs"].every((k) => a[k]?.status === "non-toxic" && speaksFor(a[k]));
};

/**
 * Everything wrong between what we say and what the ASPCA says. Empty is the
 * only acceptable answer; `npm run seo` and the unit tests both fail on any.
 */
export function auditToxicity(pages, snapshot = SNAPSHOT) {
  const out = [];
  for (const p of pages) {
    const a = snapshot.plants[p.slug];
    if (!a) {
      out.push(`${p.slug}: not in aspca-snapshot.json — run \`node scripts/aspca-audit.mjs\``);
      continue;
    }
    const t = p.toxicity ?? "";
    if (!claimsNonToxic(t) && !warnsToxic(t) && !saysUnlisted(t)) {
      out.push(`${p.slug}: toxicity line starts neither "Non-toxic", "Toxic", "Mildly toxic" nor "Not on the ASPCA" — say which`);
    }
    if (claimsNonToxic(t)) {
      for (const animal of ["cats", "dogs"]) {
        const v = a[animal];
        if (!v) out.push(`${p.slug}: we say non-toxic, but the ASPCA does not list it for ${animal}`);
        else if (v.status !== "non-toxic") out.push(`${p.slug}: we say non-toxic, but the ASPCA lists ${v.name} as toxic to ${animal}`);
        else if (!speaksFor(v)) out.push(`${p.slug}: we say non-toxic, but the ASPCA only lists a relative (${v.sci}) for ${animal}`);
      }
    }
    if (saysUnlisted(t) && (speaksFor(a.cats) || speaksFor(a.dogs))) {
      out.push(`${p.slug}: we say the ASPCA does not list it, but it does — say what the ASPCA says`);
    }
  }
  return out;
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "cats and dogs" / "cats" / "dogs" for the animals whose entries agree. */
const animalsWith = (a, status) =>
  ["cats", "dogs"].filter((k) => a[k]?.status === status).join(" and ");

/**
 * One or two sentences saying what the ASPCA lists, as plain text. Used in
 * the FAQ answer (and so in FAQPage JSON-LD), where links cannot go.
 */
export function aspcaText(p) {
  const a = aspcaFor(p.slug);
  if (!a.cats && !a.dogs) return `The ASPCA's plant list does not include ${p.sci} (checked ${CHECKED}).`;
  const parts = [];
  for (const status of ["non-toxic", "toxic"]) {
    const who = animalsWith(a, status);
    if (!who) continue;
    const e = (a.cats?.status === status ? a.cats : a.dogs);
    parts.push(
      e.level === "species"
        ? `The ASPCA lists ${e.name} (${e.sci}) as ${status} to ${who}`
        : e.level === "genus"
          ? `The ASPCA lists ${e.name} (${e.sci}), the genus as a whole, as ${status} to ${who}`
          : `The ASPCA does not list ${p.sci} itself, but lists a relative, ${e.name} (${e.sci}), as ${status} to ${who}`,
    );
  }
  const missing = ["cats", "dogs"].filter((k) => !a[k]);
  if (missing.length) parts.push(`it is not on the ASPCA's list for ${missing.join(" or ")}`);
  return `${parts.join("; ")} (checked ${CHECKED}).`;
}

/** The same, with each ASPCA entry linked, for the page body. */
export function aspcaHtml(p) {
  const a = aspcaFor(p.slug);
  let html = esc(aspcaText(p));
  for (const e of [a.cats, a.dogs]) {
    if (!e) continue;
    const label = esc(`${e.name} (${e.sci})`);
    if (html.includes(label) && !html.includes(`>${label}</a>`)) {
      html = html.replace(label, `<a href="${esc(e.url)}" rel="nofollow noopener" target="_blank">${label}</a>`);
    }
  }
  return html;
}

/**
 * The short form for the page's one-paragraph answer. Our own line when it
 * warns; the ASPCA's name on it when it reassures.
 */
export function petSummary(p) {
  const t = p.toxicity;
  if (claimsNonToxic(t)) {
    const a = aspcaFor(p.slug);
    return a.cats?.level === "species" && a.dogs?.level === "species"
      ? "The ASPCA lists it as non-toxic to cats and dogs."
      : "The ASPCA lists its genus as non-toxic to cats and dogs.";
  }
  return t.split(/(?<=\.)\s/)[0];
}

/** The emergency line, as text — for FAQ answers. */
export const EMERGENCY_TEXT = `If a pet has eaten part of a plant, call your vet or the ${APCC.name} on ${APCC.phone} straight away.`;

/**
 * The notice that goes with every toxicity statement on the site. Written to
 * be read, not skimmed past: what the information is, what it is not, and
 * what to do in an emergency, in that order.
 */
export const PET_NOTICE_HTML = `<div class="notice" role="note">
  <p><strong>If your pet has eaten a plant</strong>, call your vet, the <a href="https://www.aspca.org/pet-care/animal-poison-control" rel="nofollow noopener" target="_blank">${APCC.name}</a> on <a href="tel:${APCC.tel}">${APCC.phone}</a>, or the ${PPH.name} on <a href="tel:${PPH.tel}">${PPH.phone}</a>. Both are open around the clock and may charge a consultation fee. Take the plant or its label with you.</p>
  <p>This is general information, not veterinary advice. We don't test plants: what we say about toxicity follows the ASPCA's published plant list as it stood on ${CHECKED}, and that list can change. "Non-toxic" means not poisonous — a pet that eats enough of any plant can still vomit, and fertiliser, pesticide or leaf shine on a plant can harm it. It also only helps if the plant is what you think it is. It covers cats and dogs only; ask your vet about rabbits, birds, reptiles or anything else, and a doctor about children. Read our <a href="/terms">terms</a>.</p>
</div>`;
