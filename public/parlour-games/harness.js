/**
 * The parts every Parlour game needs and none of them should own.
 *
 * Trickle carried all of this inside its own page, which was right while
 * there was one game and wrong the moment there were two: the daily
 * calendar, the streak and the account sync are not Trickle's, they are the
 * arcade's, and three copies of them would drift apart the way two copies of
 * the welcome page did.
 *
 * Loaded as a plain script from an absolute path -- the games are served at
 * more than one URL each (a game, its practice mode, its embed) and a
 * relative src would resolve differently at each. It is the only thing any
 * game fetches. Everything else stays inline.
 *
 * Also loadable in Node, so the merge rules can be tested without a browser.
 * Nothing here touches the DOM or storage at load time; every entry point
 * that needs a document asks for one.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Parlour = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---- storage --------------------------------------------------------- */
  /* Every call is wrapped: a private window throws on access, and losing a
     saved board is never worth losing the game over. */
  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try {
      /* Always JSON, because read() always JSON.parses. Writing strings raw
         and reading them back as JSON is a pair that looks fine and silently
         loses every string value -- which is exactly what it did to
         Windowsill's remembered shelf size. */
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* nothing to do, and nothing worth breaking for */ }
  }

  /* ---- the shared calendar --------------------------------------------- */
  /* Day 1 of Parlour Games. Changing it re-deals every past board in every
     game, so it is fixed at the day the first one shipped and must not move
     once anybody has played. Every game counts days from here, so "today's
     board" means the same day across the arcade. */
  var EPOCH = Date.UTC(2026, 8, 17);

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** Which day it is, counted in local midnights from the epoch. */
  function dayNumber(when) {
    var d = when || new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000) + 1;
  }

  /** Milliseconds until the next local midnight, for the countdown. */
  function msUntilTomorrow(when) {
    var d = when || new Date();
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    return next.getTime() - d.getTime();
  }

  /* ---- which page this is ---------------------------------------------- */
  /* Practice wins over the daily board; embed combines with either rather
     than replacing them. `loc` is injectable so this can be tested. */
  function mode(loc) {
    var l = loc || (typeof location !== "undefined" ? location : { search: "", pathname: "/" });
    var learn = /[?&]learn=1/.test(l.search) || /\/learn\/?$/.test(l.pathname);
    var daily = !learn && (/[?&]daily=1/.test(l.search) || /\/daily\/?$/.test(l.pathname));
    var embed = /[?&]embed=1/.test(l.search) || /\/embed\/?$/.test(l.pathname);
    return { learn: learn, daily: daily, embed: embed };
  }

  /* ---- the streak, which belongs to the arcade and not to any one game --- */
  /* One streak across all of Parlour Games: playing anything today keeps it
     alive. With more than one game that is both kinder and stickier than a
     streak per game, which a keeper breaks three times over in a fortnight. */
  var STREAK_KEY = "pp_streak";
  var EMPTY_STREAK = { last: null, streak: 0, longest: 0, played: 0 };

  function getStreak() {
    var s = read(STREAK_KEY, null);
    return s && typeof s === "object" ? s : { last: null, streak: 0, longest: 0, played: 0 };
  }

  /**
   * Records that something was played on `day`. Idempotent within a day, so
   * a reload -- or a second game -- cannot inflate anything.
   */
  function recordPlay(day) {
    var s = getStreak();
    if (s.last === day) return s;
    s.streak = s.last === day - 1 ? (s.streak | 0) + 1 : 1;
    s.last = day;
    s.played = (s.played | 0) + 1;
    s.longest = Math.max(s.longest | 0, s.streak);
    write(STREAK_KEY, s);
    return s;
  }

  /**
   * Merge two streaks. The device that played most recently holds the live
   * count; everything else is a high-water mark. `played` takes the larger
   * rather than the sum, which can undercount someone who played different
   * days on two devices -- an undercount is the safe way to be wrong, since
   * the alternative is a total that grows every time you open the page.
   */
  function mergeStreak(a, b) {
    if (!a || a.last == null) return b && b.last != null ? b : (a || null);
    if (!b || b.last == null) return a;
    var streak = a.last === b.last
      ? Math.max(a.streak | 0, b.streak | 0)
      : ((a.last | 0) > (b.last | 0) ? a.streak | 0 : b.streak | 0);
    return {
      last: Math.max(a.last | 0, b.last | 0),
      streak: streak,
      longest: Math.max(a.longest | 0, b.longest | 0, a.streak | 0, b.streak | 0),
      played: Math.max(a.played | 0, b.played | 0)
    };
  }

  /**
   * Trickle kept the streak inside its own stats before there was an arcade
   * to keep it for. Lift it across once, so nobody's run resets on the day
   * this ships. Safe to call on every load: it only fires when there is an
   * old streak and no new one.
   */
  function adoptLegacyStreak(legacy) {
    if (!legacy || legacy.last == null) return getStreak();
    var already = read(STREAK_KEY, null);
    if (already && already.last != null) return already;
    var s = {
      last: legacy.last | 0,
      streak: legacy.streak | 0,
      longest: Math.max(legacy.streak | 0, legacy.longest | 0),
      played: legacy.played | 0
    };
    write(STREAK_KEY, s);
    return s;
  }

  /* ---- the account ----------------------------------------------------- */
  /* Same origin as the app, so the session it already holds is right here. */
  var SB_URL = "https://ixagjvntbgyqemxxinqe.supabase.co";
  var SB_KEY = "sb_publishable__A5fA6nyI8nrSqJWfaaJBQ_vqEZdRn6";
  var SB_SESSION_KEY = "sb-ixagjvntbgyqemxxinqe-auth-token";
  var SIGN_IN_URL = "/account";

  /** The session the app put in localStorage. Signed out, nothing is sent. */
  function session() {
    var raw = read(SB_SESSION_KEY, null);
    return raw && raw.access_token && raw.user && raw.user.id ? raw : null;
  }

  /* An expired token is refreshed and written back in the same shape, so the
     app picks up the refreshed session too. */
  async function token() {
    var s = session();
    if (!s) return null;
    var now = Math.floor(Date.now() / 1000);
    if (!s.expires_at || s.expires_at - 60 > now) return s.access_token;
    try {
      var res = await fetch(SB_URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { apikey: SB_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!res.ok) return null;
      var next = await res.json();
      if (!next.access_token) return null;
      write(SB_SESSION_KEY, next);
      return next.access_token;
    } catch (e) { return null; }
  }

  /* `game_progress` is keyed (user_id, game). This name is the arcade's own
     row, where the shared streak lives, so no game may be called it. */
  var STREAK_ROW = "parlour";

  /**
   * Progress sync for one game.
   *
   * The harness owns the transport, the row addressing and the streak; the
   * game owns the shape of its own progress and how two copies of it merge,
   * because only the game knows which of its numbers wants the larger and
   * which wants the smaller.
   *
   *   local()            -> this device's progress, as it will be stored
   *   merge(local, remote) -> one of them, or a blend
   *   apply(merged)      -> write it back locally
   *   onStatus(signedIn, streak) -> redraw whatever says where progress lives
   */
  function sync(opts) {
    if (opts.game === STREAK_ROW) throw new Error('"' + STREAK_ROW + '" is reserved for the shared streak');
    var pushTimer = null;

    function rows(access, uid) {
      return fetch(
        SB_URL + "/rest/v1/game_progress?select=game,progress&user_id=eq." + encodeURIComponent(uid) +
        "&game=in.(" + encodeURIComponent(opts.game) + "," + STREAK_ROW + ")",
        { headers: { apikey: SB_KEY, Authorization: "Bearer " + access } }
      );
    }

    async function push(immediate) {
      if (!immediate) {
        if (!session()) return;
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () { pushTimer = null; push(true); }, 1500);
        return;
      }
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      var access = await token();
      if (!access) return;
      var uid = session().user.id, now = new Date().toISOString();
      var body = [{ user_id: uid, game: opts.game, progress: opts.local(), updated_at: now }];
      var streak = getStreak();
      if (streak.last != null) body.push({ user_id: uid, game: STREAK_ROW, progress: streak, updated_at: now });
      try {
        await fetch(SB_URL + "/rest/v1/game_progress?on_conflict=user_id,game", {
          method: "POST",
          headers: {
            apikey: SB_KEY,
            Authorization: "Bearer " + access,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify(body)
        });
      } catch (e) { /* the local copy is still right; try again next time */ }
    }

    async function pull() {
      var access = await token();
      if (!access) { opts.onStatus(false, getStreak()); return null; }
      try {
        var res = await rows(access, session().user.id);
        if (!res.ok) { opts.onStatus(true, getStreak()); return null; }
        var got = await res.json();
        var mine = null, theirStreak = null;
        (got || []).forEach(function (r) {
          if (r.game === STREAK_ROW) theirStreak = r.progress;
          else mine = r.progress;
        });

        /* The streak is merged by the harness -- it is the one thing a game
           must not be able to drop on the floor. */
        var streak = mergeStreak(getStreak(), theirStreak);
        if (streak && streak.last != null) write(STREAK_KEY, streak);

        var merged = opts.merge(opts.local(), mine);
        opts.apply(merged);
        opts.onStatus(true, getStreak());
        push(true);
        return merged;
      } catch (e) { opts.onStatus(true, getStreak()); return null; }
    }

    return { pull: pull, push: push, signInUrl: SIGN_IN_URL };
  }

  /* ---- night ----------------------------------------------------------- */
  /* Unset follows the clock, so the first evening visit is already dark
     without anybody choosing. Choosing once wins from then on. */
  function clockSaysNight(when) {
    var h = (when || new Date()).getHours();
    return h >= 21 || h < 6;
  }

  function night(opts) {
    var key = opts.key;
    var pref = read(key, null);
    function isOn() { return pref == null ? clockSaysNight() : pref === true; }
    function apply() {
      var on = isOn();
      document.body.classList.toggle("night", on);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", on ? opts.dark || "#140A17" : opts.light || "#2E1633");
      if (opts.onApply) opts.onApply(on);
    }
    function toggle() { pref = !isOn(); write(key, pref); apply(); }
    return { isOn: isOn, apply: apply, toggle: toggle };
  }

  /* ---- sound ----------------------------------------------------------- */
  /* Everything is synthesised: nothing to download, nothing to fail. A
     browser only starts audio after a gesture, so the context is created on
     the first tap and a suspended one is resumed.
     `mix` is one dial for the whole bus, tuned against the analyser rather
     than by ear, since there is no ear in a test run. */
  function sound(opts) {
    var AC = null, master = null, analyser = null, wet = null;
    var on = read(opts.key, false) === true;
    var playing = false, timer = null, step16 = 0, nextNoteAt = 0, pass = 0;
    var MIX = opts.mix == null ? 4 : opts.mix;
    var BPM = opts.bpm || 66, STEP = 60 / BPM / 2, ROOT = opts.root || 146.83;
    var MOTIF = opts.motif || [], CHORDS = opts.chords || [], BLIPS = opts.blips || [440];
    var hz = function (semi) { return ROOT * Math.pow(2, semi / 12); };

    function audio() {
      if (AC) return AC;
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try { AC = new Ctor(); } catch (e) { return null; }
      master = AC.createGain();
      master.gain.value = 1;
      /* A delay alongside the dry signal, then a low-pass, so nothing is
         sharp enough to jar. */
      var lp = AC.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 1600; lp.Q.value = 0.4;
      var delay = AC.createDelay(1);
      delay.delayTime.value = 0.41;
      var fb = AC.createGain(); fb.gain.value = 0.32;
      wet = AC.createGain(); wet.gain.value = 0.28;
      master.connect(lp);
      master.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(lp);
      analyser = AC.createAnalyser();
      analyser.fftSize = 2048;
      lp.connect(analyser);
      analyser.connect(AC.destination);
      return AC;
    }
    function wake() {
      var ac = audio();
      if (ac && ac.state === "suspended") ac.resume();
      return ac;
    }

    function blip(i) {
      if (!on) return;
      var ac = wake(); if (!ac) return;
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = "sine";
      o.frequency.value = BLIPS[i % BLIPS.length];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05 * MIX, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.25);
    }
    function fanfare() {
      if (!on) return;
      var ac = wake(); if (!ac) return;
      [0, 1, 2, 3].forEach(function (k) {
        var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + k * 0.11;
        o.type = "sine";
        o.frequency.value = BLIPS[k + 1] || BLIPS[BLIPS.length - 1];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.06 * MIX, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.4);
      });
    }

    /* One voice: an oscillator with a slow swell, so nothing ever clicks. */
    function voice(type, frequency, at, dur, peak, attack, detune) {
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type;
      o.frequency.value = frequency;
      if (detune) o.detune.value = detune;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g); g.connect(master);
      o.start(at); o.stop(at + dur + 0.05);
    }

    /* Scheduled half a second ahead on a short interval: WebAudio keeps time,
       setInterval only decides what to hand it. */
    function schedule() {
      if (!playing || !AC) return;
      while (nextNoteAt < AC.currentTime + 0.5) {
        var at = Math.max(nextNoteAt, AC.currentTime + 0.02);
        var semi = MOTIF[step16];
        if (semi != null) {
          voice("sine", hz(semi), at, 0.9, 0.05 * MIX, 0.02, 0);
          /* Every fourth pass answers an octave up, quieter. */
          if (pass % 4 === 3) voice("sine", hz(semi + 12), at, 0.7, 0.022 * MIX, 0.02, 0);
          /* And now and then a fifth above, a half-step behind, as a glint. */
          if (Math.random() < 0.08) voice("sine", hz(semi + 19), at + 0.5 * STEP, 0.5, 0.018 * MIX, 0.02, 0);
        }
        if (step16 === 0 && CHORDS.length) {
          var chord = CHORDS[(pass % CHORDS.length + CHORDS.length) % CHORDS.length];
          var bar = STEP * 16;
          chord.forEach(function (n) {
            voice("triangle", hz(n), at, bar, 0.016 * MIX, 1.6, 5);
            voice("triangle", hz(n), at, bar, 0.016 * MIX, 1.6, -5);
          });
          voice("sine", hz(chord[0] - 12), at, bar, 0.03 * MIX, 0.6, 0);
        }
        nextNoteAt = at + STEP;
        step16 += 1;
        if (step16 === 16) { step16 = 0; pass += 1; }
      }
    }

    function startMusic() {
      var ac = wake(); if (!ac) return;
      if (playing) return;
      playing = true;
      step16 = 0; pass = 0;
      nextNoteAt = ac.currentTime + 0.1;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ac.currentTime);
      master.gain.linearRampToValueAtTime(1, ac.currentTime + 2.5);
      timer = setInterval(schedule, 120);
      schedule();
    }
    function stopMusic() {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (AC && master) {
        master.gain.cancelScheduledValues(AC.currentTime);
        master.gain.setValueAtTime(master.gain.value, AC.currentTime);
        master.gain.linearRampToValueAtTime(0.0001, AC.currentTime + 1.2);
        setTimeout(function () { if (!playing && master) master.gain.value = 1; }, 1300);
      }
    }

    /* A tab nobody is looking at should be silent. */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (timer) { clearInterval(timer); timer = null; }
      } else if (playing && !timer) {
        if (AC) nextNoteAt = AC.currentTime + 0.1;
        timer = setInterval(schedule, 120);
      }
    });

    return {
      blip: blip,
      fanfare: fanfare,
      startMusic: startMusic,
      stopMusic: stopMusic,
      /* Two questions with different answers while a tab is hidden: the
         music is still "on" but is deliberately not being scheduled. */
      musicRunning: function () { return playing; },
      musicAudible: function () { return playing && !!timer; },
      isOn: function () { return on; },
      setOn: function (next) { on = next; write(opts.key, on); },
      /* The test measures the bus rather than taking its level on trust. */
      levels: function () {
        if (!analyser) return null;
        var buf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buf);
        var peak = 0, sum = 0;
        for (var i = 0; i < buf.length; i++) { var v = Math.abs(buf[i]); if (v > peak) peak = v; sum += buf[i] * buf[i]; }
        return { peak: peak, rms: Math.sqrt(sum / buf.length) };
      }
    };
  }

  return {
    read: read, write: write,
    EPOCH: EPOCH, mulberry32: mulberry32, dayNumber: dayNumber, msUntilTomorrow: msUntilTomorrow,
    mode: mode,
    getStreak: getStreak, recordPlay: recordPlay, mergeStreak: mergeStreak,
    adoptLegacyStreak: adoptLegacyStreak,
    session: session, token: token, sync: sync, signInUrl: SIGN_IN_URL,
    clockSaysNight: clockSaysNight, night: night,
    sound: sound
  };
});
