// What PlantParlour costs and earns at a given size, from stated assumptions.
//
//   node scripts/pricing-model.mjs
//
// Every number it prints comes from the constants below, so the argument is
// about the assumptions rather than the arithmetic. Change one and re-run.
// docs/PRICING.md walks through what it prints.
//
// MEASURED (12 Oct 2026; re-run the SQL in docs/PRICING.md to refresh):
//   * an identification (Opus 5.5, $4/$20 per Mtok) cost 7.6c: 9.2k tokens in,
//     1.9k out -- most of the output is the model thinking
//   * a health check (Sonnet 5.5, $2/$10) cost 4.2-4.6c: 14-17k tokens in,
//     because it carries an earlier photo to compare with and the care brief.
//     The September planning figure of 2.8c assumed one photo; it was low
//   * a care guide for a species nobody has asked about is 0.7c, once, and
//     161 species are already in the library at no cost
//   * photos average 599 KB stored; resized through the render endpoint a
//     grid thumbnail is ~12 KB
//   * plans in use: Supabase FREE, Vercel HOBBY, Expo FREE, Resend free.
//     The September model assumed $45/month of Supabase Pro + Vercel Pro;
//     today the fixed bill is $0
//
// LIST PRICES (12 Oct 2026; check before relying on them):
//   Supabase Free: 1 GB storage, 5 GB egress, 50k MAU, pauses when idle a week.
//     Pro $25: 100 GB storage (+$0.0213/GB), 250 GB egress (+$0.09/GB),
//     100k MAU (+$0.00325), image transformations 100 origin images
//     (+$5 per 1,000). Transformations are documented as Pro-only; they
//     answer on our free project today, which may not last.
//   Vercel Hobby is "non-commercial, personal use only". Pro $20/seat.
//   Expo Free: 1,000 update MAU, no overage. Starter $19: 3,000 then $0.005.
//     Production $199: 50,000 then $0.005.
//   Resend free: 3,000 emails/month, 100/day. Pro $20: 50,000.
//   Google Play, auto-renewing subscriptions: 10% service + 5% billing fee.
//   Stripe, US card: 2.9% + 30c.
//
// ASSUMED: everything about behaviour. Ten keepers and one month of history
// can't produce a usage curve; the numbers marked ASSUMED are judgement and
// the first thing to replace with real counts.

const SCAN = { identify: 0.076, health: 0.044 };
const NEW_SPECIES_GUIDE = 0.007;

/** Lifetime photo checks per keeper (PHOTO_TRIAL in _shared/cap.ts). */
const TRIAL = 5;
/** ASSUMED: of the five, how many an average new keeper uses. Measured so
 *  far: 1 scan across 9 keepers. 2.5 is half, which is generous to cost. */
const TRIAL_USED = 2.5;
/** ASSUMED: share of trial scans that are identifications, not health checks. */
const TRIAL_IDENTIFY_SHARE = 0.8;

/** ASSUMED: keepers arrive evenly over this many months. */
const RAMP_MONTHS = 12;
/** ASSUMED: share of keepers who open the app in a given month. */
const MONTHLY_ACTIVE = 0.4;
/** ASSUMED: share of keepers on the Android app (the rest use the website,
 *  which has no EAS Update and, for a subscription, pays Stripe). */
const ANDROID_SHARE = 0.7;
/** ASSUMED: photos an active keeper adds a month, and stored per keeper on
 *  average at the size modelled (lots of keepers never add one). */
const PHOTOS_PER_ACTIVE_MONTH = 3;
const PHOTOS_STORED_PER_KEEPER = 12;
const PHOTO_MB = 0.6;
/** ASSUMED: what an active keeper pulls a month -- thumbnails, a few full
 *  photos, a public tag or two. */
const EGRESS_MB_PER_ACTIVE = 25;
/** ASSUMED: distinct photos resized through the render endpoint per active
 *  keeper per month. A keeper's own phone shows local files; this is second
 *  devices, the website and public tags. */
const ORIGIN_IMAGES_PER_ACTIVE = 8;
/** Emails per new keeper (welcome) plus a little account mail. */
const EMAILS_PER_SIGNUP = 1.2;

/** ASSUMED: share of keepers who would subscribe, once there is something
 *  to subscribe to. Nothing measures this. */
const CONVERSION = 0.03;
const ANNUAL_SHARE = 0.7;
const PRICES = { monthly: 5.99, annual: 39.99 };
const PLAY = 0.15;
const STRIPE = { pct: 0.029, fixed: 0.3 };

/**
 * Three subscribers, drawn from who the product brief says it is for. Month
 * one is the burst: somebody photographs the collection they already own.
 * After that a scan happens when a plant arrives or something looks wrong.
 */
const PERSONAS = [
  { name: "Casual (8 plants)", share: 0.6, firstMonth: { identify: 8, health: 2 }, steady: { identify: 1, health: 1 } },
  { name: "Enthusiast (25)", share: 0.3, firstMonth: { identify: 20, health: 5 }, steady: { identify: 2, health: 3 } },
  { name: "Collector (60+)", share: 0.1, firstMonth: { identify: 45, health: 10 }, steady: { identify: 4, health: 6 } },
];

const usd = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
const usd0 = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const cents = (n) => (n * 100).toFixed(1) + "c";
const pct = (n) => (n * 100).toFixed(0) + "%";
const cost = (s) => s.identify * SCAN.identify + s.health * SCAN.health;
const scans = (s) => s.identify + s.health;

const trialScan = TRIAL_IDENTIFY_SHARE * SCAN.identify + (1 - TRIAL_IDENTIFY_SHARE) * SCAN.health;
const trialCost = TRIAL_USED * trialScan;
const trialCostFull = TRIAL * SCAN.identify;
const blended = {
  firstMonth: PERSONAS.reduce((a, p) => a + p.share * cost(p.firstMonth), 0),
  steady: PERSONAS.reduce((a, p) => a + p.share * cost(p.steady), 0),
  steadyScans: PERSONAS.reduce((a, p) => a + p.share * scans(p.steady), 0),
};

/** Net per subscriber per month, by where they paid. */
const net = {
  playMonthly: PRICES.monthly * (1 - PLAY),
  playAnnual: (PRICES.annual * (1 - PLAY)) / 12,
  webMonthly: PRICES.monthly * (1 - STRIPE.pct) - STRIPE.fixed,
  webAnnual: (PRICES.annual * (1 - STRIPE.pct) - STRIPE.fixed) / 12,
};
const netPerSub =
  ANDROID_SHARE * (ANNUAL_SHARE * net.playAnnual + (1 - ANNUAL_SHARE) * net.playMonthly) +
  (1 - ANDROID_SHARE) * (ANNUAL_SHARE * net.webAnnual + (1 - ANNUAL_SHARE) * net.webMonthly);

/** The platform bill at a given size, line by line. `selling` is whether a
 *  subscription is on sale, which is what makes Vercel Hobby unusable. */
function platform(keepers, selling) {
  const active = keepers * MONTHLY_ACTIVE;
  const signups = keepers / RAMP_MONTHS;
  const storageGB = (keepers * PHOTOS_STORED_PER_KEEPER * PHOTO_MB) / 1024;
  const egressGB = (active * EGRESS_MB_PER_ACTIVE) / 1024;
  const origins = active * ORIGIN_IMAGES_PER_ACTIVE;
  const updateMau = active * ANDROID_SHARE;
  const emails = signups * EMAILS_PER_SIGNUP;

  const supabaseFree = storageGB <= 1 && egressGB <= 5 && active <= 50_000;
  const transforms = supabaseFree ? 0 : (Math.max(0, origins - 100) / 1000) * 5;
  const supabase = supabaseFree
    ? 0
    : 25 +
      Math.max(0, storageGB - 100) * 0.0213 +
      Math.max(0, egressGB - 250) * 0.09 +
      Math.max(0, active - 100_000) * 0.00325 +
      transforms;
  const expo =
    updateMau <= 1000
      ? 0
      : Math.min(19 + Math.max(0, updateMau - 3000) * 0.005, 199 + Math.max(0, updateMau - 50_000) * 0.005);
  const vercel = selling ? 20 : 0;
  const resend = emails <= 3000 && signups / 30 <= 100 ? 0 : 20;
  return {
    active, signups, storageGB, egressGB, origins, updateMau,
    supabase, transforms, supabaseWhy: supabaseFree ? "free" : storageGB > 1 ? "storage > 1 GB" : "egress > 5 GB",
    expo, vercel, resend,
    total: supabase + expo + vercel + resend,
  };
}

console.log("=== unit costs (measured 7-11 Oct) ===");
console.log(`  identification (Opus 5.5)     ${cents(SCAN.identify)}`);
console.log(`  health check (Sonnet 5.5)     ${cents(SCAN.health)}`);
console.log(`  care guide, new species       ${cents(NEW_SPECIES_GUIDE)}  once, then free to everyone`);
console.log(`  a keeper's trial, all ${TRIAL} used  ${usd(trialCostFull)}   at ${TRIAL_USED} used (assumed): ${usd(trialCost)}`);

console.log("\n=== 1. as a free app: what growth costs, per month ===");
console.log("  No revenue. Keepers arrive over " + RAMP_MONTHS + " months; the trial is paid as they arrive.");
console.log("  keepers  active  signups/mo   AI/mo  Supabase (resizing)   Expo  Resend   total/mo   per keeper   photos GB");
for (const keepers of [100, 500, 1000, 2500, 10000, 50000]) {
  const p = platform(keepers, false);
  const ai = p.signups * trialCost;
  const total = ai + p.total;
  console.log(
    `  ${String(keepers).padStart(7)} ${String(Math.round(p.active)).padStart(7)} ${String(Math.round(p.signups)).padStart(11)}` +
      ` ${usd0(ai).padStart(7)} ${usd0(p.supabase).padStart(9)} ${("(" + usd0(p.transforms) + ")").padStart(11)} ${usd0(p.expo).padStart(6)} ${usd0(p.resend).padStart(7)}` +
      ` ${usd0(total).padStart(10)} ${usd(total / keepers).padStart(12)} ${p.storageGB.toFixed(1).padStart(12)}`,
  );
}
const storageLimitKeepers = Math.floor(1024 / (PHOTOS_STORED_PER_KEEPER * PHOTO_MB));
console.log(`\n  Supabase Free's 1 GB of photos runs out at about ${storageLimitKeepers} keepers`);
console.log(`  (${Math.floor(1024 / PHOTO_MB).toLocaleString()} photos at ${PHOTO_MB * 1000} KB). That is the first bill: $25/month.`);
console.log("  Once growth stops, the AI column goes to about zero: the trial is a one-off.");
console.log("  (resizing) is Supabase image transformations, $5 per 1,000 photos resized a month:");
console.log("  the biggest platform line at scale, and avoidable by saving a thumbnail at upload.");

console.log("\n=== 2. what a subscriber nets, by where they pay ===");
console.log(`  Google Play  $${PRICES.monthly}/mo -> ${usd(net.playMonthly)}   $${PRICES.annual}/yr -> ${usd(net.playAnnual)}/mo   (15% either way)`);
console.log(`  Web/Stripe   $${PRICES.monthly}/mo -> ${usd(net.webMonthly)}   $${PRICES.annual}/yr -> ${usd(net.webAnnual)}/mo`);
console.log(`  blended (${pct(ANDROID_SHARE)} Play, ${pct(ANNUAL_SHARE)} annual): ${usd(netPerSub)}/month`);

console.log("\n=== 3. what a subscriber costs to serve ===");
console.log("  persona              share   month 1        steady");
for (const p of PERSONAS) {
  console.log(
    `  ${p.name.padEnd(20)} ${pct(p.share).padStart(5)}   ${String(scans(p.firstMonth)).padStart(2)} ${usd(cost(p.firstMonth)).padStart(6)}` +
      `   ${String(scans(p.steady)).padStart(3)} ${usd(cost(p.steady)).padStart(6)}`,
  );
}
console.log(`  blended                       ${usd(blended.firstMonth).padStart(9)}   ${blended.steadyScans.toFixed(1).padStart(3)} ${usd(blended.steady).padStart(6)}`);
console.log(`  margin, steady: ${usd(netPerSub - blended.steady)} of ${usd(netPerSub)} (${pct((netPerSub - blended.steady) / netPerSub)})`);

console.log("\n=== 4. a paid allowance, used in full every month ===");
console.log("  allowance   all identify      all health        half and half");
for (const n of [20, 30, 50, 75, 100]) {
  const cell = (per) => {
    const v = netPerSub - n * per;
    return `${usd(v)} (${pct(v / netPerSub)})`.padStart(16);
  };
  console.log(`  ${String(n).padStart(9)}  ${cell(SCAN.identify)}  ${cell(SCAN.health)}  ${cell((SCAN.identify + SCAN.health) / 2)}`);
}

console.log(`\n=== 5. with a subscription: the business at six sizes, per month ===`);
console.log(`  ${pct(CONVERSION)} of keepers subscribe (assumed). Vercel Pro is needed once anything is sold.`);
console.log("  keepers   subs   revenue   subs AI   trials   platform    profit");
let breakEven = null;
for (const keepers of [100, 500, 1000, 2500, 10000, 50000]) {
  const p = platform(keepers, true);
  const subs = Math.round(keepers * CONVERSION);
  const revenue = subs * netPerSub;
  const subsAi = subs * blended.steady;
  const trials = p.signups * trialCost;
  const profit = revenue - subsAi - trials - p.total;
  console.log(
    `  ${String(keepers).padStart(7)} ${String(subs).padStart(6)} ${usd0(revenue).padStart(9)} ${usd0(subsAi).padStart(9)}` +
      ` ${usd0(trials).padStart(8)} ${usd0(p.total).padStart(10)} ${usd0(profit).padStart(9)}`,
  );
}
for (let k = 50; k <= 100_000; k += 50) {
  const p = platform(k, true);
  const subs = k * CONVERSION;
  if (subs * (netPerSub - blended.steady) - (k / RAMP_MONTHS) * trialCost - p.total >= 0) { breakEven = k; break; }
}
console.log(`\n  Break-even while growing: about ${breakEven?.toLocaleString()} keepers (${Math.round((breakEven ?? 0) * CONVERSION)} subscribers).`);
let target = null;
for (let k = 50; k <= 200_000; k += 50) {
  const p = platform(k, true);
  if (k * CONVERSION * (netPerSub - blended.steady) - (k / RAMP_MONTHS) * trialCost - p.total >= 1000) { target = k; break; }
}
console.log(`  $1,000/month profit while growing: about ${target?.toLocaleString()} keepers (${Math.round((target ?? 0) * CONVERSION)} subscribers).`);

console.log("\n=== 6. the ceilings that protect the bill ===");
const GLOBAL_DAILY_CAP = 200;
console.log(`  AI_DAILY_GLOBAL_CAP ${GLOBAL_DAILY_CAP} calls/day: worst case ${usd0(GLOBAL_DAILY_CAP * SCAN.identify)}/day, ${usd0(GLOBAL_DAILY_CAP * SCAN.identify * 30)}/month.`);
console.log(`  It binds at about ${Math.round(GLOBAL_DAILY_CAP / TRIAL_USED)} new keepers in one day, if each uses the trial on day one;`);
console.log("  raise it before a launch or a post that might travel, or new keepers are refused.");
