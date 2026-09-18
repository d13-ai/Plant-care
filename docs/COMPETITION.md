# PlantParlour — where we stand against everyone else

*Desk research, 18 September 2026. Facts about PlantParlour come from this
repository; facts about other products come from their own sites and from
secondary sources of the same date, and should be re-checked before anything
expensive rests on a specific number. Nothing here is published — see
`docs/SEO.md` §7 on why we do not ship comparison pages making claims about
named competitors.*

## The category, honestly

Two adjacent markets, both crowded, both much larger than us.

| | Who | Scale | Price |
|---|---|---|---|
| **Identification** | PictureThis, PlantNet, PlantIn, PlantSnap | PlantIn ~35M downloads | PictureThis $39.99/yr, PlantIn from $29.99/yr |
| **Care reminders** | Planta, Greg | Planta ~7M users; Greg 10M+ Play downloads | Planta $7.99/mo or $35.99/yr; Greg free core, paid reminders |

Annual pricing clusters at **$30–60**. Blossom sits highest at $59.99–79.99.

The category's open secret is that several leaders earn their money on
seven-day trials that auto-convert to an annual charge, and have collected
hundreds of "I was charged after the trial" reviews. That is a real opening,
and one we occupy already without trying: no ads, no tracking, no trial trap.

## Where we actually lose

Worth writing down plainly, because it decides what to build.

**We have no push notifications.** The app is an Expo web export. There is no
native build, so the one mechanism the entire reminders category runs on is
not available to us. `src/lib/calendar.ts` hands the keeper an `.ics` file to
add to their own calendar, which is ingenious and is not the same product as a
phone that buzzes on Tuesday. On the core job of a care app, we are behind on
plumbing rather than on thinking.

**We are not in the app stores**, so we get none of the store-search demand
that is most of this category's distribution. The plant library and the
crawlable half of the site (`docs/SEO.md`) are the answer to that, and they
work on a timescale of months.

**An account is the front door**, and the AI scan sits behind it, where the
big apps let somebody scan first and ask later. `docs/PRODUCT.md` already
flags this as the cost we accepted; it is still a cost.

**Free with a real marginal cost.** Every scan spends Anthropic money, bounded
by `DAILY_CAP = 20` per keeper per day and a 200/day global ceiling. That is a
spend cap, not a business model: growth breaks the product before it breaks
the bank. See `docs/PRICING.md`.

## "CARFAX for plants" is not an empty field

This was the surprise of the exercise. Several products already aim at plant
provenance:

| Product | What it is | How real |
|---|---|---|
| **Leafolio** | Collection tracker and journal for serious collectors — vendors, orders, wishlists, and a breeding journal recording crosses and parentage | Real. Both app stores, an LLC behind it, free to 20 plants then $4.99/mo or $39.99/yr. **Private: no public sharing.** |
| **Propagains** (was PropagatePro) | Mother-plant registry, offspring lineage, **QR verification cards for buyers**, ROI maths | Aimed squarely at our thesis. No pricing, team, store listing or screenshots — reads pre-launch. |
| **InPlantory** | Botanical records for rare aroid collectors; cuttings, corms and TC clones linked to their mothers | Beta, narrow niche |
| **MyGrowthStories, Rootstock, Cutting Log** | Provenance journals; Cutting Log is local-first and open source | Small / hobby scale |

Read that table twice, because it says two different things.

**Lineage tracking is contested.** If the pitch is "track a cutting back to its
mother", Leafolio does that today, on both app stores, with a distribution
story better than ours.

**The public record is not.** Leafolio keeps everything private. The one
product going after the buyer-facing verification page does not appear to have
shipped. Our actual moat is the half nobody has taken:

> The record is a public, linkable, permanent page, and it moves with the
> plant when the plant changes hands.

Not a private journal with an export button. A URL you hand a buyer, that
survives the sale, attached to a conservatory the seller builds a reputation
on. **Transfer** — history moving to another keeper — is the thing no
competitor of any size does, and it is the piece `v3b` has not shipped.

There is demand pressure behind it. The rare-plant trade has a documented
fraud problem: one scammer took more than $3,000 from 27 people in a sale
group; buyers of variegated cuttings have no way to check that what arrives is
what was promised. The market's current answer is "look at the seller's Etsy
reviews". That is weak, and it is the gap a provenance link fills.

## What we have that they do not

1. **Provenance as a public artifact** — per above, the only defensible
   position on this page.
2. **Trust.** No analytics, no ads, no tracking pixels, no trial trap, and a
   privacy page that now states exactly what crawlers may do with a keeper's
   data. In a category full of billing complaints that is marketing, not only
   ethics.
3. **The arcade.** A daily puzzle with a streak shared across games is a
   retention mechanic no plant app has, aimed at this category's real problem:
   a plant app is needed every few days, so people drift away between visits.
4. **Free, with real AI in it** — for now, and see the caveat above.

## What follows

1. **Pick the fight we can win, in the product's own words.** Stop leading
   with care reminders. Lead with the record that travels with the plant, to
   collectors, propagators and sellers — the people with money at stake. The
   library and the tag pages already point that way; the front door does not.
2. **Ship the seller loop**, because it is half-built and it is the moat: a
   printable QR card for a plant being shipped, and "claim this plant" for a
   transfer to somebody without an account (already an open question in
   `docs/PRODUCT.md`). It turns every sale into a distribution event — the
   buyer arrives holding a PlantParlour link.
3. **Decide about push, explicitly.** Either commit to a native build so the
   reminder half is competitive, or accept it as table stakes we will be
   mediocre at and spend everything on provenance. Doing neither means
   competing on a feature we cannot structurally deliver. Note the tension
   with `docs/PRICING.md`: a native app hands 15–30% of revenue to the stores.
4. **Decide pricing before there are users.** See `docs/PRICING.md`.
5. **Fix the measurement blind spot.** We cannot tell whether the sign-in wall
   costs us the scan, whether the games retain anybody, or whether tag links
   travel. Every open question on this page would be settled by data we have
   chosen not to collect. First-party, server-side, no third party, disclosed
   plainly, is compatible with our values — but not with the current wording of
   `/privacy`. It is a decision, and better taken deliberately than by
   drifting into blindness.

## Open

- **This is desk research.** The sharpest next step is an hour inside Leafolio
  and Greg, to see whether the reading above survives contact.
- **Whether Propagains ever ships.** If it does, the public-record position is
  contested too, and speed matters more than it does today.
- **Whether AI crawlers should be allowed on conservatories.** They are today
  (`robots.txt` refuses them only on `/tag`), and that is now disclosed rather
  than accidental — but it was never a decision.

Sources consulted, all 18 September 2026: leafolio.app; propagains.vercel.app;
beta.inplantory.com; mygrowthstories.com; github.com/rwrife/cutting-log;
greg.app/community; getgrowli.app/blog/plant-app-prices-2026;
identifythis.app/picture-this-app-review;
gardening.alibaba.com/plant-care/planta-app;
apartmenttherapy.com (plant scams); variegatedplantshop.com (fake rare plants).
