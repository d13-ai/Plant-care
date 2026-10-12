// Monte Carlo: the next twelve months under a few courses of action.
//
//   node scripts/cost-montecarlo.mjs [runs]      (default 20000, seeded)
//
// scripts/pricing-model.mjs answers "what does it cost at N keepers?" with
// one guess for every input. This answers "what is likely to happen?": each
// run draws growth, usage and unit costs from ranges, walks month by month,
// and the strategies are compared on the same draws so the differences are
// the strategy, not the luck. Unit costs and list prices are the ones
// measured and recorded in pricing-model.mjs (12 Oct 2026); the ranges are
// judgement, written next to each draw, and the first thing to tighten as
// real counts come in.

const RUNS = Number(process.argv[2] ?? 20000);
const MONTHS = 12;

/* ---- a seeded generator, so a rerun prints the same tables ------------- */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uni = (r, lo, hi) => lo + (hi - lo) * r();
const normal = (r, mu, sd) => mu + sd * Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
const lognormal = (r, median, sigma) => median * Math.exp(normal(r, 0, sigma));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const poissonish = (r, mean) => Math.max(0, Math.round(normal(r, mean, Math.sqrt(Math.max(mean, 1)))));

/* ---- one possible year ------------------------------------------------- */
function drawWorld(r) {
  const idCost = clamp(normal(r, 0.076, 0.012), 0.04, 0.14); // measured 7.6c
  const healthCost = clamp(normal(r, 0.044, 0.008), 0.02, 0.08); // measured 4.2-4.6c
  const wallShare = uni(r, 0.05, 0.35); // new keepers who use all five scans
  const othersUse = uni(r, 0.2, 2); // scans used by everyone else (measured: ~0.1)
  const signups = [];
  let base = lognormal(r, 25, 0.8); // new keepers in month one: ~7 to ~90
  const growth = clamp(normal(r, 0.15, 0.15), -0.3, 0.8); // month on month
  for (let m = 0; m < MONTHS; m++) {
    const spike = r() < 0.03 ? lognormal(r, 15, 0.7) : 1; // a post that travels
    signups.push(poissonish(r, base * spike));
    base *= 1 + growth;
  }
  return {
    signups, idCost, healthCost, wallShare, othersUse,
    activeShare: uni(r, 0.2, 0.5), // of all keepers so far, who open it in a month
    photosPerActive: uni(r, 1, 5), // photos added per active keeper per month
    egressMbPerActive: 25 * uni(r, 0.5, 2),
    resizedPerActive: uni(r, 4, 15), // distinct photos resized a month, per active keeper
    peakDay: uni(r, 2, 4), // busiest day against an average day
    // paying, once there is something to pay for
    subConvertWall: uni(r, 0.03, 0.15), // of keepers who used all five
    subConvertOther: uni(r, 0.002, 0.01),
    subChurn: uni(r, 0.04, 0.1),
    subScans: uni(r, 2, 6), // a month, per subscriber
    packBuyWall: uni(r, 0.05, 0.25), // of keepers who used all five, buy a pack
    packRebuy: uni(r, 0.05, 0.2), // a buyer buys again in a given month
    packScansUsed: uni(r, 10, 25), // of the 25 in a pack
    playFeeOneOff: uni(r, 0.15, 0.2), // one-off products; the 2026 schedule is unsettled
  };
}

/* ---- the courses of action -------------------------------------------- */
const SUB_NET = 3.63; // $5.99/mo or $39.99/yr, 70% annual, 70% via Play at 15%
const PACK = { price: 2.99, scans: 25 };
const STRATEGIES = [
  { key: "now", name: "As now: 5 free scans, nothing to buy", trial: 5, thumbs: false },
  { key: "thumbs", name: "As now + thumbnails saved at upload", trial: 5, thumbs: true },
  { key: "three", name: "Thumbnails + cut free scans to 3", trial: 3, thumbs: true },
  { key: "packs", name: "Thumbnails + scan packs from month 3", trial: 5, thumbs: true, packsFrom: 2 },
  { key: "subs", name: "Thumbnails + subscription from month 3", trial: 5, thumbs: true, subsFrom: 2 },
  // Sell only once there are people to sell to: the month after 100 keepers
  // have used all five free scans. Until then, nothing to sell, no Vercel Pro.
  { key: "trigger", name: "Thumbnails + cap 500 + subscription once 100 have used all 5", trial: 5, thumbs: true, subsWhenWall: 100, cap: 500 },
];
const GLOBAL_CAP = 200;

function simulate(w, s) {
  let keepers = 0, storageGB = 0, onPro = false, subs = 0, buyers = 0, wallTotal = 0;
  let cost = 0, revenue = 0, worstMonth = 0, capHit = false, firstBill = null, refused = 0;
  let subsFrom = s.subsFrom, launched = null;
  const cap = s.cap ?? GLOBAL_CAP;
  for (let m = 0; m < MONTHS; m++) {
    if (s.subsWhenWall != null && subsFrom == null && wallTotal >= s.subsWhenWall) subsFrom = launched = m;
    const fresh = w.signups[m];
    keepers += fresh;
    const active = keepers * w.activeShare;

    // the free scans
    const wall = fresh * w.wallShare;
    wallTotal += wall;
    const trialScans = wall * s.trial + (fresh - wall) * Math.min(w.othersUse, s.trial);
    const scanCost = 0.8 * w.idCost + 0.2 * w.healthCost;

    // paying
    let paidScans = 0, monthRevenue = 0, selling = false;
    if (subsFrom != null && m >= subsFrom) {
      selling = true;
      subs = subs * (1 - w.subChurn) + wall * w.subConvertWall + (fresh - wall) * w.subConvertOther;
      paidScans += subs * w.subScans;
      monthRevenue += subs * SUB_NET;
    }
    if (s.packsFrom != null && m >= s.packsFrom) {
      selling = true;
      const newBuyers = (m === s.packsFrom ? wallTotal : wall) * w.packBuyWall; // the backlog buys first
      const packs = newBuyers + buyers * w.packRebuy;
      buyers += newBuyers;
      paidScans += packs * w.packScansUsed;
      monthRevenue += packs * PACK.price * (1 - w.playFeeOneOff);
    }

    // the daily cap: the busiest day against 200 calls
    const calls = trialScans + paidScans;
    const busiest = (calls / 30) * w.peakDay;
    let served = 1;
    if (busiest > cap) { capHit = true; served = cap / busiest; refused += calls * (1 - served); }
    const ai = (trialScans + paidScans) * served * scanCost;

    // the platform
    storageGB += (active * w.photosPerActive * 0.6) / 1024;
    const egressGB = (active * w.egressMbPerActive) / 1024;
    if (storageGB > 1 || egressGB > 5) onPro = true;
    let supabase = 0;
    if (onPro) {
      supabase = 25 + Math.max(0, storageGB - 100) * 0.0213 + Math.max(0, egressGB - 250) * 0.09;
      if (!s.thumbs) supabase += (Math.max(0, active * w.resizedPerActive - 100) / 1000) * 5;
    }
    const updateMau = active * 0.7;
    const expo = updateMau <= 1000 ? 0 : Math.min(19 + Math.max(0, updateMau - 3000) * 0.005, 199 + Math.max(0, updateMau - 50000) * 0.005);
    const resend = fresh * 1.2 > 3000 ? 20 : 0;
    const vercel = selling ? 20 : 0;
    const platform = supabase + expo + resend + vercel;
    if (platform > 0 && firstBill == null) firstBill = m + 1;

    const monthCost = ai + platform;
    cost += monthCost;
    revenue += monthRevenue;
    worstMonth = Math.max(worstMonth, monthCost);
  }
  return { keepers, cost, revenue, net: revenue - cost, worstMonth, capHit, firstBill, refused, wall: wallTotal, launched };
}

/* ---- run it ------------------------------------------------------------ */
const rng = mulberry32(20261012);
const results = Object.fromEntries(STRATEGIES.map((s) => [s.key, []]));
for (let i = 0; i < RUNS; i++) {
  const w = drawWorld(rng);
  for (const s of STRATEGIES) results[s.key].push(simulate(w, s));
}

const q = (xs, p) => { const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
const usd = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const pct = (n) => (n * 100).toFixed(0) + "%";
const band = (xs) => `${usd(q(xs, 0.1))} / ${usd(q(xs, 0.5))} / ${usd(q(xs, 0.9))}`;

const k = results.now.map((x) => x.keepers);
console.log(`${RUNS.toLocaleString()} simulated years, Oct 2026 - Sep 2027. Figures are 10th / median / 90th percentile.\n`);
console.log(`Keepers after a year: ${q(k, 0.1).toLocaleString()} / ${q(k, 0.5).toLocaleString()} / ${q(k, 0.9).toLocaleString()}`);
const wall = results.now.map((x) => x.wall);
console.log(`Keepers who use all 5 free scans: ${Math.round(q(wall, 0.1))} / ${Math.round(q(wall, 0.5))} / ${Math.round(q(wall, 0.9))}  -- the people with nothing to buy today\n`);

for (const s of STRATEGIES) {
  const rs = results[s.key];
  const nets = rs.map((x) => x.net);
  const fb = rs.map((x) => x.firstBill).filter((x) => x != null);
  console.log(s.name);
  console.log(`  year's cost      ${band(rs.map((x) => x.cost))}`);
  if (s.subsFrom != null || s.packsFrom != null || s.subsWhenWall != null) {
    console.log(`  year's revenue   ${band(rs.map((x) => x.revenue))}`);
    console.log(`  year's net       ${band(nets)}   chance of ending ahead: ${pct(nets.filter((n) => n > 0).length / RUNS)}`);
  }
  if (s.subsWhenWall != null) {
    const l = rs.map((x) => x.launched).filter((x) => x != null);
    console.log(`  subscription switched on in ${pct(l.length / RUNS)} of years, median month ${q(l, 0.5) + 1}`);
  }
  console.log(`  worst month      ${band(rs.map((x) => x.worstMonth))}`);
  console.log(`  first platform bill by month ${fb.length ? q(fb, 0.5) : "-"} (median) in ${pct(fb.length / RUNS)} of years`);
  console.log(`  ${s.cap ?? GLOBAL_CAP}/day AI cap turns people away in ${pct(rs.filter((x) => x.capHit).length / RUNS)} of years\n`);
}

// Same world, strategy against strategy: how often is one better than the other?
const better = (a, b) => results[a].filter((x, i) => x.net > results[b][i].net).length / RUNS;
console.log("Head to head, on the same simulated years:");
console.log(`  thumbnails beat as-now           ${pct(better("thumbs", "now"))} of years (never worse)`);
console.log(`  scan packs beat thumbnails only  ${pct(better("packs", "thumbs"))}`);
console.log(`  subscription beats thumbnails    ${pct(better("subs", "thumbs"))}`);
console.log(`  scan packs beat subscription     ${pct(better("packs", "subs"))}`);
console.log(`  wait-for-100 beats subscription now ${pct(better("trigger", "subs"))}`);
console.log(`  wait-for-100 beats thumbnails only ${pct(better("trigger", "thumbs"))}`);
console.log(`  3 free scans save, a year        ${band(results.thumbs.map((x, i) => x.cost - results.three[i].cost))}`);

// The same, split by how the year went: the choice matters most in the years
// that grow, which is when the bill grows too.
const BUCKETS = [["under 500 keepers", 0, 500], ["500-2,000", 500, 2000], ["over 2,000", 2000, Infinity]];
console.log("\nMedian net for the year, by how big it got:");
console.log("  " + "".padEnd(62) + BUCKETS.map(([n]) => n.padStart(19)).join(""));
for (const s of STRATEGIES) {
  const cells = BUCKETS.map(([, lo, hi]) => {
    const xs = results[s.key].filter((x) => x.keepers >= lo && x.keepers < hi).map((x) => x.net);
    return (xs.length ? usd(q(xs, 0.5)) : "-").padStart(19);
  });
  console.log("  " + s.name.padEnd(62) + cells.join(""));
}
const share = BUCKETS.map(([n, lo, hi]) => `${n} ${pct(results.now.filter((x) => x.keepers >= lo && x.keepers < hi).length / RUNS)}`);
console.log("  (share of years: " + share.join(", ") + ")");
