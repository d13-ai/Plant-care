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

  /** The light reaching every tier of one run, window first. */
  function lightsFor(run) {
    return run.map(function (_, t) {
      var blocked = 0;
      for (var u = 0; u < t; u++) if (overtops(run[u], u, t)) blocked += 1;
      return Math.max(0, MAX_LIGHT - blocked);
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
    lightsFor: lightsFor,
    stateOf: stateOf,
    shelfStates: shelfStates,
    shelfLights: shelfLights,
    isSolved: isSolved,
    fullRuns: fullRuns,
    describe: describe
  };
});
