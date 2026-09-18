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

## What to charge, at 7¢ a scan

Through Stripe, $5.99 nets about **$5.52** after 2.9% + 30¢. At 7¢ a scan that
is **79 scans a month before a subscriber costs more than they pay.**

| Monthly allowance | Worst-case cost | Gross margin |
|---|---|---|
| 20 | $1.40 | 75% |
| **30 (recommended)** | **$2.10** | **62%** |
| 50 | $3.50 | 37% |
| 79 | $5.53 | 0% |
| 100 | $7.00 | **−27%** |

**30 a month.** One a day is more than a collector uses once their plants are
photographed — scans cluster around new arrivals and sick plants — and it
leaves enough margin to absorb a price rise or a heavier cohort. The 50–100
range floated in the first draft of this page was written against the 2.1¢
figure and does not survive 7¢.

**The free tier has an acquisition cost.** Five scans at 7¢ is **35¢ per
signup**, spent before anyone pays anything. A thousand signups is $350. That
is affordable and it is not nothing, and it is the number to watch if a post
ever goes wide.

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

**$1,000/month is 167 subscribers.** At a typical 2–5% free-to-paid
conversion, that is somewhere between 3,300 and 8,400 active keepers.

Which reframes everything above: none of this matters until the funnel that
feeds it exists — and we currently cannot measure a funnel at all. See
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

Both are reads. Neither spends anything — which is the point: the app records
what it costs so nobody has to spend money to find out (`CLAUDE.md`).
