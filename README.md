# PlantParlour

A CARFAX for plants. Photograph each plant you own, log what you do for it,
see what it needs today, and hand its whole history to whoever you trade or
sell it to. Cuttings trace back to their mother plant.

The idea, personas, rules and roadmap are in [`docs/PRODUCT.md`](docs/PRODUCT.md).

## Status: v2 — accounts and sync

Local-first: your plants live in SQLite on the device, and the app works
with no account at all. Sign in — with Google, or an email and a 6-digit
code; no passwords — and the whole greenhouse (plants, care history,
photos) is saved to your account and syncs to any phone you sign into. See
*Accounts and sync*.

Publishing a plant's **tag** makes that one plant's synced record public
at a link anyone can open:

`https://ixagjvntbgyqemxxinqe.supabase.co/functions/v1/tag?t=<token>`

Links are unlisted (32-hex random token), read via a `SECURITY DEFINER`
RPC — there is no anonymous read access to any table. Until an email is
added, identity is a Supabase **anonymous sign-in** created on first
publish; adding the email attaches it to that same account.

- Add plants with up to three photos — the whole plant, then close-ups —
  which the AI reads together in one scan (each extra photo is about half a cent)
- Per-plant reminders for watering, fertilizing, repotting and a fresh photo
  ("Needs water", "Due in 2d", "New photo due")
- Log care in one tap, or with notes and a back-date — with an Undo, and any
  history entry can be removed later (the removal syncs to other phones)
- Report an issue → the plant is flagged **Special care needed** until you
  resolve it, and the fix goes on the record as a treatment
- Photo timeline — tap any photo to make it the plant's main picture (syncs, and fronts the tag)
- Log a propagation → a new plant whose record links back to this one
- Full per-plant history — every AI photo check is written into it, so the
  findings sync and stay with the plant
- **Publish / update / unpublish a tag**, share the link from the app
- **Sign in** (Google, or an emailed code) and the greenhouse backs up and syncs across phones

Not yet: public greenhouses, trades. See the roadmap.

## Supabase

Project `plant-care` (`ixagjvntbgyqemxxinqe`, us-east-1). `.env` holds the
URL and publishable key (safe to commit — RLS gates everything).

- `supabase/migrations/…_plant_passports.sql` — tables `keepers`, `plants`,
  `care_events`, `photos`; RLS (keepers touch only their own rows);
  public-read bucket `plant-photos` with per-keeper write folders;
  `passport(token)` RPC
- `supabase/migrations/…_greenhouse_sync.sql` — those tables become the
  synced copy of each keeper's whole greenhouse: client-generated uuids,
  location and cadences on plants, `deleted_at` tombstones, a server-stamped
  `synced_at` as the pull cursor; plants private (`is_public = false`) by
  default
- `api/tag.ts` — the public HTML tag page, served by Vercel at `/tag?t=…`
  (Edge Functions rewrite `text/html` to `text/plain`, so it can't live
  there; `supabase/functions/tag` now only redirects old links)
  (deployed with JWT verification off; it only calls the RPC)

**One-time setup in the Supabase dashboard:** Authentication → Sign In /
Providers → enable **Allow anonymous sign-ins**. Publishing fails with a
clear message until that's on.

## Accounts and sync

**In the app:** the person icon on the greenhouse (or the "sign in" card)
opens the login screen: **Continue with Google** (one tap; web app for now)
or your email and the 6-digit code from the email. There are no passwords.
Whichever way you sign in, whatever is on the phone is pushed into that
account on the first sync. With the email code, an existing anonymous
session gets the email attached, so anything already published keeps its
links. Signing in the same way on another phone brings the greenhouse over.
Signing out leaves the plants on the phone; they just stop syncing. A phone
that signs into a *different* account keeps its plants and gives that
account its own copy (the first account's copy stays as it was).

**How sync works** (`src/lib/sync.ts`): every local row has a uuid the
server keys on and a `dirty` flag that each write sets. A sync *pulls* rows
the server has changed since the phone's cursor (last-write-wins by
`updated_at`; a local edit at least as new stays and pushes next) and then
*pushes* every dirty row, plus tombstones for deleted plants. It runs on
launch, when a screen regains focus, and shortly after every write. Photos
upload once to the `plant-photos` bucket under `<keeper>/<plant>/<photo>.jpg`;
another phone shows them from that URL. Only accounts with an email sync;
an anonymous session couldn't be signed into elsewhere, so there'd be
nothing to promise.

**Privacy note:** the bucket is public-read (tags need it) with unguessable
paths. Unpublishing a tag stops the link resolving but leaves the keeper's
photos in place — they're the synced copy now — so someone who saved a
photo URL while the tag was up keeps it. A private bucket with signed URLs
would close that; it's a later change.

**One-time setup for Google sign-in:**

1. Google Cloud Console → APIs & Services → *OAuth consent screen*: External,
   app name PlantParlour, your support email; add yourself as a test user
   (or publish the app so anyone can sign in).
2. *Credentials* → Create credentials → OAuth client ID → Web application.
   Authorized JavaScript origin: `https://plant-care-flame.vercel.app`, plus
   any custom domain — list both, don't swap one for the other (see
   *Domain* below). Authorized redirect URI:
   `https://ixagjvntbgyqemxxinqe.supabase.co/auth/v1/callback` — that one is
   the Supabase callback and doesn't change with the domain. Copy the
   Client ID (`….apps.googleusercontent.com`) and the Client Secret.
3. Supabase → Authentication → Providers → Google: enable; paste the Client
   ID into *Client IDs* and the secret into *Client Secret*; save.
4. Supabase → Authentication → URL Configuration: Site URL
   `https://plant-care-flame.vercel.app`; add
   `https://plant-care-flame.vercel.app/**` to Redirect URLs. A custom
   domain needs its own `/**` entry here too, added alongside rather than
   in place of this one.

**One-time setup for the email code (the fallback):**

1. Authentication → Email Templates: the **Magic Link** and **Change Email
   Address** templates must include the code, `{{ .Token }}` — e.g.
   `<p>Your PlantParlour code: <strong>{{ .Token }}</strong></p>`. The app
   verifies the code; it never uses the link.
2. Authentication → SMTP settings: point it at a real mail provider.
   Supabase's built-in mailer sends only a few emails an hour, project-wide,
   which is fine for one tester and not for anyone else. The app reports
   the limit plainly when it's hit.

## Species catalogue

`src/domain/species.ts` knows ~135 houseplants and ~110 named cultivars and
variegations — Thai Constellation, Albo, Marble Queen, Pink Princess, Tineke,
Raven ZZ — each with the reminder cadences that suit it. Type in the species
box and it suggests as you go (a genus prefix leads with scientific names, a
nickname like "thai con" or "pothos" resolves too); **Browse** opens the whole
list by group, with a *Variegated & cultivars* filter. Picking one, or typing
a name it knows, sets the plant's reminders and stores the catalogue's
spelling (`Monstera deliciosa 'Thai Constellation'`). Cultivars inherit their
parent's care and sit right under it in the list.

## AI photo analysis

On the add-plant screen, **Identify with AI** names the plant from its photo
(top candidates with confidence; tapping one fills the species and sets its
reminders from the catalogue) and reads its health. On a plant's page,
**Check health with AI** does the health read on the latest photo, and any
finding can be logged as an issue in one tap.

It runs in `supabase/functions/analyze` on Claude. Photos are shrunk to
1024px before they're sent. Only signed-in keepers can call it, and each
keeper gets 20 analyses a day (`ai_usage` table; the function alone writes
it).

Cost is a dial, set as function secrets with no redeploy: `AI_MODEL`
(`claude-opus-5` default; `claude-sonnet-5` at a third of the cost;
`claude-haiku-4-5` cheapest) and `AI_EFFORT` (`low` | `medium` default |
`high`). Measured on five real photos: Opus named all five, cultivars
included (Thai Constellation, White Princess, Euphorbia 'Rubra'), at about
3¢ and 12–20 s each; Sonnet got two, calling the Thai Constellation an Albo
and a philodendron a pothos, at about 1¢ and 9 s. The image is most of the
cost, so caching doesn't help. Each answer reports which model and effort produced it and the tokens it
used. A request may also name a `model` from that list to compare answers on
one photo; the daily cap bounds it.

**One-time setup:** add your Anthropic API key as a function secret —
Supabase dashboard → Edge Functions → Secrets → `ANTHROPIC_API_KEY` (or
`supabase secrets set ANTHROPIC_API_KEY=…`). Until it's there the buttons
show a clear "not set up" message rather than failing quietly.

## Care guides

Each plant's page shows a care guide for its species — light, water, humidity,
soil, feeding, repotting, the problems it's prone to, and toxicity to pets and
children. Guides are generated once by Claude (`supabase/functions/care`,
Sonnet by default) and **shared**: the `care_cards` table caches each species,
so the first keeper to look one up pays a couple of cents and everyone after
reads it free and instantly. The card is also cached on-device, so it shows
offline after the first view. Set `AI_CARE_MODEL` to override the model.

## Calendar reminders

**Add to calendar** on a plant's page turns its schedule into recurring
reminders your phone's Calendar app understands — a repeating event for each
of watering, fertilizing, repotting and a fresh photo, on that plant's own
cadence, first ping at 9am local. Each reminder carries the species care
instructions in its notes, so the alert tells you not just *that* the Thai
Constellation needs water but *how* to water it. On the web it downloads an
`.ics` (which phones open straight into Calendar); on a device it opens the
share sheet. The generator is `src/domain/calendar.ts` (pure, unit-tested);
`src/lib/calendar.ts` does the platform save.

Push notifications ("water your Monstera", "time to reorder soil") are the
next step and need the native app — the web page can't ping a locked phone.

## Run it

```sh
npm install
npm start          # then scan the QR code with Expo Go on Android/iOS
npm run android    # or open on a connected device / emulator
npm run web        # runs in the browser too
```

[Expo Go](https://expo.dev/go) is the fastest way to put a build on a phone
— yours or a friend's — without an app store.

## Hand it to testers

**Web:** https://plant-care-flame.vercel.app — the permanent address every
published tag points at, and the whole app in a browser,
data kept on that device. On a phone, "Take photo" opens the camera and
"Add to Home Screen" gives it an icon. Photos are stored inside the app's
database (shrunk to 1600px), so they survive reloads. Hosted on Vercel,
which redeploys automatically on every push to `main`; no command to run.
The Supabase URL and publishable key are built into the bundle, so any host
serves a working app.

**Native build:** `npm run start:tunnel` runs it through Expo Go, scannable
from anywhere. Only needed for what a browser can't do — push notifications,
when they land. Leave it running while people are testing; when it stops, so
does the app on their phones.

## Domain

The app answers on its Vercel address, and `EXPO_PUBLIC_SITE_URL` points it
at a custom one. Two facts shape the whole switch:

- **A published tag link is permanent once it leaves the app.** The database
  stores only the token; `tagUrl()` rebuilds the URL from `SITE_URL` every
  time it is shown, so the app itself follows whatever host is configured.
  What cannot be rewritten is a link already texted to someone or printed
  onto a plant tag. Until such links exist, switching hosts is free — after
  that, the old host has to keep answering, so **add a domain rather than
  replace one** and check what is actually published before retiring a host:

  ```sql
  select count(*) from plants where is_public and deleted_at is null;
  ```
- **`EXPO_PUBLIC_SITE_URL` is inlined at build time.** Setting it in Vercel
  fixes the web app on the next deploy. Phones keep minting links from the
  value compiled into their build until a new binary ships, so the rollover
  is gradual, not a cutover.

In order, and safe to stop after any step:

1. Vercel → Settings → Domains → add the domain; create the DNS records it
   shows you at the registrar; wait for *Valid Configuration* and the
   certificate.
2. Confirm it serves: `curl -sI https://<domain>/ | head -1` → `HTTP/2 200`.
   Both hosts work now and nothing else has changed.
3. Supabase → Authentication → URL Configuration: **add** `https://<domain>/**`
   to Redirect URLs, keeping the existing entry.
4. Google Cloud Console → Credentials → Web client: **add** `https://<domain>`
   to Authorized JavaScript origins, keeping the existing one.
5. Vercel → Environment Variables: `EXPO_PUBLIC_SITE_URL=https://<domain>`,
   then redeploy. New tag links published from the web app now use it.
6. Supabase → Edge Functions → `tag` → secrets: `SITE_URL=https://<domain>`,
   so old `/functions/v1/tag?t=…` links forward to the new host.
7. Supabase → Authentication → URL Configuration: change *Site URL* to the
   new domain, once step 3 is confirmed working.
8. For phones: `SITE_URL`'s fallback in `src/lib/supabase.ts` is the live
   domain, so a rebuilt app is correct without any variable set. Reload the
   app and publish a tag to confirm the link comes out on the right host.

Steps 3 and 4 are adds, not edits: replacing the old values locks out anyone
mid-session and breaks sign-in from the old host while it is still live.

## Test it

```sh
npm test           # domain logic (care scheduling, alerts, keeper history)
npm run typecheck
npm run smoke      # exports the web build and drives it in headless Chromium
npm run e2e        # publishes a real tag to Supabase and syncs two "phones"
```

The care rules live in `src/domain/care.ts` and are pure functions with no
framework or storage dependency; `care.test.ts` pins them against fixed
dates.

`npm run smoke` walks the whole v0 flow in a real browser — add a plant,
see what's due, log care, report and resolve an issue, take a cutting,
reload — against the SQLite-on-wasm build. It needs a browser once:
`npx playwright install chromium` (or point `CHROME` at an existing binary).
Camera flows are checked on a device.

`npm run e2e` is the v1 counterpart and hits the **real Supabase project** in
`.env`: it builds a plant with a care history and a photo, calls the app's own
`publishTag`, then checks the snapshot landed, the photo is publicly
readable, the tag page renders, republishing reuses the link, a cutting
links back to its mother, the tables stay unreadable anonymously,
unpublishing returns a 404 and takes the photos out of the public bucket, and
republishing puts them back. It deletes everything it created afterwards.

It drives `src/lib/tag.ts` and `src/db` directly under Node — SQLite is
backed by `node:sqlite` and the two React-Native-only modules are stubbed
(`e2e/stubs`, wired up in `vitest.e2e.config.ts`) — so the publish path under
test is the one that ships. Identity comes from the app's anonymous sign-in,
so **Allow anonymous sign-ins** has to be on (see above); to run it against a
dedicated account instead, set `PASSPORT_E2E_EMAIL` and
`PASSPORT_E2E_PASSWORD`.

`e2e/sync.e2e.test.ts` is the sync counterpart: two `node:sqlite` databases
play two phones on one account. A pushes a greenhouse with a photo and a
cutting; B pulls it and gets the same plants, history, lineage and a photo
that loads from storage; a change on B reaches A; when both edit the same
plant the later edit wins on both; a delete on A disappears from B; a third,
fresh phone ends up identical to A. Sync needs an account with an email, so
this one needs `PASSPORT_E2E_EMAIL` / `PASSPORT_E2E_PASSWORD` set to a
confirmed account (without them it tries a throwaway sign-up, which works
only when the project doesn't require email confirmation).

## Look

The brand from Amanda's brief, as settled on the design canvas: an
aubergine page with cream cards and aubergine text on them, gold as the one
working colour, plum for the water drops and "Log", a cooler burgundy for
"something's up". Lora (the tag page's serif) for titles and section labels,
Source Sans 3 for everything else. `src/theme.ts` holds two palettes with
one shape — on the page and inside a card — and `useTheme()` returns the
right one for wherever a component renders (`Card` sets the surface), so
every colour pair stays at or above WCAG AA.

## Layout

```
src/app/            Expo Router screens
  index.tsx           the greenhouse (plant list, sorted by what needs attention)
  plant/new.tsx       add a plant
  plant/[id]/         plant detail (care, photos, lineage, history) and edit
  account.tsx         sign in with an email code; sync status
src/domain/care.ts  care scheduling rules — the product's brain
src/domain/calendar.ts  the .ics reminder feed
src/db/             SQLite schema and typed queries (plus the sync-facing ones)
src/lib/            sync engine, auth, tag publishing, AI, photos, calendar save
src/components/     small UI kit + plant card
e2e/                live tag publish and two-phone sync checks (npm run e2e)
docs/PRODUCT.md     product brief and roadmap
```

## Where the idea came from

A first cut of the whole thing — including sharing, tags and trades —
was prototyped inside a Shopify app (`d13-ai/plant-compliance-app`, branch
`claude/plant-care-tracking-xa0dnq`). The domain logic here is ported from
it; the UI and the shop-as-identity assumption were left behind.
