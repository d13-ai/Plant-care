"""
Reproduces every number in docs/windowsill-spec.md.

Windowsill's design rests on claims that are easy to get wrong by reasoning
and cheap to settle by counting: that the flat-sill light rule collapses to a
single column pattern, that the tiered rule does not, that the game only holds
together three tiers deep, and that a board's difficulty can be measured
rather than hoped for. This is where those claims were settled.

The real generator ships in JavaScript with the game (build step 2). This
stays as the record of how the shape of the game was chosen.

    python3 scripts/windowsill-model.py
"""
import itertools, random, statistics, time
from functools import lru_cache
from collections import Counter

MAX_LIGHT = 3
HEIGHTS = (1, 2, 3)
NEED = {3: "sun", 2: "bright", 1: "shade"}
TALL = {1: "low", 2: "mid", 3: "tall"}


def light_flat(hs, t):
    """First attempt: light drops by the HEIGHT of everything in front."""
    return max(0, MAX_LIGHT - sum(hs[:t]))


def light_tiered(hs, t):
    """What shipped: a stepped stand. A plant at tier u costs one level only
    if it overtops tier t's base, which a low plant at the front does not."""
    return max(0, MAX_LIGHT - sum(1 for u in range(t) if u + hs[u] > t))


def full_columns(D, rule=light_tiered, heights=HEIGHTS):
    """Every completely filled column of depth D, as ((need, height), ...)."""
    out = []
    for hs in itertools.product(heights, repeat=D):
        col = []
        for t, h in enumerate(hs):
            lit = rule(hs, t)
            if lit < 1:  # nothing wants no light at all
                col = None
                break
            col.append((lit, h))
        if col:
            out.append(tuple(col))
    return out


def solutions(W, D, pool, cols):
    """How many ways `pool` fills the shelf, counted UP TO COLUMN ORDER --
    sliding whole columns sideways is not a different answer to a player, and
    counting raw arrangements would flatter the model by a factor of W!."""
    types = sorted({p for c in cols for p in c})
    ti = {t: i for i, t in enumerate(types)}
    costs = [tuple(Counter(ti[p] for p in c).get(i, 0) for i in range(len(types))) for c in cols]
    target = tuple(Counter(ti[p] for p in pool).get(i, 0) for i in range(len(types)))

    @lru_cache(maxsize=None)
    def go(start, col, left):
        if col == W:
            return 1 if not any(left) else 0
        total = 0
        for i in range(start, len(costs)):
            if all(c <= l for c, l in zip(costs[i], left)):
                total += go(i, col + 1, tuple(l - c for l, c in zip(left, costs[i])))
        return total

    n = go(0, 0, target)
    go.cache_clear()
    return n


def deal(W, cols, rng):
    return [p for _ in range(W) for p in rng.choice(cols)]


print("Does the light rule admit more than one shape of column?\n")
print(f"  {'model':<28} {'full columns':>13} {'need patterns':>14}")
for label, rule, hs in [
    ("flat sill, heights 1-2", light_flat, (1, 2)),
    ("flat sill, heights 1-3", light_flat, (1, 2, 3)),
    ("tiered, heights 1-2", light_tiered, (1, 2)),
    ("tiered, heights 1-3", light_tiered, (1, 2, 3)),
]:
    cols = full_columns(3, rule, hs)
    print(f"  {label:<28} {len(cols):>13} {len({tuple(n for n, _ in c) for c in cols}):>14}")
print("\n  A flat sill gives one pattern -- (3, 2, 1) every time -- so the game")
print("  would be 'sort each column by need'. That is why the shelf is stepped.\n")

print("How tight is a board? (120 random boards per shape)\n")
print(f"  {'shelf':>7} {'plants':>7} {'median':>7} {'p90':>6} {'>50 solutions':>14}")
rng = random.Random(11)
for D in (3, 4):
    cols = full_columns(D)
    for W in (3, 4, 5):
        counts = sorted(solutions(W, D, deal(W, cols, rng), cols) for _ in range(120))
        p90 = counts[int(len(counts) * 0.9)]
        loose = sum(1 for c in counts if c > 50) * 100 // len(counts)
        print(f"  {W}x{D:<5} {W*D:>7} {statistics.median(counts):>7.0f} {p90:>6} {loose:>13}%")
print("\n  Four tiers is mush. The game is three tiers deep, three to five wide.\n")

print("Can difficulty be filtered rather than hoped for?\n")
for W, band in [(3, (2, 8)), (4, (4, 16)), (5, (8, 30))]:
    cols = full_columns(3)
    t0, kept, tried = time.time(), 0, 0
    while kept < 20:
        tried += 1
        if band[0] <= solutions(W, 3, deal(W, cols, rng), cols) <= band[1]:
            kept += 1
    per = (time.time() - t0) / tried * 1000
    print(f"  {W}x3 targeting {band[0]}-{band[1]} solutions: "
          f"{per:.1f}ms per candidate, {kept * 100 // tried}% accepted")
print("\n  Milliseconds, so the generator deals until the board is the difficulty")
print("  it was asked for. Difficulty stops being a guess.\n")

print("The practice board in section 5 has exactly one solution:\n")
cols = full_columns(3)
practice = (((3, 1), (3, 1), (3, 2)), ((3, 3), (2, 2), (1, 1)))
pool = [p for c in practice for p in c]
for i, c in enumerate(practice):
    print(f"  column {i + 1}, front to back: " + ", ".join(f"{NEED[n]}/{TALL[h]}" for n, h in c))
print("  tray: " + ", ".join(sorted(f"{NEED[n]}/{TALL[h]}" for n, h in pool)))
n = solutions(2, 3, pool, cols)
print(f"\n  solutions: {n}")
assert n == 1, f"the practice board is meant to be unique, found {n}"
print("  verified unique.")
