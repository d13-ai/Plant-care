# Search and answer engines

*What PlantParlour does to be found, and by what. Ported from the WrenchBid
playbook — same moves, different subject matter.*

The short version: an app has no content to rank for. Everything below
exists so that there is something on this domain worth crawling, worth
quoting, and worth linking to, and so that the thing being quoted is
accurate.

---

## 1. The problem this solves

PlantParlour's web build is an Expo static export. Every route renders the
same shell and paints itself from the JavaScript bundle. Googlebot runs that
bundle; almost nothing else does — GPTBot, ClaudeBot, PerplexityBot,
CCBot and the rest fetch HTML and read what is in it. Before this work,
what they read was an empty `<div id="root">` on every URL.

So the crawlable surface is deliberately made of plain documents:

| Surface | What it is | Where it comes from |
|---|---|---|
| `/plants` and `/plants/{slug}` | 158 plant care pages, plus the hub | generated, `npm run plants` |
| `/parlour-games`, `/parlour-games/trickle`, `/parlour-games/windowsill` | the puzzle corner | hand-written HTML in `public/` |
| `/` | the app shell | `src/app/+html.tsx`, plus a `<noscript>` block that states the claim in markup |
| `/privacy`, `/terms` | legal pages | `api/legal.ts`, server-rendered |

---

## 2. AEO: what goes on every page

"AEO" (answer-engine optimisation) is mostly one idea — *make the answer
easy to lift* — plus the structured data that says which part of the page is
the answer. Every page here carries:

- **A liftable one-paragraph answer** (`.answer`). Short sentences, no
  hedging, in the order somebody asks: light, water, mix, food, repotting,
  humidity, is it safe. It has to stand alone when quoted with no page
  around it.
- **A Quick facts list** (`<dl class="facts">`) where every value is a
  complete sentence. "Water weekly. Water when the top 5 cm of mix is dry" —
  not "7 days", which means nothing lifted out of its table.
- **A visible FAQ**, and a `FAQPage` block generated *from the same array*
  as the visible markup. A FAQPage whose answers are not on the page is a
  manual-action offence, not a style question, so the two are never written
  twice.
- **`speakable`** on `WebPage`, pointing at `.answer` and `.facts`.
- **`HowTo`**, `BreadcrumbList`, and a type for the thing itself
  (`WebPage`+`about` for a plant, `VideoGame`+`WebApplication` for a game).
- **Keyword-led `<title>`**, with the brand suffix dropped when a long
  cultivar name would push the title past where Google truncates it.
  `og:title` is allowed to be the brand line instead — different room.
- **A canonical**, an `og:image` that exists, internal links out.

`public/llms.txt` is the same idea for the whole site: one document that
says plainly what PlantParlour is, what the library covers, what the games
are, what it costs, and which URLs are not to be cited (published tags).

---

## 3. The plant care library

`npm run plants` writes `public/plants/`, which is committed.

Two inputs, and neither is duplicated:

- **`src/domain/species.ts`** — *which* plants exist and their care
  cadences. The same file the app's species picker reads. This is the point:
  the watering cadence on a page is the reminder the app will set, so the
  library and the product cannot disagree.
- **`scripts/plants-data.mjs`** — the care knowledge a cadence can't carry.
  Two levels, because that is how the knowledge is actually shaped:
  `GENUS` (everything Monsteras share, with an `inherit` chain for close
  relatives) and `PLANTS` (keyed by slug: the species' own identity, plus
  any field where it departs from its genus; `problems` and `faq` accumulate,
  everything else replaces).

A page exists for every base species, plus the cultivars that have no parent
species in the catalogue (`Philodendron 'Florida Ghost'` and friends).
Cultivars *with* a parent are listed in a table on the parent's page rather
than getting a thin page of their own.

**Adding a plant:** add the row to `src/domain/species.ts` as usual, then
add a `PLANTS` record with at least a `blurb`. If its genus is new, add a
`GENUS` record too. `npm run plants` tells you what is missing by failing.

**When you change a page,** commit `scripts/sitemap-manifest.json` along
with it — see below.

### Keeping it honest

The blurbs are the unique content and the reason these are not doorway
pages. Keep the claims conservative: these pages are read by people who are
about to water something. Two known catalogue quirks are handled in the
copy rather than silently corrected, and both are flagged on their pages:

- `Ficus audrey` is a trade name; the species is *Ficus benghalensis*.
- `Bambusa vulgaris` carries the common name "Lucky bamboo", but the stems
  sold in a vase of pebbles are *Dracaena sanderiana* — which matters,
  because one is toxic to cats and dogs and the other is not.

---

## 4. The sitemap, and honest `lastmod`

`scripts/generate-sitemap.mjs` runs after the page generator.

A URL's `<lastmod>` only moves when that page's *content* changes. Each URL
is hashed against the file(s) that define it and compared with
`scripts/sitemap-manifest.json`, which is **committed**. Without this, every
rebuild would claim all 165 URLs changed today, which is how you teach a
crawler to ignore your `lastmod` entirely.

No git involved, so it behaves identically locally and on Vercel's shallow
clone. Today's date is stripped from the content before hashing, so a page
that stamps the build date into its markup doesn't look changed every time.

If you forget to commit the manifest, nothing breaks — the next build just
re-dates the pages it can't account for.

---

## 5. Tags stay unlisted

Publishing a plant's tag gives a keeper a link to hand to one person. The
README calls those links unlisted, so they are:

That takes two different mechanisms, because it is two different problems.

- `api/tag.ts` renders a published tag with `robots: noindex, nofollow`.
  `noindex` is what actually keeps it out of search results. `nofollow`
  matters because the only links on a tag page are to other tags — a
  keeper's mother plant and its cuttings — so following them would walk a
  whole lineage. There is nothing else on the page to follow.
- `robots.txt` disallows `/tag` in every group **except `Googlebot` and
  `Bingbot`**, which are deliberately allowed to fetch one.

  That looks backwards and is not. `noindex` lives inside the page, so a
  crawler has to fetch a tag to be told not to list it; disallowing the two
  crawlers that build search results means the instruction is never read.
  Worse, a disallowed URL can still be listed as a bare link — title-less,
  undescribed, and unremovable without allowing the crawl — if a keeper
  posts their tag link somewhere public. Allowing those two in is what keeps
  tags out of Google.

  Every other group keeps the disallow, because `noindex` binds an index and
  a crawler collecting text for a model does not have one. For those, not
  being allowed to fetch the page is the only thing that binds. (The rule is
  repeated under each named bot because a crawler matching its own
  user-agent line ignores the wildcard group entirely.)
- `llms.txt` says explicitly that tag URLs are not for citation.
- `scripts/seo-check.mjs` fails the build if a tag URL reaches the sitemap,
  if a search crawler is disallowed from `/tag`, if any other crawler is
  allowed it, or if `api/tag.ts` stops emitting the `noindex` that the whole
  arrangement rests on. Half of this is only correct in combination, so
  neither half is left to a comment.

`/@handle` conservatories are the opposite: a keeper chose a handle and made
that page public, so it stays indexable. It isn't in the sitemap because the
set of handles isn't knowable at build time.

---

## 6. Checks

`npm run seo` (also run inside `npm run smoke`) walks every page in
`public/` and fails on:

- a missing or duplicated `<title>`, a missing description, a canonical
  that doesn't match the URL the file is served at
- JSON-LD that doesn't parse, or has no `@context`
- a `FAQPage` question or answer that isn't visible on the page
- an `og:image` with no file behind it
- an internal link to something nothing serves
- a page missing from the sitemap, or a sitemap entry with no page
- `robots.txt` not naming the sitemap, or not disallowing `/tag`

Warnings (long titles, short descriptions) print but don't fail.

---

## 7. Not done, and why

- **Competitor comparison pages** (`/compare/...`). WrenchBid has four and
  they earn their keep. Doing the same here means publishing claims about
  Planta, Greg, Vera and PictureThis — their pricing, their limits, what
  they do and don't store. Those change, and getting them wrong is a
  liability rather than an SEO win. Worth doing with verified, dated
  figures and a note of when they were checked; not worth guessing at.
- **A second language.** WrenchBid's Spanish parity — `/es`, `hreflang`,
  translated calculators — was a large share of its traffic. The same
  structure would work here (the generator already separates data from
  prose), but the care copy has to be written, not translated by machine.
- **Per-plant photography.** Every page would be better with a picture of
  the plant, and `og:image` currently falls back to the site card. That
  needs an image source with licensing that survives commercial use.
- **Search Console.** Nothing here verifies the property or watches what
  lands. Submit `https://plantparlour.org/sitemap.xml` once this ships.

---

## 8. Commands

```
npm run plants   # regenerate /plants and sitemap.xml
npm run seo      # check the crawlable surface
npm run icons    # re-render icons and the four social cards
npm run smoke    # build + seo + the full browser walkthrough
```
