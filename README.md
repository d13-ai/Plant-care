# Plant Passport

A CARFAX for plants. Photograph each plant you own, log what you do for it,
see what it needs today, and hand its whole history to whoever you trade or
sell it to. Cuttings trace back to their mother plant.

The idea, personas, rules and roadmap are in [`docs/PRODUCT.md`](docs/PRODUCT.md).

## Status: v1 — passports

Local-first: your plants live in SQLite on the device. Publishing a plant's
**passport** pushes a snapshot of that one plant (record, care events,
photos) to Supabase and gives you a link anyone can open:

`https://ixagjvntbgyqemxxinqe.supabase.co/functions/v1/passport?t=<token>`

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
- **Publish / update / unpublish a passport**, share the link from the app

Not yet: accounts with email, full sync, public greenhouses, trades. See the roadmap.

## Supabase

Project `plant-care` (`ixagjvntbgyqemxxinqe`, us-east-1). `.env` holds the
URL and publishable key (safe to commit — RLS gates everything).

- `supabase/migrations/…_plant_passports.sql` — tables `keepers`, `plants`,
  `care_events`, `photos`; RLS (keepers touch only their own rows);
  public-read bucket `plant-photos` with per-keeper write folders;
  `passport(token)` RPC
- `supabase/functions/passport/index.ts` — the public HTML passport page
  (deployed with JWT verification off; it only calls the RPC)

**One-time setup in the Supabase dashboard:** Authentication → Sign In /
Providers → enable **Allow anonymous sign-ins**. Publishing fails with a
clear message until that's on.

## Run it

```sh
npm install
npm start          # then scan the QR code with Expo Go on Android/iOS
npm run android    # or open on a connected device / emulator
npm run web        # runs in the browser too
```

[Expo Go](https://expo.dev/go) is the fastest way to put a build on a phone
— yours or a friend's — without an app store.

## Test it

```sh
npm test           # domain logic (care scheduling, alerts, keeper history)
npm run typecheck
npm run smoke      # exports the web build and drives it in headless Chromium
```

The care rules live in `src/domain/care.ts` and are pure functions with no
framework or storage dependency; `care.test.ts` pins them against fixed
dates.

`npm run smoke` walks the whole v0 flow in a real browser — add a plant,
see what's due, log care, report and resolve an issue, take a cutting,
reload — against the SQLite-on-wasm build. It needs a browser once:
`npx playwright install chromium` (or point `CHROME` at an existing binary).
Camera flows are checked on a device.

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
docs/PRODUCT.md     product brief and roadmap
```

## Where the idea came from

A first cut of the whole thing — including sharing, passports and trades —
was prototyped inside a Shopify app (`d13-ai/plant-compliance-app`, branch
`claude/plant-care-tracking-xa0dnq`). The domain logic here is ported from
it; the UI and the shop-as-identity assumption were left behind.
