# Plant Passport

A CARFAX for plants. Photograph each plant you own, log what you do for it,
see what it needs today, and hand its whole history to whoever you trade or
sell it to. Cuttings trace back to their mother plant.

The idea, personas, rules and roadmap are in [`docs/PRODUCT.md`](docs/PRODUCT.md).

## Status: v1 — tags

Local-first: your plants live in SQLite on the device. Publishing a plant's
**tag** pushes a snapshot of that one plant (record, care events,
photos) to Supabase and gives you a link anyone can open:

`https://ixagjvntbgyqemxxinqe.supabase.co/functions/v1/tag?t=<token>`

Links are unlisted (32-hex random token), read via a `SECURITY DEFINER`
RPC — there is no anonymous read access to any table. Identity is a
Supabase **anonymous sign-in** created on first publish; linking an email
to it later is a one-liner (`supabase.auth.updateUser`).

- Add plants with a camera or library photo
- Per-plant reminders for watering, fertilizing, repotting and a fresh photo
  ("Needs water", "Due in 2d", "New photo due")
- Log care in one tap, or with notes and a back-date
- Report an issue → the plant is flagged **Special care needed** until you
  resolve it, and the fix goes on the record as a treatment
- Photo timeline
- Log a propagation → a new plant whose record links back to this one
- Full per-plant history
- **Publish / update / unpublish a tag**, share the link from the app

Not yet: accounts with email, full sync, public greenhouses, trades. See the roadmap.

## Supabase

Project `plant-care` (`ixagjvntbgyqemxxinqe`, us-east-1). `.env` holds the
URL and publishable key (safe to commit — RLS gates everything).

- `supabase/migrations/…_plant_passports.sql` — tables `keepers`, `plants`,
  `care_events`, `photos`; RLS (keepers touch only their own rows);
  public-read bucket `plant-photos` with per-keeper write folders;
  `passport(token)` RPC
- `supabase/functions/tag/index.ts` — the public HTML tag page
  (deployed with JWT verification off; it only calls the RPC)

**One-time setup in the Supabase dashboard:** Authentication → Sign In /
Providers → enable **Allow anonymous sign-ins**. Publishing fails with a
clear message until that's on.

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

It runs in `supabase/functions/analyze` on Claude (Opus 5, medium effort —
a few cents a photo). Photos are shrunk to 1024px before they're sent. Only
signed-in keepers can call it, and each keeper gets 20 analyses a day
(`ai_usage` table; the function alone writes it).

**One-time setup:** add your Anthropic API key as a function secret —
Supabase dashboard → Edge Functions → Secrets → `ANTHROPIC_API_KEY` (or
`supabase secrets set ANTHROPIC_API_KEY=…`). Until it's there the buttons
show a clear "not set up" message rather than failing quietly.

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

```sh
npm run start:tunnel   # Expo Go, scannable from anywhere — not just your wifi
npm run deploy:pages   # web build → https://d13-ai.github.io/Plant-care/
```

`start:tunnel` is the real app: camera and all. Leave it running while people
are testing; when it stops, so does the app on their phones.

`deploy:pages` puts the web build on GitHub Pages as the `gh-pages` branch —
the whole app in a browser, data kept on that device, no camera ("Choose"
picks from files). One-time setup: the repo must be public (or on a plan that
serves Pages from private repos) and Settings → Pages set to deploy from
`gh-pages`. The base path comes from `app.config.js` via `EXPO_BASE_URL`;
everything else about the build is unchanged.

## Test it

```sh
npm test           # domain logic (care scheduling, alerts, keeper history)
npm run typecheck
npm run smoke      # exports the web build and drives it in headless Chromium
npm run e2e        # publishes a real tag to Supabase and reads it back
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

## Layout

```
src/app/            Expo Router screens
  index.tsx           the greenhouse (plant list, sorted by what needs attention)
  plant/new.tsx       add a plant
  plant/[id]/         plant detail (care, photos, lineage, history) and edit
src/domain/care.ts  care scheduling rules — the product's brain
src/db/             SQLite schema and typed queries
src/lib/            photos (camera/library → app storage), date parsing
src/components/     small UI kit + plant card
e2e/                live tag publish check (npm run e2e)
docs/PRODUCT.md     product brief and roadmap
```

## Where the idea came from

A first cut of the whole thing — including sharing, tags and trades —
was prototyped inside a Shopify app (`d13-ai/plant-compliance-app`, branch
`claude/plant-care-tracking-xa0dnq`). The domain logic here is ported from
it; the UI and the shop-as-identity assumption were left behind.
