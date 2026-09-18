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
| AI cost per call | **$0.02137** — 28 calls, $0.5984 total, 4 keepers, 13–17 Sep |
| Photos | 18 objects, 9.6 MB, **535 KB average** |
| Photo handling | Downscaled to 1600px at 0.85 quality on upload (`src/lib/photos.ts`) |
| Current AI cap | `DAILY_CAP = 20` per keeper per **day** — up to ~600/month |

The sample is small — 28 calls over five days — and cost per call moves with
photo size and model choice. Treat $0.02 as the right order of magnitude
rather than a constant, and re-run the query before relying on it.

Everything that is not AI is cheap. A 40-plant collector with ten photos each
is about 214 MB, well under a cent a month of storage. Fixed costs are
Supabase Pro (~$25) and Vercel (~$20), so **roughly nine subscribers cover the
infrastructure.**

The variable that could bite is **egress, not storage**. Photos are served as
full-size originals — there are no thumbnails — so a conservatory holding 400
photos can pull hundreds of megabytes on a single view. Supabase's image
transformations would cut that by an order of magnitude and make the pages
faster. Worth doing before there is traffic rather than after.

## $5.99 works, but not with today's caps

Through Stripe, $5.99 nets about **$5.52** after 2.9% + 30¢. At $0.02137 a
call that is **258 AI calls a month before a subscriber costs more than they
pay.**

The current cap permits 600. A heavy keeper inside today's limit costs
**$12.82 a month against $5.99 of revenue.**

The cap was written to bound abuse of a free product, and as a paid
entitlement it is upside-down. Proposed instead:

| Tier | AI scans | Worst case cost | Gross margin |
|---|---|---|---|
| Free | 3–5 / month | ~$0.11 | n/a |
| Paid | 50–100 / month | ~$2.14 | ~60% |

Two or three scans a day is generous for anybody who is not testing the app,
and it bounds the downside without anyone feeling a wall.

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
-- cost per AI call, and per keeper
select count(distinct keeper_id) as keepers, sum(count) as ai_calls,
       round(sum(cost_usd), 4) as total_usd,
       round(sum(cost_usd) / nullif(sum(count), 0), 5) as usd_per_call
from ai_usage;

-- what the photos weigh
select count(*) as photos,
       pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as total,
       round(avg((metadata->>'size')::bigint) / 1024.0, 0) as avg_kb
from storage.objects where bucket_id = 'plant-photos';
```

Both are reads. Neither spends anything — which is the point: the app records
what it costs so nobody has to spend money to find out (`CLAUDE.md`).
