# Elbow Room — spec

A plot divided into beds. One plant to each bed. Every plant needs room to
grow.

The puzzle underneath is Star Battle — the one LinkedIn calls Queens and
Oakever's *Meowdoku* dresses in cats. The puzzle type is old and free to use;
the name, the art, the boards and the twists here are ours. What Elbow Room
adds is a reason for the rules that a plant keeper already knows, and three
plants that bend them the way real plants do.

---

## 1. The rules, in full

**The plot** is an `N × N` grid divided into `N` coloured **beds** of
different shapes.

Place `N` plants so that:

1. **every bed has exactly one plant;**
2. **every row and every column has exactly one plant;**
3. **no two plants touch** — not side by side, and not corner to corner.
   Plants need elbow room: leaves that touch fight for light and trap damp,
   which is how mildew spreads along a windowsill.

Rows and columns already keep two plants from sitting side by side, so in
practice rule 3 is about the diagonals — and the diagonals are where most of
the thinking happens.

**You win** when all `N` plants are in and no rule is broken. Every board has
**exactly one** answer, and every board can be reached **by reasoning alone**
— never by guessing (§3).

### The twists

A twisted bed shows its plant on it from the start, so the player always
knows which beds play by different rules. Each twist is one rule, and each is
true of the real plant.

| plant | rule | why it's true |
|---|---|---|
| **Cactus** | **Doesn't mind company.** A cactus may touch its neighbours corner to corner. Rows, columns and beds still apply. | Cacti and succulents are slow, dry-rooted and happy sharing a dish garden — about the only houseplants that are happy packed in together. |
| **Fern** | **Keeps out of the sun.** Some cells are **sun patches** (warm light falling through the window). A fern may not be planted in one. | Direct sun scorches fern fronds; they want bright shade. |
| **Climber** | **Needs something to climb.** Some cell edges carry a **trellis**. A climber must be planted in a cell with a trellis on one of its sides. | Pothos, philodendrons and monsteras are climbers; given a pole or a trellis they grow bigger leaves. |

Sun patches and trellises only matter to the plant that cares about them.
A cactus can sit in the sun; anything can stand by a trellis.

### Worked example — the practice board

5 × 5, five beds A–E, no twists. Lower-case marks the answer.

```
C A A A a
C B b A A
c B B B A
C B D d A
E e D D D
```

There are two ways in, both *confinement*. Bed **C** runs straight down
column 1, so column 1's plant must be in C and nothing else in column 1 can
grow. Bed **E** is only two cells, both in the bottom row, so the bottom row
belongs to E. The chain runs from there. A player who has solved this has
seen every idea the gentle boards use.

---

## 2. What was measured before any of this was written

All figures from a prototype generator and two solvers, run in Node on this
container. 60–400 boards per row, seeded, so they repeat.

### Random beds almost never have exactly one answer

Grow `N` beds at random around a valid placement and count the answers:

| board | one answer |
|---|---|
| 5 × 5 | 7% |
| 6 × 6 | 0.3% |
| 7 × 7 and up | 0% in 400 |

So the generator cannot deal and hope, the way Windowsill's can. It has to
**repair** (§3).

### Repair makes every board unique, quickly

Find a second answer, move one cell of a bed so that answer breaks, repeat:

| board | boards made | median | p95 | worst |
|---|---|---|---|---|
| 5 × 5 | 100 / 100 | 0.2 ms | 1.1 ms | 12 ms |
| 6 × 6 | 100 / 100 | 0.2 ms | 1.1 ms | 3 ms |
| 7 × 7 | 100 / 100 | 0.4 ms | 1.4 ms | 7 ms |
| 8 × 8 | 100 / 100 | 2.2 ms | 21 ms | 67 ms |
| 9 × 9 | 99 / 100 | 18 ms | 175 ms | 274 ms |
| 10 × 10 | 87 / 100 | 193 ms | 1.1 s | 1.6 s |

Up to 9 × 9 a board is made on the spot in the browser, as Windowsill's are.
10 × 10 is too slow to make live and is left out.

### Difficulty is a technique, not a size

A second solver plays like a person, using only named deductions, and
records the hardest one a board needed:

- **single** — a row, column or bed has one cell left;
- **confine** — a bed's cells all lie in one row (or column), so the rest of
  that row is empty — and the same the other way round;
- **crowding** — planting here would leave some bed, row or column with
  nowhere to go, so this cell is out;
- **pigeonhole** — two (or three) beds fit inside two (or three) rows between
  them, so those rows belong to them.

| board | single | confine | crowding | pigeonhole | needs a guess |
|---|---|---|---|---|---|
| 5 × 5 | 10% | 23% | 63% | 3% | 0% |
| 6 × 6 | 7% | 13% | 71% | 3% | 5% |
| 7 × 7 | 5% | 16% | 63% | 10% | 6% |
| 8 × 8 | 3% | 10% | 65% | 16% | 7% |
| 9 × 9 | 1% | 8% | 61% | 16% | 13% |

Two things follow. **Boards that need a guess are thrown away** — a puzzle
that ends in trial and error breaks the promise of §1, and at worst that costs
one candidate in eight. And **difficulty is set by technique**, the way
Windowsill's is set by solution count: a gentle board is one that singles and
confinement alone will finish.

### Twists only count if the board is built around them

Adding a fern to a board that was already unique changed what a player had to
work out in **14%** of 7 × 7 boards and **6%** of 8 × 8 — the rest of the time
it was decoration. Built in from the start instead — the beds repaired with
the twist's rule switched on — the twist was **needed** to solve the board:

| board | made | twist needed | solvable by reasoning | median | p95 |
|---|---|---|---|---|---|
| 6 × 6 | 60 / 60 | 92% | 98% | 0.2 ms | 1.4 ms |
| 7 × 7 | 60 / 60 | 92% | 97% | 0.2 ms | 4.1 ms |
| 8 × 8 | 60 / 60 | 93% | 97% | 0.9 ms | 3.3 ms |
| 9 × 9 | 60 / 60 | 88% | 92% | 2.4 ms | 51 ms |

(Fern and climber together. A twist that is switched on narrows the search,
which is why these are faster than plain boards.) A cactus bed — the one twist
that *adds* answers rather than removing them — repaired just as reliably:
60 / 60 at 6, 7 and 8, median 0.4–3.1 ms.

So a twisted board is accepted only if **it has one answer with its twists,
and more than one without** — the twist has to be something the player uses,
not a sticker on the bed.

---

## 3. Generating a board

1. Place `N` plants: one per row and column, none touching (or allowed to,
   for a cactus bed), from the seeded PRNG.
2. For a twisted board: lay the sun patches and trellises, then choose which
   plants are the fern and the climber from the ones whose cells already obey
   them — a shaded cell for the fern, a trellis cell for the climber.
3. Grow the beds out from the plants, at random, until they fill the plot.
4. **Repair.** While the board has a second answer (counting with the twist
   rules on), take a cell that the second answer uses and the first doesn't,
   and hand it to a neighbouring bed — keeping every bed in one piece and never
   moving a cell the real answer uses. If no move helps, start again from 1.
5. **Check, and throw away rather than adjust,** unless:
   - the reasoning solver finishes it with the techniques the size allows;
   - for a twisted board, it has more than one answer with the twists off;
   - no bed is a single cell (a free answer, no thought in it).
6. The player sees the beds, the twisted beds' plants, the sun patches and
   the trellises. Never the answer.

### Sizes

| board | size | allowed up to | twists |
|---|---|---|---|
| **Seedling** | 5 × 5 | confine | none |
| **Border** | 7 × 7 | crowding | one |
| **Allotment** | 9 × 9 | pigeonhole | two |

### The daily board

One board a day, the same for everyone, off the harness's shared epoch with
Elbow Room's own seed multiplier. **7 × 7, one twist**, rotating through
cactus, fern and climber so a regular sees all three in a week.

The daily is made from its seed in the browser, which means **any change to
the generator changes every future daily** (past ones are already played).
The generator therefore carries a version, the seed includes it, and a test
pins the first board of the current version so a change can't slip through
unnoticed.

---

## 4. Playing it

**Controls.** Tap a cell to cycle it: **empty → bare-soil marker → plant →
empty**. The marker is a small dot meaning "nothing can grow here" — most of
the solving is marking, not planting, so it gets the first tap. A
**Plant / Mark** switch above the board turns taps into one or the other for
anyone who prefers that. Long-press isn't used; it's unreliable on the web.

**Nothing is ever lost.** No hearts, no timer, no mistakes counted. This is
where Elbow Room parts from Meowdoku on purpose — it takes away three lives;
here a clash is shown, not punished:

| clash | shows |
|---|---|
| two plants touching | both droop, a line joins them, "too close" |
| two in a row, column or bed | that line or bed outlined, "one per row" (or column, or bed) |
| fern in the sun | the fern wilts, "too much sun" |
| climber with no trellis | the climber flops, "nothing to climb" |

Every state carries a word and an icon, never colour alone.

**Help, if wanted.**
- **Tidy up** (off by default): planting marks the cells it rules out.
- **A nudge**: the reasoning solver finds the next single deduction and
  highlights where it is — "look at bed E" — without placing anything. Using
  it is not recorded anywhere; the house rules have no scores to dock.

**Undo** steps back one tap; **Clear** empties the board, with a confirm.

**The end card**: the board, filled; "Room for everyone"; the streak; and, on
the daily, the share line.

**The share line**, spoiler-free, the shape the Trickle share card is going to
take:

```
Elbow Room · 4 Oct · 7×7 🌿
Room for everyone, no nudges
plantparlour.org/parlour-games/elbow-room
```

---

## 5. Practice board

The 5 × 5 in §1, fixed and the same for everyone: one answer, solved with
singles and confinement only, no bed smaller than two cells. Verified by
exhaustive count and by the reasoning solver.

A **twist practice** follows it the first time each twist appears: a 5 × 5
built around just that plant, with one line explaining it ("Ferns stay out of
the sun patches").

---

## 6. What it shares with Trickle and Windowsill

Everything that is not the puzzle, out of `public/parlour-games/harness.js`:

- the seeded daily board and the shared epoch;
- the streak — **one streak across all of Parlour Games**;
- progress sync through `game_progress`, keyed `(user_id, "elbow-room")`;
- night mode, the sound engine, the storage wrappers;
- hub chrome, the back link, the embed build.

Elbow Room adds **no new table and no migration**, like Windowsill.

The rules live in `public/parlour-games/elbow-room-rules.js` beside
`windowsill-rules.js`, with a `.d.ts` and tests run by `npm test`.

---

## 7. Look

The games' palette: aubergine page, plum card, gold, leaf green.

- **Beds** are told apart three ways at once: a fill colour, a light pattern
  (dots, stripes, hatching) and a thick border wherever two beds meet. Eight or
  nine beds are too many for colour alone, for anyone.
- **Plants** are one leafy silhouette for an ordinary plant, and three for the
  twists: a cactus, a fern frond, a trailing climber.
- **Sun patches** are warm gold light across the cell. **Trellises** are a
  lattice drawn along the cell edge.
- **The marker** is a small soil-coloured dot.

Plain SVG to start. Amanda drawing the plants is the refinement, not the
blocker — the same as Windowsill.

## 8. Accessibility

- Every bed has a pattern and borders as well as a colour; every clash has a
  word as well as an icon.
- Cells are at least 40 px at 9 × 9 on a 360 px phone — the Allotment board
  scrolls sideways before it shrinks below that.
- Fully playable by keyboard: arrows move a cursor, space cycles the cell,
  `p` / `m` switch Plant and Mark.
- Screen readers hear each cell as "row 3, column 5, bed C, sun patch, empty".
- Honours `prefers-reduced-motion`.

---

## 9. Build plan

Each step lands working and tested before the next starts.

1. **The rules module**: board model, the counting solver, the reasoning
   solver with named techniques, and tests — the practice board's one answer,
   each twist's rule, a guess-only board rejected.
2. **The generator**: placement, beds, repair, the checks in §3.5, the three
   sizes, twist placement. Re-run the §2 measurements from the real module and
   record them here.
3. **The page**: `/parlour-games/elbow-room` — board, controls, clashes, undo,
   the end card. Practice first for a new player.
4. **The daily board**, versioned seed, its pinned-board test.
5. **The streak and sync** through the harness.
6. **Nudge and Tidy up.**
7. **The hub entry, the smoke test and the embed** at
   `/parlour-games/elbow-room/embed`; sitemap and the games' SEO page copy.
8. **The share line**, once Trickle's share card has settled the shape.

## 10. Open questions

- **A fourth twist?** Candidates: a **succulent** that must sit *in* a sun
  patch (the fern's opposite, and good paired with it on one board); a **tall
  plant** whose bed shades the cells behind it.
- **Two plants per bed** on a 10 × 10 — the classic harder Star Battle —
  would need boards made ahead of time and shipped as a file, since making
  10 × 10 live takes over a second. Worth it only if the Allotment proves too
  easy for regulars.
- **Names on the sizes** — Seedling / Border / Allotment are placeholders.
