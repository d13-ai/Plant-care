# Google Play: listing and forms

Everything the Play Console asks for, drafted to paste. Kept in the repo so
the answers change when the app does: if a change here would make one of
them untrue (a new kind of data, ads, a new third party), update this file in
the same commit.

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
`Plant care reminders, AI plant ID and a care record for every plant you keep.`

**Full description** (4000 max):

```
PlantParlour is a care record for every plant you keep, and it goes with the plant.

Photograph a plant and PlantParlour tells you what it is, down to the cultivar where it can, and how it's doing. Then it keeps track of the rest: when you watered, fed and repotted, what went wrong and what you did about it, and what each plant needs today.

WHAT IT DOES
• Identifies plants from a photo, including variegated and collector cultivars
• Checks a plant's health from a photo and suggests what to do
• Keeps a watering, feeding and repotting schedule for each plant
• "Still moist" puts watering off when the soil is still wet, and learns how often each plant really needs it
• Logs problems, treatments, repotting and cuttings, with photos
• Gives a care guide for every species: light, water, humidity, soil and common problems
• Works offline, and keeps your plants in step across your phones and computers

PLANT TAGS
Publish a plant and it gets its own tag: a link to its species, care history and photos. Pass it on with the plant when you sell, swap or gift a cutting, and its story goes with it. Nothing is public until you publish it.

HONEST ABOUT THE AI
Identification and health checks are AI answers, and AI can be wrong. Every answer can be reported from where it's shown. Toxicity notes always come with the ASPCA list and the Animal Poison Control number, because the AI is not the authority on whether a plant is safe around pets or children.

YOUR DATA
No ads. Your records aren't sold or shared. Delete your account and everything in it from inside the app, at any time.

Free plant care library and calm plant puzzles at plantparlour.org.
```

**Category:** House & Home. **Tags:** Plant care, Gardening, Home & garden.

**Contact:** email `bondcreativestudios@gmail.com`, website `https://plantparlour.org`.

**Privacy policy:** `https://plantparlour.org/privacy`

**Graphics:**

| Asset | File | Size |
|---|---|---|
| App icon | `public/icon-512.png` | 512×512 |
| Feature graphic | `store/feature-graphic.png` | 1024×500 |
| Phone screenshots | to take from the first Android test build | 2–8, 9:16 |

Both images come from `npm run icons`.

## App content forms

### Privacy policy
`https://plantparlour.org/privacy`

### Ads
No, the app does not contain ads.

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
analytics SDK; page-view counting is on the website only.

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
