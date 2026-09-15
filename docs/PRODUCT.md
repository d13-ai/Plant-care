# PlantParlour — product brief

*"A CARFAX for plants" is the pitch. Named PlantParlour in September 2026 after a knockout trademark search: no live US registration, .app/.co/.io free.*

## The idea in one paragraph

You photograph each plant you own. The app tells you what each one needs
right now — a little water-drop when it's thirsty, a flag when something's
wrong — and keeps a record of everything you do for it: watered, fertilized,
repotted, treated. Every few months it nudges you to take a fresh photo so
the record shows how the plant actually fared. Your collection is a
greenhouse you can share; friends can visit, and when you trade or sell a
plant you hand over the plant *and its whole history*. Cuttings are linked
to their mother plant, so any propagation traces back to where it came from.
The result: for any plant, anyone can see who kept it, where it thrived,
what went wrong, and what fixed it.

## Who it's for

- **Collectors** — the person with 40 plants and a spreadsheet they hate.
  Cares about not killing things, and about showing off rare ones.
- **Propagators / small sellers** — people who root cuttings and sell or
  trade them. A traceable history is a selling point ("rooted from a
  mother that's been thriving in my care since 2023").
- **Traders** — people who swap plants in local groups and online. Want the
  plant's record to move with it.

The same person is often all three.

## Core concepts

| Concept | What it is |
|---|---|
| **Keeper** | A person with an account. Owns one greenhouse. |
| **Greenhouse** | A keeper's collection. Private by default; can be public. |
| **Plant** | One physical plant. Has a stable identity that survives changing hands. |
| **Care event** | A dated entry in the plant's record: water, fertilize, repot, prune, photo, issue, treatment, note. |
| **Issue** | A care event that stays *open* until resolved. An open issue = "special care needed". |
| **Photo** | Dated image on the plant's timeline. The health record you can *see*. |
| **Lineage** | A plant may have a mother plant (it was propagated from it). Chains back indefinitely. |
| **Transfer** | An offer to hand a plant to another keeper. The plant — and all of the above — moves only when accepted. |
| **Tag** | A plant's public record: lineage, keepers, care summary, issues & treatments, photos over time. Shareable by link. |

The one rule that makes everything else work: **history belongs to the
plant, not the keeper.** Trades, propagation and tags all fall out of
that.

## Features (from the original brainstorm, in the order they came up)

1. **Photos of each plant** — the collection is visual from day one.
2. **"It needs water" / "special care needed" indicators** on each plant.
3. **Tap in → last watered, last fertilized, last repotted.**
4. **Log watering, fertilizing, repotting** (and pruning, treatments, notes).
5. **Photo reminders** — every ~6 months, "take a new picture to verify
   its health."
6. **Personal greenhouse you can share** and show off rare species.
7. **Friends join / visit greenhouses.**
8. **Trade a plant** → it appears in the other person's greenhouse.
9. **Propagation** — a cutting traces back to its mom.
10. **Full traceable history** for any plant: who owned it, where it
    thrived, issues, fixes. Sellable provenance.

## Care-reminder rules (already worked out and tested)

- Each plant has a cadence, in days, per care type. Defaults: water 7,
  fertilize 30, repot 365, photo 180. Blank = reminder off.
- Due date = last logged event of that type + cadence.
- Never logged? Count from the plant's acquisition date, not "overdue
  immediately" — a plant you added this morning is not overdue for repotting.
- "Due soon" = within 20% of the cadence, capped at 3 days (so an annual
  repot doesn't nag for ten weeks).
- An open issue outranks everything: the plant is flagged "special care
  needed" until someone marks it resolved, and resolving writes a
  *treatment* entry so the fix is on the record too.
- Collection view sorts plants that need something to the top.

## Testable versions, in order

Each slice is something you can hand to a friend with plants and ask "does
this feel right?"

**v0 — My plants, on my phone (no account, no server).** ✅ shipped
Add plants with a photo from the camera. Log care. See what's due. Photo
timeline. Everything stored on-device. *Tests: is logging care low-friction
enough that people actually do it? Are the reminders right?*

**v1 — Provenance.** ✅ shipped
Propagate a cutting from a plant. Issues and treatments. Publish a plant's
tag to Supabase and share it as a link (unlisted; anonymous sign-in
under the hood). *Tests: do
propagators want this? Is the tag something they'd send a buyer?*

**v2 — Accounts and sync.** ✅ shipped (public greenhouse link still to come)
Sign in with an email and a 6-digit code (an anonymous session gets the
email attached, so published tags keep their links); the whole greenhouse
syncs to the account and to any phone that signs in — last-write-wins
between phones, deletes carried as tombstones. Photos live in storage once
and show on every phone. *Tests: does "it's backed up" change how people
treat the app? Does a second phone feel like the same greenhouse?*

**v2b — Sharing.**
A public greenhouse page (every published plant of one keeper at one link),
and a handle to find keepers by. *Tests: will people make their greenhouse
public? Do links get shared?*

**v3 — Trades.**
Offer a plant to another keeper by handle; accept/decline; history moves.
Friends/following. *Tests: does the trade flow match how people actually
swap plants (in person, at meetups, by mail)?*

Shipped along the way: species catalogue with cultivars, AI identification
and health checks from a photo, per-species care guides (generated once and
shared), calendar reminders that carry the care instructions.

Later, in no particular order: push notifications for due care (needs the
native app), light/humidity notes per location, marketplace listings backed
by tags, export/import, a private photo bucket with signed URLs.

## Housekeeping from the brand round (Sep 2026)

- **Tag page in the brand look** — done: aubergine page, cream card with the
  double gold rule, Lora headings, the plum footer band. Same markup, so the
  e2e still reads it.
- **Data sources — decision for Amanda.** `docs/DATA_SOURCES.md` compares
  Perenual with the catalogue + cached AI guides on ten species and
  recommends: keep the catalogue and guides as the care source; add GBIF's
  free name-matching for species outside the catalogue; use the ASPCA list
  as the pet-safety reference; skip USDA PLANTS; revisit Perenual only for
  structured attributes (hardiness, propagation) on a paid tier. *Open:
  Amanda to confirm or push back; nothing in the app depends on it yet.*
- **Emailed sign-in codes** need two dashboard settings only the project
  owner can make (see README → Accounts and sync): the Magic Link and
  Change Email templates must contain `{{ .Token }}`, and SMTP must point
  at Resend (the sending-only key for bondcreativestudios.com is already
  created). Until then Google sign-in is the working path and the email
  path hits Supabase's few-per-hour limit.

## What already exists

A first cut of all of the above was prototyped inside a Shopify app
(`d13-ai/plant-compliance-app`, branch `claude/plant-care-tracking-xa0dnq`):
data model, care-scheduling logic, lineage walk, keeper history, transfer
flow, tag and public greenhouse pages. The **domain logic is plain
TypeScript with no framework dependency** and ports directly:
`app/utils/greenhouse.ts` there (care statuses, alerts, keeper history).
The UI and the Shopify-shop-as-identity assumption do not carry over.

## Open questions

- Identity: settled on email + 6-digit code (no passwords, no magic links —
  a link tapped from Mail opens in the wrong place on a phone). Handles for
  trading ("send to @dana") are still open.
- Photos: synced to Supabase storage, one object per photo, shown from its
  URL on other phones. Still open: people with 200 plants × 10 photos, and
  moving to a private bucket with signed URLs.
- Species data: free text is fine for v0; later, a species table lets the
  app suggest cadences ("succulents: water every 14 days") and power search
  in public greenhouses.
- Does a *deceased* plant's tag stay public? (Probably yes — the
  record is the point — with a status badge.)
- What does a trade look like when the recipient doesn't have the app yet?
  (Likely: a tag link with a "claim this plant" button.)
