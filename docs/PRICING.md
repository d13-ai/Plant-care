# PlantParlour — what it costs to run, and what to charge

*18 September 2026. The intent is a **$5.99/month** subscription. This works
out whether that survives contact with the numbers. The cost figures are
measured from our own tables, not estimated; the platform prices are list
prices of this date and should be re-checked before a spreadsheet is built on
them.*

## What a keeper actually costs

Measured, from `ai_usage` and `storage.objects`:

| | Measured |
|---|---|
| AI calls recorded | 28, of which **10 cost nothing** — cache hits |
| Cost per *billed* call | **$0.0352** — $0.5985 over 17 calls, 13–17 Sep |
| Cost per photo scan | **2–7¢**, depending on how many photos ride along |
| Photos | 18 objects, 9.6 MB, **535 KB average** (1600px, q0.85, `src/lib/photos.ts`) |

**Take 7¢ as the planning number.** A scan sends up to three 1024px photos in
a single call (`supabase/functions/analyze`), so its cost scales with how many
the keeper attaches: one photo is a couple of cents, three is about seven.
The 2.1¢ figure in the first draft of this page was the average across *all*
AI calls including free cache hits and cheap text-only care guides, and it
understated a real scan by a factor of three.

The model is the other half of it. The default is **Opus 5** at $5/$25 per
million tokens, chosen on evidence recorded in the function: on five real
photos it named every plant including cultivars, where Sonnet got two and
called a Thai Constellation an Albo. Sonnet would cost about 40% as much. For
an app whose buyers are collectors, naming the cultivar correctly *is* the
product — but it is the biggest single cost lever, and worth revisiting for
health-check-only scans, where no cultivar has to be named.

## Correcting the first draft: the cap is not what I said it was

This page previously claimed a heavy keeper could spend $12.82 a month inside
the current caps. That was wrong, and the code is better than I gave it credit
for. There are **two** caps (`supabase/functions/_shared/cap.ts`):

- `DAILY_CAP = 20` — photos **or lookups**, per keeper per day.
- `PHOTO_TRIAL = 5` — photo identifications per keeper **for their lifetime**,
  overridable by the `AI_PHOTO_TRIAL` secret, skipped for rows flagged
  `ai_unlimited`.

So a free keeper cannot run up 600 scans a month. They get **five scans, ever
— about 35¢** — and then care guides, which are cached and shared, so the
second keeper to ask about a Monstera pays nothing.

Which means the free tier is already the shape this page recommends further
down: a quota, not a clock. It was built before anyone called it pricing.

## Health checks moved to Sonnet

`mode: "health"` now runs on Sonnet 5 rather than Opus 5 — 40% of the cost on
the same tokens, **2.8¢ against 7¢**. Opus is the default because of
cultivar-grade identification, naming a Thai Constellation rather than an
Albo; a keeper asking why the leaves are yellowing on a Monstera they have
already recorded is not asking for that skill. The health prompt now takes the
keeper's species as given rather than asking the model to re-identify it,
because pairing a cheaper model with a request for its weakest skill is the
worst of both.

Overridable with `AI_HEALTH_MODEL`, and an explicit `model` in the request
still wins, so the two can be compared on one photo.

**Untested.** The Opus-vs-Sonnet comparison recorded in the function was about
identification, not health reading, and `CLAUDE.md` forbids spending the
project's API key on evaluations without asking. A five-photo A/B across both
models would cost about **50¢**. Worth doing before this is load-bearing.

## What a keeper actually uses

Run `node scripts/pricing-model.mjs` — every number below is arithmetic from
stated assumptions, and the assumptions are the argument.

The personas are judgement, not data: four keepers over five days cannot
produce a usage curve. Month one is the burst, when somebody photographs the
collection they already own; after that a scan happens when a plant arrives or
something looks wrong.

| Persona | Share | Month 1 | Steady state |
|---|---|---|---|
| Casual (8 plants) | 60% | 10 scans, $0.62 | 2 scans, $0.10 |
| Enthusiast (25 plants) | 30% | 25 scans, $1.54 | 5 scans, $0.22 |
| Collector (60+) | 10% | 55 scans, $3.43 | 10 scans, $0.45 |
| **Blended** | | **$1.17** | **3.7 scans, $0.17** |

**A subscriber costs 17¢ a month to serve.** On $5.99 monthly that is a 97%
margin in steady state, 79% in their first month.

Which means **the paid allowance was the wrong thing to agonise over.** A cap
exists to bound abuse, not to price the product, because the typical keeper
uses four scans and the cap could be fifty without anybody noticing:

| Allowance, used in full every month | All identify | All health | Half and half |
|---|---|---|---|
| 30 | $3.42 (62%) | $4.68 (85%) | $4.05 (73%) |
| **50** | **$2.02 (37%)** | $4.12 (75%) | $3.07 (56%) |
| 100 | −$1.48 (−27%) | $2.72 (49%) | $0.62 (11%) |

**Set it at 50 a month.** It reads as generous, almost nobody approaches it,
and the loss-making corner needs somebody running fifty *identifications* a
month, every month — which is not a keeper, it is a script.

## The free trial is the real cost, not the paid cap

At any size worth having, the dominant AI cost is people who never pay:

| Keepers | Subscribers (3%) | Revenue/mo | AI for subscribers | Free trials (one-off) | Profit/mo |
|---|---|---|---|---|---|
| 100 | 3 | $11.71 | $0.51 | $33.95 | **−$33.80** |
| 1,000 | 30 | $117.07 | $5.12 | $339.50 | $66.95 |
| 10,000 | 300 | $1,170.75 | $51.24 | **$3,395.00** | $1,074.51 |
| 50,000 | 1,500 | $5,853.73 | $256.20 | **$16,975.00** | $5,552.53 |

At ten thousand keepers, serving every paying subscriber costs **$51 a month**
and the free trials cost **$3,395** — sixty-six times more. That is the number
to manage, and there are three ways to:

- **Five scans to three.** 35¢ a signup becomes 21¢, and three is still enough
  to photograph the plants somebody cares most about.
- **Spend the first scan well and the rest cheaply.** Run trial scan one on
  Opus — it is the moment the app proves itself — and the rest on Sonnet. 35¢
  becomes about 18¢ with the wow intact.
- **Watch it, and be ready.** It is an acquisition cost, and 21–35¢ a signup
  is cheap next to any advertising. It only becomes a problem if a post goes
  wide and the people it brings never come back.

## What to charge

Stripe's fixed 30¢ lands twelve times on a monthly plan and once on an annual
one, which is why the plans net so differently:

| Plan | Nets per month | Card fee |
|---|---|---|
| $5.99/month | **$5.52** | 8% |
| $39.99/year | **$3.21** | 4% |

At a 70/30 annual/monthly mix that is **$3.90 a month of real revenue per
subscriber** — the annual plan buys retention, not revenue, and the headline
price is not what arrives.

- **$5.99/month, and an annual plan.** Recommended: **$47.88/year** — it reads
  as "$3.99 a month", undercuts Planta's monthly, sits a little above their
  annual, and nets $3.87 rather than $3.21. Matching Planta at $39.99 is the
  safer comparison-shopper choice and costs about 66¢ a subscriber a month.
- **Break-even is about 13 subscribers**, or roughly 430 keepers at 3%
  conversion. Below that the $45 of fixed cost is the whole story: at 100
  keepers this loses $34 a month, which is the price of being open.
- **$1,000/month profit needs 281 subscribers** — about **9,400 keepers** at
  3% conversion. That is the target, and it is a distribution problem, not a
  pricing one.

## Everything else is cheap

At 535 KB a photo, a 40-plant collector with ten photos each is about 214 MB —
under a cent a month of storage. Fixed costs are Supabase Pro (~$25) and
Vercel (~$20), so **roughly nine subscribers cover the infrastructure.**

Egress *was* the thing that could bite: photos were served as full-size
originals into thumbnails a centimetre across, so a conservatory with 400
photos could pull hundreds of megabytes on one view. Fixed on 18 September —
photos are now requested at the size they are drawn, measured at 69× smaller
for a grid thumbnail and 4.9× for a full-width hero.

## The problem is the shape, not the number

**$5.99/month with no annual option is $71.88 a year** — double Planta's
$35.99 and PictureThis's $39.99. A shopper comparing sees us as the expensive
one, which is a strange place for the newcomer with no push notifications.

Monthly-only also concentrates us in the worst cohort. Consumer utility apps
churn hard month to month, and a plant app's dead season is winter — exactly
when somebody notices the charge and cancels.

**Recommended:**

- **$5.99/month and $39.99/year, side by side.** The monthly is the anchor
  that makes the annual obvious; the annual is where the money and the
  retention are. Matching Planta's annual means comparison shoppers do not
  flinch.
- **A founding offer** — lifetime, or two years for one, for the first
  hundred. Cash now, and those people are the ones who tell plant groups
  about us.
- **Paywall what costs money or makes a seller money**: AI scans beyond the
  free allowance, QR and printed tag cards, unlimited public records, a custom
  conservatory.
- **Never paywall the arcade.** It costs nothing to serve and it is the
  retention mechanic.
- **Keep core tracking, reminders and the plant library free.** They are the
  SEO surface and the word of mouth, and their marginal cost is ~zero.

## The native-app tension

Fixing push notifications (`docs/COMPETITION.md`) means a native build, and a
native build means Apple and Google take 15–30%: $5.52 net becomes $5.09 at
15%, $4.19 at 30%.

Being a PWA costs us push and store discovery, and keeps 92% of every dollar.
Web checkout is a large part of why $5.99 can work at all. If we do go native,
look into selling the subscription on the web and linking out — the US rules
on that changed recently, and the current state needs verifying before the
model depends on it.

Also unresolved: sales tax and VAT. Stripe Tax, or a merchant of record such
as Paddle, is a decision that comes with the first paid keeper, not later.

## The number that matters

**$1,000/month of profit is 281 subscribers** — about 9,400 keepers at 3%
conversion — once the free trials are paid for. `scripts/pricing-model.mjs`
prints it, and will print a different one when the assumptions change.

Which reframes everything above: none of it matters until the funnel that
feeds it exists, and we cannot measure a funnel at all. See
`docs/COMPETITION.md`, item 5.

## Re-running the numbers

```sql
-- cost per BILLED call. The zero rows are cache hits; averaging over them
-- is what understated a scan by 3x the first time this page was written.
select count(*) filter (where cost_usd > 0) as billed_rows,
       sum(count) filter (where cost_usd > 0) as billed_calls,
       round(sum(cost_usd), 4) as total_usd,
       round(sum(cost_usd) / nullif(sum(count) filter (where cost_usd > 0), 0), 5) as usd_per_billed_call
from ai_usage;

-- and the heaviest keeper-days, which is where a cap has to hold
select keeper_id, day, count as calls, round(cost_usd, 4) as cost_usd
from ai_usage order by cost_usd desc limit 10;

-- what the photos weigh
select count(*) as photos,
       pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as total,
       round(avg((metadata->>'size')::bigint) / 1024.0, 0) as avg_kb
from storage.objects where bucket_id = 'plant-photos';
```

And the model that turns those into a business:

```
node scripts/pricing-model.mjs
```

Both queries are reads. Neither spends anything — which is the point: the app records
what it costs so nobody has to spend money to find out (`CLAUDE.md`).
