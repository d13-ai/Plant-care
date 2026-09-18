// What PlantParlour costs and earns at a given size, from stated assumptions.
//
//   node scripts/pricing-model.mjs
//
// Every number it prints comes from the constants below, so the argument is
// about the assumptions rather than the arithmetic. Change one and re-run.
//
// The measured inputs (see docs/PRICING.md, and re-run the SQL there):
//   * a billed AI call averaged $0.0352 over 17 calls, 13-17 Sep 2026
//   * a real photo scan sends up to three 1024px photos in ONE call, so it
//     costs 2-7c depending on how many ride along; 7c is the planning figure
//   * identification runs on Opus 5 ($5/$25 per Mtok), health on Sonnet 5
//     ($2/$10) as of 18 Sep -- Sonnet is 40% of Opus on the same tokens
//
// What is assumed rather than measured is everything about behaviour. We have
// four keepers and five days of history; nobody can honestly derive a usage
// curve from that. The personas below are judgement, and they are the first
// thing to replace with real counts once there are any.

const SCAN = {
  identify: 0.07, // Opus 5, a three-photo scan
  health: 0.028, // Sonnet 5, same tokens, 40% of the above
};

/** Stripe, US card, as of Sep 2026. */
const STRIPE = { pct: 0.029, fixed: 0.3 };

/** What the project pays whether anybody shows up or not. */
const FIXED_MONTHLY = 25 /* Supabase Pro */ + 20 /* Vercel Pro */;

/** The free trial as the code actually implements it: PHOTO_TRIAL, lifetime. */
const FREE_SCANS_LIFETIME = 5;

/** Share of keepers who subscribe. Pure assumption — nothing measures this. */
const CONVERSION_NOTE = 0.03;

/** How long the keepers at a given size are assumed to have arrived over. */
const RAMP_MONTHS = 12;

const PRICES = {
  monthly: 5.99,
  annual: 39.99,
};

/**
 * Three keepers, drawn from who the product brief says it is for. Month one
 * is the burst: somebody photographs the collection they already own. After
 * that a scan happens when a plant arrives or something looks wrong.
 */
const PERSONAS = [
  {
    name: "Casual (8 plants)",
    share: 0.6,
    firstMonth: { identify: 8, health: 2 },
    steady: { identify: 1, health: 1 },
  },
  {
    name: "Enthusiast (25 plants)",
    share: 0.3,
    firstMonth: { identify: 20, health: 5 },
    steady: { identify: 2, health: 3 },
  },
  {
    name: "Collector (60+ plants)",
    share: 0.1,
    firstMonth: { identify: 45, health: 10 },
    steady: { identify: 4, health: 6 },
  },
];

const cost = (s) => s.identify * SCAN.identify + s.health * SCAN.health;
const scans = (s) => s.identify + s.health;
const usd = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
const pct = (n) => (n * 100).toFixed(0) + "%";

/** What a subscriber nets after Stripe, per month, on each plan. */
const netMonthly = {
  monthly: PRICES.monthly * (1 - STRIPE.pct) - STRIPE.fixed,
  annual: (PRICES.annual * (1 - STRIPE.pct) - STRIPE.fixed) / 12,
};

console.log("=== what a scan costs ===");
console.log(`  identify (Opus)  ${usd(SCAN.identify)}`);
console.log(`  health   (Sonnet) ${usd(SCAN.health)}   ${pct(SCAN.health / SCAN.identify)} of an identify`);

console.log("\n=== what a subscription nets, after Stripe ===");
console.log(`  $${PRICES.monthly}/month  -> ${usd(netMonthly.monthly)}/month   (fee ${pct(1 - netMonthly.monthly / PRICES.monthly)})`);
console.log(`  $${PRICES.annual}/year   -> ${usd(netMonthly.annual)}/month   (fee ${pct(1 - (netMonthly.annual * 12) / PRICES.annual)})`);
console.log("  The same card fee lands twelve times on the monthly plan and once on the annual.");

console.log("\n=== what each keeper costs to serve ===");
console.log("  persona                 share   month 1 scans   month 1 cost   steady scans   steady cost");
for (const p of PERSONAS) {
  console.log(
    `  ${p.name.padEnd(22)} ${pct(p.share).padStart(5)}` +
      `${String(scans(p.firstMonth)).padStart(14)}` +
      `${usd(cost(p.firstMonth)).padStart(15)}` +
      `${String(scans(p.steady)).padStart(15)}` +
      `${usd(cost(p.steady)).padStart(14)}`,
  );
}
const blended = {
  firstMonth: PERSONAS.reduce((a, p) => a + p.share * cost(p.firstMonth), 0),
  steady: PERSONAS.reduce((a, p) => a + p.share * cost(p.steady), 0),
  steadyScans: PERSONAS.reduce((a, p) => a + p.share * scans(p.steady), 0),
};
console.log(
  `  ${"blended".padEnd(22)} ${"".padStart(5)}${"".padStart(14)}` +
    `${usd(blended.firstMonth).padStart(15)}` +
    `${blended.steadyScans.toFixed(1).padStart(15)}` +
    `${usd(blended.steady).padStart(14)}`,
);

console.log("\n=== margin per subscriber ===");
for (const [plan, net] of Object.entries(netMonthly)) {
  const first = net - blended.firstMonth;
  const steady = net - blended.steady;
  console.log(
    `  ${plan.padEnd(8)} month 1: ${usd(first)} (${pct(first / net)})` +
      `   steady: ${usd(steady)} (${pct(steady / net)})`,
  );
}

console.log("\n=== where an allowance stops paying for itself ===");
console.log("  (a subscriber who uses the whole allowance, every month)");
console.log("  allowance   all identify        all health         half and half");
for (const n of [20, 30, 40, 50, 79, 100]) {
  const id = netMonthly.monthly - n * SCAN.identify;
  const he = netMonthly.monthly - n * SCAN.health;
  const mix = netMonthly.monthly - n * (SCAN.identify + SCAN.health) / 2;
  const cell = (v) => `${usd(v)} (${pct(v / netMonthly.monthly)})`.padStart(18);
  console.log(`  ${String(n).padStart(9)}   ${cell(id)} ${cell(he)} ${cell(mix)}`);
}

console.log("\n=== the whole business, at four sizes ===");
console.log("  A KEEPER is anyone with an account: free, costs their 5-scan trial once");
console.log("  (" + usd(FREE_SCANS_LIFETIME * SCAN.identify) + ") and about nothing after that.");
console.log("  A SUBSCRIBER is a keeper who pays: " + pct(CONVERSION_NOTE) + " of them, by assumption.");
console.log("\n  Every column is PER MONTH. The trial is a one-off per keeper, so it is");
console.log("  charged here over the " + RAMP_MONTHS + " months those keepers are assumed to arrive in —");
console.log("  which is what makes it a growth cost rather than a running one.");
const CONVERSION = CONVERSION_NOTE;
const ANNUAL_SHARE = 0.7;
console.log("\n  keepers   subs   revenue/mo   subs AI/mo   trials/mo   fixed/mo   profit/mo   (trials, total one-off)");
for (const keepers of [100, 1000, 10000, 50000]) {
  const subs = Math.round(keepers * CONVERSION);
  const revenue = subs * (ANNUAL_SHARE * netMonthly.annual + (1 - ANNUAL_SHARE) * netMonthly.monthly);
  const aiPaid = subs * blended.steady;
  const trialsTotal = (keepers - subs) * FREE_SCANS_LIFETIME * SCAN.identify;
  const trialsMonthly = trialsTotal / RAMP_MONTHS;
  const profit = revenue - aiPaid - trialsMonthly - FIXED_MONTHLY;
  console.log(
    `  ${String(keepers).padStart(7)}   ${String(subs).padStart(4)}   ${usd(revenue).padStart(10)}   ` +
      `${usd(aiPaid).padStart(10)}   ${usd(trialsMonthly).padStart(9)}   ${usd(FIXED_MONTHLY).padStart(8)}   ` +
      `${usd(profit).padStart(9)}   ${usd(trialsTotal).padStart(22)}`,
  );
}
console.log("\n  Once growth stops the trials column goes to zero and the profit column");
console.log("  gains it back. Growing costs money here; standing still does not.");

console.log("\n=== what $1,000/month takes ===");
const perSub = ANNUAL_SHARE * netMonthly.annual + (1 - ANNUAL_SHARE) * netMonthly.monthly - blended.steady;
const trialDragPerSub = ((1 / CONVERSION_NOTE) - 1) * FREE_SCANS_LIFETIME * SCAN.identify / RAMP_MONTHS;
const need = Math.ceil((1000 + FIXED_MONTHLY) / (perSub - trialDragPerSub));
console.log(`  ${usd(perSub)} per subscriber per month, before the trials of the keepers who did not subscribe`);
console.log(`  ${usd(trialDragPerSub)} of trial cost rides on each subscriber while growing at this rate`);
console.log(`  -> ${need} subscribers, which at ${pct(CONVERSION)} conversion is ${Math.ceil(need / CONVERSION).toLocaleString()} keepers`);
