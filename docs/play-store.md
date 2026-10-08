# Google Play: listing and forms

Everything the Play Console asks for, drafted to paste. Kept in the repo so
the answers change when the app does: if a change here would make one of
them untrue (a new kind of data, ads, a new third party), update this file in
the same commit.

## Status

First production release (version 6) sent for review on 8 Oct 2026, with the
listing text below.

## Before the first upload

- **Package name: `org.plantparlour.app`.** Registered in Play Console when
  the app was created (6 Oct 2026) and set in `app.json`. It can never
  change, so it must never be edited there.
- **Developer account:** an organization account, under the name on the
  D-U-N-S record. Organization accounts don't need the 14-day, 12-tester
  closed test that new personal accounts must run.
- **First upload by hand.** Build with `eas build --platform android
  --profile production` and upload the `.aab` in Play Console → Test and
  release → Internal testing. Later builds can go up with `eas submit`, which
  needs a Google service-account key.

## Store listing

**App name** (30 max): `PlantParlour: Plant Care`

**Short description** (80 max):
`Plant ID, care reminders and a living care record for every plant you keep.`

**Full description** (4000 max):

```
Every plant you love deserves a history. PlantParlour keeps it, and tells you what each one needs today.

Snap a photo and PlantParlour names your plant, down to the cultivar where it can, including variegated and collector varieties. See how it's doing, get a care guide written for that species, and let reminders tell you when it's time to water, feed or repot.

NEVER MISS A WATERING
• A reminder on the day each plant needs water, fertilizer, repotting or a fresh photo, with tips from its care guide
• One gentle nudge a day for anything still waiting, so nothing slips through the cracks
• Soil still damp? Tap "Still moist" and watering waits. Do it a few times and PlantParlour suggests a better schedule for that plant, in that spot
• You pick the time. Reminders are scheduled on your phone

KNOW WHAT YOU'VE GOT
• Identify plants from a photo, including variegated and rare collector cultivars
• Health checks from a photo: what's going wrong and what to do about it
• A care guide for every species: light, water, humidity, soil, feeding and the common problems to watch for

A RECORD THAT GROWS WITH YOUR PLANT
• Log watering, feeding, repotting, pests, treatments and cuttings, with photos
• Watch every plant change over time in its own photo history
• Trace each cutting back to its mother plant
• Works offline, and keeps your collection in step across your phones and computers

PLANT TAGS: ITS STORY GOES WITH IT
Selling, swapping or gifting a cutting? Publish the plant and it gets its own tag, a link to its species, care history and photos, so whoever takes it home knows exactly what it's been through. Show off your collection on your own conservatory page and follow the collections of keepers you admire. Nothing is public until you publish it.

A QUIET MINUTE
On days when nothing needs you, sit down with Parlour Games: calm plant puzzles with a fresh daily board, no timers and nothing to lose, right inside the app.

HONEST ABOUT THE AI
AI can be wrong, so every answer can be reported right where it's shown. Toxicity notes always come with the ASPCA list and the Animal Poison Control number, because when it comes to pets and children, the AI is not the final word.

YOUR PLANTS, YOUR DATA
No ads. Your records aren't sold or shared. Delete your account and everything in it from inside the app, any time.

More free care guides for over 150 houseplants at plantparlour.org.
```

**Category:** House & Home. **Tags:** Plant care, Gardening, Home & garden.

**Contact:** email `bondcreativestudios@gmail.com`, website `https://plantparlour.org`.

**Privacy policy:** `https://plantparlour.org/privacy`

**Graphics:**

| Asset | File | Size |
|---|---|---|
| App icon | `public/icon-512.png` | 512×512 |
| Feature graphic | `store/feature-graphic.png` | 1024×500 |
| Phone screenshots | `store/screenshots/1-…6-*.png`, from the web build by `scripts/store-screenshots.mjs` (stubbed, no AI spend); retake from the Android build later if wanted | 1080×1920 |

Both images come from `npm run icons`.

## App content forms

### Privacy policy
`https://plantparlour.org/privacy`

### Ads
No, the app does not contain ads.

### Advertising ID
No, the app doesn't use it. `app.json` blocks
`com.google.android.gms.permission.AD_ID` so no library can add it behind
that answer; Play rejects a build that declares No but carries the permission.

### Health apps
No health features. ("Plant health" is about plants, not people.)

### App access
**All or some functionality is restricted.** Every screen needs an account.
Give the reviewer a test account made for them (not a real keeper's), with
its email and password, and this note:

> Sign in with the email and password above. To try plant identification,
> tap Add plant, then Take photo or Choose photo, then Identify with AI. The
> account includes five AI photo checks.

### Content rating (IARC questionnaire)
- Category: **All other app types** (a utility, not a game).
- Violence, fear, sexuality, language, controlled substances, gambling:
  **No** to every question.
- **Users can report users or user-generated content: Yes** (since 6 Oct
  2026: *Report this page* on every tag and conservatory, which stores the
  report in `content_reports` and emails it to us; see
  `supabase/functions/report-content`). Block: No. Chat moderation: No.
- **Online content: Yes** (AI-generated answers).
- **Users can interact or share content: Yes.** A keeper can publish a
  plant's tag and a public conservatory page with their photos and notes.
  There is no chat or messaging between users.
- Shares the user's location: **No.**
- Allows purchases: **No.**

### Target audience and content
- Target age: **18 and over**. Choosing an age under 18 brings in the
  Families policy, which the app isn't built for.
- Appeals to children: **No.**

### News app
No. **Health app:** No (plant health, not human health). **Government app:** No.
**Financial features:** None.

### Data safety

Data is **encrypted in transit**: yes. Users **can request deletion**: yes, in
the app (Account → Delete account) and at
`https://plantparlour.org/delete-account`. Deleting some data without the
account: yes, `https://plantparlour.org/delete-account#some-data`. Account
creation method: username (email) and password.

Sending photos to Anthropic for identification, and email addresses to
Resend for the account emails, is processing by service providers on our
behalf, which Google does not count as sharing. **Shared with third
parties: none.**

| Data type | Collected | Required? | Why |
|---|---|---|---|
| Personal info → Email address | Yes | Required | Account management; app functionality (sign-in, password reset); developer communications (the one welcome email) |
| Personal info → Name | Yes | Optional (display name) | App functionality |
| Personal info → User IDs | Yes | Required | Account management |
| Photos and videos → Photos | Yes | Optional | App functionality (plant records, AI identification) |
| App activity → Other user-generated content | Yes | Optional | App functionality (plant notes, care history) |
| App activity → App interactions | Yes | Optional, sent only in a bug report (the trail of recent actions) | Analytics; app functionality |
| App info and performance → Crash logs | Yes | Optional, sent only in a bug report (errors the app hit) | Analytics; app functionality |
| App info and performance → Diagnostics | Yes | Optional, sent only when the user files a bug or AI-answer report | Analytics; app functionality |

Not collected: location, contacts, financial info, health info, messages,
audio, files, calendar, web browsing, device IDs. The Android app has no
analytics SDK; page-view counting is on the website only. The app opens
Parlour Games in a browser sheet (`?from=app`), and those pages skip the
counter for the whole visit (`IN_APP_KEY` in `src/domain/analytics.ts`), since
Google treats what a page shown inside the app collects as the app collecting.

**Is data processed ephemerally?** No for photos (they're stored as part of
the record). **Is all collected data encrypted in transit?** Yes.

### AI-generated content
Play requires a way to report offensive AI-generated content. Every AI
answer (identification, health check and care guide) has **Report this
answer** under it; reports arrive in `bug_reports` with `app.report =
"ai_answer"` (see `src/domain/ai-report.ts`).

### Account deletion
In the app: Account → Delete account. On the web:
`https://plantparlour.org/delete-account`, which also gives the email route
for anyone who can't sign in.

## Permissions

The Android build asks for the **camera** (taking plant photos) and nothing
else of note. Photos are chosen through the system photo picker, which needs
no permission; `app.json` blocks the media-library and microphone
permissions that libraries would otherwise add, because Play rejects
photo-library access an app doesn't strictly need.

Care reminders (version 5 on) add **notifications** (`POST_NOTIFICATIONS`,
asked for only after the keeper taps "Turn on reminders") and
`RECEIVE_BOOT_COMPLETED`, so queued reminders survive a restart. They are
scheduled on the phone by `expo-notifications`: no push service, no device
token, nothing sent anywhere — the Data safety answers don't change. No
exact-alarm permission is declared; Android delivers them within a few
minutes of the reminder time, which is all a watering reminder needs.

## Over-the-air updates (from version 7)

Builds from version 7 on carry `expo-updates`, so a change to the app's
JavaScript -- screens, wording, logic, like the health-check photo choice --
can reach installed phones without a new store build:

```
npm run update:android -- --message "Health checks: one earlier photo for comparison"
```

That needs `EXPO_TOKEN`, so it runs from a cloud session in the Default
environment, like the builds. The phone downloads the update in the background
when the app opens and runs it the next time it starts.

- **Only JavaScript.** Anything native -- a new permission, a new Expo module,
  a config-plugin change in `app.json` -- changes the runtime fingerprint
  (`runtimeVersion: { policy: "fingerprint" }`), and builds with the old
  fingerprint never receive an update made for the new one. So a native change
  still needs a store build; a JS change no longer does. Versions 2-6 predate
  this and only change by store update.
- **Channels:** production builds listen on `production`, preview on
  `preview`. Publishing to `production` reaches internal testers and, once
  live, everyone on that build.
- **Play policy** allows updates like these as long as the app's purpose and
  what the listing promises don't change; a new feature of any size still goes
  through review as a build.
- **Cost:** Expo's free plan covers 1,000 monthly active users and 100 GiB of
  bandwidth, with no overage -- past 1,000 users, updates stop being served
  until a paid plan (Starter, $19/month, 3,000 users) is on.
- Bug reports from the app include the update it was running (`update`,
  `channel`, `runtime` in the report's `app` field).
