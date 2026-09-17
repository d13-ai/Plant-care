/**
 * Windowsill's rules, kept apart from its page so they can be tested without
 * a browser.
 *
 * The shelf is a stepped stand in a window. Light comes in horizontally from
 * the window and every cell starts at MAX. A plant at tier t with height h
 * stands from t to t + h, and it shades a plant behind it only when it
 * OVERTOPS that plant's base -- t + h > t'. Each plant that overtops you
 * costs one level.
 *
 * That "overtops" is the whole game, and it is why the stand is stepped: a
 * low plant at the front stands from 0 to 1, and the tier behind it starts at
 * 1, so it shades nothing. A tall one at the front shades two rows back. The
 * flat version of this rule -- light dropping by the height of whatever is in
 * front -- admits exactly one shape of filled run, (3, 2, 1) every time, which
 * makes the game "sort by need" and no game at all. See docs/windowsill-spec.md,
 * section 2, and scripts/windowsill-model.py for the counts.
 *
 * A plant is happy only when the light it gets EXACTLY equals what it wants.
 * Too much scorches, too little goes leggy. Both being wrong is what stops
 * this being a sorting exercise.
 *
 * A "run" is one line of cells from the window backwards -- index 0 nearest
 * the glass. A shelf is an array of runs. An empty cell is null and shades
 * nothing.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WindowsillRules = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Full sun, at the glass with nothing in front. Also the largest need. */
  var MAX_LIGHT = 3;

  var NEEDS = { 3: "sun", 2: "bright", 1: "shade" };
  var HEIGHTS = { 1: "low", 2: "mid", 3: "tall" };

  /** Does the plant at tier `t` overtop the base of tier `behind`? */
  function overtops(plant, t, behind) {
    return !!plant && t + plant.height > behind;
  }

  /**
   * Which plants in a run are taking light off tier `t` -- their indices,
   * nearest the glass first. Empty when nothing is.
   *
   * The count of these is what lightsFor subtracts, so the two cannot drift;
   * this exists because "your light is 2" is a fact and "the tall one at the
   * front is taking a level off you" is an explanation, and practice needs
   * the second one.
   */
  function blockersOf(run, t) {
    var out = [];
    for (var u = 0; u < t; u++) if (overtops(run[u], u, t)) out.push(u);
    return out;
  }

  /** The light reaching every tier of one run, window first. */
  function lightsFor(run) {
    return run.map(function (_, t) {
      return Math.max(0, MAX_LIGHT - blockersOf(run, t).length);
    });
  }

  /**
   * How a plant is doing in the light it is getting. `null` for an empty
   * cell, so callers can map straight over a run.
   */
  function stateOf(plant, light) {
    if (!plant) return null;
    if (light === plant.need) return "happy";
    return light > plant.need ? "scorching" : "leggy";
  }

  /** Every cell's state, shelf-shaped. */
  function shelfStates(shelf) {
    return shelf.map(function (run) {
      var lights = lightsFor(run);
      return run.map(function (plant, t) { return stateOf(plant, lights[t]); });
    });
  }

  /** Every cell's light, shelf-shaped. */
  function shelfLights(shelf) {
    return shelf.map(lightsFor);
  }

  /**
   * Solved when the shelf is full and nothing on it is unhappy. Full matters:
   * the board is dealt with exactly as many plants as cells, and a gap would
   * let the rest slide about behind it.
   */
  function isSolved(shelf) {
    return shelf.every(function (run, i) {
      var lights = lightsFor(run);
      return run.every(function (plant, t) {
        return !!plant && stateOf(plant, lights[t]) === "happy";
      });
    });
  }

  /**
   * Every completely filled run of depth `d` that works, as arrays of
   * {need, height}. The generator deals from these; the tests count them.
   */
  function fullRuns(d) {
    var out = [];
    (function walk(run) {
      if (run.length === d) { out.push(run.slice()); return; }
      var t = run.length;
      var blocked = 0;
      for (var u = 0; u < t; u++) if (overtops(run[u], u, t)) blocked += 1;
      var light = Math.max(0, MAX_LIGHT - blocked);
      /* Nothing wants darkness, so a run that reaches zero cannot be filled
         any further and is not a full run. */
      if (light < 1) return;
      [1, 2, 3].forEach(function (height) {
        run.push({ need: light, height: height });
        walk(run);
        run.pop();
      });
    })([]);
    return out;
  }

  /* ---- dealing a board ------------------------------------------------- */

  /* Nine kinds of plant: three needs by three heights. Counting them as a
     vector is what makes the solution counter quick enough to run on a phone
     while the page is loading. */
  var KINDS = 9;
  function kindOf(plant) { return (plant.need - 1) * 3 + (plant.height - 1); }
  function tally(plants) {
    var v = new Array(KINDS).fill(0);
    plants.forEach(function (p) { v[kindOf(p)] += 1; });
    return v;
  }

  /**
   * How many ways `pool` fills a shelf `w` runs wide and `d` deep, counted
   * UP TO THE ORDER OF THE RUNS -- sliding whole runs up and down the shelf
   * is not a different answer to anyone looking at it, and counting ordered
   * arrangements would flatter every board by a factor of w!.
   *
   * Runs are drawn in non-decreasing index order, which visits each
   * unordered shelf exactly once.
   */
  function countSolutions(w, d, pool, runs) {
    runs = runs || fullRuns(d);
    var costs = runs.map(tally);
    var memo = new Map();

    function go(from, placed, left) {
      if (placed === w) return left.every(function (n) { return n === 0; }) ? 1 : 0;
      var key = from + "|" + placed + "|" + left.join(",");
      var hit = memo.get(key);
      if (hit !== undefined) return hit;
      var total = 0;
      for (var i = from; i < costs.length; i++) {
        var cost = costs[i], ok = true;
        for (var k = 0; k < KINDS; k++) if (cost[k] > left[k]) { ok = false; break; }
        if (!ok) continue;
        for (k = 0; k < KINDS; k++) left[k] -= cost[k];
        total += go(i, placed + 1, left);
        for (k = 0; k < KINDS; k++) left[k] += cost[k];
      }
      memo.set(key, total);
      return total;
    }

    return go(0, 0, tally(pool));
  }

  /** The same search, but keeping the arrangements -- up to `limit` of them. */
  function solutions(w, d, pool, limit, runs) {
    runs = runs || fullRuns(d);
    limit = limit || 50;
    var costs = runs.map(tally), out = [], chosen = [];

    (function go(from, left) {
      if (out.length >= limit) return;
      if (chosen.length === w) {
        if (left.every(function (n) { return n === 0; })) {
          out.push(chosen.map(function (r) { return r.map(function (p) { return { need: p.need, height: p.height }; }); }));
        }
        return;
      }
      for (var i = from; i < costs.length && out.length < limit; i++) {
        var cost = costs[i], ok = true;
        for (var k = 0; k < KINDS; k++) if (cost[k] > left[k]) { ok = false; break; }
        if (!ok) continue;
        for (k = 0; k < KINDS; k++) left[k] -= cost[k];
        chosen.push(runs[i]);
        go(i, left);
        chosen.pop();
        for (k = 0; k < KINDS; k++) left[k] += cost[k];
      }
    })(0, tally(pool));

    return out;
  }

  /**
   * The shapes the game is played at, and how many ways out each should have.
   *
   * Both halves are measured rather than chosen by feel. Three tiers deep is
   * the only depth that works: at four, the median board has 104 answers at
   * 4x4 and 900 at 5x4, which is fidgeting rather than thinking. The bands
   * are the middle of what each width deals naturally, so a board is never
   * a walk and never a haystack. scripts/windowsill-model.py has the counts.
   */
  var SHELVES = [
    { key: "gentle", label: "Gentle", w: 3, d: 3, band: [2, 8] },
    { key: "standard", label: "Standard", w: 4, d: 3, band: [4, 16] },
    { key: "deep", label: "Deep end", w: 5, d: 3, band: [8, 30] }
  ];

  /**
   * The practice board. Fixed, the same for everybody, and it has EXACTLY ONE
   * solution -- asserted by exhaustive count in the tests, and arrived at
   * independently by scripts/windowsill-model.py.
   *
   * Chosen to teach both halves of the rule in one board. One run is three
   * sun-lovers stacked, none of which shades another, because a low plant
   * stands exactly as high as the step behind it. The other puts the tall
   * plant at the glass, where it overtops both rows behind and steps the
   * light down 3, 2, 1. Somebody who has solved this knows the whole game.
   *
   * The tray is in a fixed order too: shuffling it would make the practice
   * board different for different people, and the coaching is written for
   * this one.
   */
  var PRACTICE = {
    w: 2,
    d: 3,
    tray: [
      { need: 3, height: 2 }, { need: 1, height: 1 }, { need: 3, height: 1 },
      { need: 2, height: 2 }, { need: 3, height: 3 }, { need: 3, height: 1 }
    ]
  };

  /** Fisher-Yates, off the caller's generator so a board can be reproduced. */
  function shuffle(list, rnd) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /**
   * Deal a board of a given shape.
   *
   * A solution is planted first and then forgotten -- the player is handed
   * only the plants -- so every board is solvable by construction. Then the
   * ways out are counted, and a board outside the band is thrown away and
   * another dealt. Counting costs a few milliseconds, which is what makes
   * difficulty something set rather than hoped for.
   *
   * It always returns a board. If the band cannot be hit inside `tries` the
   * nearest candidate is kept, because handing somebody a slightly easy
   * puzzle is better than handing them nothing.
   */
  function deal(shelf, rnd, tries) {
    var runs = fullRuns(shelf.d);
    var band = shelf.band, best = null, bestMiss = Infinity;
    tries = tries || 60;
    for (var attempt = 0; attempt < tries; attempt++) {
      var chosen = [];
      for (var i = 0; i < shelf.w; i++) chosen.push(runs[Math.floor(rnd() * runs.length)]);
      var pool = [];
      chosen.forEach(function (run) {
        run.forEach(function (p) { pool.push({ need: p.need, height: p.height }); });
      });
      var ways = countSolutions(shelf.w, shelf.d, pool, runs);
      var miss = ways < band[0] ? band[0] - ways : ways > band[1] ? ways - band[1] : 0;
      if (miss === 0) {
        return { w: shelf.w, d: shelf.d, tray: shuffle(pool, rnd), ways: ways, tries: attempt + 1 };
      }
      if (miss < bestMiss) { bestMiss = miss; best = { pool: pool, ways: ways, tries: attempt + 1 }; }
    }
    return { w: shelf.w, d: shelf.d, tray: shuffle(best.pool, rnd), ways: best.ways, tries: best.tries, missed: true };
  }

  /** For labels and for anything a screen reader has to say out loud. */
  function describe(plant) {
    if (!plant) return "empty";
    return NEEDS[plant.need] + ", " + HEIGHTS[plant.height];
  }

  return {
    MAX_LIGHT: MAX_LIGHT,
    NEEDS: NEEDS,
    HEIGHTS: HEIGHTS,
    overtops: overtops,
    blockersOf: blockersOf,
    lightsFor: lightsFor,
    stateOf: stateOf,
    shelfStates: shelfStates,
    shelfLights: shelfLights,
    isSolved: isSolved,
    fullRuns: fullRuns,
    countSolutions: countSolutions,
    solutions: solutions,
    SHELVES: SHELVES,
    PRACTICE: PRACTICE,
    shuffle: shuffle,
    deal: deal,
    describe: describe
  };
});
