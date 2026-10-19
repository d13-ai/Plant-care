/**
 * Forget-Me-Not's rules, kept apart from its page so they can be tested
 * without a browser.
 *
 * Pairs, the memory game: every plant on the table is there twice, face
 * down. Turn two cards; a pair stays face up, anything else waits face up
 * until the next tap and then turns back. Find every pair.
 *
 * The house rules shape three choices. There is no clock -- a pair that
 * doesn't match stays showing until the player taps again, never on a timer,
 * so nobody has to memorise against the clock. Nothing is lost -- a wrong
 * pair costs nothing but a turn. And the only number, turns taken, is shown
 * when the table is cleared, not counted down while it is being played.
 *
 * A board is
 *   { size, cols, rows, cards: [kind key per card], version }
 * and what the player has done is
 *   { cards: string, up: [card...], turns }
 * where each character of `cards` is "." never turned, "s" seen and turned
 * back, or "m" matched; `up` holds the card or two showing right now.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ForgetMeNotRules = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Bumped whenever dealing changes. It is part of the daily seed, so a
     change to the deal changes future dailies on purpose, never by accident
     -- the pinned-board test fails until this moves. */
  var VERSION = 1;

  /* The pot every potted plant stands in, drawn the same each time so the
     plant above it is the only thing that differs. */
  var POT = '<path fill="#A2755C" d="M13 31h14l-2 7H15z"/><rect x="12" y="29" width="16" height="3" rx="1" fill="#8A5F49"/>';
  var svg = function (body) { return '<svg viewBox="0 0 40 40" aria-hidden="true">' + body + "</svg>"; };

  /*
   * Seventeen plants, each drawn to be told apart by shape before colour,
   * and named on the card, so nobody needs to tell two greens apart. The
   * line under each is what the game says when the pair is found: short,
   * and true of the plant. `slug` is its page in the care library.
   */
  var KINDS = [
    {
      key: "monstera", name: "Monstera", slug: "monstera-deliciosa",
      fact: "The splits and holes come with age and good light.",
      art: svg(POT + '<path d="M20 29V22" stroke="#3F7D4E" stroke-width="2" stroke-linecap="round"/>' +
        '<path fill="#3F7D4E" d="M20 4c8 0 14 6 14 12s-6 9-14 9S6 22 6 16 12 4 20 4z"/>' +
        '<path d="M20 7v16M7 12l7 3M6.5 18l7.5 0M33 12l-7 3M33.5 18l-7.5 0" stroke="#F3ECDD" stroke-width="1.4" stroke-linecap="round"/>' +
        '<ellipse cx="15" cy="21" rx="1.4" ry="1" fill="#F3ECDD"/><ellipse cx="25" cy="21" rx="1.4" ry="1" fill="#F3ECDD"/>')
    },
    {
      key: "snake", name: "Snake plant", slug: "dracaena-trifasciata",
      fact: "Happy to go weeks between waterings, and copes with a dim corner.",
      art: svg(POT + '<g stroke="#C9B458" stroke-width="1">' +
        '<path fill="#3F6B47" d="M14 30c-1-9 0-17 2-25 1 8 2 16 2 25z"/>' +
        '<path fill="#4E7F55" d="M19 30c0-10 1-18 3-27 1 9 2 18 1 27z"/>' +
        '<path fill="#3F6B47" d="M24 30c0-7 1-13 3-19 1 6 1 13 0 19z"/></g>' +
        '<path d="M16 12h1.5M16 18h2M21.5 9h1.5M21.5 16h2M21.5 23h2M25.5 18h1.5" stroke="#9CC29A" stroke-width="1" stroke-linecap="round"/>')
    },
    {
      key: "cactus", name: "Bunny-ear cactus", slug: "opuntia-microdasys",
      fact: "Those soft-looking dots are tufts of tiny barbed bristles. Look, don't stroke.",
      art: svg(POT + '<ellipse cx="20" cy="21" rx="7" ry="8.5" fill="#6FA35A"/>' +
        '<ellipse cx="13" cy="10" rx="4" ry="6" transform="rotate(-25 13 10)" fill="#7DB067"/>' +
        '<ellipse cx="27" cy="10" rx="4" ry="6" transform="rotate(25 27 10)" fill="#7DB067"/>' +
        '<g fill="#F2E3A6"><circle cx="17" cy="17" r=".9"/><circle cx="23" cy="17" r=".9"/><circle cx="20" cy="21" r=".9"/><circle cx="17" cy="25" r=".9"/><circle cx="23" cy="25" r=".9"/>' +
        '<circle cx="12" cy="9" r=".8"/><circle cx="14" cy="12.5" r=".8"/><circle cx="28" cy="9" r=".8"/><circle cx="26" cy="12.5" r=".8"/></g>')
    },
    {
      key: "fern", name: "Boston fern", slug: "nephrolepis-exaltata",
      fact: "Likes its soil evenly moist and the air around it humid.",
      art: svg(POT + '<g fill="none" stroke="#4E8F4A" stroke-width="3.6" stroke-dasharray="1.4 .9" stroke-linecap="butt">' +
        '<path d="M20 29C15 22 9 19 3 21"/><path d="M20 29C25 22 31 19 37 21"/>' +
        '<path d="M20 29C17 19 12 12 7 10"/><path d="M20 29C23 19 28 12 33 10"/><path d="M20 29C20 19 20 11 20 4"/></g>')
    },
    {
      key: "pothos", name: "Pothos", slug: "epipremnum-aureum",
      fact: "Trails happily from a shelf, and a trimmed stem roots in a glass of water.",
      art: svg(POT + '<path d="M14 30C10 32 8 35 7 39M26 30c3-6 3-12 0-18" fill="none" stroke="#4E9A4F" stroke-width="1.3"/>' +
        '<g fill="#4E9A4F"><path d="M8 33c-3-2-3-5 0-5 1-2 4-1 3 2z"/><path d="M6 38c-3-2-2-5 1-4 2-2 4 1 2 3z"/>' +
        '<path d="M20 22c-5-3-5-8 0-7 2-3 6-1 4 3z"/><path d="M27 15c-4-3-4-8 1-7 2-3 6 0 3 4z"/><path d="M15 27c-4-2-4-6 0-6 2-2 5 0 3 3z"/></g>' +
        '<path d="M19 18.5l2.5-2M26.5 11.5l2.5-2M14.8 24.5l2-1.5" stroke="#E6D27A" stroke-width="1.1" stroke-linecap="round"/>')
    },
    {
      key: "echeveria", name: "Echeveria", slug: "echeveria-elegans",
      fact: "A rosette that wants full sun and very little water.",
      art: svg(POT + '<g fill="#86AFA5" stroke="#E7A1B0" stroke-width=".9">' +
        '<ellipse cx="9" cy="24" rx="7" ry="3.4" transform="rotate(-15 9 24)"/><ellipse cx="31" cy="24" rx="7" ry="3.4" transform="rotate(15 31 24)"/>' +
        '<ellipse cx="12" cy="19" rx="6.5" ry="3.4" transform="rotate(-40 12 19)"/><ellipse cx="28" cy="19" rx="6.5" ry="3.4" transform="rotate(40 28 19)"/>' +
        '<ellipse cx="20" cy="15" rx="3.4" ry="7"/><ellipse cx="15.5" cy="20" rx="5" ry="3" transform="rotate(-60 15.5 20)" fill="#9CC0B6"/>' +
        '<ellipse cx="24.5" cy="20" rx="5" ry="3" transform="rotate(60 24.5 20)" fill="#9CC0B6"/><ellipse cx="20" cy="22" rx="3" ry="4.5" fill="#B0D0C6"/></g>')
    },
    {
      key: "palm", name: "Parlour palm", slug: "chamaedorea-elegans",
      fact: "A Victorian parlour favourite, and still fine in lower light.",
      art: svg(POT + '<path d="M17 30V15M20 30V9M23 30V15" stroke="#6B8F4E" stroke-width="1.3"/>' +
        '<g stroke="#5C9E5A" stroke-width="1.6" stroke-linecap="round" fill="none">' +
        '<path d="M17 15l-6-4M17 15l-7 0M17 15l-6 4M17 15l-3-6"/><path d="M23 15l6-4M23 15l7 0M23 15l6 4M23 15l3-6"/>' +
        '<path d="M20 9l-5-4M20 9l5-4M20 9l0-6M20 9l-6 1M20 9l6 1"/></g>')
    },
    {
      key: "lily", name: "Peace lily", slug: "spathiphyllum-wallisii",
      fact: "Droops when it's thirsty and perks up within hours of a drink.",
      art: svg(POT + '<path fill="#2F6B3F" d="M18 30c-8-3-10-10-7-17 4 5 7 11 7 17z"/><path fill="#2F6B3F" d="M22 30c8-3 10-10 7-17-4 5-7 11-7 17z"/>' +
        '<path d="M20 30V13" stroke="#3F7D4E" stroke-width="1.3"/>' +
        '<path fill="#FFFFFF" stroke="#C9C0AA" stroke-width=".8" d="M20 3c4 3 5 8 0 12-5-4-4-9 0-12z"/><rect x="19.2" y="7" width="1.6" height="5" rx=".8" fill="#E6C46B"/>')
    },
    {
      key: "violet", name: "African violet", slug: "saintpaulia-ionantha",
      fact: "Water at the soil, or from below, to keep its furry leaves dry.",
      art: svg(POT + '<g fill="#3E6B45"><ellipse cx="11" cy="25" rx="6" ry="4.5"/><ellipse cx="29" cy="25" rx="6" ry="4.5"/><ellipse cx="20" cy="24" rx="6" ry="5"/></g>' +
        '<g fill="#8E5CC2"><circle cx="15" cy="15" r="2.2"/><circle cx="18" cy="13" r="2.2"/><circle cx="17" cy="17" r="2.2"/>' +
        '<circle cx="24" cy="14" r="2.2"/><circle cx="27" cy="12" r="2.2"/><circle cx="26" cy="16.5" r="2.2"/><circle cx="21" cy="18" r="2.2"/></g>' +
        '<g fill="#F2D35B"><circle cx="16.6" cy="15" r=".8"/><circle cx="25.6" cy="14.3" r=".8"/><circle cx="21" cy="18" r=".7"/></g>')
    },
    {
      key: "pearls", name: "String of pearls", slug: "senecio-rowleyanus",
      fact: "Each bead stores water, so let the soil dry out between drinks.",
      art: svg('<path fill="#A2755C" d="M12 6h16l-2 7H14z"/><rect x="11" y="4" width="18" height="3" rx="1" fill="#8A5F49"/>' +
        '<path d="M14 12c-2 8-1 16 0 26M20 13c0 8 1 15 0 22M26 12c2 7 2 13 1 20" fill="none" stroke="#6E8F5A" stroke-width=".8"/>' +
        '<g fill="#7DB46C"><circle cx="13.6" cy="16" r="1.4"/><circle cx="13.2" cy="20" r="1.4"/><circle cx="13.2" cy="24" r="1.4"/><circle cx="13.4" cy="28" r="1.4"/><circle cx="13.8" cy="32" r="1.4"/><circle cx="14" cy="36" r="1.4"/>' +
        '<circle cx="20.2" cy="17" r="1.4"/><circle cx="20.5" cy="21" r="1.4"/><circle cx="20.6" cy="25" r="1.4"/><circle cx="20.4" cy="29" r="1.4"/><circle cx="20.1" cy="33" r="1.4"/>' +
        '<circle cx="26.6" cy="16" r="1.4"/><circle cx="27.2" cy="20" r="1.4"/><circle cx="27.3" cy="24" r="1.4"/><circle cx="27.1" cy="28" r="1.4"/></g>')
    },
    {
      key: "zz", name: "ZZ plant", slug: "zamioculcas-zamiifolia",
      fact: "Stores water in fat underground stems, so it forgives a missed watering.",
      art: svg(POT + '<path d="M16 30C15 22 14 14 12 6M24 30c1-8 2-15 5-22" fill="none" stroke="#2E5B35" stroke-width="1.3"/>' +
        '<g fill="#2E6B3A"><ellipse cx="11" cy="11" rx="1.8" ry="3.4" transform="rotate(-40 11 11)"/><ellipse cx="16" cy="10" rx="1.8" ry="3.4" transform="rotate(30 16 10)"/>' +
        '<ellipse cx="12" cy="17" rx="1.8" ry="3.4" transform="rotate(-45 12 17)"/><ellipse cx="17.5" cy="16" rx="1.8" ry="3.4" transform="rotate(35 17.5 16)"/>' +
        '<ellipse cx="13" cy="23" rx="1.8" ry="3.4" transform="rotate(-50 13 23)"/><ellipse cx="18.5" cy="22" rx="1.8" ry="3.4" transform="rotate(40 18.5 22)"/>' +
        '<ellipse cx="25" cy="12" rx="1.8" ry="3.4" transform="rotate(-35 25 12)"/><ellipse cx="30.5" cy="13" rx="1.8" ry="3.4" transform="rotate(45 30.5 13)"/>' +
        '<ellipse cx="22.5" cy="18" rx="1.8" ry="3.4" transform="rotate(-40 22.5 18)"/><ellipse cx="28.5" cy="19" rx="1.8" ry="3.4" transform="rotate(50 28.5 19)"/></g>')
    },
    {
      key: "aloe", name: "Aloe", slug: "aloe-vera",
      fact: "A succulent: give it bright light and a gritty mix that drains fast.",
      art: svg(POT + '<g fill="#7FAF8C" stroke="#5E8C6A" stroke-width=".6">' +
        '<path d="M19 30C12 26 6 20 3 13c6 3 12 9 17 16z"/><path d="M21 30c7-4 13-10 16-17-6 3-12 9-17 16z"/>' +
        '<path d="M19 30c-4-8-6-16-4-25 3 8 5 16 5 25z"/><path d="M21 30c4-8 6-16 4-25-3 8-5 16-5 25z"/></g>' +
        '<g fill="#E9F1E6"><circle cx="9" cy="18" r=".6"/><circle cx="12" cy="21" r=".6"/><circle cx="31" cy="18" r=".6"/><circle cx="28" cy="21" r=".6"/><circle cx="16.5" cy="14" r=".6"/><circle cx="23.5" cy="14" r=".6"/><circle cx="17.5" cy="20" r=".6"/><circle cx="22.5" cy="20" r=".6"/></g>')
    },
    {
      key: "rubber", name: "Rubber plant", slug: "ficus-elastica",
      fact: "Wipe the big leaves now and then so they can catch the light.",
      art: svg(POT + '<path d="M20 30V5" stroke="#5B4A3A" stroke-width="1.6"/>' +
        '<g fill="#2F4F3A"><ellipse cx="13" cy="23" rx="7" ry="3.8" transform="rotate(-25 13 23)"/><ellipse cx="27" cy="18" rx="7" ry="3.8" transform="rotate(25 27 18)"/>' +
        '<ellipse cx="14" cy="12" rx="6" ry="3.4" transform="rotate(-35 14 12)"/></g>' +
        '<path d="M8 25.5l9-4M33 20.5l-9-4M9.5 14.5l8-4.5" stroke="#5F7F68" stroke-width=".7"/><path fill="#C0504D" d="M20 3c1.5 1 1.5 4 0 6-1.5-2-1.5-5 0-6z"/>')
    },
    {
      key: "orchid", name: "Moth orchid", slug: "phalaenopsis-amabilis",
      fact: "Grows in bark, not soil. Its roots want air as much as water.",
      art: svg(POT + '<g fill="#3E7A4C"><ellipse cx="13" cy="27" rx="7" ry="2.8" transform="rotate(-12 13 27)"/><ellipse cx="27" cy="27" rx="7" ry="2.8" transform="rotate(12 27 27)"/></g>' +
        '<path d="M21 29C22 18 24 10 31 6" fill="none" stroke="#6B5A3E" stroke-width="1"/>' +
        '<g fill="#E9A7C6" stroke="#C97A9F" stroke-width=".5"><circle cx="18" cy="10" r="3.3"/><circle cx="24" cy="6" r="3"/><circle cx="31" cy="6" r="2.6"/><circle cx="20" cy="17" r="3.3"/></g>' +
        '<g fill="#8E3A63"><circle cx="18" cy="10" r=".9"/><circle cx="24" cy="6" r=".8"/><circle cx="20" cy="17" r=".9"/></g>')
    },
    {
      key: "spider", name: "Spider plant", slug: "chlorophytum-comosum",
      fact: "Sends out babies on long runners, and each one roots easily.",
      art: svg(POT + '<g fill="none" stroke-linecap="round"><g stroke="#4F8F4A" stroke-width="2.6">' +
        '<path d="M20 29C16 20 10 14 4 14"/><path d="M20 29C24 20 30 14 36 14"/><path d="M20 29C19 20 16 11 13 5"/><path d="M20 29C21 20 24 11 27 5"/></g>' +
        '<g stroke="#EAF2DE" stroke-width=".8"><path d="M20 29C16 20 10 14 4 14"/><path d="M20 29C24 20 30 14 36 14"/><path d="M20 29C19 20 16 11 13 5"/><path d="M20 29C21 20 24 11 27 5"/></g>' +
        '<path d="M26 30c6 0 9 3 9 7" stroke="#C7B98A" stroke-width=".9"/><g stroke="#4F8F4A" stroke-width="1.6"><path d="M35 37l-3-3M35 37l3-3M35 37v-4"/></g></g>')
    },
    {
      key: "pilea", name: "Chinese money plant", slug: "pilea-peperomioides",
      fact: "Turn it now and then: the round leaves lean towards the window.",
      art: svg(POT + '<g stroke="#6B8F4E" stroke-width=".9"><path d="M20 29L9 15M20 29L15 8M20 29L25 6M20 29L32 13M20 29L30 23M20 29L10 24"/></g>' +
        '<g fill="#5FA36E"><circle cx="9" cy="14" r="4"/><circle cx="15" cy="7" r="3.6"/><circle cx="25" cy="5.5" r="3.6"/><circle cx="32" cy="12" r="4"/><circle cx="30.5" cy="22.5" r="3.4"/><circle cx="9.5" cy="23.5" r="3.4"/></g>' +
        '<g fill="#7FBF8A"><circle cx="9" cy="14" r="1"/><circle cx="15" cy="7" r=".9"/><circle cx="25" cy="5.5" r=".9"/><circle cx="32" cy="12" r="1"/><circle cx="30.5" cy="22.5" r=".8"/><circle cx="9.5" cy="23.5" r=".8"/></g>')
    },
    {
      key: "forgetmenot", name: "Forget-me-not", slug: null,
      fact: "A garden flower rather than a houseplant. It's here for the name.",
      art: svg('<g stroke="#5C8F4E" stroke-width="1.2" fill="none"><path d="M20 39C20 30 17 24 12 18M20 39c0-10 3-16 9-22M20 39V20"/></g>' +
        '<g fill="#5C8F4E"><ellipse cx="14" cy="31" rx="4" ry="1.8" transform="rotate(-30 14 31)"/><ellipse cx="26" cy="32" rx="4" ry="1.8" transform="rotate(30 26 32)"/></g>' +
        flower(12, 15) + flower(20, 9) + flower(29, 13) + flower(16, 23) + flower(25, 21))
    }
  ];

  /** A forget-me-not: five blue petals round a yellow eye. */
  function flower(x, y) {
    var petals = "";
    for (var i = 0; i < 5; i++) {
      var a = (i * 72 - 90) * Math.PI / 180;
      petals += '<circle cx="' + (x + 2.6 * Math.cos(a)).toFixed(2) + '" cy="' + (y + 2.6 * Math.sin(a)).toFixed(2) + '" r="2"/>';
    }
    return '<g fill="#6FA8DC">' + petals + '</g><circle cx="' + x + '" cy="' + y + '" r="1.2" fill="#F2D35B"/>';
  }

  var BY_KEY = {};
  KINDS.forEach(function (k) { BY_KEY[k.key] = k; });
  function kindOf(key) { return BY_KEY[key] || null; }

  var SIZES = [
    { key: "posy", label: "Posy", pairs: 6, cols: 3 },
    { key: "bunch", label: "Bunch", pairs: 8, cols: 4 },
    { key: "bouquet", label: "Bouquet", pairs: 12, cols: 4 }
  ];
  function sizeOf(key) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i].key === key) return SIZES[i];
    return SIZES[1];
  }

  function shuffle(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** A table of `size` pairs, dealt with `rnd`: which plants, then where. */
  function deal(sizeKey, rnd) {
    var size = sizeOf(sizeKey);
    var kinds = shuffle(KINDS.map(function (k) { return k.key; }), rnd).slice(0, size.pairs);
    var cards = shuffle(kinds.concat(kinds), rnd);
    return { size: size.key, cols: size.cols, rows: cards.length / size.cols, cards: cards, version: VERSION };
  }

  /* Six cards, laid out by hand: small enough to learn on, and the first
     two cards anyone turns along the top row are not a pair, so the practice
     board always gets to show what happens when they don't match. */
  var PRACTICE = {
    size: "practice", cols: 3, rows: 2,
    cards: ["monstera", "cactus", "fern", "cactus", "fern", "monstera"],
    version: VERSION
  };

  var DAILY_SEED = 6151;
  var DAILY_SIZE = "bunch";
  function dailySeed(day) { return (day * DAILY_SEED + VERSION * 1000003) >>> 0; }

  /* ------------------------------------------------------------ playing */

  function start(board) {
    return { cards: Array(board.cards.length + 1).join("."), up: [], turns: 0 };
  }

  function setChar(s, i, ch) { return s.slice(0, i) + ch + s.slice(i + 1); }

  /**
   * Turn card `i`. Returns the new position and what happened:
   *   "first"   one card is showing, waiting for its partner
   *   "match"   the two showing made a pair, and stay up
   *   "miss"    the two showing don't match; they stay up until the next tap
   *   "hide"    a miss was showing and this tap only turned it back
   *   "ignored" a card already up, or already found
   * A tap on a fresh card while a miss is showing turns the miss back and
   * the new card over in one go, so nobody has to tap twice to move on.
   */
  function turn(board, st, i) {
    var next = { cards: st.cards, up: st.up.slice(), turns: st.turns | 0 };
    if (i < 0 || i >= board.cards.length) return { st: st, event: "ignored" };
    var hid = false;
    if (next.up.length === 2) {
      var tappedShown = next.up.indexOf(i) >= 0;
      next.up = [];
      hid = true;
      if (tappedShown || next.cards[i] === "m") return { st: next, event: "hide" };
    }
    if (next.cards[i] === "m" || next.up.indexOf(i) >= 0) return { st: hid ? next : st, event: hid ? "hide" : "ignored" };
    if (next.cards[i] === ".") next.cards = setChar(next.cards, i, "s");
    next.up.push(i);
    if (next.up.length < 2) return { st: next, event: "first", hid: hid };
    next.turns += 1;
    var a = next.up[0], b = next.up[1];
    if (board.cards[a] === board.cards[b]) {
      next.cards = setChar(setChar(next.cards, a, "m"), b, "m");
      next.up = [];
      return { st: next, event: "match", hid: hid, pair: [a, b], kind: board.cards[a] };
    }
    return { st: next, event: "miss", hid: hid, pair: [a, b] };
  }

  function found(st) { return st.cards.replace(/[^m]/g, "").length / 2; }
  function isSolved(board, st) { return st.cards.length === board.cards.length && found(st) * 2 === board.cards.length; }

  /** The other card of the same plant. */
  function partnerOf(board, i) {
    for (var j = 0; j < board.cards.length; j++) if (j !== i && board.cards[j] === board.cards[i]) return j;
    return -1;
  }

  /**
   * A nudge points at what the player has already seen, never at a card
   * they haven't: it is a reminder, not a peek.
   */
  function nudge(board, st) {
    if (isSolved(board, st)) return null;
    if (st.up.length === 2) {
      return { cells: [], why: "Tap any card to turn these two back, then try again." };
    }
    if (st.up.length === 1) {
      var mate = partnerOf(board, st.up[0]);
      if (mate >= 0 && st.cards[mate] === "s") {
        return { cells: [mate], why: "You've seen its twin already. It's this one." };
      }
      return { cells: [], why: "You haven't seen its twin yet, so any card you haven't turned is as good a guess as another." };
    }
    for (var i = 0; i < board.cards.length; i++) {
      if (st.cards[i] !== "s") continue;
      var j = partnerOf(board, i);
      if (j > i && st.cards[j] === "s") {
        return { cells: [i, j], why: "You've seen both of these. They're a pair." };
      }
    }
    return { cells: [], why: "Nothing you've seen makes a pair yet. Turn a card you haven't seen." };
  }

  /** What a screen reader says for a card. */
  function describeCard(board, st, i) {
    var where = "card " + (i + 1) + " of " + board.cards.length;
    var kind = kindOf(board.cards[i]);
    if (st.cards[i] === "m") return where + ", " + kind.name + ", found";
    if (st.up.indexOf(i) >= 0) return where + ", " + kind.name;
    return where + ", face down";
  }

  function shareText(num, pairs, turns, nudged) {
    return "Forget-Me-Not #" + num + " · " + pairs + " pairs\n" +
      "Found them all in " + turns + " turns" + (nudged ? ", with a nudge" : ", no nudges") + " 🌼\n" +
      "plantparlour.org/parlour-games/forget-me-not/daily";
  }

  /* --------------------------------------------------------- progress */

  function emptyProgress() { return { done: 0, bySize: {}, nudgeFree: 0, daily: null }; }

  function laterDaily(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if ((a.num | 0) !== (b.num | 0)) return (a.num | 0) > (b.num | 0) ? a : b;
    if (!!a.done !== !!b.done) return a.done ? a : b;
    var count = function (d) { return String(d.cards || "").replace(/[^m]/g, "").length; };
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

  return {
    VERSION: VERSION,
    KINDS: KINDS,
    SIZES: SIZES,
    PRACTICE: PRACTICE,
    DAILY_SIZE: DAILY_SIZE,
    kindOf: kindOf,
    sizeOf: sizeOf,
    shuffle: shuffle,
    deal: deal,
    dailySeed: dailySeed,
    start: start,
    turn: turn,
    found: found,
    isSolved: isSolved,
    partnerOf: partnerOf,
    nudge: nudge,
    describeCard: describeCard,
    shareText: shareText,
    emptyProgress: emptyProgress,
    laterDaily: laterDaily,
    mergeProgress: mergeProgress
  };
});
