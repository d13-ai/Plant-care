# Parlour Games — roadmap

Parlour Games is the puzzle corner at `/parlour-games`. It exists for one
reason: PlantParlour's long-term value depends on keepers coming back, and a
plant app only genuinely needs you every few days. Games fill the days in
between without inventing fake plant chores.

The house rules, from the hub page, apply to every game here: **no timers, no
scores, nothing to lose.** They are the constraint, not decoration — a game
that punishes you is a game people quit, and the whole point is the coming
back.

## What exists

| | |
|---|---|
| **The hub** | `/parlour-games` — lists the games, links back to the app. |
| **Trickle** | `/parlour-games/trickle` — rotate the pipes until the water reaches every plant. Free boards, a daily board everyone shares, a streak, a practice mode, and an embeddable build at `/parlour-games/trickle/embed`. |
| **The way in** | A card on the greenhouse shown only when nothing needs attention, plus a permanent link at the foot of the plant list. Both point at the hub, not at a game. |

## What actually drives the habit

Worth being clear-eyed, because it changes what to build next.

The puzzle is not the addictive part. Wordle's mechanic is Mastermind, which
is forty years old; what made it a habit was **one board a day**, **a streak**,
and **a result you could paste into a group chat without spoiling it**.

Trickle has the first two. It does not have the third, and the share card is a
fraction of the work of a new game. *That is the highest-value item on this
page*, and it is not a game.

Two decisions that follow from this:

- **One streak across all of Parlour Games**, not one per game. With three
  games a keeper gets three chances a day to keep the streak alive, which is
  both kinder and stickier than three separate streaks they each break inside
  a fortnight.
- **A shared daily epoch**, so "today's boards" means the same day everywhere.

## Order of work

1. **The Trickle share card.** Spoiler-free result, a copy button, an image
   for the platforms that want one. Blocked *only* on the analytics half of
   Trickle step 8 — the share half has no such dependency and should be split
   out and shipped.
2. **Extract the shared harness.** Roughly 400 lines currently live inside
   `trickle.html`: the seeded daily board, the streak, progress sync against
   `game_progress`, the sound engine, night mode, and the storage wrappers
   that swallow a locked-down browser. Copy that into a second game and the
   third one becomes a maintenance problem. Extract once, and game two costs
   about half what Trickle cost.
3. **Windowsill.** Next game. Spec in `docs/windowsill-spec.md`.
4. **Thicket.** Later.
5. **Roots.** Later.

## The games

### Windowsill — *next*

Arrange plants on a tiered windowsill so every one of them gets the light it
wants. Too much scorches, too little goes leggy, and a tall plant at the front
shades what is behind it — but a short one does not shade the raised row
behind, which is the whole reason plant stands are built in steps.

The one game on this list that teaches something true about keeping plants.
Spec and measured design in `docs/windowsill-spec.md`.

### Thicket — *later*

A bed of sprouts; some are weeds. Row and column counts tell you how many
weeds each holds, so it is solvable by logic with no guessing.

The trick that makes it fit the house rules: **you mark, you do not pull.**
Nothing is uprooted until the whole bed is consistent, and then one button
clears it in a single sweep. That inverts the usual fail state — there is no
wrong pull to punish, and the reward is a bed that visibly tidies all at once.

Deduction rather than spatial reasoning, so it widens the audience more than
another spatial game would.

### Roots — *later*

One seed, and a single unbroken root that has to reach every patch of soil,
routing around stones. Least original of the three — it is a path-filling
puzzle and there are many — but that genre has the best retention of any and
it is the cheapest to build: lay the path first, then drop the stones in, and
every board is solvable by construction.

## Open

- **Analytics.** There are none, anywhere in PlantParlour, and `/privacy` says
  so in those words. Wiring a provider to measure whether any of this works
  would make that page false. Unresolved, and it is a decision rather than a
  task. Until it is resolved we are building on judgement, which argues for
  cheap-if-wrong choices.
- **Art.** Windowsill wants nine plant silhouettes. Simple SVG is fine to
  start; it is the one game here with a real art dependency.
