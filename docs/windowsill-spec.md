# Windowsill — spec

A shelf in a window. Plants that each want a particular amount of light.
Arrange them so every one of them is happy.

It is the only game on the Parlour Games roadmap that teaches something true
about keeping plants, which is why it goes first.

---

## 1. The rules, in full

**The shelf** is `W` columns wide and `D` tiers deep. The window is at the
front. Tiers are *stepped*: tier 0 is at the front and lowest, tier 1 sits one
step up and behind it, tier 2 one step up again — a plant stand, not a flat
sill.

**A plant** has two properties, both visible:

- a **light need**: sun (3), bright (2) or shade (1)
- a **height**: low (1), mid (2) or tall (3)

**Light** comes in horizontally from the window. Every cell starts at 3. A
plant standing at tier `t` with height `h` occupies the vertical span from `t`
to `t + h`. It shades a plant behind it at tier `t'` when it **overtops that
plant's base** — that is, when `t + h > t'`. Each plant that overtops you
costs one level of light, floored at 0.

**A plant is happy only when the light it receives exactly equals its need.**
Too much scorches it. Too little makes it leggy. Both are wrong, and that
two-sidedness is what makes it a puzzle rather than a sorting exercise.

**You win** when every plant on the shelf is happy.

### The idea the whole game turns on

A **low plant at the front does not shade the raised row behind it** — it
stands from 0 to 1, and the tier behind it starts at 1. A **tall plant at the
front shades two rows back.**

That is exactly why real plant stands are built in steps, and it is the one
thing a player has to notice. Everything else follows from it.

### Worked example

A column, front to back: `sun/tall`, `bright/mid`, `shade/low`.

| tier | what shades it | light | plant | |
|---|---|---|---|---|
| 0 | nothing in front | 3 | sun (3) | ✓ |
| 1 | the tall one (0+3 > 1) | 2 | bright (2) | ✓ |
| 2 | the tall one (0+3 > 2) and the mid one (1+2 > 2) | 1 | shade (1) | ✓ |

And a column that looks wrong but is not: `sun/low`, `sun/low`, `sun/mid`.
Nothing overtops anything — 0+1 is not above 1, 1+1 is not above 2 — so all
three sit in full light and all three are happy.

---

## 2. What was measured before any of this was written

The first version of this game had a **flat** sill, where light dropped by the
*height* of each plant in front rather than by whether it overtopped. It is
dead, and it is worth recording why, because it looked fine on paper.

| model | full columns | distinct need-patterns |
|---|---|---|
| flat sill, heights 1–2 | 2 | **1** — always (3, 2, 1) |
| flat sill, heights 1–3 | 3 | **1** — always (3, 2, 1) |
| tiered, heights 1–2 | 8 | 4 |
| **tiered, heights 1–3** | **27** | **5** |

On a flat sill every filled column has the identical pattern of needs, so the
game is "sort each column by light need, descending" — no puzzle at all. The
flat sill also cannot be filled more than three deep, because the light runs
out. The tiered rule fixes both.

### How tight are the boards?

Solutions counted **up to column order**, since sliding whole columns
sideways is not a different answer to a player. 120 random boards per shape:

| shelf | plants | median solutions | p90 | share with >50 |
|---|---|---|---|---|
| 3 × 3 | 9 | **4** | 13 | 0% |
| 4 × 3 | 12 | **10** | 29 | 3% |
| 5 × 3 | 15 | 23 | 80 | 24% |
| 3 × 4 | 12 | 20 | 61 | 18% |
| 4 × 4 | 16 | 104 | 409 | 66% |
| 5 × 4 | 20 | 900 | 2870 | 95% |

**The game lives at three tiers deep and three to five columns wide** —
which is, pleasingly, the shape of an actual windowsill plant stand. Four
tiers is mush: a board with four hundred answers is fidgeting, not thinking.

Two further findings that shape the build:

- **The shelf must be full.** Leaving cells empty lets plants slide about
  behind gaps and the solution count explodes. Number of plants always equals
  `W × D`.
- **The front tier always wants full sun.** Nothing can stand in front of it.
  This is forced by the geometry and is not worth fighting — it is true of
  real windowsills, and it gives a beginner somewhere obvious to start.

### Difficulty is a dialled number, not a hope

Counting a board's solutions costs **0.5–3 ms**. The generator can therefore
deal a candidate, count it, and reject it unless it lands in a target band —
and still fill a board in well under a frame. Acceptance rates at sensible
bands were 80% (3×3), 57% (4×3) and 46% (5×3), so a handful of candidates is
always enough.

This is the most useful thing in this document. Difficulty stops being a
guess.

| board | shelf | target solutions |
|---|---|---|
| gentle | 3 × 3 | 2–8 |
| standard | 4 × 3 | 4–16 |
| deep end | 5 × 3 | 8–30 |

---

## 3. Generating a board

1. Pick the shelf shape.
2. Deal `W` valid full columns at random from the 27, using the seeded PRNG.
3. Collect the plants into a tray and forget the arrangement. Every board is
   therefore **solvable by construction** — the same guarantee Trickle's
   generator gives, and for the same reason.
4. Count the solutions. If the count is outside the band, throw the candidate
   away and deal again.
5. Shuffle the tray.

The player is never shown the arrangement the board was dealt from, and it is
not "the" answer — most boards have several, and any of them wins.

---

## 4. Playing it

**Controls.** Tap a plant in the tray to pick it up, tap a cell to set it
down. Tap a plant already on the shelf to pick it up again; tap another to
swap the two. Tap-then-tap rather than drag: drag is unreliable on a phone
and there is no reason to need it.

**The light is never hidden.** Every cell shows the light reaching it, live,
as the shelf fills. This does not give the game away — the difficulty is that
the height you choose now decides the light two rows back, so working greedily
from the front fails. Trickle shows the water; this shows the light.

**Feedback per plant**, by icon *and* word, never by colour alone:

| state | reads |
|---|---|
| happy | ✓ |
| scorching | too much sun |
| leggy | wants more light |

**Nothing is ever lost.** No timer, no move limit, no failure state. A
scorched plant is an unhappy face you can fix by moving it, not a penalty.
This is the house rule and it is not negotiable.

**Par** is the number of plants: a perfect round sets each one down once and
never moves it. Your count of placements is shown against par at the end, the
same shape Trickle uses. Par is a thing to aim at, not a thing to fail.

---

## 5. Practice board

Fixed, the same for everyone, and it has **exactly one solution**. Two
columns, three tiers. Verified by exhaustive count.

Tray: `bright/mid`, `shade/low`, `sun/low`, `sun/low`, `sun/mid`, `sun/tall`

The solution, front to back:

- **column 1** — `sun/low`, `sun/low`, `sun/mid`
- **column 2** — `sun/tall`, `bright/mid`, `shade/low`

It was chosen to teach both halves of the rule in one board: column 1 stacks
three sun-lovers that never shade each other, and column 2 puts the tall one
at the front so the light steps 3 → 2 → 1 behind it. A player who has solved
this has the whole game.

---

## 6. What it shares with Trickle

Everything that is not the puzzle, out of the extracted harness (roadmap item
2, which lands before this one):

- the seeded daily board and the shared epoch
- the streak — **one streak across all of Parlour Games**
- progress sync through `game_progress`
- the sound engine, night mode, and the storage wrappers that survive a
  browser with everything switched off
- hub chrome, the back link, the embed build

Windowsill adds no new table and no new migration.

---

## 7. Look

The games' palette, not the app's: aubergine page, plum card, gold, leaf
green. Drawn from the side, as a stepped stand in front of a window, so the
tiers and the heights are literally visible — a player should be able to *see*
that the tall one is blocking the light rather than having to work it out from
numbers.

Nine plant silhouettes are needed, one per (need, height) pair. Plain SVG to
start. Naming them after real species that actually want that light would be
a nice touch and ties the game back to the app, but it is a refinement, not a
blocker — Amanda is on the logo.

## 8. Accessibility

- Every state carries an icon and a word, never colour alone.
- Tap targets at least 44 px, checked at the smallest shelf.
- Contrast measured against the page, not eyeballed — the games' text has
  been running at 7:1 and up and this should not be the one that slips.
- Fully playable by keyboard: arrow keys move a cursor, space picks up and
  puts down.
- Honours `prefers-reduced-motion`; the placing animation is decoration.

---

## 9. Build plan

Each step ends somewhere it can be looked at.

1. **The shelf renders and the rules are right.** A fixed board, plants
   placed by tapping, light recomputed live, happy/scorched/leggy per plant,
   win detected. No generator, no daily, no sound. Unit tests for the light
   model first, including the two worked examples in §1.
2. **The generator**, with the solution counter and the difficulty bands.
   Prove it: deal a few hundred boards at each shape and assert every one is
   solvable, full, and inside its band.
3. **Practice mode** on the fixed board in §5, with the two-part lesson.
4. **A daily board**, off the shared epoch, plus par and the end-of-round
   card.
5. **The streak and progress sync**, through the shared harness.
6. **Sound and night mode**, from the harness.
7. **Art pass** — the nine silhouettes, the window, the stepped stand.
8. **The hub entry**, the smoke test, and the embed build.

Steps 1 and 2 are the ones that decide whether the game is any good. Stop
after each and look.
