/**
 * Elbow Room's rules, kept apart from its page so they can be tested without
 * a browser. See docs/elbow-room-spec.md.
 *
 * A plot of N x N cells is divided into N beds. Place N plants: one to every
 * bed, one to every row and column, and no two touching -- not even corner to
 * corner. Rows and columns already keep plants from sitting side by side, so
 * "touching" only ever means the diagonal.
 *
 * Four beds can carry a twist, each one rule and each true of the plant:
 *   cactus     may touch its neighbours (they share a dish happily)
 *   fern       may not stand in a sun patch (direct sun scorches it)
 *   succulent  must stand in a sun patch (it stretches without it)
 *   climber    must stand by a trellis (it needs something to climb)
 *
 * Cells are numbered row by row: cell = row * n + col. A board is
 *   { n, beds[cell] -> bed, sun[cell] -> bool, trellis[cell] -> side|null,
 *     twists: { bed: kind }, answer: [cell per row], size, version }
 * and what the player has done is a string of n*n characters:
 *   "." empty, "x" marked bare, "p" planted.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ElbowRoomRules = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Bumped whenever generation changes. It is part of the daily seed, so a
     change to the generator changes future dailies on purpose, never by
     accident -- the pinned-board test fails until this moves. */
  var VERSION = 1;

  var KINDS = ["cactus", "fern", "climber", "succulent"];
  var TWIST_LINES = {
    cactus: "Cactus doesn't mind company: it may touch its neighbours.",
    fern: "Fern keeps out of the sun: never in a sun patch.",
    climber: "Climber needs something to climb: only by a trellis.",
    succulent: "Succulent needs the sun: only in a sun patch."
  };

  /* Difficulty is the hardest named deduction a board needs, in this order. */
  var TECHNIQUES = ["twist", "single", "confine", "crowding", "pigeonhole"];
  var rank = function (t) { return TECHNIQUES.indexOf(t); };

  var SIZES = [
    { key: "seedling", label: "Seedling", n: 5, twists: 0, min: "single", max: "confine" },
    { key: "border", label: "Border", n: 7, twists: 1, min: "crowding", max: "crowding" },
    { key: "allotment", label: "Allotment", n: 9, twists: 2, min: "crowding", max: "pigeonhole" }
  ];
  var sizeOf = function (key) { return SIZES.filter(function (s) { return s.key === key; })[0] || SIZES[1]; };

  function shuffle(list, rnd) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }
  var range = function (n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; };
  var rowOf = function (b, cell) { return Math.floor(cell / b.n); };
  var colOf = function (b, cell) { return cell % b.n; };

  /* ---------------------------------------------------------------- rules */

  function kindAt(b, cell) { return b.twists[b.beds[cell]] || null; }

  /** May a plant stand in this cell at all, as far as its bed's twist goes? */
  function allowedByTwist(b, cell) {
    var kind = kindAt(b, cell);
    if (kind === "fern") return !b.sun[cell];
    if (kind === "succulent") return !!b.sun[cell];
    if (kind === "climber") return !!b.trellis[cell];
    return true;
  }

  /** May plants in these two cells touch corner to corner? Only with a cactus. */
  function mayTouch(b, a, c) { return kindAt(b, a) === "cactus" || kindAt(b, c) === "cactus"; }

  /** Diagonal neighbours of a cell -- the only way two plants can touch. */
  function diagonals(b, cell) {
    var r = rowOf(b, cell), c = colOf(b, cell), out = [];
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (d) {
      var rr = r + d[0], cc = c + d[1];
      if (rr >= 0 && rr < b.n && cc >= 0 && cc < b.n) out.push(rr * b.n + cc);
    });
    return out;
  }

  function plantsIn(state) {
    var out = [];
    for (var i = 0; i < state.length; i++) if (state[i] === "p") out.push(i);
    return out;
  }

  /**
   * Everything wrong on the board right now, each with the cells to point at
   * and the words to say. Nothing here is a penalty; it is what the page
   * draws.
   */
  function clashes(b, state) {
    var out = [], plants = plantsIn(state);
    var byRow = {}, byCol = {}, byBed = {};
    plants.forEach(function (p) {
      (byRow[rowOf(b, p)] = byRow[rowOf(b, p)] || []).push(p);
      (byCol[colOf(b, p)] = byCol[colOf(b, p)] || []).push(p);
      (byBed[b.beds[p]] = byBed[b.beds[p]] || []).push(p);
    });
    Object.keys(byRow).forEach(function (k) { if (byRow[k].length > 1) out.push({ type: "row", index: +k, cells: byRow[k], words: "one per row" }); });
    Object.keys(byCol).forEach(function (k) { if (byCol[k].length > 1) out.push({ type: "col", index: +k, cells: byCol[k], words: "one per column" }); });
    Object.keys(byBed).forEach(function (k) { if (byBed[k].length > 1) out.push({ type: "bed", index: +k, cells: byBed[k], words: "one per bed" }); });
    plants.forEach(function (p) {
      diagonals(b, p).forEach(function (q) {
        if (q > p && state[q] === "p" && !mayTouch(b, p, q)) out.push({ type: "touch", cells: [p, q], words: "too close" });
      });
      var kind = kindAt(b, p);
      if (kind === "fern" && b.sun[p]) out.push({ type: "sun", cells: [p], words: "too much sun" });
      if (kind === "succulent" && !b.sun[p]) out.push({ type: "shade", cells: [p], words: "wants the sun" });
      if (kind === "climber" && !b.trellis[p]) out.push({ type: "climb", cells: [p], words: "nothing to climb" });
    });
    return out;
  }

  function isSolved(b, state) {
    return plantsIn(state).length === b.n && clashes(b, state).length === 0;
  }

  /* ------------------------------------------------------- counting solver */

  /**
   * Every answer, up to `limit`, as one column per row. Row by row, keeping
   * columns and beds unused, the twist rules on, and the diagonal clear of the
   * row above unless a cactus is involved. Pass { plain: true } to count as
   * if no bed had a twist -- which is how a twist is shown to matter.
   */
  function solutions(b, limit, opts) {
    var n = b.n, plain = !!(opts && opts.plain), lim = limit || 2;
    var board = plain ? { n: n, beds: b.beds, sun: b.sun, trellis: b.trellis, twists: {} } : b;
    var found = [], cols = [], colUsed = [], bedUsed = [];
    (function go(r) {
      if (found.length >= lim) return;
      if (r === n) { found.push(cols.slice()); return; }
      for (var c = 0; c < n; c++) {
        if (colUsed[c]) continue;
        var cell = r * n + c, bed = board.beds[cell];
        if (bedUsed[bed] || !allowedByTwist(board, cell)) continue;
        if (r > 0) {
          var above = (r - 1) * n + cols[r - 1];
          if (Math.abs(cols[r - 1] - c) === 1 && !mayTouch(board, above, cell)) continue;
        }
        colUsed[c] = bedUsed[bed] = true; cols.push(c);
        go(r + 1);
        cols.pop(); colUsed[c] = bedUsed[bed] = false;
      }
    })(0);
    return found;
  }

  /* ------------------------------------------------------ reasoning solver */

  /**
   * The units a deduction talks about: every row, column and bed, with its
   * cells and a name a person can follow.
   */
  function unitsOf(b) {
    var n = b.n, units = [];
    for (var k = 0; k < n; k++) {
      units.push({ kind: "row", index: k, cells: range(n).map(function (x) { return k * n + x; }) });
      units.push({ kind: "col", index: k, cells: range(n).map(function (y) { return y * n + k; }) });
      units.push({ kind: "bed", index: k, cells: range(n * n).filter(function (i) { return b.beds[i] === k; }) });
    }
    return units;
  }

  function unitName(u) {
    return u.kind === "row" ? "row " + (u.index + 1) : u.kind === "col" ? "column " + (u.index + 1) : "the highlighted bed";
  }

  /** The cells a plant here rules out: its row, column, bed and (cactus aside) its diagonals. */
  function shadowOf(b, cell) {
    var n = b.n, r = rowOf(b, cell), c = colOf(b, cell), out = {};
    for (var k = 0; k < n; k++) { out[r * n + k] = 1; out[k * n + c] = 1; }
    for (var i = 0; i < n * n; i++) if (b.beds[i] === b.beds[cell]) out[i] = 1;
    diagonals(b, cell).forEach(function (q) { if (!mayTouch(b, cell, q)) out[q] = 1; });
    delete out[cell];
    return Object.keys(out).map(Number);
  }

  /**
   * A fresh reasoning position: every cell a candidate, nothing planted.
   * `cand[cell]` is true while a plant could still go there.
   */
  function freshPosition(b) {
    var cand = [], placed = [];
    for (var i = 0; i < b.n * b.n; i++) { cand.push(true); placed.push(false); }
    return { cand: cand, placed: placed };
  }

  function plant(b, pos, cell) {
    pos.placed[cell] = true; pos.cand[cell] = false;
    shadowOf(b, cell).forEach(function (q) { pos.cand[q] = false; });
  }

  function combos(len, k) {
    var out = [];
    (function go(start, acc) {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (var i = start; i < len; i++) { acc.push(i); go(i + 1, acc); acc.pop(); }
    })(0, []);
    return out;
  }

  /**
   * The next thing a person could work out, or null. Returns the technique,
   * what it does (`plant` one cell, or `clear` some), the cells, the units
   * involved and a sentence. The solver and the nudge are the same code, so
   * a nudge can never point at something the difficulty rating didn't count.
   */
  function nextStep(b, pos, units) {
    var n = b.n, cand = pos.cand, placed = pos.placed;
    var done = function (u) { return u.cells.some(function (i) { return placed[i]; }); };
    var live = function (u) { return u.cells.filter(function (i) { return cand[i]; }); };

    /* Twist rules first: they rule cells out before any thinking. */
    for (var i = 0; i < n * n; i++) {
      if (cand[i] && !allowedByTwist(b, i)) {
        var kind = kindAt(b, i), bed = b.beds[i];
        var cells = range(n * n).filter(function (j) { return cand[j] && b.beds[j] === bed && !allowedByTwist(b, j); });
        var why = kind === "fern" ? "Ferns keep out of the sun, so the sun patches in this bed stay bare."
          : kind === "succulent" ? "Succulents need the sun, so the shaded cells in this bed stay bare."
          : "Climbers need a trellis, so the cells in this bed with nothing to climb stay bare.";
        return { technique: "twist", action: "clear", cells: cells, units: [{ kind: "bed", index: bed }], why: why };
      }
    }

    for (var a = 0; a < units.length; a++) {
      var u = units[a];
      if (done(u)) continue;
      var c = live(u);
      if (c.length === 0) return { technique: "stuck", action: "none", cells: [], units: [u], why: "There's no room left in " + unitName(u) + "." };
      if (c.length === 1) return { technique: "single", action: "plant", cells: c, units: [u], why: "There's only one place left in " + unitName(u) + "." };
    }

    for (var x = 0; x < units.length; x++) {
      var A = units[x];
      if (done(A)) continue;
      var inA = live(A);
      for (var y = 0; y < units.length; y++) {
        var B = units[y];
        if (B.kind === A.kind || done(B)) continue;
        var inB = {}; B.cells.forEach(function (q) { inB[q] = 1; });
        if (!inA.every(function (q) { return inB[q]; })) continue;
        var setA = {}; inA.forEach(function (q) { setA[q] = 1; });
        var clear = B.cells.filter(function (q) { return cand[q] && !setA[q]; });
        if (clear.length) {
          return {
            technique: "confine", action: "clear", cells: clear, units: [A, B],
            why: "Everything left in " + unitName(A) + " is in " + unitName(B) + ", so the rest of " + unitName(B) + " stays bare."
          };
        }
      }
    }

    for (var j = 0; j < n * n; j++) {
      if (!cand[j]) continue;
      var gone = {}; shadowOf(b, j).forEach(function (q) { gone[q] = 1; }); gone[j] = 1;
      for (var w = 0; w < units.length; w++) {
        var U = units[w];
        if (done(U) || U.cells.indexOf(j) >= 0) continue;
        if (live(U).every(function (q) { return gone[q]; })) {
          return {
            technique: "crowding", action: "clear", cells: [j], units: [U],
            why: "A plant here would leave no room at all in " + unitName(U) + "."
          };
        }
      }
    }

    var pairs = [["bed", "row"], ["bed", "col"], ["row", "bed"], ["col", "bed"]];
    for (var p = 0; p < pairs.length; p++) {
      var As = units.filter(function (u) { return u.kind === pairs[p][0] && !done(u); });
      var Bs = units.filter(function (u) { return u.kind === pairs[p][1] && !done(u); });
      var whichB = function (cell) { for (var t = 0; t < Bs.length; t++) if (Bs[t].cells.indexOf(cell) >= 0) return t; return -1; };
      var covers = As.map(function (u) { var s = {}; live(u).forEach(function (q) { s[whichB(q)] = 1; }); return Object.keys(s).map(Number); });
      for (var k = 2; k <= 3; k++) {
        var cs = combos(As.length, k);
        for (var m = 0; m < cs.length; m++) {
          var union = {};
          cs[m].forEach(function (ai) { covers[ai].forEach(function (bi) { union[bi] = 1; }); });
          var bis = Object.keys(union).map(Number);
          if (bis.length !== k || bis.indexOf(-1) >= 0) continue;
          var mine = {}; cs[m].forEach(function (ai) { As[ai].cells.forEach(function (q) { mine[q] = 1; }); });
          var out = [];
          bis.forEach(function (bi) { Bs[bi].cells.forEach(function (q) { if (cand[q] && !mine[q]) out.push(q); }); });
          if (out.length) {
            var named = cs[m].map(function (ai) { return As[ai]; });
            var into = bis.map(function (bi) { return Bs[bi]; });
            var noun = pairs[p][0] === "bed" ? "beds" : pairs[p][0] === "row" ? "rows" : "columns";
            var into2 = pairs[p][1] === "bed" ? "beds" : pairs[p][1] === "row" ? "rows" : "columns";
            return {
              technique: "pigeonhole", action: "clear", cells: out, units: named.concat(into),
              why: "These " + k + " " + noun + " only fit in these " + k + " " + into2 + " between them, so nothing else in those " + into2 + " can grow."
            };
          }
        }
      }
    }
    return null;
  }

  function applyStep(b, pos, step) {
    if (step.action === "plant") plant(b, pos, step.cells[0]);
    else step.cells.forEach(function (q) { pos.cand[q] = false; });
  }

  /**
   * Solve like a person. `hardest` is the hardest technique the board
   * needed; `solved` is false when reasoning ran out before the board was
   * full -- a board like that would need a guess, and is never dealt.
   */
  function reason(b) {
    var pos = freshPosition(b), units = unitsOf(b), hardest = "twist", steps = 0, step;
    while ((step = nextStep(b, pos, units))) {
      if (step.technique === "stuck") return { solved: false, hardest: hardest, steps: steps };
      if (rank(step.technique) > rank(hardest)) hardest = step.technique;
      applyStep(b, pos, step); steps++;
    }
    var count = pos.placed.filter(Boolean).length;
    return { solved: count === b.n, hardest: hardest, steps: steps };
  }

  /**
   * A nudge: the next deduction from where the player actually is.
   *
   * Only what the player has got right is believed -- plants on the answer,
   * marks off it -- so a nudge never builds on a mistake. If they have planted
   * somewhere the answer isn't, the nudge says which plant has to move
   * instead, because no amount of reasoning gets past it.
   */
  function nudge(b, state) {
    var n = b.n, answer = {};
    b.answer.forEach(function (c, r) { answer[r * n + c] = 1; });
    for (var i = 0; i < n * n; i++) {
      if (state[i] === "p" && !answer[i]) {
        return { technique: "wrong", action: "move", cells: [i], units: [], why: "This plant can't stay here. Try working out where else it could go." };
      }
    }
    var pos = freshPosition(b), units = unitsOf(b);
    for (var j = 0; j < n * n; j++) if (state[j] === "p") plant(b, pos, j);
    for (var k = 0; k < n * n; k++) if (state[k] === "x" && !answer[k]) pos.cand[k] = false;
    var step;
    while ((step = nextStep(b, pos, units))) {
      if (step.technique === "stuck") return null;
      /* Skip what the player already shows: a plant already in, or cells
         already marked. Otherwise this is the thing to say. */
      var news = step.cells.filter(function (q) { return step.action === "plant" ? state[q] !== "p" : state[q] !== "x"; });
      if (news.length) return step;
      applyStep(b, pos, step);
    }
    return null;
  }

  /* --------------------------------------------------------- the generator */

  /** One plant per row and column, none touching, except that a cactus row may. */
  function placement(n, rnd, cactusRow) {
    var cols = [], used = [];
    var ok = function (r, c) {
      if (used[c]) return false;
      if (r === 0) return true;
      var near = Math.abs(cols[r - 1] - c) === 1;
      return !near || r === cactusRow || r - 1 === cactusRow;
    };
    return (function go(r) {
      if (r === n) return true;
      var order = shuffle(range(n), rnd);
      for (var i = 0; i < order.length; i++) {
        var c = order[i];
        if (!ok(r, c)) continue;
        cols.push(c); used[c] = true;
        if (go(r + 1)) return true;
        cols.pop(); used[c] = false;
      }
      return false;
    })(0) ? cols : null;
  }

  /** Sun falls through a window along the top: deeper in some columns than others. */
  function laySun(n, rnd) {
    var sun = [], depth = 1 + Math.floor(rnd() * Math.ceil(n / 2));
    for (var c = 0; c < n; c++) {
      depth = Math.max(1, Math.min(Math.ceil(n / 2), depth + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.6 ? 1 : 0)));
      for (var r = 0; r < n; r++) sun[r * n + c] = r < depth;
    }
    return sun;
  }

  /** Trellis along two garden walls, in runs. Stored per cell as the side it is on. */
  function layTrellis(n, rnd) {
    var trellis = []; for (var i = 0; i < n * n; i++) trellis.push(null);
    var walls = shuffle(["left", "right", "bottom"], rnd).slice(0, 2);
    walls.forEach(function (wall) {
      var len = Math.ceil(n / 2) + Math.floor(rnd() * Math.ceil(n / 3));
      var start = Math.floor(rnd() * (n - len + 1));
      for (var k = start; k < start + len; k++) {
        var cell = wall === "left" ? k * n : wall === "right" ? k * n + n - 1 : (n - 1) * n + k;
        if (!trellis[cell]) trellis[cell] = wall;
      }
    });
    return trellis;
  }

  function growBeds(n, cols, rnd) {
    var beds = []; for (var i = 0; i < n * n; i++) beds.push(-1);
    cols.forEach(function (c, r) { beds[r * n + c] = r; });
    var left = n * n - n, guard = 0;
    while (left > 0 && guard++ < 100000) {
      var bed = Math.floor(rnd() * n), opts = [];
      for (var cell = 0; cell < n * n; cell++) {
        if (beds[cell] !== bed) continue;
        var r = Math.floor(cell / n), c = cell % n;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var rr = r + d[0], cc = c + d[1];
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && beds[rr * n + cc] === -1) opts.push(rr * n + cc);
        });
      }
      if (!opts.length) continue;
      beds[opts[Math.floor(rnd() * opts.length)]] = bed;
      left--;
    }
    return beds;
  }

  function connected(n, beds, bed) {
    var cells = [];
    for (var i = 0; i < n * n; i++) if (beds[i] === bed) cells.push(i);
    if (!cells.length) return false;
    var seen = {}, stack = [cells[0]], count = 1; seen[cells[0]] = 1;
    while (stack.length) {
      var cell = stack.pop(), r = Math.floor(cell / n), c = cell % n;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var rr = r + d[0], cc = c + d[1], j = rr * n + cc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && beds[j] === bed && !seen[j]) { seen[j] = 1; count++; stack.push(j); }
      });
    }
    return count === cells.length;
  }

  /** Which rows' plants can carry which twist, given where the answer put them. */
  function assignTwists(n, cols, sun, trellis, kinds, cactusRow, rnd) {
    var taken = {}, out = {};
    for (var k = 0; k < kinds.length; k++) {
      var kind = kinds[k], fits = [];
      for (var r = 0; r < n; r++) {
        if (taken[r]) continue;
        var cell = r * n + cols[r];
        if (kind === "cactus" ? r === cactusRow
          : kind === "fern" ? !sun[cell]
          : kind === "succulent" ? !!sun[cell]
          : !!trellis[cell]) fits.push(r);
      }
      if (!fits.length) return null;
      var pick = fits[Math.floor(rnd() * fits.length)];
      taken[pick] = 1; out[pick] = kind;
    }
    return out;
  }

  /**
   * Make a board. Every board it returns has exactly one answer, can be
   * finished by reasoning alone within the size's band, has no single-cell
   * bed, and -- if it has twists -- needs them: with the twists switched off
   * it would not have this one answer.
   */
  function generate(sizeKey, rnd, opts) {
    var size = sizeOf(sizeKey), n = size.n;
    var kinds = (opts && opts.twists) || shuffle(KINDS.slice(), rnd).slice(0, size.twists);
    for (var attempt = 0; attempt < 400; attempt++) {
      var cactusRow = kinds.indexOf("cactus") >= 0 ? Math.floor(rnd() * n) : -1;
      var cols = placement(n, rnd, cactusRow);
      if (!cols) continue;
      /* A cactus only matters if it actually touches somebody. */
      if (cactusRow >= 0) {
        var touches = (cactusRow > 0 && Math.abs(cols[cactusRow - 1] - cols[cactusRow]) === 1) ||
          (cactusRow < n - 1 && Math.abs(cols[cactusRow + 1] - cols[cactusRow]) === 1);
        if (!touches) continue;
      }
      var sun = laySun(n, rnd), trellis = layTrellis(n, rnd);
      var rowsTwist = assignTwists(n, cols, sun, trellis, kinds, cactusRow, rnd);
      if (!rowsTwist) continue;
      var beds = growBeds(n, cols, rnd), twists = {};
      Object.keys(rowsTwist).forEach(function (r) { twists[r] = rowsTwist[r]; });
      var b = { n: n, beds: beds, sun: sun, trellis: trellis, twists: twists, answer: cols, size: size.key, version: VERSION };
      var answerCells = {}; cols.forEach(function (c, r) { answerCells[r * n + c] = 1; });

      var unique = false;
      for (var step = 0; step < 600; step++) {
        var sols = solutions(b, 2);
        if (sols.length === 1) { unique = true; break; }
        var other = sols.filter(function (s) { return s.some(function (c, r) { return c !== cols[r]; }); })[0];
        if (!other) break;
        var cand = shuffle(other.map(function (c, r) { return r * n + c; }).filter(function (q) { return !answerCells[q]; }), rnd);
        var moved = false;
        for (var ci = 0; ci < cand.length && !moved; ci++) {
          var q = cand[ci], from = beds[q], r0 = Math.floor(q / n), c0 = q % n;
          var nbrs = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]].map(function (d) { return [r0 + d[0], c0 + d[1]]; })
            .filter(function (p) { return p[0] >= 0 && p[0] < n && p[1] >= 0 && p[1] < n; })
            .map(function (p) { return beds[p[0] * n + p[1]]; })
            .filter(function (to) { return to !== from; }), rnd);
          for (var ni = 0; ni < nbrs.length; ni++) {
            beds[q] = nbrs[ni];
            if (connected(n, beds, from)) { moved = true; break; }
            beds[q] = from;
          }
        }
        if (!moved) break;
      }
      if (!unique) continue;

      var sizes = range(n).map(function (k) { return beds.filter(function (x) { return x === k; }).length; });
      if (Math.min.apply(null, sizes) < 2) continue;
      if (kinds.length) {
        var plain = solutions(b, 2, { plain: true });
        if (plain.length === 1 && plain[0].every(function (c, r) { return c === cols[r]; })) continue;
      }
      var how = reason(b);
      if (!how.solved || rank(how.hardest) < rank(size.min) || rank(how.hardest) > rank(size.max)) continue;
      b.hardest = how.hardest;
      b.attempts = attempt + 1;
      return b;
    }
    return null;
  }

  /* ------------------------------------------------------ fixed boards */

  /** Turn a picture of a board into one. Upper case is a bed, lower case is
   *  that bed's plant. Used for the practice board and in tests. */
  function fromPicture(rows, extra) {
    var n = rows.length, beds = [], answer = [];
    rows.forEach(function (line, r) {
      line.split(/\s+/).forEach(function (ch, c) {
        beds.push(ch.toUpperCase().charCodeAt(0) - 65);
        if (ch !== ch.toUpperCase()) answer[r] = c;
      });
    });
    var sun = [], trellis = [];
    for (var i = 0; i < n * n; i++) { sun.push(false); trellis.push(null); }
    var b = { n: n, beds: beds, sun: sun, trellis: trellis, twists: {}, answer: answer, size: "practice", version: VERSION };
    if (extra) Object.keys(extra).forEach(function (k) { b[k] = extra[k]; });
    return b;
  }

  /* Two ways in, both confinement: bed C runs straight down column 1, and
     bed E is two cells in the bottom row. See docs/elbow-room-spec.md, section 1. */
  var PRACTICE = fromPicture([
    "C A A A a",
    "C B b A A",
    "c B B B A",
    "C B D d A",
    "E e D D D"
  ]);

  /* Meeting each twist: a small board built around just that plant, from a
     fixed seed so it is the same for everybody. */
  var MEET_SEEDS = { cactus: 11, fern: 12, climber: 13, succulent: 14 };

  /* ------------------------------------------------------------- the day */

  var DAILY_SEED = 7907;
  function dailyTwist(day) { return KINDS[((day % KINDS.length) + KINDS.length) % KINDS.length]; }
  function dailySeed(day) { return (day * DAILY_SEED + VERSION * 1000003) >>> 0; }

  /* --------------------------------------------------------- progress */

  function emptyProgress() { return { done: 0, bySize: {}, nudgeFree: 0, daily: null }; }

  function laterDaily(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if ((a.num | 0) !== (b.num | 0)) return (a.num | 0) > (b.num | 0) ? a : b;
    if (!!a.done !== !!b.done) return a.done ? a : b;
    var count = function (d) { return String(d.state || "").replace(/[^p]/g, "").length; };
    return count(b) > count(a) ? b : a;
  }

  /** Signing in never makes things worse: counts take the larger, the later
   *  daily wins, and a size only one side has played survives. */
  function mergeProgress(local, remote) {
    if (!remote) return local;
    var big = function (x, y) { return Math.max(x | 0, y | 0); };
    var out = {
      done: big(local.done, remote.done),
      nudgeFree: big(local.nudgeFree, remote.nudgeFree),
      bySize: {},
      daily: laterDaily(local.daily, remote.daily)
    };
    var keys = {};
    Object.keys(local.bySize || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(remote.bySize || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) { out.bySize[k] = big((local.bySize || {})[k], (remote.bySize || {})[k]); });
    return out;
  }

  /** What a screen reader says for one cell. */
  function describeCell(b, state, cell) {
    var parts = ["row " + (rowOf(b, cell) + 1), "column " + (colOf(b, cell) + 1), "bed " + String.fromCharCode(65 + b.beds[cell])];
    var kind = kindAt(b, cell);
    if (kind) parts.push(kind + " bed");
    /* Only what a plant on this board cares about: a sun patch on a board
       with no fern or succulent is not a rule, and saying it suggests one. */
    var kinds = Object.keys(b.twists).map(function (k) { return b.twists[k]; });
    if (b.sun[cell] && (kinds.indexOf("fern") >= 0 || kinds.indexOf("succulent") >= 0)) parts.push("sun patch");
    if (b.trellis[cell] && kinds.indexOf("climber") >= 0) parts.push("trellis");
    parts.push(state[cell] === "p" ? "planted" : state[cell] === "x" ? "marked bare" : "empty");
    return parts.join(", ");
  }

  return {
    VERSION: VERSION,
    KINDS: KINDS,
    TWIST_LINES: TWIST_LINES,
    TECHNIQUES: TECHNIQUES,
    SIZES: SIZES,
    PRACTICE: PRACTICE,
    MEET_SEEDS: MEET_SEEDS,
    sizeOf: sizeOf,
    shuffle: shuffle,
    allowedByTwist: allowedByTwist,
    shadowOf: shadowOf,
    mayTouch: mayTouch,
    clashes: clashes,
    isSolved: isSolved,
    solutions: solutions,
    reason: reason,
    nudge: nudge,
    generate: generate,
    fromPicture: fromPicture,
    dailyTwist: dailyTwist,
    dailySeed: dailySeed,
    emptyProgress: emptyProgress,
    laterDaily: laterDaily,
    mergeProgress: mergeProgress,
    describeCell: describeCell
  };
});
