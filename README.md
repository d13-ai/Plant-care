# Plant Passport

A CARFAX for plants. Photograph each plant you own, log what you do for it,
see what it needs today, and hand its whole history to whoever you trade or
sell it to. Cuttings trace back to their mother plant.

The idea, personas, rules and roadmap are in [`docs/PRODUCT.md`](docs/PRODUCT.md).

## Status: v0 — "my plants, on my phone"

Local-only. No account, no server. Everything lives in SQLite on the device.

- Add plants with a camera or library photo
- Per-plant reminders for watering, fertilizing, repotting and a fresh photo
  ("Needs water", "Due in 2d", "New photo due")
- Log care in one tap, or with notes and a back-date
- Report an issue → the plant is flagged **Special care needed** until you
  resolve it, and the fix goes on the record as a treatment
- Photo timeline
- Log a propagation → a new plant whose record links back to this one
- Full per-plant history

Not yet: accounts, sharing, public passports, trades. See the roadmap.

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
