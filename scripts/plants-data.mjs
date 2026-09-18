/**
 * The plant care library's knowledge layer.
 *
 * `src/domain/species.ts` is the single source of truth for *which* plants
 * exist and what cadences they get — the app reads it, and so does the page
 * generator. This file adds what a care page needs and a reminder cadence
 * can't carry: light, humidity, soil, feeding, propagation, toxicity, and
 * the handful of things that actually go wrong with each plant.
 *
 * Two levels, because that is how the knowledge is really shaped:
 *
 *   GENUS  — everything Monsteras share, everything Alocasias share. Most
 *            care genuinely is a genus-level fact, and pretending otherwise
 *            would mean inventing differences that don't exist.
 *   PLANTS — keyed by slug. The species' own identity: what it is, how big
 *            it gets, where it's from, and any field where it departs from
 *            its genus. `problems` and `faq` here are *added* to the genus
 *            ones; every other field replaces.
 *
 * A page with no PLANTS entry still renders from its genus — it just has no
 * blurb, and `npm run plants` will say so. Keep the claims conservative:
 * these pages are read by people about to water something.
 */

/** Toxicity lines are written to the ASPCA's classification for cats and dogs. */
const OXALATE = "Toxic to cats, dogs and people if chewed — the sap carries insoluble calcium oxalate crystals, which burn the mouth and throat. Keep it off the floor if anything in the house tastes its way through life.";

export const GENUS = {
  // ---------------------------------------------------------------- Aroids
  Monstera: {
    light: "Bright indirect light; an hour or two of early sun is fine, midday sun is not",
    lightLong:
      "Bright indirect light, which in practice means a metre or two back from an east or west window, or right up against a north one. Monsteras will survive in low light and simply stop earning their name: the new leaves come out smaller and solid, with no splits. Direct midday sun bleaches them to a pale khaki.",
    humidity: "Happy at normal room humidity; better above 50%",
    soil: "A chunky aroid mix — bark, perlite and coir, something water runs straight through",
    soilLong:
      "Monsteras are climbers that root into bark in the wild, not into soil. A peat-only compost holds water against the roots and is the usual reason a healthy plant turns yellow. Cut potting soil half-and-half with orchid bark and perlite, or buy a ready-made aroid mix.",
    feed: "A balanced liquid feed at half strength, every second or third watering in spring and summer",
    repotNote:
      "Repot when roots come out of the drainage holes, in spring. Go up one pot size only — a monstera in too big a pot sits wet. Give it a moss pole at the same time: aerial roots that find something to climb produce noticeably larger, better-fenestrated leaves.",
    toxicity: OXALATE,
    propagation:
      "Cut just below a node — the brown bump where a leaf and an aerial root meet. A cutting with a node and one leaf roots in water in three to six weeks, or straight into damp sphagnum. A cutting without a node will never root, however long you wait.",
    waterHow:
      "Water when the top 5 cm of mix is dry, then water until it runs out of the bottom. Monsteras would rather be a day late than a day early.",
    problems: [
      ["Yellow leaves, usually the oldest ones first", "Overwatering, or a mix that holds water. The roots have been wet long enough to start dying back.", "Let it dry out further between waterings, and repot into something chunkier if the mix stays soggy for days."],
      ["New leaves come out small and with no splits", "Not enough light, or nothing to climb.", "Move it closer to the window and give it a moss pole. Fenestration is a maturity signal; the plant withholds it when conditions say stay small."],
      ["Brown crispy edges", "Dry air, or a build-up of salts from tap water and fertiliser.", "Raise humidity, and flush the pot thoroughly with plain water every few months."],
      ["Fine webbing between stems, leaves stippled pale", "Spider mites, which arrive in dry warm air.", "Shower the whole plant, then treat every five days for three weeks — one treatment never gets the eggs."],
    ],
  },
  Philodendron: {
    light: "Bright indirect light; tolerates a shadier spot than most",
    lightLong:
      "Bright indirect light suits them, and most philodendrons cope with genuinely dim corners better than a monstera will — they just grow slower and stretch. Variegated forms are the exception: white and pink tissue cannot photosynthesise, so those plants need more light than their green siblings, not less.",
    humidity: "Fine at room humidity, faster growth above 60%",
    soil: "Loose, airy aroid mix with plenty of bark and perlite",
    soilLong:
      "Almost all of them climb or creep rather than sit in deep soil, so the roots want air. Half potting compost, half bark and perlite is the standard recipe. Crawlers like gloriosum want a shallow wide pot rather than a deep one — the rhizome runs along the surface.",
    feed: "Balanced liquid feed at half strength every third watering through the growing season",
    repotNote:
      "Every spring or two, one size up. A philodendron that has filled its pot pushes roots out of the drainage holes and dries out within a day or two of watering — that is the signal.",
    toxicity: OXALATE,
    propagation:
      "Stem cuttings root readily: take a section with at least one node and a leaf, and put it in water, perlite or damp sphagnum. Crawling species are divided instead, by cutting the rhizome between two growth points.",
    waterHow:
      "Water when the top third of the pot is dry. Philodendrons wilt visibly when genuinely thirsty and recover within hours, which makes them easy to read.",
    problems: [
      ["Long bare stems with leaves far apart", "Too little light. The plant is reaching.", "Move it brighter and cut the leggy growth back — it will branch from the nodes below the cut."],
      ["Yellow lower leaves", "Usually overwatering; occasionally just age, one leaf at a time.", "If several go at once, check the roots. Brown and soft means rot; trim them and repot into fresh airy mix."],
      ["Variegation fading back to plain green", "Not enough light for the plant to afford the white tissue.", "Give it more light, and prune back to a node that still shows variegation — the plant grows on from the last variegated point."],
      ["Brown tips on new leaves that were fine in the old pot", "Low humidity while the leaf was still unfurling.", "Group plants together or run a humidifier while new leaves open; the damage is cosmetic and permanent on that leaf."],
    ],
  },
  Thaumatophyllum: {
    inherit: "Philodendron",
    light: "Bright indirect to a couple of hours of direct sun",
    lightLong:
      "Brighter than most philodendrons: this is a self-heading plant from open forest edges, and it will take morning sun happily. In dim light the leaf stalks stretch out until the plant flops.",
    repotNote:
      "Repot every second spring. It builds a thick woody trunk over time and gets heavy — a wide, weighted pot stops it tipping.",
  },
  Epipremnum: {
    light: "Anything from bright indirect to a dim corner",
    lightLong:
      "Pothos is the plant that made 'tolerates low light' a cliché, and it earns it — but tolerating is not thriving. In a dark spot the leaves come smaller and the variegation fades; in bright indirect light the vines run and the pattern is crisp.",
    humidity: "Indifferent. Ordinary room air is fine",
    soil: "Standard potting compost with a handful of perlite",
    soilLong:
      "Pothos is not fussy. Ordinary compost with perlite mixed through for drainage does the job; it will also grow indefinitely in a jar of water, though a plant raised in water sulks if you later pot it into soil.",
    feed: "A balanced feed at half strength once a month in spring and summer",
    repotNote:
      "Every other spring. If the vines have gone long and bare at the top, cut them back hard at repotting time and push the cuttings into the same pot — that is how a full, bushy pothos is made.",
    toxicity: OXALATE,
    propagation:
      "The easiest cutting in the house. A 10 cm piece with two nodes roots in a glass of water in a fortnight. Change the water weekly.",
    waterHow:
      "Water when the top half of the pot is dry — pothos droops its whole canopy when thirsty and stands back up within a couple of hours of a drink.",
    problems: [
      ["Yellow leaves scattered through the plant", "Overwatering. Pothos is much more often killed by kindness than by neglect.", "Let it dry out properly between waterings and make sure the pot actually drains."],
      ["Variegation disappearing, new leaves plain green", "Not enough light.", "Move it brighter. Cut back to the last well-marked leaf; all-green growth will otherwise take over, because it grows faster."],
      ["Long stretches of bare vine", "Light coming from one direction and no pruning.", "Cut the bare vines back to 15 cm; new shoots come from the nodes below the cut."],
      ["Black soft patches at the base of the stems", "Root rot from standing water.", "Take healthy cuttings from the top of the vines, root those, and start again — a rotted crown rarely recovers."],
    ],
  },
  Scindapsus: {
    inherit: "Epipremnum",
    light: "Bright indirect light — the silver needs it",
    lightLong:
      "Bright indirect light. The silver flecking is a reflective layer over air pockets in the leaf, and in dim light the plant makes less of it, so a shaded satin pothos slowly turns plain green.",
    humidity: "Room humidity is fine; above 60% gives bigger leaves",
    propagation:
      "Node cuttings in water or sphagnum, the same as pothos, though Scindapsus is slower to root — give it a month.",
  },
  Rhaphidophora: {
    inherit: "Monstera",
    light: "Bright indirect light",
    lightLong:
      "Bright indirect light. It is not a monstera and not a philodendron despite both nicknames, but it wants the same thing: bright light out of the sun's direct path, and something to climb.",
    propagation:
      "Node cuttings root fast in water — a fortnight is normal. It is one of the quickest aroids to propagate.",
  },
  Anthurium: {
    light: "Bright indirect light, never direct sun",
    lightLong:
      "Bright indirect light. The flowering kinds need it to keep producing spathes; the velvet-leaved ones scorch easily and want the same brightness filtered through a sheer curtain.",
    humidity: "60% and up. This is the genus where humidity actually decides the outcome",
    soil: "Very chunky — mostly bark and perlite, barely any soil",
    soilLong:
      "Anthuriums are epiphytes. The mix should look wrong: mostly orchid bark and perlite with a little coir, loose enough that water pours straight through. Standard compost suffocates them within a season.",
    feed: "A weak orchid feed every second watering while growing",
    repotNote:
      "Every year or two, into a pot barely larger than the root ball. Bury the stem slightly deeper each time — anthuriums creep upward and go bald at the base otherwise.",
    toxicity: OXALATE,
    propagation:
      "Divide at the base where a plant has made side shoots with their own roots. Velvet species also produce seed from a pollinated spadix, but division is the practical route.",
    waterHow:
      "Water when the top of the mix is dry to the touch, and let it drain completely. In a bark mix that is often twice a week; in soil it would be a death sentence.",
    problems: [
      ["Brown crispy leaf edges", "Air too dry, or tap water minerals building up.", "Raise humidity above 60% and water with rain or filtered water if your tap is hard."],
      ["No flowers for months", "Not enough light, or not enough phosphorus.", "Move it brighter and switch to a feed with a higher middle number through spring and summer."],
      ["Yellowing leaves with a soft brown base", "Rot, almost always from a mix that holds water.", "Repot into bark and perlite, cutting away any root that is brown and mushy."],
      ["A bald woody stem with leaves only at the top", "Normal upward creep.", "Repot deeper, or cut the top off below a set of aerial roots and re-root it."],
    ],
  },
  Alocasia: {
    light: "Bright indirect light, as much as it can get without direct sun",
    lightLong:
      "Bright indirect light — more than people give them. An alocasia in a dim room loses a leaf for every new one it makes and slowly winds down to nothing. Direct afternoon sun, though, burns holes in those thin leaves.",
    humidity: "60% and above, or spider mites will find it",
    soil: "Chunky and fast-draining: bark, perlite, a little coir",
    soilLong:
      "Alocasias grow from a corm, and a corm sitting in wet compost rots. Use a very open mix and a pot with real drainage. Many growers keep them in semi-hydroponics for exactly this reason.",
    feed: "Balanced feed at half strength every second or third watering, spring through summer only",
    repotNote:
      "Once a year in spring. Expect to find offsets — small corms around the parent — which can be potted separately. Do not size up more than one pot at a time.",
    toxicity: OXALATE,
    propagation:
      "Separate the offsets at repotting. Each corm, even a bare one the size of a hazelnut, will sprout in damp sphagnum in a covered box over a few weeks.",
    waterHow:
      "Water when the top third dries, and never leave the pot standing in a saucer of water. Alocasias also drip water from their leaf tips in the morning — that is guttation, and it means the roots are working, not that anything is wrong.",
    problems: [
      ["Leaves dropping one after another over winter", "Dormancy. Alocasias often go down to nothing and come back in spring.", "Cut the water right back, keep the corm just barely damp, stop feeding, and wait. Throwing it out in February is the usual mistake."],
      ["Fine webbing, leaves going dull and stippled", "Spider mites. This genus is their favourite.", "Shower the plant, wipe both sides of every leaf, and treat weekly for a month. Raise the humidity or they come straight back."],
      ["Yellow leaf with a brown mushy stem", "Rot at the corm from a wet mix.", "Unpot immediately, cut back to firm white tissue, and repot into bark and perlite."],
      ["Dry brown patches in the middle of a leaf", "Sunburn.", "Move it out of direct sun; the damage does not heal."],
    ],
  },
  Colocasia: {
    inherit: "Alocasia",
    light: "Bright light, including several hours of direct sun",
    lightLong:
      "Bright light and happy in direct sun for part of the day — unlike its alocasia cousins, this is a marsh plant from open ground.",
    soil: "Rich and moisture-retentive — the one aroid that wants it wet",
    soilLong:
      "The exception to every aroid drainage rule. Colocasia grows in standing water in the wild and is perfectly happy in a heavy, rich compost kept constantly damp, even in a saucer of water.",
    waterHow:
      "Keep it wet. Not damp — wet. A colocasia that dries out fully drops its leaves and may not come back.",
    propagation: "Divide the clump in spring, or pot up the small tubers that form around the parent.",
  },
  Caladium: {
    inherit: "Alocasia",
    light: "Bright indirect light; the paler varieties want more",
    humidity: "60% and up while in leaf",
    repotNote:
      "Caladiums die back to the tuber every autumn. Keep the dry tuber in its pot somewhere warm over winter, stop watering entirely, and start again in spring — that is the plant's habit, not a failure.",
    propagation: "Lift and divide the tubers when dormant, making sure each piece has at least one bud.",
    waterHow: "Keep evenly damp while it is in leaf, then stop completely once it starts to die back in autumn.",
  },
  Zamioculcas: {
    light: "Anything. Bright indirect is best, a dark hallway is survivable",
    lightLong:
      "The ZZ plant handles more neglect and less light than anything else on this list. It grows faster in bright indirect light, but it will hold its looks for years in a corner that would kill a pothos.",
    humidity: "Indifferent",
    soil: "Free-draining — cactus compost, or standard mix cut with plenty of grit",
    soilLong:
      "It stores water in potato-like rhizomes under the surface, so the mix must let go of water quickly. Cactus compost with a little extra perlite is ideal.",
    feed: "A weak feed two or three times over the whole growing season. It genuinely does not need much",
    repotNote:
      "Every two or three years. You will know when the rhizomes start deforming the pot, which they do — plastic pots crack.",
    toxicity: OXALATE,
    propagation:
      "Divide the rhizomes, or lay a single leaflet flat on damp compost: it forms a small tuber in a few months and a shoot some months after that. Slow, but almost foolproof.",
    waterHow:
      "Water when the pot is completely dry, and then not very much. Three weeks between drinks is normal; six is survivable. Wrinkling stems, not drooping ones, are the signal it is thirsty.",
    problems: [
      ["Yellow stems that go soft at the base", "Overwatering. This is the only reliable way to kill a ZZ.", "Stop watering. Unpot, cut away any rotten rhizome, let the cut surfaces dry for a day, and repot in dry gritty mix."],
      ["Stems flopping outward from the centre", "Too little light — it is reaching — or a pot that has become top-heavy.", "Move it brighter. Staking is a cosmetic fix; the light is the cause."],
      ["Dusty, dull leaves", "Just dust. The waxy surface shows it.", "Wipe with a damp cloth. It improves the light reaching the plant more than people expect."],
    ],
  },
  Spathiphyllum: {
    light: "Medium to bright indirect light; no direct sun",
    lightLong:
      "Medium to bright indirect light. Peace lilies are sold as low-light plants and will live in a dim room, but they will not flower there. A spot with bright light and no direct sun gives you both the leaves and the spathes.",
    humidity: "Above 50% keeps the tips from browning",
    soil: "Standard potting compost with perlite through it",
    soilLong: "Ordinary peat-free compost with a third perlite. Peace lilies want moisture-retentive, not chunky — they are the least epiphytic aroid on this list.",
    feed: "Balanced feed at half strength monthly, spring to early autumn",
    repotNote: "Every spring while young, then every other year. Divide the clump at the same time if it has outgrown its place.",
    toxicity: OXALATE,
    propagation: "Divide the clump at repotting. Each division needs several leaves and its own roots.",
    waterHow:
      "Water when the top of the compost is dry. A peace lily dramatically collapses when thirsty and recovers within an hour of a drink — useful, but doing it repeatedly costs it leaves.",
    problems: [
      ["Brown crispy leaf tips", "Tap water minerals, over-feeding, or dry air — in that order of likelihood.", "Flush the pot with plain water, feed at half strength, and raise humidity."],
      ["Whole plant collapses", "Dry. It is theatrical about this.", "Water thoroughly. If it collapses while the compost is wet, the roots have rotted and the cause is the opposite."],
      ["Green flowers instead of white", "Too much fertiliser, or the spathe simply ageing.", "Cut the old spathes off at the base and ease off the feed."],
      ["No flowers at all", "Not enough light.", "Move it to a brighter spot out of the sun and feed through spring."],
    ],
  },
  Aglaonema: {
    light: "Medium indirect light; the pink and red kinds want it brighter",
    lightLong:
      "Medium indirect light suits the green and silver varieties, which is why they end up in offices. The pink, red and cream cultivars carry far less chlorophyll and need genuinely bright indirect light to keep their colour and keep growing.",
    humidity: "Room humidity is fine",
    soil: "Standard compost with perlite",
    soilLong: "Ordinary potting compost with a third perlite. Aglaonemas are not fussy; they only object to sitting wet.",
    feed: "Balanced feed at half strength monthly in spring and summer",
    repotNote: "Every second or third spring. They are slow and are perfectly happy slightly potbound.",
    toxicity: OXALATE,
    propagation: "Divide the clump, or root a stem cutting with two or three nodes in water.",
    waterHow: "Water when the top half of the pot is dry. Aglaonemas tolerate a missed week far better than an extra one.",
    problems: [
      ["Yellow lower leaves", "Overwatering, or cold.", "Let it dry further between waterings and keep it above 15 °C — they sulk in a draught."],
      ["Colour washing out of a pink or red variety", "Not enough light.", "Move it brighter, out of direct sun."],
      ["Grey mushy patches after a cold spell", "Cold damage.", "Remove the damaged leaves and move it away from the window or door that did it."],
    ],
  },
  Dieffenbachia: {
    inherit: "Aglaonema",
    light: "Bright indirect light",
    toxicity:
      "Toxic to cats, dogs and people. The common name — dumb cane — comes from the effect of chewing it: the calcium oxalate crystals swell the mouth and tongue and can make speech and swallowing painful for days. Worth placing out of reach of small children.",
    problems: [
      ["Leaning hard toward the window", "Uneven light. Dieffenbachia grows toward it faster than most.", "Turn the pot a quarter turn every week."],
      ["Bare stem with a tuft of leaves on top", "Normal ageing.", "Cut the crown off with 10 cm of stem and re-root it; the stump usually shoots again."],
      ["Yellow lower leaves", "Overwatering, or cold water.", "Let it dry down further and use tepid water."],
    ],
  },
  Syngonium: {
    inherit: "Philodendron",
    light: "Bright indirect light; the pink forms need more",
    lightLong:
      "Bright indirect light. Plain green syngoniums manage in medium light; the pink, white and speckled cultivars lose their markings without a bright spot.",
    repotNote:
      "Every spring while young — they grow fast. A syngonium that is allowed to climb changes leaf shape entirely, from the arrowhead most people know to a large lobed adult leaf.",
    propagation: "Node cuttings root in water within two or three weeks.",
  },

  // ----------------------------------------------------------------- Trees
  Ficus: {
    light: "Bright light, including some direct sun",
    lightLong:
      "Bright light, and the more the better — several hours of direct morning sun suits them. These are canopy trees, not understorey plants, and the leggy, leaf-dropping ficus in a dim corner is the single most common indoor failure of the genus.",
    humidity: "Room humidity is adequate; above 50% reduces leaf drop",
    soil: "Free-draining loam-based compost",
    soilLong:
      "A loam-based compost (John Innes No. 2 or its equivalent) with perlite mixed through. Ficus want weight and structure around the roots rather than the airy mixes aroids like.",
    feed: "Balanced feed at half strength every two to four weeks in spring and summer",
    repotNote:
      "Every second or third spring, one size up. A ficus resents disturbance and will usually drop leaves after repotting — that is normal and passes in a month.",
    toxicity:
      "Mildly toxic to cats and dogs. The milky sap irritates the mouth and stomach and can irritate skin on contact, so wear gloves when pruning.",
    propagation:
      "Take a stem cutting with two or three leaves in late spring, dip the cut end in water to stop the sap flowing, then root it in damp compost under a bag. Air layering is more reliable for a thick woody stem.",
    waterHow:
      "Water when the top 5 cm is dry, thoroughly, and empty the saucer. Ficus hate both extremes and will drop leaves to tell you about either.",
    problems: [
      ["Leaves dropping after you moved it", "Ficus dislike change — light, temperature, position, all of it.", "Put it somewhere bright and leave it there. Resist the urge to fix it; the drop stops within a few weeks."],
      ["Brown spots spreading from the leaf edges", "Overwatering. The roots are suffocating.", "Let the top third dry out fully before the next water, and check the pot drains freely."],
      ["Bare lower stem, leaves only at the top", "Not enough light.", "Move it into the brightest spot you have and prune the top back in spring — it branches from below the cut."],
      ["Sticky leaves and a black sooty film", "Scale insects on the stems and leaf undersides.", "Scrape them off with a fingernail, then treat with horticultural soap every week for a month."],
    ],
  },
  Schefflera: {
    light: "Bright indirect light to a little direct sun",
    lightLong:
      "Bright indirect light with an hour or two of sun. In poor light the stems stretch and the plant leans; variegated forms lose their cream markings entirely.",
    humidity: "Room humidity is fine",
    soil: "Standard compost with perlite",
    soilLong: "Ordinary potting compost with a third perlite. They are not particular, as long as the pot drains.",
    feed: "Balanced feed at half strength monthly through spring and summer",
    repotNote: "Every second spring. Prune hard at the same time if it has gone lanky — scheffleras take it well and branch generously.",
    toxicity: OXALATE,
    propagation: "Stem cuttings in spring, rooted in damp compost under a bag. Air layering works for a tall bare specimen.",
    waterHow: "Water when the top third is dry. More scheffleras are lost to a permanently wet pot than to drought.",
    problems: [
      ["Leaves dropping in quantity", "Usually overwatering, sometimes a cold draught.", "Check the pot is not sitting wet, and move it away from the door."],
      ["Long bare stems with a few leaves at the top", "Too little light.", "Move it brighter and cut it back by a third in spring."],
      ["Sticky residue on the leaves below", "Scale or mealybugs above.", "Check the leaf undersides and stem joints, wipe them off with alcohol on a cotton bud, and treat weekly for a month."],
    ],
  },
  Dracaena: {
    light: "Medium to bright indirect light; no direct sun",
    lightLong:
      "Medium to bright indirect light. The snake plants in this genus tolerate deep shade and full sun alike, but the leafy dracaenas — marginata, fragrans, the rest — scorch in direct sun and stretch in the dark.",
    humidity: "Room humidity is fine",
    soil: "Free-draining compost with grit or perlite",
    soilLong:
      "Free-draining is the whole requirement. Ordinary compost cut with a third perlite for the leafy kinds; cactus compost for the snake plants, which rot at the base if the mix holds water.",
    feed: "A weak balanced feed monthly in spring and summer; none in winter",
    repotNote:
      "Every two or three years. Snake plants flower and grow best slightly potbound, so leave them until the pot is visibly straining.",
    toxicity:
      "Toxic to cats and dogs. The saponins cause vomiting, drooling and — in cats specifically — dilated pupils. Not dangerous to people beyond an upset stomach.",
    propagation:
      "Leafy dracaenas: cut the cane into sections and root them upright in water or damp compost. Snake plants: divide the rhizome, or cut a leaf into 8 cm pieces and stand them the right way up in compost — note that a variegated leaf propagated this way comes back plain green, so divide instead if you want to keep the markings.",
    waterHow:
      "Let the top half of the pot dry out for the leafy kinds; let the whole pot dry for the snake plants. Both are far more often overwatered than under.",
    problems: [
      ["Brown tips on long thin leaves", "Fluoride and salts in tap water — dracaenas are unusually sensitive.", "Water with rainwater or filtered water, and flush the pot through a few times a year."],
      ["Soft yellow base on a snake plant, leaves falling out of the pot", "Rot. Water has sat in the crown or the mix.", "Take the firm leaves as cuttings and start again. Water snake plants from below or around the edge, never into the centre."],
      ["Lower leaves yellowing and dropping on a cane dracaena", "Normal ageing if it is one at a time; overwatering if it is several.", "Peel the old leaves off cleanly and check the mix is drying out between waterings."],
    ],
  },
  Yucca: {
    light: "As much direct sun as you can give it",
    lightLong: "Full sun. A yucca indoors wants the brightest window in the house and will stretch and weaken anywhere else.",
    humidity: "Indifferent; dry air suits it",
    soil: "Gritty and sharply drained — cactus compost",
    soilLong: "Cactus compost, or ordinary compost cut with a third horticultural grit. The cane rots quickly in anything that holds water.",
    feed: "A weak feed two or three times a year, no more",
    repotNote: "Every three years or so. They are top-heavy — use a wide, weighted pot.",
    toxicity: "Mildly toxic to cats and dogs; the saponins cause vomiting. The leaf tips are sharp enough to be the greater hazard with small children.",
    propagation: "Cut the cane into sections and root them in gritty compost, or pot up the offsets that appear at the base.",
    waterHow: "Water when the pot is completely dry, and sparingly in winter. A yucca will go a month without complaint.",
    problems: [
      ["Soft brown base, leaves pulling away", "Rot from overwatering.", "Cut the cane back above the rot, let it callus for a few days, and re-root it in dry gritty mix."],
      ["Leaves going pale and floppy", "Not enough light.", "Move it to the sunniest window you have."],
      ["Brown leaf tips", "Dry air or fluoride in tap water.", "Trim them at an angle with scissors and switch to rainwater."],
    ],
  },
  Pachira: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light. Direct midday sun scorches the leaflets; deep shade makes the stems stretch and the braid open up.",
    humidity: "Above 50% is appreciated",
    soil: "Free-draining compost with perlite or sand",
    soilLong: "Ordinary compost with a third perlite or coarse sand. The swollen trunk stores water, so the mix must not.",
    feed: "Balanced feed at half strength monthly in spring and summer",
    repotNote: "Every second or third spring. Braided specimens are several young trees planted together — they can be separated at repotting if you would rather have one proper tree.",
    toxicity: "Non-toxic to cats and dogs, and one of the few genuinely safe larger houseplants.",
    propagation: "Stem cuttings in spring, rooted in damp compost under a bag; expect a low success rate compared with an aroid.",
    waterHow: "Water thoroughly when the top half of the pot is dry, then let it drain completely. Every week or two is typical indoors.",
    problems: [
      ["Yellow leaves dropping from the bottom", "Overwatering. The trunk is a reservoir and does not need help.", "Water less often and make sure the pot is not standing in water."],
      ["Leaflets going brown and crisp at the edges", "Dry air.", "Raise the humidity — group it with other plants or run a humidifier."],
      ["The braid loosening and stems going bare", "Too little light.", "Move it brighter and prune the tops back in spring to force branching."],
    ],
  },
  Crassula: {
    light: "Full sun to bright indirect light",
    lightLong: "Four to six hours of direct sun. A jade in a dim room stretches into a thin pale thing that never regains its compact shape.",
    humidity: "Indifferent; dry air is fine",
    soil: "Cactus compost with extra grit",
    soilLong: "Cactus compost, ideally with more grit still. The one thing a jade cannot survive is a mix that stays damp.",
    feed: "A weak cactus feed two or three times over the summer",
    repotNote: "Every three or four years, and into a heavy pot — a mature jade is top-heavy and a plastic pot will tip.",
    toxicity: "Toxic to cats and dogs; causes vomiting and lethargy. Not a hazard to people.",
    propagation: "A single leaf laid on dry compost roots and forms a plantlet in a few weeks. Stem cuttings work too — let the cut end callus for a couple of days first.",
    waterHow: "Water thoroughly, then not again until the pot is bone dry and the leaves have lost a little of their firmness. In winter, once a month is plenty.",
    problems: [
      ["Leaves dropping at a touch", "Overwatering, almost always.", "Stop watering until the pot is fully dry, then water far less often."],
      ["Stretched pale stems with leaves far apart", "Not enough light.", "Move it into direct sun and cut the stretched growth back — the cuttings will root."],
      ["Red edges on the leaves", "Sun and cool nights. This is a good sign, not a problem.", "Nothing to fix; it is the plant colouring up."],
      ["White cottony spots in the leaf joints", "Mealybugs.", "Dab each one with alcohol on a cotton bud and check again weekly for a month."],
    ],
  },
  Beaucarnea: {
    inherit: "Yucca",
    light: "Bright light, direct sun welcome",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "From the offsets that sometimes appear at the base of a mature plant. Seed is the commercial route; cuttings do not work.",
    waterHow:
      "Water thoroughly, then leave it until the pot is completely dry — the swollen base is a water tank and a ponytail palm is happy forgotten for a month.",
    problems: [
      ["Soft, squashy base", "Rot. It has been watered too often.", "Cut away the rot if any firm tissue remains, dry it out, and repot in gritty mix. Often fatal — prevention is the only real answer."],
      ["Brown leaf tips", "Dry air or salts building up.", "Trim the tips and flush the pot with plain water occasionally."],
    ],
  },
  Polyscias: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light. Aralias drop leaves when they are moved, when it gets cold, and when the light changes — a stable bright position matters more than an ideal one.",
    humidity: "Above 60%. This is a genuinely humidity-hungry plant",
    soil: "Free-draining compost with perlite",
    soilLong: "Ordinary compost with a third perlite. They want steady moisture without sitting wet.",
    feed: "Balanced feed at half strength monthly in spring and summer",
    repotNote: "Every second or third spring; they are slow and dislike disturbance. Expect leaf drop afterwards.",
    toxicity: "Toxic to cats and dogs — the saponins cause vomiting and mouth irritation.",
    propagation: "Stem cuttings in spring under a propagator lid, with bottom heat if you have it.",
    waterHow: "Keep evenly damp, never soggy, and never let it dry out completely — an aralia that dries hard defoliates.",
    problems: [
      ["Sudden leaf drop", "A change: a move, a draught, a cold night, or the compost drying out.", "Put it somewhere stable and bright, keep it evenly damp, and be patient."],
      ["Spider mites", "Dry air. Aralias attract them reliably.", "Raise humidity and treat weekly for a month."],
    ],
  },
  Fatsia: {
    light: "Medium indirect light; cool and shady suits it",
    lightLong: "Medium indirect light and, unusually, a cool room. Fatsia is hardy outdoors in mild climates and struggles in a hot dry lounge more than in a chilly hallway.",
    humidity: "Above 50%",
    soil: "Loam-based compost, moisture-retentive",
    soilLong: "A loam-based compost that holds some water. Fatsia is not a plant that wants to dry out.",
    feed: "Balanced feed monthly in spring and summer",
    repotNote: "Every second spring. It grows fast and gets large; prune in spring to keep it in bounds.",
    toxicity: "Mildly toxic to cats and dogs — causes vomiting if chewed.",
    propagation: "Stem cuttings in spring, or air layering for a tall specimen.",
    waterHow: "Keep evenly damp through spring and summer, drier in winter. Wilting leaves recover, but the leaf edges brown permanently.",
    problems: [
      ["Yellow leaves with brown edges", "Too warm and too dry.", "Move it somewhere cooler, raise humidity, keep the compost damp."],
      ["Spider mites in a warm room", "Dry heat.", "Shower the plant and treat weekly; a cooler spot is the real cure."],
      ["Pale washed-out leaves", "Too much direct sun.", "Move it into shade."],
    ],
  },
  Strelitzia: {
    light: "The brightest spot you have, with several hours of direct sun",
    lightLong: "As much light as possible, including direct sun. A bird of paradise will not flower in anything less, and indoors most never do — treat the leaves as the point and any flower as a bonus.",
    humidity: "Room humidity is fine",
    soil: "Rich, loam-based, free-draining compost",
    soilLong: "A rich loam-based compost with perlite or grit. These are big hungry plants with thick fleshy roots that still resent standing water.",
    feed: "A balanced feed every two weeks through spring and summer — they are heavy feeders",
    repotNote:
      "Every second spring while young, then leave it: strelitzias flower better potbound, and a mature one is heavy enough that top-dressing is the practical option.",
    toxicity: "Toxic to cats and dogs — the seeds and flowers most of all. Causes vomiting and drowsiness.",
    propagation: "Divide a large clump in spring, giving each piece several leaves and a good share of root. Seed is very slow.",
    waterHow: "Water thoroughly when the top third is dry. They drink hard in summer and much less in winter.",
    problems: [
      ["Leaves splitting along the ribs", "Normal. The splits let wind through in the wild.", "Nothing to fix. Splits appear faster in a draught or when the leaves rub against something."],
      ["No flowers after years indoors", "Not enough light, too much pot, or simply not old enough — they flower at four or five years.", "Give it the sunniest position you have, feed through summer, and stop repotting."],
      ["Brown crispy leaf edges", "Under-watering or salt build-up.", "Water more thoroughly and flush the pot a few times a year."],
    ],
  },
  Musa: {
    light: "Full sun",
    lightLong: "As much direct sun as you can manage. Bananas are field crops; indoors they want the brightest window there is.",
    humidity: "Above 60%, or the leaf edges brown",
    soil: "Rich, moisture-retentive compost",
    soilLong: "A rich compost that holds water. Bananas are greedy and thirsty and will not be talked out of it.",
    feed: "A high-nitrogen feed every week or two in summer",
    repotNote: "Every spring — they grow astonishingly fast and exhaust their compost within a season.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Separate the pups that come up beside the parent, once each has a few leaves of its own.",
    waterHow: "Keep the compost damp at all times in summer — near-daily watering in a warm room is normal. Ease off in winter.",
    problems: [
      ["Brown crispy leaf edges", "Dry air, almost always.", "Raise the humidity. Some edge browning on indoor bananas is unavoidable."],
      ["Leaves tearing into strips", "Normal for the genus, and worse in a draught.", "Nothing to fix; move it out of the airflow if it bothers you."],
      ["Growth stalling in a warm bright spot", "Hungry or potbound.", "Feed weekly and repot — bananas outgrow pots in a single season."],
    ],
  },

  // ----------------------------------------------------------------- Palms
  Chamaedorea: {
    light: "Medium to low indirect light",
    lightLong:
      "Medium indirect light, and genuinely tolerant of less — the parlour palm earned its name in Victorian drawing rooms lit by gaslight. Direct sun scorches it.",
    humidity: "Above 50% keeps the tips green",
    soil: "Standard compost with perlite",
    soilLong: "Ordinary peat-free compost with perlite through it. Palms want moisture-retentive but never waterlogged.",
    feed: "A weak balanced feed monthly in spring and summer only",
    repotNote:
      "Every two or three years, and reluctantly — palm roots resent disturbance. What is sold as one plant is usually a dozen seedlings in a pot; keep them together.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "From seed only. A clump can be split, but each piece is an individual seedling and splitting often kills several.",
    waterHow: "Keep the top of the compost just barely damp. Palms will not forgive a pot left standing in water, and brown tips are the receipt for the one time you let it dry out hard.",
    problems: [
      ["Brown tips on every frond", "Dry air, hard tap water, or a dry spell. Almost universal indoors.", "Raise humidity, water with rainwater, and trim the brown off with scissors following the leaf's own shape."],
      ["Spider mites", "Dry warm air. Palms are a favourite.", "Shower the fronds, both sides, and treat weekly for a month."],
      ["Whole fronds yellowing from the bottom", "Normal ageing if one at a time; overwatering if several.", "Cut old fronds off at the base and check the mix is not staying wet."],
    ],
  },
  Dypsis: { inherit: "Chamaedorea", light: "Bright indirect light", lightLong: "Bright indirect light — brighter than a parlour palm wants. An areca in a dim room thins out and never fills back in." },
  Howea: { inherit: "Chamaedorea", light: "Medium indirect light, and tolerant of shade", lightLong: "Medium indirect light. Kentias are the most shade-tolerant palm sold as a houseplant, and the most forgiving overall — which is why they cost more." },
  Rhapis: { inherit: "Chamaedorea", light: "Medium indirect light", propagation: "Divide the clump in spring — unusually for a palm, lady palms sucker and divide well." },
  Phoenix: { inherit: "Chamaedorea", light: "Bright light with some direct sun", toxicity: "Non-toxic to cats and dogs, but the spines at the base of each frond are needle-sharp — site it away from walkways." },
  Livistona: { inherit: "Chamaedorea", light: "Bright indirect light with some direct sun" },

  // ------------------------------------------------------- Vines & trailers
  Hoya: {
    light: "Bright indirect light, with some direct morning sun for flowers",
    lightLong:
      "Bright indirect light, and a couple of hours of direct morning sun if you want flowers. Hoyas grown in medium light stay alive and green for years without ever blooming.",
    humidity: "Room humidity is fine; above 60% speeds growth",
    soil: "Very free-draining — orchid bark, perlite and a little compost",
    soilLong: "Hoyas are epiphytes that root into bark and moss. A chunky mix of bark and perlite with a little compost is right; ordinary potting soil holds far too much water.",
    feed: "A balanced feed at half strength every second or third watering in spring and summer",
    repotNote:
      "Rarely. Hoyas flower best tightly potbound, and repotting a plant that is about to bloom usually costs you the flowers. Every three or four years is plenty.",
    toxicity: "Non-toxic to cats and dogs, though the milky sap can irritate skin.",
    propagation: "Cuttings with two nodes and a leaf or two root in water, perlite or sphagnum over four to eight weeks.",
    waterHow:
      "Water thoroughly when the pot is nearly dry and the leaves have just started to feel less firm. Hoyas store water in their leaves and are far more tolerant of drought than of wet feet.",
    problems: [
      ["Never flowers", "Not enough light, too much pot, or the flower spurs were cut off.", "Move it brighter, stop repotting, and never cut the old flower stalks — hoyas bloom from the same short spurs year after year."],
      ["Wrinkled, dimpled leaves", "Under-watering — or, confusingly, root rot, which stops the plant drinking.", "Check the roots. Firm white roots mean water it; brown mushy roots mean repot and cut the damage away."],
      ["Yellow leaves dropping", "Overwatering or cold.", "Let it dry out further and keep it above 15 °C."],
      ["Sticky black film under the flowers", "The flowers themselves drip nectar; it is not a pest.", "Wipe it off. Put a saucer under a plant that is blooming heavily."],
    ],
  },
  Tradescantia: {
    light: "Bright indirect light; the colours need it",
    lightLong: "Bright indirect light, with an hour of direct sun welcome. The purple, pink and cream stripes wash out to plain green in a dim spot faster than almost any other houseplant.",
    humidity: "Room humidity is fine",
    soil: "Standard compost with perlite",
    soilLong: "Ordinary potting compost with perlite. Tradescantias are unfussy and grow at a speed that makes the mix almost irrelevant.",
    feed: "A balanced feed at half strength monthly in spring and summer",
    repotNote: "Every spring, or simply start again from cuttings — a tradescantia is at its best in its first year and goes bare in the middle in its second.",
    toxicity: "Mildly toxic to cats and dogs; the sap can also cause a skin rash in people who handle it a lot.",
    propagation: "Absurdly easy. Any piece of stem roots in water in a week, or push several cuttings straight back into the parent's pot to keep it full.",
    waterHow: "Keep the compost lightly damp. It wilts fast and recovers fast, but repeated wilting costs it the lower leaves.",
    problems: [
      ["Bare leggy stems with leaves only at the ends", "Normal growth habit plus too little light.", "Pinch the tips out regularly and root the cuttings back into the same pot. Move it brighter."],
      ["Stripes fading to green", "Not enough light.", "Move it brighter and cut out any wholly green stems — they outgrow the variegated ones."],
      ["Brown crisp leaves", "It dried out.", "Water more often; tradescantias are thirstier than they look."],
    ],
  },
  Chlorophytum: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light. Spider plants cope with less but produce fewer runners, and the variegation is sharpest in a bright spot out of direct sun.",
    humidity: "Room humidity is fine",
    soil: "Standard compost with perlite",
    soilLong: "Ordinary compost with perlite. Spider plants build thick white water-storing roots that will crack a pot when they run out of room.",
    feed: "A balanced feed at half strength monthly in spring and summer; over-feeding causes brown tips",
    repotNote: "Every spring while young. A spider plant that is not producing babies is usually one that needs a bigger pot — or, occasionally, one that needs a smaller one, since they flower when snug.",
    toxicity: "Non-toxic to cats and dogs. Cats are unusually drawn to chewing the leaves, which is harmless but hard on the plant.",
    propagation: "Peg a plantlet from a runner onto a pot of compost while still attached to the parent, and cut it free once it has rooted.",
    waterHow: "Keep lightly damp in summer, drier in winter. They store water in the roots and survive a missed fortnight.",
    problems: [
      ["Brown tips on most leaves", "Fluoride and salts in tap water — the classic spider plant complaint.", "Switch to rainwater or filtered water, flush the pot occasionally, and feed less."],
      ["Pale limp leaves", "Too much direct sun.", "Move it out of the sun's direct path."],
      ["No babies", "Too young, too dark, or too much pot.", "Give it a bright spot and leave it slightly potbound."],
    ],
  },
  Hedera: {
    light: "Bright indirect light; cool conditions",
    lightLong: "Bright indirect light and, importantly, a cool room. Ivy is a hardy outdoor plant and does badly in dry central heating — a chilly porch suits it better than a warm lounge.",
    humidity: "Above 50%; dry heat brings spider mites",
    soil: "Standard compost with perlite",
    soilLong: "Ordinary compost with perlite. Ivy is not fussy about the mix, only about the air around it.",
    feed: "A balanced feed at half strength monthly in spring and summer",
    repotNote: "Every second spring. Trim it hard at the same time; ivy takes cutting back well.",
    toxicity: "Toxic to cats, dogs and people — causes vomiting and, on contact, a skin rash in some people.",
    propagation: "Stem cuttings root in water or damp compost within a few weeks.",
    waterHow: "Keep evenly damp. Ivy dislikes drying out completely and shows it by browning from the tips back.",
    problems: [
      ["Spider mites, repeatedly", "Warm dry air. Indoor ivy is a magnet for them.", "Move it somewhere cooler and more humid, shower it regularly, and treat weekly for a month when they appear."],
      ["Leaves going dry and brown from the edges", "Dry heat or a pot that dried out.", "Water more regularly and move it away from the radiator."],
      ["Variegated ivy turning plain green", "Too little light.", "Move it brighter and remove all-green shoots."],
    ],
  },
  Senecio: {
    light: "Bright light with some direct sun",
    lightLong: "Bright light with a few hours of direct sun. String of pearls stretches into a bare thread with beads far apart when it is too dark.",
    humidity: "Indifferent; dry air suits it",
    soil: "Cactus compost with extra perlite",
    soilLong: "Cactus compost with more perlite still, in a shallow pot. The beads are water stores and the roots are fine and shallow — depth of wet compost below them is what kills these plants.",
    feed: "A weak cactus feed two or three times over the summer",
    repotNote: "Every two or three years, into a shallow wide pot rather than a deep one.",
    toxicity: "Toxic to cats, dogs and people; causes vomiting and, on contact, skin irritation.",
    propagation: "Lay a strand on damp compost and pin it down — it roots at the nodes within a few weeks. Or push cuttings in a circle around the pot's edge to thicken it.",
    waterHow: "Water thoroughly when the pot is completely dry and the beads have just started to look slightly flat. Every two to three weeks in summer, monthly in winter.",
    problems: [
      ["Shrivelled flat beads", "Thirsty — or rotting roots that can no longer take water up.", "Check the roots before you water. Firm roots mean it needs a drink; mushy ones mean rot."],
      ["Bare strings with beads only at the ends", "Too little light.", "Move it into direct sun and cut the bare strings back; they will branch."],
      ["Mushy stems at soil level", "Rot from overwatering.", "Take healthy strand cuttings and start again."],
    ],
  },
  Ceropegia: {
    inherit: "Senecio",
    light: "Bright indirect light with a little direct sun",
    toxicity: "Non-toxic to cats and dogs.",
    propagation:
      "It makes small round tubers along the strands; press one onto damp compost and it roots within weeks. Strand cuttings work too.",
  },
  Peperomia: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light, no direct sun. Peperomias are small understorey plants with thick leaves — they burn easily and stretch in the dark.",
    humidity: "Room humidity is fine for most; the trailing kinds prefer above 60%",
    soil: "Light and free-draining — compost with plenty of perlite, or an aroid mix",
    soilLong: "Peperomias have small, shallow root systems and semi-succulent leaves. A light, airy mix in a small pot is the whole secret; a big pot of wet compost is the whole problem.",
    feed: "A weak balanced feed monthly in spring and summer",
    repotNote: "Rarely, and into a pot barely bigger than the last. Peperomias are happiest tight.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Leaf cuttings: cut a leaf in half across the middle and stand the cut edge in damp compost, or root a stem cutting with a node in water.",
    waterHow: "Let the top half of the pot dry out, then water thoroughly. The leaves store water — a peperomia would much rather be dry.",
    problems: [
      ["Leaves dropping at a touch", "Overwatering.", "Let it dry down properly and consider a smaller pot."],
      ["Leaves going soft and translucent", "Rot, or cold water.", "Unpot and check the roots; use tepid water and keep it above 15 °C."],
      ["Stretched pale growth", "Not enough light.", "Move it brighter, out of the sun's direct path."],
    ],
  },
  Pilea: {
    inherit: "Peperomia",
    light: "Bright indirect light",
    lightLong: "Bright indirect light, and turn the pot weekly — a pilea leans hard toward its light source and goes permanently lopsided otherwise.",
    propagation: "Pot up the babies that come up from the soil around the parent once they have a few leaves; cut them off below soil level with a little root attached.",
    problems: [
      ["Leaning heavily to one side", "It grows toward light faster than most.", "Turn the pot a quarter turn every week."],
      ["Yellow lower leaves dropping", "Overwatering, or simply age as the stem lengthens.", "Let it dry out more between waterings; a bare lower stem on an older pilea is normal."],
      ["Curling or cupping leaves", "Usually too much light; sometimes too little water.", "Move it out of direct sun and check the compost."],
      ["No babies", "Too young, or not enough light.", "Give it a bright spot and wait — pileas pup freely once established."],
    ],
  },
  Cissus: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light, no direct sun. This is a jungle vine and the leaves mark easily.",
    humidity: "Above 60%. It will not thrive in dry air, full stop",
    soil: "Airy compost with bark and perlite",
    soilLong: "An airy mix with bark and perlite. It climbs, and the roots want air as much as water.",
    feed: "Balanced feed at half strength every second or third watering in the growing season",
    repotNote: "Every spring while it is growing fast. Give it something to climb.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Node cuttings root in water or sphagnum within a few weeks.",
    waterHow: "Keep evenly damp. It wilts dramatically when dry and the leaves often do not fully recover.",
    problems: [
      ["Crispy edges and leaf drop", "Dry air. This is the whole story with this plant.", "Get it above 60% humidity — a cabinet or terrarium is the honest answer."],
      ["Powdery white coating", "Mildew from still, damp air.", "Improve the airflow; humidity without circulation is what causes it."],
    ],
  },

  // ------------------------------------------------------- Prayer plants
  Maranta: {
    light: "Medium indirect light; never direct sun",
    lightLong:
      "Medium indirect light. Prayer plants grow on a forest floor and direct sun bleaches the pattern out of them within days. They are one of the few genuinely good plants for a north-facing room.",
    humidity: "Above 60%. Below that, the edges brown and it will not stop",
    soil: "Peat-free compost with perlite, moisture-retentive but not heavy",
    soilLong: "A light, moisture-retentive mix — compost with perlite and a little bark. The roots are fine and shallow, so a wide shallow pot beats a deep one.",
    feed: "A balanced feed at quarter to half strength monthly in spring and summer. They are sensitive to over-feeding",
    repotNote: "Every spring, into a shallow pot. Divide the clump at the same time if it has spread.",
    toxicity: "Non-toxic to cats and dogs — the whole family is safe, which is much of their appeal.",
    propagation: "Divide the clump at repotting, giving each piece roots and several leaves. Stem cuttings with a node also root in water.",
    waterHow:
      "Keep evenly damp — never soggy, never dry — and use rainwater or filtered water if you can. Tap water is the most common cause of the brown edges this family is famous for.",
    problems: [
      ["Brown crispy edges on every leaf", "Dry air, or minerals in tap water. Usually both.", "Get the humidity above 60% and switch to rainwater or filtered water. Existing damage will not heal."],
      ["Leaves curling inward", "Thirsty, or the air is too dry.", "Water and raise the humidity; the leaves uncurl within a day if that was it."],
      ["Leaves staying folded up all day", "Stress — too dry, too cold, or too dark.", "The folding is normal at night. All day means something is wrong: check water, warmth and light in that order."],
      ["Fine webbing under the leaves", "Spider mites, which love this family.", "Shower the plant and treat weekly for a month; raise the humidity or they return."],
    ],
  },
  Goeppertia: {
    inherit: "Maranta",
    lightLong:
      "Medium indirect light. Calatheas — which is what most of these were called until the genus was split, and what everyone still calls them — burn in direct sun and lose their markings in a dark corner.",
  },
  Calathea: { inherit: "Maranta" },
  Ctenanthe: { inherit: "Maranta", humidity: "Above 60%, though it is the most forgiving of the prayer plants" },
  Stromanthe: { inherit: "Maranta", light: "Bright indirect light — the pink needs more than a calathea does" },

  // ----------------------------------------------------------------- Ferns
  Nephrolepis: {
    light: "Medium indirect light",
    lightLong: "Medium indirect light, and never direct sun. A bright north window or a well-lit bathroom is close to ideal.",
    humidity: "Above 60%. A fern in dry air is a fern on its way out",
    soil: "Moisture-retentive peat-free compost with perlite",
    soilLong: "A mix that holds water without turning to mud: compost with perlite and a little bark. Ferns have fine roots that must never dry out completely.",
    feed: "A weak balanced feed monthly in spring and summer",
    repotNote: "Every spring. Divide the clump at the same time if it has filled the pot.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Divide the clump in spring. Spores work but take the better part of a year.",
    waterHow:
      "Keep the compost damp at all times — this is the one plant on this list where 'let it dry out' is wrong. Standing the pot in a shallow tray of water for an hour once a week suits it.",
    problems: [
      ["Fronds going brown and crisp from the tips", "Dry air, or the compost dried out.", "Raise the humidity and never let the pot go fully dry. A bathroom is the easy answer."],
      ["Leaflets dropping all over the floor", "Dry heat, usually from a radiator.", "Move it away from the heat source and raise the humidity."],
      ["Yellowing fronds in a wet pot", "It is sitting in water rather than damp compost.", "Damp, not waterlogged — make sure the pot drains and the saucer empties."],
      ["Brown dots in rows under the fronds", "Spores. Completely normal.", "Nothing to do; it means the fern is mature and happy."],
    ],
  },
  Adiantum: { inherit: "Nephrolepis", humidity: "Above 70%. Maidenhair ferns are unforgiving about this", waterHow: "Never, ever let it dry out. A maidenhair that dries once loses every frond — cut them all back to the compost and it usually reshoots." },
  Asplenium: { inherit: "Nephrolepis", light: "Medium to low indirect light", waterHow: "Keep the compost damp, and water around the edge of the pot rather than into the centre — water sitting in the rosette rots the crown." },
  Platycerium: {
    inherit: "Nephrolepis",
    light: "Bright indirect light",
    soil: "None, ideally — mounted on bark with a pad of sphagnum moss",
    soilLong:
      "Staghorns are epiphytes that grow on tree trunks. Mounted on a board with sphagnum behind them is how they are happiest; in a pot, use pure bark and moss rather than compost.",
    waterHow: "Soak the whole mount or root ball in water for ten minutes, then let it drain and dry out somewhat before the next soak — usually weekly.",
    propagation: "Separate the pups that form at the base of a mature plant, each with a piece of the shield frond.",
    problems: [
      ["The flat round shield frond turning brown", "Normal. Shield fronds brown and stay on as the plant's anchor.", "Leave it exactly where it is — removing it damages the plant."],
      ["Black spots spreading on the antler fronds", "Too wet, or water sitting on the fronds in still air.", "Water at the base, improve airflow, and let it dry between soaks."],
    ],
  },
  Phlebodium: { inherit: "Nephrolepis", light: "Medium to bright indirect light", waterHow: "Keep damp, and keep water off the furry rhizomes that creep over the surface — they rot if buried or kept wet." },
  Davallia: { inherit: "Nephrolepis", waterHow: "Keep damp, and leave the furry rhizomes sitting on top of the compost where they belong — burying them kills the plant." },
  Asparagus: {
    inherit: "Nephrolepis",
    light: "Bright indirect light",
    toxicity: "Toxic to cats and dogs. The berries cause vomiting and the sap can give a skin rash — and despite the name it is not a fern at all, but a relative of asparagus.",
    propagation: "Divide the tuberous root ball in spring. It is tough work; a serrated knife helps.",
  },

  // ------------------------------------------------------ Begonias & violets
  Begonia: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light. Begonias want brightness without a ray of direct sun landing on the leaves, which mark permanently.",
    humidity: "Above 60%, but with air moving — still humid air gives them mildew",
    soil: "Light, airy, free-draining compost with perlite and bark",
    soilLong: "A light open mix. Begonia roots are fine and shallow and rot readily; many growers use a shallow pot and an aroid-style mix.",
    feed: "A balanced feed at half strength every two to four weeks in spring and summer",
    repotNote: "Every spring, into a shallow wide pot. Cane begonias get top-heavy and want staking.",
    toxicity: "Toxic to cats and dogs — the tubers most of all. Causes mouth irritation and vomiting.",
    propagation: "Leaf cuttings: pin a leaf flat on damp compost with the veins nicked, and plantlets form at the cuts. Stem cuttings root in water.",
    waterHow:
      "Water when the top of the compost is dry, around the edge of the pot rather than over the leaves. Water sitting on a begonia leaf overnight is how mildew starts.",
    problems: [
      ["White powdery patches on the leaves", "Powdery mildew — humid air with no movement.", "Improve airflow, stop watering over the leaves, remove affected leaves, and treat if it spreads."],
      ["Leaves dropping suddenly", "A cold draught or a dry spell.", "Keep it above 15 °C and evenly damp."],
      ["Leggy stems with leaves only at the top", "Not enough light.", "Move it brighter and cut back hard in spring — cane begonias respond well."],
      ["Brown crisp edges", "Dry air.", "Raise humidity, keeping the air moving."],
    ],
  },
  Saintpaulia: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light — an east window is close to perfect. African violets flower reliably at a light level that suits an ordinary room, which is much of why they have been popular for a century.",
    humidity: "Above 50%",
    soil: "A light African violet mix — peat-free compost with plenty of perlite",
    soilLong: "A light open mix in a small shallow pot. African violets flower best when snug and rot if the crown sits in wet compost.",
    feed: "A high-phosphorus African violet feed at quarter strength with most waterings while in flower",
    repotNote: "Once a year, into the same size pot with fresh mix. Bury the bare stem a little deeper each time.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "A single leaf with 3 cm of stalk, pushed into damp compost, makes a cluster of plantlets in two or three months.",
    waterHow:
      "Water from below: stand the pot in 2 cm of tepid water for twenty minutes, then drain. Cold water on the leaves leaves permanent pale rings.",
    problems: [
      ["Pale rings and blotches on the leaves", "Cold water splashed on the leaves.", "Water from below with tepid water. The marks are permanent on those leaves."],
      ["No flowers", "Too little light, too big a pot, or too much nitrogen.", "Move it to a bright east window, keep it snug, and use a high-phosphorus feed."],
      ["Crown going soft and brown", "Water sat in the centre of the rosette.", "Water from below only. A rotted crown is usually fatal — take leaf cuttings while you can."],
    ],
  },
  Streptocarpus: { inherit: "Saintpaulia", light: "Bright indirect light; cooler rooms suit it", propagation: "Cut a leaf lengthways along the midrib and push the cut edges into damp compost; plantlets form along the whole length." },
  Episcia: { inherit: "Saintpaulia", humidity: "Above 60%", propagation: "It sends out runners with plantlets on the end, like a strawberry. Pin one down and cut it free once rooted." },

  // -------------------------------------------------- Succulents & cacti
  Echeveria: {
    light: "Four to six hours of direct sun",
    lightLong:
      "As much direct sun as you can give it — four to six hours minimum. An echeveria in a normal room stretches into a pale tower within weeks, and no amount of later light will make it compact again.",
    humidity: "Indifferent; dry air is ideal",
    soil: "Gritty cactus compost, at least half grit or perlite",
    soilLong: "Cactus compost cut with more grit. A terracotta pot helps because it wicks water out of the mix and away from the roots.",
    feed: "A weak cactus feed two or three times over the summer",
    repotNote: "Every two or three years in spring, into a pot barely larger than the rosette.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Twist a whole leaf cleanly off the stem, lay it on dry compost, and wait — roots and a tiny rosette form in a few weeks. Beheading a stretched plant and re-rooting the top also works.",
    waterHow:
      "Water thoroughly, then leave it until the pot is bone dry and the lower leaves have gone slightly soft. Never water into the rosette — water sitting in the centre rots it.",
    problems: [
      ["Stretched, pale, spaced-out leaves", "Not enough light. This is not reversible.", "Cut the head off, let it callus for a few days, and re-root it in full sun. The stump usually produces offsets."],
      ["Mushy translucent lower leaves", "Overwatering.", "Stop watering. Remove the affected leaves and let it dry out completely."],
      ["Shrivelled wrinkled leaves", "Genuinely thirsty.", "Water thoroughly and it plumps back up within a day or two."],
      ["White cottony blobs between the leaves", "Mealybugs.", "Alcohol on a cotton bud, every few days for a month — they hide deep in the rosette."],
    ],
  },
  Haworthiopsis: { inherit: "Echeveria", light: "Bright indirect light; it burns in hard direct sun", lightLong: "Bright indirect light. Unlike most succulents, haworthias grow under scrub in the wild and turn red and stressed in full midday sun." },
  Gasteria: { inherit: "Haworthiopsis" },
  Aloe: {
    inherit: "Echeveria",
    light: "Bright light with several hours of direct sun",
    toxicity: "Toxic to cats and dogs — the latex just under the skin of the leaf causes vomiting and diarrhoea. Harmless to people; it is the gel inside that is used on burns.",
    propagation: "Pot up the offsets that appear around the base once they have a few leaves of their own.",
  },
  Kalanchoe: {
    inherit: "Echeveria",
    light: "Bright light with some direct sun",
    toxicity: "Toxic to cats and dogs. Kalanchoes contain cardiac glycosides, which affect the heart — this is one of the more seriously toxic houseplants sold, and worth keeping out of reach.",
    feed: "A balanced feed monthly in spring and summer while in flower",
    repotNote: "After flowering. To get it to flower again it needs fourteen hours of complete darkness a night for six weeks — that, not care, is why supermarket kalanchoes never rebloom.",
    problems: [
      ["Flowers once, then never again", "Kalanchoes are short-day plants and need long nights to set buds.", "Give it fourteen hours of total darkness a night for six weeks in autumn."],
      ["Stretched leggy growth", "Not enough light.", "Move it into direct sun and cut it back after flowering."],
      ["Mushy stem at the base", "Overwatering.", "Take healthy cuttings and start again."],
    ],
  },
  Sempervivum: { inherit: "Echeveria", light: "Full sun; it is a hardy outdoor plant", lightLong: "Full sun. Houseleeks are alpine plants, hardy to well below freezing, and they do better on a windowsill that gets cold at night — or outdoors — than in a warm room.", propagation: "Detach the offsets — the 'chicks' — and press them onto gritty compost." },
  Sedum: { inherit: "Echeveria", light: "Bright light with some direct sun", propagation: "Individual leaves root readily; a burro's tail drops them at the slightest knock, so pot the casualties up." },
  Euphorbia: {
    inherit: "Echeveria",
    light: "Bright light with direct sun",
    toxicity:
      "Toxic to cats, dogs and people, and the most genuinely hazardous plant in the house. The white latex burns skin and can cause lasting damage to eyes — wear gloves and eye protection when cutting one, and wash immediately if it touches you.",
    propagation: "Stem cuttings, wearing gloves. Dip the cut end in water to stop the latex, let it callus for several days, then root in dry gritty mix.",
  },
  Schlumbergera: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light. Holiday cacti are forest cacti that grow in tree forks, not desert plants — direct sun reddens and scorches the segments.",
    humidity: "Above 50%",
    soil: "An open mix — cactus compost with bark and perlite through it",
    soilLong: "More like an orchid mix than a desert cactus one: open, bark-heavy, free-draining, but not pure grit.",
    feed: "A balanced feed at half strength monthly from spring to late summer, then stop",
    repotNote: "Every three or four years, after flowering. They bloom better potbound.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Twist off a piece two or three segments long, let it dry for a day, then push it into damp compost.",
    waterHow: "Water when the top half of the pot is dry — more often than a desert cactus, less than a houseplant. Keep it drier for six weeks in autumn to set buds.",
    problems: [
      ["Buds dropping before they open", "It was moved, or the temperature or watering changed.", "Once the buds form, leave it alone — do not turn it, move it, or change the routine."],
      ["No flowers", "It needs cool nights and long darkness in autumn to set buds.", "From early autumn, give it twelve to fourteen hours of darkness and nights around 12–15 °C for six weeks."],
      ["Limp wrinkled segments", "Either too dry or rotting roots.", "Check the roots before watering."],
      ["Red or purple segments", "Too much direct sun, or hungry.", "Move it out of direct sun and feed in spring."],
    ],
  },
  Opuntia: {
    light: "Full sun",
    lightLong: "Full direct sun, as much as there is. Desert cacti etiolate into pale asparagus in anything less.",
    humidity: "Indifferent; dry air is ideal",
    soil: "Very gritty cactus compost",
    soilLong: "Cactus compost with at least half grit or pumice, in a terracotta pot. Drainage is the entire discipline with cacti.",
    feed: "A weak cactus feed two or three times over the summer",
    repotNote: "Every three or four years. Use folded newspaper or thick gloves as a handle.",
    toxicity: "Non-toxic to cats and dogs, but the glochids — the fine hair-like spines — embed in skin and are miserable to remove. Handle with care.",
    propagation: "Detach a pad or an offset, let the cut callus for a week, then set it in dry gritty compost and wait a fortnight before watering.",
    waterHow:
      "Water thoroughly in summer once the pot is completely dry, roughly every three weeks. From late autumn to early spring, stop almost entirely — a cold wet cactus is a dead cactus.",
    problems: [
      ["Soft brown patches at the base", "Rot from water in cold conditions.", "Cut above the rot, callus the cut, and re-root. Keep it dry all winter."],
      ["Pale stretched narrow growth at the top", "Not enough light.", "Move it into full sun. The stretched part stays stretched."],
      ["Corky brown patches low down", "Normal ageing on an older cactus.", "Nothing to fix."],
    ],
  },
  Mammillaria: { inherit: "Opuntia", toxicity: "Non-toxic to cats and dogs; the spines are the only hazard." },
  Cereus: { inherit: "Opuntia", toxicity: "Non-toxic to cats and dogs; the spines are the only hazard.", repotNote: "Every three or four years, into a heavy pot — a tall column cactus is top-heavy." },
  Epiphyllum: { inherit: "Schlumbergera", light: "Bright indirect light", lightLong: "Bright indirect light. Like the holiday cacti, this is a forest epiphyte and scorches in direct sun." },
  Rhipsalis: { inherit: "Schlumbergera", light: "Medium to bright indirect light", waterHow: "Keep lightly damp — mistletoe cactus is the thirstiest cactus you will own and hates drying out hard." },
  Lithops: {
    // Inherits the cactus mix and cactus discipline, but it is a mesemb, not
    // a cactus: no glochids to warn about and a different reason for wanting
    // sun, so both of those fields are its own.
    inherit: "Opuntia",
    light: "Full sun, four to six hours",
    lightLong:
      "Full sun, four to six hours of it. In the wild only the flat translucent window on top of each leaf shows above the gravel, and the plant lives on the light that comes through it — give it less and it stretches upward into a soft pale column that never recovers its shape.",
    toxicity: "Non-toxic to cats and dogs.",
    repotNote: "Every four or five years at most, into a deep narrow pot — the taproot is long.",
    propagation: "From seed, or by dividing a clump that has split into several heads.",
    waterHow:
      "Far less often than the reminder suggests, and only at the right point in the year. Lithops follow a strict cycle: water lightly in autumn and again in spring, and give them nothing at all through winter while a new pair of leaves is absorbing the old pair. Watering during that changeover is the standard way people kill them.",
    problems: [
      ["Split, burst or mushy body", "Watered during the dormant period or during the leaf change.", "Stop watering completely until the old leaves are dry papery shells."],
      ["Stretching upward into a column", "Not enough light.", "Move it into full sun; this does not reverse."],
      ["Old leaves not drying up", "Watered too early in the cycle.", "Withhold water entirely and let the new pair draw the old one down."],
    ],
  },

  // ------------------------------------------------------------- Flowering
  Phalaenopsis: {
    light: "Bright indirect light",
    lightLong:
      "Bright indirect light — an east window, or a metre back from a south one. A moth orchid's leaves should be a mid grass-green; dark forest-green leaves mean too little light, which is the usual reason one never reflowers.",
    humidity: "Above 50%",
    soil: "No soil at all — coarse orchid bark in a pot with holes",
    soilLong:
      "Never compost. Phalaenopsis roots are photosynthetic and need air: coarse bark, or sphagnum if you water carefully, in a pot with drainage. The clear pots they are sold in are useful — you can see the roots.",
    feed: "A weak orchid feed with every second watering while in growth",
    repotNote: "Every two years, into fresh bark, after flowering. Old bark breaks down into something that holds water and kills the roots.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation:
      "Occasionally a keiki — a baby plant — forms on an old flower spike. Once it has two or three roots of its own, cut it off with a short piece of spike and pot it up. Otherwise they are not propagated at home.",
    waterHow:
      "Soak the bark thoroughly under the tap once a week, let it drain completely, and never leave water in the pot cover. Silvery-white roots mean thirsty; green roots mean it has had enough.",
    problems: [
      ["Never reflowers", "Not enough light, or no temperature drop.", "Give it a brighter spot, and a few weeks of nights around 16 °C in autumn — that drop is what triggers a new spike."],
      ["Limp wrinkled leaves", "Root loss, usually from sitting wet, so the plant cannot drink.", "Unpot it and look: brown hollow roots are dead. Cut them off, repot in fresh bark, keep humidity up while it rebuilds."],
      ["Yellowing lowest leaf", "Normal — orchids shed the oldest leaf.", "Nothing to do unless several go at once."],
      ["The flower spike turning brown after flowering", "Finished.", "Cut it off at the base. A green spike can instead be cut just above a node and may branch into a second flush."],
    ],
  },
  Dendrobium: { inherit: "Phalaenopsis", light: "Bright light with some direct morning sun", waterHow: "Water thoroughly while in growth, then keep it much drier and cooler through winter — that rest is what makes it flower." },
  Cattleya: { inherit: "Phalaenopsis", light: "Bright light with some direct sun", waterHow: "Let the bark dry out almost completely between waterings; the pseudobulbs carry the plant through." },
  Gardenia: {
    light: "Bright light with some direct sun",
    lightLong: "Bright light with a few hours of direct sun. Gardenias are demanding plants and light is the least of it.",
    humidity: "Above 60%, consistently",
    soil: "Ericaceous (acid) compost — this is not optional",
    soilLong:
      "Gardenias need acid soil, pH 5 to 6. In ordinary compost or with hard tap water they cannot take up iron and go yellow between the veins. Use ericaceous compost and rainwater.",
    feed: "An ericaceous or acid-loving plant feed every two weeks in spring and summer",
    repotNote: "Every second spring, into fresh ericaceous compost.",
    toxicity: "Mildly toxic to cats and dogs; causes vomiting and diarrhoea.",
    propagation: "Semi-ripe cuttings in summer with bottom heat, under cover. Not easy.",
    waterHow: "Keep evenly damp with rainwater or filtered water. Hard tap water will yellow the leaves within a couple of months whatever else you do.",
    problems: [
      ["Yellow leaves with green veins", "Iron deficiency from soil or water that is too alkaline — the classic gardenia problem.", "Repot into ericaceous compost, water with rainwater, and feed with a sequestered iron product."],
      ["Buds dropping before opening", "A change in temperature, light, watering or humidity. Gardenias object to all of them.", "Keep everything constant once buds form, and humidity above 60%."],
      ["Sticky leaves, black sooty mould", "Scale or mealybugs.", "Treat weekly for a month and wipe the mould off."],
    ],
  },
  Jasminum: {
    light: "Bright light with several hours of direct sun",
    lightLong: "Bright light with direct sun. Indoors it needs the sunniest window there is; outdoors in summer it is happier still.",
    humidity: "Above 50%",
    soil: "Loam-based compost with grit",
    soilLong: "A loam-based compost with grit for drainage. Jasmine is a vigorous climber and wants something with body to it.",
    feed: "A high-potash feed every two weeks from spring until flowering finishes",
    repotNote: "Every second spring. Prune hard right after flowering — it flowers on the previous season's growth, so pruning later costs you next year's blooms.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Semi-ripe cuttings in summer, or layer a stem into a neighbouring pot.",
    waterHow: "Keep damp in spring and summer, drier in autumn and winter. The cool dry autumn rest is what sets the buds.",
    problems: [
      ["No flowers", "Too warm in autumn, or pruned at the wrong time.", "Give it six weeks of nights around 10 °C in autumn, and prune only immediately after flowering."],
      ["Yellow leaves dropping", "Overwatering, or a pot that is too small.", "Check the drainage and repot in spring."],
      ["Red spider mite in a warm room", "Dry heat.", "Raise humidity and treat weekly."],
    ],
  },
  Hibiscus: {
    light: "Full sun",
    lightLong: "As much direct sun as possible — six hours if you can. Hibiscus flower on new growth in strong light and simply do not bloom without it.",
    humidity: "Above 50%",
    soil: "Rich loam-based compost, free-draining",
    soilLong: "A rich loam-based compost with grit. They are hungry and thirsty and still want the pot to drain.",
    feed: "A high-potash feed weekly through spring and summer",
    repotNote: "Every spring while young. Prune in early spring to shape — flowers come on new wood.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Softwood cuttings in early summer with bottom heat.",
    waterHow: "Keep damp through the growing season — daily in a hot room is normal — and much drier in winter.",
    problems: [
      ["Buds dropping before they open", "Irregular watering, a move, or a sudden temperature change.", "Water on a steady routine and keep it in one place."],
      ["Yellow leaves", "Overwatering, cold, or hunger.", "Check the drainage first, then feed — hibiscus are greedy."],
      ["No flowers", "Not enough light or not enough potash.", "Move it into full sun and switch to a high-potash feed."],
    ],
  },
  Cyclamen: {
    light: "Bright indirect light, and cool",
    lightLong: "Bright indirect light in a genuinely cool room — 12–15 °C. A cyclamen in a warm lounge collapses within a fortnight, which is why most are treated as disposable.",
    humidity: "Above 50%",
    soil: "Free-draining compost with grit",
    soilLong: "Free-draining compost with grit, and the top of the tuber left proud of the surface — buried, it rots.",
    feed: "A weak high-potash feed every two weeks while in flower",
    repotNote: "Repot the dormant tuber in late summer, keeping its shoulders above the compost.",
    toxicity: "Toxic to cats and dogs — the tuber especially, which can cause heart problems in quantity.",
    propagation: "From seed. Tubers do not divide successfully.",
    waterHow:
      "Water from below, into the saucer, and never into the crown. Let it take up what it wants for twenty minutes, then pour the rest away.",
    problems: [
      ["Collapsing, floppy leaves and stems", "Too warm — or water in the crown.", "Move it somewhere cool and water from below only."],
      ["Yellow leaves in spring", "Normal. It is going dormant.", "Stop watering, let it die back, and keep the tuber dry until late summer."],
      ["Grey fuzzy mould on the stems", "Botrytis from damp still air.", "Remove affected parts, improve airflow, and keep water off the crown."],
    ],
  },
  Clivia: {
    light: "Bright indirect light; shade in summer",
    lightLong: "Bright indirect light, and no direct sun. Clivias flower reliably in a spot most flowering plants would sulk in.",
    humidity: "Room humidity is fine",
    soil: "Loam-based, free-draining compost",
    soilLong: "A loam-based compost with grit. Clivia roots are thick and fleshy and rot in anything that stays wet.",
    feed: "A balanced feed monthly from spring to late summer; none in winter",
    repotNote: "Only every three or four years — clivias flower best when tightly potbound, to the point of cracking the pot.",
    toxicity: "Toxic to cats and dogs; causes vomiting, and the bulb in quantity affects the heart.",
    propagation: "Divide the clump after flowering, giving each piece its own thick roots. Offsets take three or four years to flower.",
    waterHow: "Water when the top half is dry in the growing season. From late autumn, keep it almost completely dry and cool for eight to ten weeks — that rest is what makes it flower.",
    problems: [
      ["Never flowers", "No winter rest.", "Keep it cool (around 10 °C) and nearly dry from November to January, then resume watering and it will send a stalk up."],
      ["Flower stalk stays short, flowers open inside the leaves", "Too warm during the rest, or watered too early.", "Keep the rest cooler and wait until the stalk is clear of the leaves before watering."],
      ["Pale scorched patches", "Direct sun.", "Move it into bright shade."],
    ],
  },
  Hippeastrum: {
    inherit: "Clivia",
    light: "Bright light with some direct sun",
    repotNote: "Every three or four years, with the top third of the bulb above the compost.",
    propagation: "Pot up the offset bulbs that form beside the parent.",
    waterHow:
      "Water sparingly until the flower stalk is well up, then generously while it flowers and while the leaves grow. Stop entirely in late summer for a dry rest of eight to ten weeks, then start again.",
    problems: [
      ["Leaves but no flowers", "It did not get a dry rest, or the leaves were cut off too early.", "Let the leaves grow all summer to feed the bulb, then withhold water for eight to ten weeks in autumn."],
      ["Soft, mushy bulb", "Rot from water sitting around the neck.", "Water around the edge of the pot and keep the top of the bulb exposed."],
      ["Red streaks on the bulb and leaves", "Red blotch, a fungal disease.", "Remove affected tissue, keep the bulb dry, and treat with a fungicide."],
    ],
  },

  // ------------------------------------------------- Bromeliads & air plants
  Guzmania: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light. Bromeliads take more shade than most flowering plants but need brightness to keep their colour.",
    humidity: "Above 60%",
    soil: "An open bark-based mix, barely any compost",
    soilLong: "Bromeliads are epiphytes with token root systems used mostly for anchorage. Orchid bark with a little compost, in a small pot, is right.",
    feed: "A very weak feed occasionally, into the central cup rather than the compost",
    repotNote:
      "Rarely. The parent rosette flowers once and then slowly dies over a year or two, leaving pups around its base — those are what you pot on.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Separate the pups when they are a third to a half the size of the parent, with a sharp knife at the base.",
    waterHow:
      "Fill the central cup with water and keep it topped up, flushing it out every couple of weeks so it does not stagnate. Water the compost only lightly — the cup is the plant's real reservoir.",
    problems: [
      ["The parent rosette dying after flowering", "Normal. Bromeliads are monocarpic: flower once, then finish.", "Keep the pups growing; they will flower in two or three years."],
      ["Brown crispy leaf tips", "Dry air, or minerals in the cup.", "Raise humidity and flush the cup with rainwater regularly."],
      ["Rot at the base", "The compost was kept too wet.", "Water the cup, not the pot."],
    ],
  },
  Aechmea: { inherit: "Guzmania" },
  Tillandsia: {
    inherit: "Guzmania",
    light: "Bright indirect light",
    soil: "None — air plants grow on nothing at all",
    soilLong: "No growing medium whatsoever. Sit them in a bowl, wire them to bark, or wedge them into a shell — anything that lets air get right round them.",
    repotNote: "Nothing to repot. Just make sure whatever it sits on lets it dry out within a few hours of watering.",
    feed: "A very weak bromeliad feed in the soaking water once a month",
    propagation: "Separate the pups that form at the base after flowering.",
    waterHow:
      "Soak the whole plant in a bowl of water for twenty to thirty minutes once a week, then shake it hard and lay it upside down to dry. Water trapped in the base for more than a few hours is what rots them — misting alone is not enough.",
    problems: [
      ["Brown mushy centre, leaves pulling out", "Water sat in the base after soaking.", "Shake hard and dry upside down after every soak. A rotted centre is fatal."],
      ["Leaves curling tighter and going brown at the tips", "Thirsty.", "Soak weekly, more often in a dry warm room."],
      ["No colour or flowers", "Not enough light.", "Move it brighter, out of direct sun."],
    ],
  },

  // -------------------------------------------------------- Herbs & edibles
  Ocimum: {
    light: "Full sun — six hours minimum",
    lightLong: "As much direct sun as possible. Supermarket basil dies indoors mainly because a kitchen windowsill gives it a fraction of the light it needs.",
    humidity: "Room humidity is fine, with air moving",
    soil: "Rich, free-draining compost",
    soilLong: "A rich compost that holds some water but drains freely. The pot a supermarket basil comes in is far too small and far too crowded — split it into three or four pots on day one.",
    feed: "A balanced feed at half strength every two weeks in summer",
    repotNote: "Basil is an annual. Rather than repotting, take cuttings through the summer and start new plants.",
    toxicity: "Non-toxic to cats and dogs, and edible.",
    propagation: "Cuttings root in a glass of water within a week. This is the practical way to keep basil going year-round.",
    waterHow: "Keep the compost damp — basil wilts fast and hard — but water in the morning, at the base, so the leaves are dry by night.",
    problems: [
      ["Whole plant collapses within a fortnight of coming home", "Too many seedlings in one small pot, all competing.", "Split the clump into three or four pots on the day you buy it, and put it in the sunniest spot you have."],
      ["Black spots and stems going soft", "Fungal disease from cold, damp, still air.", "Water in the morning at the base, improve airflow, and keep it warm."],
      ["Flower spikes forming", "It is bolting; the leaves turn bitter afterwards.", "Pinch out the flower buds and the top pair of leaves regularly to keep it producing."],
    ],
  },
  Mentha: {
    inherit: "Ocimum",
    light: "Bright light; a few hours of direct sun",
    toxicity: "Mildly toxic to cats and dogs in quantity, though a nibble is harmless. Edible for people.",
    repotNote: "Every spring — mint fills a pot with runners within a season and exhausts it.",
    propagation: "Cuttings root in water in days, and a clump divides in seconds.",
    waterHow: "Keep it damp. Mint is a streamside plant and the one herb that genuinely does not want to dry out.",
    problems: [
      ["Lower stems going bare and woody", "Normal after a season.", "Cut the whole plant back to 5 cm; it reshoots within a fortnight."],
      ["Orange spots under the leaves", "Mint rust.", "Cut it right back, bin the affected material, and do not compost it."],
    ],
  },
  Rosmarinus: {
    inherit: "Ocimum",
    light: "Full sun",
    soil: "Gritty, free-draining, on the poor side",
    soilLong: "Rosemary is a Mediterranean shrub growing on thin stony ground. Gritty free-draining compost, and a terracotta pot, are much closer to right than rich compost.",
    feed: "Very little — a weak feed twice over the summer",
    toxicity: "Non-toxic to cats and dogs; edible.",
    waterHow: "Let the pot dry out well between waterings. Indoor rosemary is almost always killed by overwatering, and it gives no warning before it goes.",
    problems: [
      ["Suddenly brown and dead with no warning", "Root rot from a pot that stayed wet, or dried out completely once.", "Let the top half dry between waterings and use gritty compost in terracotta."],
      ["Powdery white mildew", "Still humid air indoors.", "Improve airflow; rosemary is happier outdoors whenever the weather allows."],
    ],
  },
  Citrus: {
    light: "Full sun — the brightest position in the house",
    lightLong: "As much direct sun as possible, and outdoors from late spring to autumn if you can manage it. Citrus indoors in poor light drop their leaves and never fruit.",
    humidity: "Above 50%",
    soil: "Citrus compost, or a loam-based compost with grit — slightly acid",
    soilLong: "A free-draining, slightly acid mix. Citrus-specific composts exist and are worth using; ordinary compost plus hard water causes the yellowing you see on half the lemon trees in garden centres.",
    feed: "A citrus feed — summer formula in the growing season, winter formula from autumn. They are hungry and specific about it",
    repotNote: "Every second or third spring, one size up. Prune lightly in late winter to keep the shape.",
    toxicity: "Mildly toxic to cats and dogs — the essential oils in the leaves and peel cause vomiting and, in cats, can irritate skin.",
    propagation: "Semi-ripe cuttings in summer with bottom heat; slow, and seed-grown plants take many years to fruit.",
    waterHow: "Water thoroughly when the top few centimetres are dry, with rainwater if your tap is hard. Never let it stand in a saucer.",
    problems: [
      ["Yellow leaves with green veins", "Iron or magnesium locked out by hard water or alkaline compost.", "Use rainwater, repot into citrus compost, and use a proper citrus feed."],
      ["Leaves dropping in winter", "Too warm and too dark indoors.", "Keep it cool (around 10 °C) and as bright as possible over winter, and water much less."],
      ["Sticky leaves and sooty black mould", "Scale insects — extremely common on indoor citrus.", "Check stems and leaf undersides, wipe them off, and treat every week for a month."],
      ["Flowers but no fruit", "Nothing pollinated them indoors.", "Dab each flower with a soft brush every day or two while they are open."],
    ],
  },
  Coffea: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light, no direct sun. Coffee grows as an understorey shrub and the leaves scorch quickly in a sunny window.",
    humidity: "Above 60%",
    soil: "Slightly acid, free-draining compost",
    soilLong: "A slightly acid, free-draining mix — ericaceous compost cut with perlite works well.",
    feed: "A balanced feed at half strength every two weeks in spring and summer",
    repotNote: "Every spring while young. It grows into a substantial shrub and can be pruned to keep it in bounds.",
    toxicity: "Toxic to cats and dogs — the caffeine in the leaves and beans causes vomiting, a racing heart and tremors.",
    propagation: "From fresh seed, which must be very fresh, or semi-ripe cuttings with bottom heat.",
    waterHow: "Keep evenly damp through spring and summer, slightly drier in winter. It wilts hard when dry and the leaf edges brown afterwards.",
    problems: [
      ["Brown leaf edges and tips", "Dry air or hard water.", "Raise the humidity above 60% and water with rainwater."],
      ["Leaves yellowing between the veins", "The compost has gone too alkaline.", "Repot into an ericaceous mix and feed."],
      ["Leaf drop after a cold night", "Cold damage — it will not take below about 12 °C.", "Move it away from cold glass and keep it warm."],
    ],
  },

  // ----------------------------------------------------------------- Other
  Codiaeum: {
    light: "Bright light with a few hours of direct sun",
    lightLong: "Bright light with some direct sun. The colour in a croton is made by light — in a dim spot the new leaves come out plain green and the plant stops being the thing you bought.",
    humidity: "Above 60%",
    soil: "Rich, free-draining compost",
    soilLong: "A rich compost with perlite. Crotons want moisture and food but not a waterlogged pot.",
    feed: "A balanced feed at half strength every two weeks in spring and summer",
    repotNote: "Every second spring. Prune in spring if it goes bare below; it branches from the cut.",
    toxicity: "Toxic to cats and dogs — the milky sap irritates the mouth and causes vomiting, and it can irritate skin on contact.",
    propagation: "Stem cuttings in spring, dipped in water to stop the sap, rooted under cover with bottom heat.",
    waterHow: "Keep evenly damp. A croton that dries out drops every leaf, often overnight, and takes months to recover.",
    problems: [
      ["All the leaves drop at once", "A shock: a move, a draught, a cold delivery van, or drying out.", "Keep it warm, bright, damp and still. New growth usually comes in a few weeks."],
      ["New leaves plain green", "Not enough light.", "Move it into the brightest spot you have."],
      ["Spider mites", "Dry air. Crotons attract them badly.", "Raise the humidity, shower it, and treat weekly for a month."],
    ],
  },
  Cordyline: {
    inherit: "Codiaeum",
    light: "Bright indirect light with some direct sun",
    toxicity: "Toxic to cats and dogs; the saponins cause vomiting, and in cats dilated pupils.",
    waterHow: "Keep lightly damp with rainwater. Cordylines are noticeably sensitive to fluoride in tap water and brown at the tips because of it.",
    problems: [
      ["Brown tips and edges", "Fluoride and salts in tap water — the classic cordyline complaint.", "Switch to rainwater or filtered water and flush the pot occasionally."],
      ["Colour fading", "Not enough light.", "Move it brighter."],
      ["Lower leaves yellowing and dropping", "Normal as the cane lengthens.", "Peel them off; cut the cane back in spring if it is too bare."],
    ],
  },
  Fittonia: {
    light: "Medium indirect light",
    lightLong: "Medium indirect light, no direct sun. Nerve plants live on a dark forest floor and scorch in a bright window.",
    humidity: "Above 70%. This is a terrarium plant that is sold as a houseplant",
    soil: "Moisture-retentive compost with perlite",
    soilLong: "A mix that stays damp: peat-free compost with perlite, in a small shallow pot.",
    feed: "A weak balanced feed monthly in spring and summer",
    repotNote: "Every spring, into a shallow pot. Pinch the tips out to keep it dense.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Stem cuttings root in water or damp compost in a fortnight.",
    waterHow: "Keep damp at all times. A fittonia faints theatrically when dry and usually recovers within an hour of water — but each faint costs it leaves.",
    problems: [
      ["Dramatic total collapse", "It dried out. It does this often.", "Water it and it stands back up within the hour. A terrarium or cloche prevents the cycle."],
      ["Crispy brown leaf edges", "Air too dry.", "Above 70% humidity, or grow it under glass."],
      ["Leggy bare stems", "Too little light, or no pinching.", "Pinch the tips out regularly and move it to medium indirect light."],
    ],
  },
  Hypoestes: { inherit: "Fittonia", light: "Bright indirect light — the spots need it", humidity: "Above 50%", toxicity: "Non-toxic to cats and dogs.", repotNote: "It is short-lived and best replaced or restarted from cuttings every year or two. Pinch out flower spikes — flowering exhausts it." },
  Oxalis: {
    light: "Bright indirect light with some direct sun",
    lightLong: "Bright indirect light with a little direct sun. The purple deepens in brighter light; in shade the leaves stretch and pale.",
    humidity: "Room humidity is fine",
    soil: "Free-draining compost with perlite",
    soilLong: "Ordinary compost with perlite. It grows from small scaly rhizomes just under the surface.",
    feed: "A balanced feed at half strength monthly while in leaf",
    repotNote: "Every second spring, or whenever the pot fills with rhizomes. Divide at the same time.",
    toxicity: "Toxic to cats and dogs in quantity — the leaves are high in oxalic acid. A nibble is harmless; a mouthful is not.",
    propagation: "Divide the rhizomes at repotting; each scaly piece makes a new plant.",
    waterHow: "Keep lightly damp while in leaf. When it dies back, stop watering entirely until new shoots appear.",
    problems: [
      ["Dies back to nothing in late summer", "Dormancy, and completely normal.", "Stop watering, leave the pot somewhere cool for a month or two, then start again — it comes back thicker."],
      ["Leaves folding down", "Normal. It folds at night and in strong sun.", "Nothing to fix."],
      ["Pale stretched stems", "Not enough light.", "Move it brighter."],
    ],
  },
  Aspidistra: {
    light: "Low to medium indirect light",
    lightLong: "Low to medium indirect light — it is called the cast iron plant for a reason, and it is the best genuine low-light plant on this list. Direct sun scorches it.",
    humidity: "Indifferent",
    soil: "Standard compost with perlite",
    soilLong: "Ordinary compost with perlite. Nothing special required.",
    feed: "A weak feed two or three times over the summer. Over-feeding scorches the leaf tips",
    repotNote: "Every four or five years. It is very slow and resents disturbance.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Divide the rhizome in spring, giving each piece two or three leaves.",
    waterHow: "Water when the top half of the pot is dry. It survives being forgotten for a month, which is the whole point of it.",
    problems: [
      ["Brown leaf tips", "Over-feeding, or hard water.", "Feed less and flush the pot with rainwater."],
      ["Pale bleached patches", "Direct sun.", "Move it into shade."],
      ["Very slow growth", "Normal. Two or three new leaves a year is a good year.", "Nothing to fix; do not over-water trying to speed it up."],
    ],
  },
  Cyperus: {
    light: "Bright indirect light with some direct sun",
    lightLong: "Bright light, including some direct sun. It is a marsh plant from open ground.",
    humidity: "Above 50%",
    soil: "Heavy, moisture-retentive compost",
    soilLong: "Ordinary compost, kept wet. This is the one houseplant that is genuinely happy with its pot standing in water.",
    feed: "A balanced feed monthly through the growing season",
    repotNote: "Every spring — it fills a pot fast.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Divide the clump, or turn a flower head upside down in a glass of water — it roots from the bracts.",
    waterHow: "Stand the pot in a saucer of water and keep it there. An umbrella plant cannot be overwatered and dies quickly if it dries.",
    problems: [
      ["Brown crispy stem tips", "It dried out, even briefly.", "Stand it in water permanently."],
      ["Yellowing older stems", "Normal ageing.", "Cut them out at the base."],
    ],
  },
  Soleirolia: {
    inherit: "Fittonia",
    light: "Medium to bright indirect light",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Pull off a clump with a little root and press it onto damp compost — it takes within days.",
    waterHow: "Keep damp at all times, watering from below. Baby's tears collapses within hours of drying out.",
  },
  Bambusa: {
    light: "Bright indirect light",
    lightLong: "Bright indirect light. True bamboos want brightness and airflow; they do poorly in a dark corner.",
    humidity: "Above 50%",
    soil: "Rich, moisture-retentive compost",
    soilLong: "A rich compost that holds water. Bamboo is thirsty and roots hard into whatever it is given.",
    feed: "A high-nitrogen feed every two weeks in spring and summer",
    repotNote: "Every spring — bamboo fills a pot with root in a single season and will eventually split it.",
    toxicity: "Non-toxic to cats and dogs.",
    propagation: "Divide the clump in spring with a saw. It is heavy work.",
    waterHow: "Keep the compost damp at all times. Bamboo in a pot dries out fast and drops leaves when it does.",
    problems: [
      ["Leaves curling lengthways", "Thirsty.", "Water more often; potted bamboo needs it almost daily in summer."],
      ["Yellow leaves", "Overwatering in a pot with no drainage, or hard water.", "Check the pot drains; use rainwater."],
      ["Spider mites", "Dry indoor air.", "Raise humidity and treat weekly."],
    ],
  },
};

/**
 * Per-plant records, keyed by the slug the generator derives from the
 * scientific name ("Monstera deliciosa" -> "monstera-deliciosa").
 *
 * `blurb` is the one field that must be here and must be unique — it is the
 * paragraph that makes the page about *this* plant rather than about its
 * genus. Everything else is either a fact the genus can't carry (size,
 * origin, how hard it is) or an override of a genus field.
 *
 * `problems` and `faq` here are appended to the genus's; every other key
 * replaces it.
 */
export const PLANTS = {
  // ---------------------------------------------------------------- Aroids
  "monstera-deliciosa": {
    blurb:
      "The plant that put holes in a million living rooms. A monstera deliciosa is a climbing aroid from the rainforests of southern Mexico and Central America, where it hauls itself up tree trunks and grows leaves the size of a bin lid. The famous splits and holes — fenestrations — only appear as the plant matures, and only if it has enough light and something to climb; a young one in a dark corner makes plain heart-shaped leaves and stays that way.",
    size: "2–3 m tall indoors with a pole, leaves up to 60 cm across",
    origin: "Southern Mexico to Panama",
    difficulty: "Easy",
    faq: [
      ["Why doesn't my monstera have holes?", "Because it is still juvenile, or it hasn't got enough light and nothing to climb. Fenestration is a maturity signal: a monstera makes split leaves when conditions tell it that it has reached the canopy. Give it bright indirect light and a moss pole, and the leaf after next will usually show the difference."],
      ["Should I cut off my monstera's aerial roots?", "No. They are how the plant anchors and feeds itself as it climbs. Tuck them into a moss pole or down into the pot; cutting them off does no lasting harm but throws away the thing that produces the biggest leaves."],
      ["Is monstera fruit edible?", "The fruit of Monstera deliciosa is edible when fully ripe — that is the 'deliciosa' — but it almost never fruits indoors, and an unripe one is loaded with the same oxalate crystals as the leaves and will burn your mouth badly."],
    ],
  },
  "monstera-adansonii": {
    blurb:
      "The Swiss cheese vine: a smaller, faster, holier relative of the big monstera, with leaves perforated like lace from the day they open. It trails happily from a shelf but is a climber by nature, and given a pole it makes leaves three times the size. It is one of the quickest aroids to fill out a pot.",
    size: "Vines to 2 m or more; leaves 10–25 cm",
    origin: "Central and South America",
    difficulty: "Easy",
  },
  "monstera-obliqua": {
    blurb:
      "A collector's plant, and one of the most mislabelled in the trade — almost everything sold as obliqua is an adansonii. The real thing has leaves that are more hole than leaf, tissue-paper thin, on wiry runners, and it is genuinely difficult: it wants near-constant humidity and grows very slowly. Check the papery texture before you pay a collector's price.",
    size: "Small and slow; leaves 10–20 cm on long runners",
    origin: "Central and South America",
    difficulty: "Fussy",
    humidity: "Above 80%. Realistically a terrarium plant",
  },
  "monstera-standleyana": {
    blurb:
      "A climbing monstera with narrow, glossy, unsplit leaves, usually speckled with cream. It looks nothing like the monstera most people picture and is often sold as a philodendron by mistake. It is undemanding, fast, and takes a pole well.",
    size: "Vines to 2 m; leaves 15–25 cm",
    origin: "Central America",
    difficulty: "Easy",
  },
  "philodendron-hederaceum": {
    blurb:
      "The heartleaf philodendron: a trailing vine with soft heart-shaped leaves that has been sold as a houseplant for over a century, largely because it is very hard to kill. It grows in less light than almost anything else here and roots from any cutting. The velvet-leaved form sold as 'Micans' is the same species.",
    size: "Vines to 3 m; leaves 7–12 cm",
    origin: "Central America and the Caribbean",
    difficulty: "Easy",
  },
  "philodendron-erubescens": {
    blurb:
      "The blushing philodendron — a climbing species with red-backed leaves and wine-coloured stems, and the parent of most of the famous variegated cultivars: Pink Princess, White Knight, White Princess, and the Birkin. The plain species is vigorous and easy; the variegated forms carry less chlorophyll and need noticeably more light and patience.",
    size: "2 m or more on a pole; leaves 20–30 cm",
    origin: "Colombia",
    difficulty: "Easy",
  },
  "philodendron-gloriosum": {
    blurb:
      "A crawler, not a climber: the rhizome runs along the surface of the soil and puts up huge velvety heart-shaped leaves with bright white veins, one at a time. It wants a long shallow pot rather than a deep one, and the rhizome must sit on the surface — buried, it rots.",
    size: "Leaves 40–60 cm on a slowly creeping rhizome",
    origin: "Colombia",
    difficulty: "Needs attention",
    repotNote:
      "Into a long, shallow, wide pot — the rhizome creeps forward and needs somewhere to go. Lay it on the surface and only cover the roots beneath it, never the rhizome itself.",
  },
  "philodendron-melanochrysum": {
    blurb:
      "The black gold philodendron: a climber whose leaves are so dark they look almost black, with a velvet surface and gold veining, and which lengthen dramatically as the plant climbs. A juvenile leaf is 15 cm; a mature one up a pole can pass 60 cm. It wants high humidity to unfurl those leaves without damage.",
    size: "Leaves to 60 cm on a mature climbing plant",
    origin: "Colombia",
    difficulty: "Needs attention",
    humidity: "Above 65% — new leaves scar in dry air",
  },
  "thaumatophyllum-bipinnatifidum": {
    blurb:
      "Still sold as Philodendron selloum, and still called a tree philodendron, though botanists moved it to Thaumatophyllum in 2018. It is a self-heading plant rather than a vine: a thick woody trunk with a crown of deeply cut leaves, spreading wider than it is tall. It needs floor space more than it needs anything else.",
    size: "1.5 m tall, 2 m wide",
    origin: "South America",
    difficulty: "Easy",
  },
  "epipremnum-aureum": {
    blurb:
      "Pothos, golden pothos, devil's ivy — the plant given to people who say they kill everything. It trails, it climbs, it roots in a glass of water, and it puts up with light levels that would finish most houseplants. Left to climb it eventually makes huge split leaves, which is why a mature wild pothos looks nothing like the pot on your shelf.",
    size: "Vines to 3 m indoors; leaves 8–15 cm trailing, far larger climbing",
    origin: "French Polynesia; naturalised across the tropics",
    difficulty: "Easy",
    faq: [
      ["Can pothos live in water permanently?", "Yes. A pothos cutting will grow in a jar of water indefinitely if you change the water every week or two and add a very dilute feed occasionally. It won't grow as vigorously as it would in a pot, and a plant raised in water sulks for a while if you later move it into compost."],
      ["Is pothos safe for cats?", "No. Like all aroids it contains insoluble calcium oxalate crystals, which burn a cat's mouth and cause drooling and vomiting. It is rarely dangerous, but it is genuinely unpleasant — hang it where a cat can't reach the trailing ends."],
    ],
  },
  "epipremnum-pinnatum": {
    blurb:
      "A close relative of pothos that splits its leaves as it matures, so an established plant looks like a slender monstera. The blue-leaved form, 'Cebu Blue', is the one most people buy — juvenile leaves have a metallic blue sheen that it loses as it climbs and splits.",
    size: "Vines to 3 m; mature climbing leaves to 40 cm",
    origin: "Southeast Asia and Australasia",
    difficulty: "Easy",
  },
  "scindapsus-pictus": {
    blurb:
      "Satin pothos: a trailing vine with matte, slightly puckered leaves splashed with reflective silver. It isn't a pothos at all — Scindapsus is a separate genus — but it wants the same things and is nearly as forgiving. The silver is a layer of air pockets under the leaf surface, and the plant makes less of it in poor light.",
    size: "Vines to 2 m; leaves 8–15 cm",
    origin: "Southeast Asia",
    difficulty: "Easy",
  },
  "scindapsus-treubii": {
    blurb:
      "A thicker, stiffer, slower Scindapsus with leaves like polished pewter ('Moonlight') or near-black ('Dark Form'). It grows at a fraction of the speed of satin pothos and is priced accordingly. Very tolerant of neglect once established — the main risk is impatience.",
    size: "Vines to 1.5 m; leaves 10–15 cm",
    origin: "Southeast Asia",
    difficulty: "Easy",
  },
  "anthurium-andraeanum": {
    blurb:
      "The flamingo flower, the anthurium sold in supermarkets everywhere. What looks like a waxy red flower is a spathe — a modified leaf — around the true flowers on the spadix, and each one lasts for weeks. With enough light it produces them almost continuously; in a dim room it makes leaves and nothing else.",
    size: "40–60 cm tall",
    origin: "Colombia and Ecuador",
    difficulty: "Straightforward",
  },
  "anthurium-clarinervium": {
    blurb:
      "Grown entirely for the leaves: thick, stiff, dark velvet hearts with bone-white veins, held almost flat. It is a lithophyte — in the wild it grows on limestone rock — which is why it wants a mix that looks far too coarse to grow anything in. Slow, but not as difficult as its price suggests.",
    size: "Leaves 20–30 cm; plant to 50 cm",
    origin: "Southern Mexico",
    difficulty: "Needs attention",
  },
  "anthurium-crystallinum": {
    blurb:
      "The other great velvet anthurium: thinner and more elongated than clarinervium, with a crystalline shimmer across the leaf and silver-white veining. New leaves emerge coppery pink and harden off dark green. It is more humidity-dependent than clarinervium and scars easily if the air is dry while a leaf is opening.",
    size: "Leaves 25–40 cm; plant to 60 cm",
    origin: "Colombia and Panama",
    difficulty: "Needs attention",
    humidity: "Above 70%",
  },
  "alocasia-amazonica": {
    blurb:
      "Alocasia Polly, or African mask — a hybrid, despite the name, and not from the Amazon at all. Arrow-shaped leaves with scalloped edges and thick white veins on near-black green. It is the alocasia most people meet first and the one most people assume they have killed, because it goes dormant at the slightest provocation and comes back from the corm weeks later.",
    size: "40–60 cm tall",
    origin: "A garden hybrid of Southeast Asian parents",
    difficulty: "Needs attention",
  },
  "alocasia-zebrina": {
    blurb:
      "Grown for its stems as much as its leaves: thick petioles barred in black and cream, holding arrowhead leaves at the top like a sculpture. It leans hard toward the light and needs turning weekly or it goes permanently lopsided.",
    size: "60–100 cm tall",
    origin: "The Philippines",
    difficulty: "Needs attention",
  },
  "alocasia-macrorrhizos": {
    blurb:
      "Giant taro — the largest alocasia commonly grown indoors, with upright glossy leaves that can pass a metre in length on a mature plant. It is thirstier and hungrier than the smaller alocasias and needs both floor space and a bright spot to do anything worth watching.",
    size: "1.5–2 m indoors; leaves to 1 m",
    origin: "Southeast Asia",
    difficulty: "Straightforward",
  },
  "alocasia-baginda": {
    blurb:
      "The dragon scale alocasia: stiff, thick leaves textured like reptile skin, silver-green with dark veins pressed deep into the surface. It is slower and tougher-leaved than most alocasias, which makes it a little more forgiving — but it is a spider mite magnet and wants humidity above 60%.",
    size: "40–60 cm tall",
    origin: "Borneo",
    difficulty: "Fussy",
  },
  "alocasia-reginula": {
    blurb:
      "Black velvet alocasia: small, low and matte black, with silver veins, and a texture like felt. It is a rheophyte from stream banks in Borneo and wants a very open mix and genuinely humid air. The smallest alocasia here and the one most often lost to a wet pot.",
    size: "25–40 cm tall",
    origin: "Borneo",
    difficulty: "Fussy",
    humidity: "Above 70%",
  },
  "alocasia-micholitziana": {
    blurb:
      "Sold everywhere as 'Frydek': deep green velvet arrowheads with sharp white veins, on upright stems. Faster and more vigorous than the black velvet types, and it pups readily — a happy Frydek fills its pot with offsets within a couple of seasons.",
    size: "60–90 cm tall",
    origin: "The Philippines",
    difficulty: "Needs attention",
  },
  "colocasia-esculenta": {
    blurb:
      "Taro: the elephant ear grown as a food crop across the tropics, with huge soft leaves held on drooping stems. Unlike every other aroid on this list it wants to be wet — it grows in paddies — and will happily sit in a saucer of standing water. Indoors it needs the brightest spot you have.",
    size: "1–1.5 m indoors",
    origin: "Southeast Asia; cultivated worldwide",
    difficulty: "Straightforward",
  },
  "caladium-bicolor": {
    blurb:
      "Angel wings: paper-thin leaves in pink, white, red and green, so translucent they light up from behind. It is a seasonal plant grown from a tuber — it leafs up in spring, performs all summer, then dies back completely in autumn and spends the winter as a dry tuber in its pot. People throw them away every October by mistake.",
    size: "30–60 cm tall while in leaf",
    origin: "South America",
    difficulty: "Needs attention",
  },
  "zamioculcas-zamiifolia": {
    blurb:
      "The ZZ plant: glossy, almost artificial-looking leaflets on upright stalks growing out of fat underground rhizomes that store water for months. It is the toughest plant in this catalogue by a distance — it will hold its looks in a dim office corner on a watering every three weeks, and the only reliable way to kill one is to be generous with the watering can.",
    size: "60–100 cm tall",
    origin: "Eastern Africa, from Kenya to South Africa",
    difficulty: "Easy",
    faq: [
      ["How often should I water a ZZ plant?", "Roughly every three weeks, and only when the pot is completely dry. In winter, or in a cool dim room, every four to six weeks is right. Wrinkling stems mean it's thirsty; yellow soft stems mean you've already watered too much."],
      ["Can a ZZ plant survive with no natural light?", "It will survive for months under office fluorescent light alone and look fine doing it, but it won't grow. Give it indirect daylight if you want new stems."],
    ],
  },
  "spathiphyllum-wallisii": {
    blurb:
      "The peace lily: dark glossy leaves and white spathes on tall stems, sold as an easy low-light plant. It is easy, but 'low light' is the part that misleads people — it will live in a dim room and never flower there. It also faints spectacularly when thirsty and stands straight back up after a drink, which makes it the most legible plant in the house.",
    size: "40–70 cm tall",
    origin: "Central and South America",
    difficulty: "Easy",
    faq: [
      ["Why won't my peace lily flower?", "Almost always too little light. Peace lilies are sold as low-light plants because they survive there, not because they bloom there. Move it somewhere bright but out of direct sun and feed it monthly through spring and it will usually produce spathes within a season."],
      ["Do peace lilies clean the air?", "They were in NASA's 1989 clean-air study, which was run in sealed chambers. In a real room the air exchange dwarfs anything a potted plant does — you would need hundreds of them per room to matter. Keep it because it's a good plant, not as an air filter."],
    ],
  },
  "aglaonema-commutatum": {
    blurb:
      "Chinese evergreen: broad leaves marbled in silver, cream, pink or red on a short compact plant. The silver and green kinds are among the best genuinely low-light plants sold; the pink and red cultivars are a different proposition and need real brightness to keep their colour. Slow, tough, and long-lived.",
    size: "40–70 cm tall and wide",
    origin: "Southeast Asia",
    difficulty: "Easy",
  },
  "dieffenbachia-seguine": {
    blurb:
      "Dumb cane: big paddle leaves splashed with cream, on a thick upright cane that goes bare at the bottom as it ages. It grows fast and takes low light, and the common name is a genuine warning — chewing a leaf swells the mouth and tongue enough to stop you speaking, which is worth knowing if there are small children about.",
    size: "1–1.5 m tall",
    origin: "The Caribbean and northern South America",
    difficulty: "Easy",
  },
  "syngonium-podophyllum": {
    blurb:
      "Arrowhead vine: it starts as a compact rosette of arrow-shaped leaves and then, given something to climb, turns into a vine with completely different lobed adult foliage. It grows fast, roots from anything, and comes in more colour forms than almost any other houseplant — pink, cream, speckled, near-white.",
    size: "Compact to 40 cm, or vining to 2 m on a pole",
    origin: "Central and South America",
    difficulty: "Easy",
  },
  "rhaphidophora-tetrasperma": {
    blurb:
      "Mini monstera — which it isn't; it's neither a monstera nor a philodendron, despite being sold as both. A fast, slender climbing aroid with small deeply-split leaves, it grows several leaves a month in summer and is one of the quickest ways to get a green wall of fenestration in a small flat.",
    size: "Vines to 2.5 m on a pole; leaves 10–20 cm",
    origin: "Southern Thailand and Malaysia",
    difficulty: "Easy",
  },
  "philodendron-florida-ghost": {
    blurb:
      "A hybrid climber whose new leaves open pure white — the 'ghost' — then harden through cream and pale green to deep green over several weeks. The multi-lobed leaf shape is unusual enough to be recognisable at a glance. How white the new leaves open depends on how much light the plant is getting.",
    size: "1.5 m on a pole; leaves 20–30 cm",
    origin: "A hybrid of Brazilian parents",
    difficulty: "Needs attention",
  },
  "philodendron-florida-beauty": {
    blurb:
      "The variegated sport of the Florida hybrids: the same deeply-lobed leaves, splashed and marbled in cream and yellow, with every leaf different. Variegation on this one is unstable — it can revert to plain green or produce an all-white leaf that cannot feed itself.",
    size: "1.5 m on a pole; leaves 20–30 cm",
    origin: "A hybrid of Brazilian parents",
    difficulty: "Needs attention",
  },
  "philodendron-prince-of-orange": {
    blurb:
      "A self-heading philodendron — it forms a rosette rather than climbing — whose new leaves emerge bright copper-orange and age through amber to green, so an established plant shows the whole gradient at once. Compact enough for a shelf and one of the easier collector philodendrons.",
    size: "50–70 cm tall and wide",
    origin: "A cultivated hybrid",
    difficulty: "Easy",
  },
  "philodendron-moonlight": {
    blurb:
      "A self-heading hybrid with new leaves in a startling acid chartreuse that darkens slowly to mid-green. Compact, fast, and tolerant — the brightness of the new growth is what it is grown for, and it holds it longest in bright indirect light.",
    size: "50–70 cm tall and wide",
    origin: "A cultivated hybrid",
    difficulty: "Easy",
  },
  "philodendron-ring-of-fire": {
    blurb:
      "A slow climbing hybrid with long, deeply serrated leaves marbled in cream, orange and red against green. The variegation is unstable and every leaf is different; it is one of the slowest philodendrons in cultivation, which is most of why it costs what it does.",
    size: "1.5 m on a pole over several years; leaves 30–45 cm",
    origin: "A cultivated hybrid",
    difficulty: "Needs attention",
  },
  "philodendron-paraiso-verde": {
    blurb:
      "A climber with long, narrow, marbled leaves in shifting shades of pale and deep green — the variegation is a pattern of chlorophyll density rather than an absence of it, so it doesn't behave like a white variegate. New leaves emerge almost lime and darken unevenly.",
    size: "1.5–2 m on a pole; leaves 30–40 cm",
    origin: "A cultivated hybrid",
    difficulty: "Needs attention",
  },
  "philodendron-burle-marx-variegata": {
    blurb:
      "The variegated form of the fast, shrubby Burle Marx philodendron, splashed in cream and yellow. It spreads sideways rather than climbing far and is a good deal quicker than most variegated philodendrons — which is unusual, and makes it the sensible first variegate to try.",
    size: "60–90 cm tall, spreading wider",
    origin: "Named for the Brazilian landscape architect Roberto Burle Marx",
    difficulty: "Straightforward",
  },
  "philodendron-jose-buono": {
    blurb:
      "A large climbing philodendron with long paddle leaves blocked and splashed in cream and white — the variegation comes in solid sectors rather than speckles. Leaves get very big on a pole, and like all sectorial variegates it can throw an all-green or an all-white leaf.",
    size: "2 m on a pole; leaves 40–60 cm",
    origin: "A cultivated hybrid",
    difficulty: "Needs attention",
  },
  "alocasia-pink-dragon": {
    blurb:
      "An alocasia grown as much for its stems as its leaves: dusty-pink petioles holding glossy dark arrowheads with pale veins and burgundy undersides. Sturdier and more forgiving than most alocasias, and one of the better ones to start with.",
    size: "60–90 cm tall",
    origin: "A cultivated hybrid",
    difficulty: "Needs attention",
  },
  "alocasia-regal-shield": {
    blurb:
      "A big hybrid alocasia with broad, near-black shield-shaped leaves and deep purple undersides. It is larger and noticeably tougher than the Polly types, coping with ordinary room humidity better than most of the genus.",
    size: "1–1.5 m tall",
    origin: "A cultivated hybrid",
    difficulty: "Straightforward",
  },
  "aglaonema-red-siam": {
    blurb:
      "A compact aglaonema with green leaves edged and veined in hot pink-red, on pink stems. Like all the red and pink aglaonemas it needs more light than the silver kinds — the colour is what the extra light buys.",
    size: "40–60 cm tall",
    origin: "A cultivated hybrid of Southeast Asian parents",
    difficulty: "Easy",
  },
  "aglaonema-siam-aurora": {
    blurb:
      "Also sold as Red Lipstick: broad dark leaves outlined in a clean red margin, with red midribs and stems. One of the most widely grown coloured aglaonemas and among the more forgiving of them in ordinary indoor light.",
    size: "40–60 cm tall",
    origin: "A cultivated hybrid of Southeast Asian parents",
    difficulty: "Easy",
  },
  "aglaonema-pink-dalmatian": {
    blurb:
      "Dark green leaves flecked and spotted in pink, as if splattered — no two leaves alike. It carries less chlorophyll than the green aglaonemas and is correspondingly slower and hungrier for light.",
    size: "40–60 cm tall",
    origin: "A cultivated hybrid of Southeast Asian parents",
    difficulty: "Straightforward",
  },

  // ----------------------------------------------------------------- Trees
  "ficus-lyrata": {
    blurb:
      "The fiddle-leaf fig: huge violin-shaped leaves on an upright trunk, and the most photographed and most complained-about houseplant of the last decade. It is not difficult so much as inflexible — it wants a bright spot, a steady routine, and to be left exactly where it is. Most of the horror stories start with someone moving it.",
    size: "2–3 m indoors; leaves 25–40 cm",
    origin: "West Africa",
    difficulty: "Needs attention",
    faq: [
      ["Why is my fiddle-leaf fig dropping leaves?", "Because something changed. Ficus lyrata drops leaves in response to a move, a draught, a cold window, a change in watering, or repotting — often weeks after the event. Put it in a bright stable spot, water on a consistent schedule, and stop interfering; the drop usually stops within a month."],
      ["What do brown spots on a fiddle-leaf fig mean?", "Dark spots spreading from the leaf edges inward, with yellowing around them, are almost always overwatering and the beginning of root rot. Dry, crisp brown patches at the very edge are usually under-watering or low humidity. Check the roots before you treat it as either."],
      ["How much light does a fiddle-leaf fig need?", "As much bright indirect light as you can give it, ideally right beside a large window, plus a few hours of direct morning sun. These are canopy trees — the dim-corner placement they usually get is the root of most fiddle-leaf problems."],
    ],
  },
  "ficus-elastica": {
    blurb:
      "The rubber plant: thick, glossy, oval leaves on an upright stem, in deep green, burgundy, or variegated cream and pink. Much more forgiving than its fiddle-leaf cousin and considerably faster — a single-stemmed plant can put on 60 cm in a good summer. Pinch the top out to make it branch.",
    size: "2–3 m indoors; leaves 20–30 cm",
    origin: "Northeast India to Indonesia",
    difficulty: "Easy",
  },
  "ficus-benjamina": {
    blurb:
      "The weeping fig: a small-leaved tree with arching branches, often sold braided or standard-trained. It has a reputation for dropping every leaf when moved, and it earns it — but a benjamina that is left alone in a bright spot refoliates and then behaves for years.",
    size: "1.5–3 m indoors",
    origin: "South and Southeast Asia, northern Australia",
    difficulty: "Straightforward",
  },
  "ficus-microcarpa": {
    blurb:
      "Sold as the ginseng ficus: a fat exposed root system like a swollen bottle, topped with a small canopy of glossy leaves. The shape is nursery-made — the roots are grown underground and then lifted — and it is the plant most people are given as their first bonsai. Easier than a real bonsai, and much harder to kill.",
    size: "30–60 cm as sold; larger untrained",
    origin: "Asia and Australasia",
    difficulty: "Straightforward",
  },
  "ficus-audrey": {
    blurb:
      "Ficus Audrey: soft matte green leaves with pale veins on a pale trunk — a gentler, more forgiving alternative to the fiddle-leaf fig, and increasingly sold as exactly that. It is the national tree of India, where mature specimens drop aerial roots and spread over acres. Worth noting that the correct botanical name is Ficus benghalensis; 'Ficus audrey' is a trade name rather than a species.",
    size: "1.5–2.5 m indoors",
    origin: "India and Pakistan",
    difficulty: "Straightforward",
  },
  "ficus-triangularis": {
    blurb:
      "A small ficus with stiff, triangular leaves held flat along the stem, usually sold in its variegated form with cream margins. It is more compact and slower than the other figs here and makes a good shelf plant rather than a floor tree.",
    size: "60–120 cm indoors",
    origin: "Southern Africa",
    difficulty: "Straightforward",
  },
  "schefflera-arboricola": {
    blurb:
      "The dwarf umbrella tree: leaflets arranged in a wheel around the end of each stalk, on a plant that branches freely and takes hard pruning without complaint. It is fast, cheap, forgiving and one of the best value large green plants there is.",
    size: "1.5–2 m indoors",
    origin: "Taiwan and Hainan",
    difficulty: "Easy",
  },
  "dracaena-trifasciata": {
    blurb:
      "The snake plant — still called Sansevieria by almost everyone, though it was moved to Dracaena in 2017. Stiff upright leaves banded in grey-green, growing from a spreading rhizome. It survives deep shade, direct sun, and being forgotten for two months, and it is the plant most often recommended for a bedroom because it keeps its stomata shut by day and releases oxygen at night.",
    size: "60–120 cm tall",
    origin: "West Africa",
    difficulty: "Easy",
    faq: [
      ["How often should you water a snake plant?", "Every three weeks in summer and every five or six in winter, and only when the pot is completely dry throughout. Water around the edge of the pot rather than into the crown, where standing water causes rot."],
      ["Why are my snake plant's leaves falling over?", "Either too much water — the base has gone soft and can no longer hold the leaf up — or too little light, which makes the leaves stretch and weaken. Check the base first: if it's soft and yellow, that's rot, and the plant needs unpotting today."],
    ],
  },
  "dracaena-marginata": {
    blurb:
      "The dragon tree: thin arching leaves edged in red on top of slender grey canes, often several canes of different heights in one pot. It is slow, tough, and unusually sensitive to fluoride — the brown leaf tips almost every specimen has are usually the tap water, not you.",
    size: "1.5–2.5 m indoors",
    origin: "Madagascar",
    difficulty: "Easy",
  },
  "dracaena-fragrans": {
    blurb:
      "The corn plant: broad strap leaves in a rosette on top of a thick cane, most often sold in the yellow-striped 'Massangeana' form. It tolerates low light better than almost any other large houseplant, which is why it has furnished offices for fifty years.",
    size: "1.5–2 m indoors",
    origin: "Tropical Africa",
    difficulty: "Easy",
  },
  "dracaena-angolensis": {
    blurb:
      "The cylindrical snake plant: smooth round spears growing from a rhizome, sometimes sold braided or fanned out. Care is identical to a regular snake plant, and the braiding is done at the nursery — new growth comes up straight, so a braided plant slowly stops looking braided.",
    size: "60–150 cm tall",
    origin: "Angola",
    difficulty: "Easy",
  },
  "dracaena-masoniana": {
    blurb:
      "The whale fin: a single enormous paddle-shaped leaf, mottled dark green, usually sold as one or two leaves in a pot. It is very slow — a new leaf a year is normal — and most plants sold are a single leaf cutting that has rooted but has no rhizome yet, so it may never pup.",
    size: "One leaf, 40–120 cm tall",
    origin: "Central Africa",
    difficulty: "Easy",
  },
  "yucca-elephantipes": {
    blurb:
      "The spineless yucca: thick woody canes topped with fountains of sword-shaped leaves, sold as sawn-off logs that sprout. It wants the sunniest spot in the house and almost no water — indoors it is nearly always overwatered, and the base goes soft long before the top shows anything.",
    size: "1.5–2.5 m indoors",
    origin: "Mexico and Central America",
    difficulty: "Easy",
  },
  "pachira-aquatica": {
    blurb:
      "The money tree: several young trunks braided together while soft, topped with palmate leaves of five to seven leaflets. It is a swamp tree in the wild, which is why it tolerates a heavier pot than most, and it is one of very few larger houseplants that is completely non-toxic to cats and dogs.",
    size: "1–2 m indoors",
    origin: "Central and South America",
    difficulty: "Easy",
  },
  "crassula-ovata": {
    blurb:
      "The jade plant: fat glossy oval leaves on a thickening woody trunk, slowly becoming a miniature tree. Given full sun and very little water it lives for decades and takes on red-edged leaves and a genuinely gnarled shape. Given a shady corner and regular watering, it stretches and falls apart.",
    size: "60–120 cm indoors over many years",
    origin: "South Africa and Mozambique",
    difficulty: "Easy",
  },
  "beaucarnea-recurvata": {
    blurb:
      "The ponytail palm — neither a palm nor a tree, but a member of the asparagus family with a swollen water-storing base and a fountain of thin strappy leaves. It is the most drought-tolerant plant in this catalogue after the lithops: a month without water is routine.",
    size: "1–2 m indoors over many years",
    origin: "Eastern Mexico",
    difficulty: "Easy",
  },
  "polyscias-fruticosa": {
    blurb:
      "Ming aralia: finely divided lacy foliage on twisting woody stems, slow-growing and sculptural, and a traditional bonsai subject. It is the fussiest plant in this section — it drops its leaves at any change and wants humidity above 60% — but a settled one is beautiful and very long-lived.",
    size: "1–2 m indoors",
    origin: "Southeast Asia and the Pacific islands",
    difficulty: "Fussy",
  },
  "fatsia-japonica": {
    blurb:
      "Japanese aralia: big glossy hand-shaped leaves on a shrubby plant that is hardy outdoors in mild climates. Indoors it wants a cool, bright, shaded spot — a hallway or a cold porch suits it far better than a heated living room, which is the opposite of most of this list.",
    size: "1–2 m indoors; leaves 20–40 cm across",
    origin: "Southern Japan, South Korea and Taiwan",
    difficulty: "Straightforward",
  },
  "strelitzia-nicolai": {
    blurb:
      "The giant white bird of paradise: enormous paddle leaves on tall stems, forming a fan several metres across. It is grown indoors for the architecture, not the flowers — almost none flower in a living room. The leaves split along the ribs as they age, which is normal and not damage.",
    size: "2–3 m indoors",
    origin: "South Africa",
    difficulty: "Straightforward",
  },
  "strelitzia-reginae": {
    blurb:
      "The orange bird of paradise: smaller and stiffer than nicolai, with grey-green paddle leaves and — given enough sun and enough age — the famous orange and blue crane-headed flower. It needs four or five years and the brightest window in the house before it will bloom.",
    size: "1–1.5 m indoors",
    origin: "South Africa",
    difficulty: "Straightforward",
  },
  "musa-acuminata": {
    blurb:
      "The dwarf banana: huge soft paddle leaves that unfurl from a central spear, growing at a speed that has to be seen to be believed in a warm bright room. It is greedy, thirsty, short-lived and constantly producing pups — treat the parent as temporary and the pups as the plant.",
    size: "1.5–2 m indoors",
    origin: "Southeast Asia",
    difficulty: "Straightforward",
  },

  // ----------------------------------------------------------------- Palms
  "chamaedorea-elegans": {
    blurb:
      "The parlour palm — named for the Victorian drawing rooms it survived, on gaslight and coal dust. Slender green canes with soft arching fronds, tolerant of low light and cool rooms, and non-toxic to cats and dogs. What is sold as one plant is usually a dozen seedlings sharing a pot.",
    size: "60–120 cm indoors",
    origin: "Southern Mexico and Guatemala",
    difficulty: "Easy",
  },
  "dypsis-lutescens": {
    blurb:
      "The areca or butterfly palm: clumping golden canes with feathery upright fronds, sold in big multi-stemmed pots. It is thirstier and hungrier for light than a parlour palm, and it browns at the tips if the air is dry or the water is hard — which is why so many end up looking tired.",
    size: "1.5–2.5 m indoors",
    origin: "Madagascar",
    difficulty: "Straightforward",
  },
  "howea-forsteriana": {
    blurb:
      "The kentia palm: dark arching fronds on slim canes, tolerant of shade, cool rooms and general neglect. It is the most forgiving palm sold and the most expensive, because it grows slowly from seed on a single island — Lord Howe, off Australia — and cannot be rushed.",
    size: "1.5–3 m indoors",
    origin: "Lord Howe Island, Australia",
    difficulty: "Easy",
  },
  "rhapis-excelsa": {
    blurb:
      "The lady palm: fan-shaped fronds of blunt-ended segments on slender bamboo-like canes, forming a dense clump. Unusually for a palm it suckers, so it divides, and it copes with low light and dry air better than most.",
    size: "1–2 m indoors",
    origin: "Southern China and Taiwan",
    difficulty: "Easy",
  },
  "phoenix-roebelenii": {
    blurb:
      "The pygmy date palm: a stout shaggy trunk with a crown of fine feathery fronds, like a scaled-down date palm. It wants more light than the other palms here, and the spines at the base of each frond are genuinely sharp — site it away from where people brush past.",
    size: "1–2 m indoors",
    origin: "Southeast Asia",
    difficulty: "Straightforward",
  },
  "livistona-chinensis": {
    blurb:
      "The Chinese fan palm: broad circular fronds split into drooping segments, giving a very different silhouette from the feathery palms. Slow indoors, tolerant of bright light, and better in a large pot with room for its deep roots.",
    size: "1.5–2.5 m indoors",
    origin: "Southern Japan and Taiwan",
    difficulty: "Straightforward",
  },

  // ------------------------------------------------------- Vines & trailers
  "hoya-carnosa": {
    blurb:
      "The wax plant: thick leathery leaves on woody vines, and — given enough light and enough patience — umbels of star-shaped flowers that smell of chocolate at night and drip nectar onto whatever is underneath. Hoyas flower from short spurs that they reuse year after year, so the one rule is never to cut off an old flower stalk.",
    size: "Vines to 3 m",
    origin: "East Asia and Australia",
    difficulty: "Easy",
    faq: [
      ["How do I get my hoya to flower?", "Bright light including some direct morning sun, a pot it has filled, and time — a hoya usually needs to be two or three years old. Never cut off the old flower spurs: hoyas bloom from the same short stalks repeatedly, and removing them costs you every future flush from that point."],
      ["Should I cut off the long bare hoya vine?", "No, if you can bear it. Those bare runners are searching for something to climb and will leaf up once they find it. Train it around a hoop or up a trellis instead of cutting."],
    ],
  },
  "hoya-kerrii": {
    blurb:
      "The sweetheart hoya, usually sold as a single heart-shaped leaf in a small pot around February. A single leaf with no node will root and sit there, unchanged, for years — it cannot produce a stem. If you want a plant rather than an ornament, buy one with a visible stem and a node.",
    size: "A single leaf, or vines to 2 m if it has a node",
    origin: "Southeast Asia",
    difficulty: "Easy",
    faq: [
      ["Will a single hoya kerrii leaf grow into a plant?", "Almost never. A leaf cutting without a node roots happily and then stops — there is no growth point to make a stem from. It can live like that for years. For a plant that actually vines, buy one with a length of stem and at least one node."],
    ],
  },
  "hoya-linearis": {
    blurb:
      "The odd one out among hoyas: soft, fuzzy, needle-thin leaves hanging in long green curtains, more like a string plant than a wax plant. It comes from cool Himalayan forests, so it wants better humidity, more air movement and cooler nights than the leathery hoyas — and it rots faster if kept wet.",
    size: "Strands to 1.5 m",
    origin: "The Himalayas",
    difficulty: "Needs attention",
    humidity: "Above 60%, with air moving",
  },
  "tradescantia-zebrina": {
    blurb:
      "Inch plant: fast-trailing stems with purple-backed leaves striped in silver. It grows at a rate that makes it disposable — root a handful of cuttings each spring, throw the tired parent out, and you always have a full pot. The colour only holds in bright light.",
    size: "Trails to 1 m",
    origin: "Mexico and Central America",
    difficulty: "Easy",
  },
  "tradescantia-nanouk": {
    blurb:
      "A patented cultivar bred in the Netherlands: thick stems and broad leaves striped in pink, cream and green, much sturdier and denser than the older tradescantias. It is one of the few houseplants that is genuinely a recent invention — released in 2017.",
    size: "Trails to 60 cm",
    origin: "A Dutch cultivar of a South American species",
    difficulty: "Easy",
  },
  "chlorophytum-comosum": {
    blurb:
      "The spider plant: arching striped leaves and long runners carrying miniature plantlets — the babies that made it the most-shared houseplant in the world. Its thick white roots store water, so it forgives a missed fortnight, and the brown tips nearly every specimen has are usually fluoride in the tap water.",
    size: "30–50 cm with runners to 60 cm",
    origin: "Southern Africa",
    difficulty: "Easy",
    faq: [
      ["Why does my spider plant have brown tips?", "Fluoride and salts in tap water, nine times out of ten — spider plants are unusually sensitive to both. Switch to rainwater or filtered water, flush the pot through with plain water a few times a year, and ease off the fertiliser."],
      ["Why isn't my spider plant producing babies?", "It is either too young, in too little light, or in too large a pot. Spider plants send out runners when they are mature and slightly potbound. Give it a bright spot and leave it snug."],
    ],
  },
  "hedera-helix": {
    blurb:
      "English ivy: the hardy climber from European woodland, sold indoors in dozens of leaf shapes and variegations. It is easy outdoors and awkward indoors, because central heating gives it spider mites within weeks. A cool bright room, or a shaded porch, is where it actually works.",
    size: "Trails or climbs to 2 m indoors",
    origin: "Europe and western Asia",
    difficulty: "Needs attention",
  },
  "senecio-rowleyanus": {
    blurb:
      "String of pearls: strands of spherical leaves, each with a translucent window along one side that lets light into the interior — an adaptation to reduce surface area in a dry climate. It has shallow fine roots and a deep pot of wet compost is the standard way it dies.",
    size: "Strands to 60–90 cm",
    origin: "Southwest Africa",
    difficulty: "Needs attention",
  },
  "ceropegia-woodii": {
    blurb:
      "String of hearts: fine purple strands of small marbled heart-shaped leaves, growing from a tuber. It makes small round tubers along the strands too, which makes it one of the easiest plants to propagate — press one onto compost and it roots. Non-toxic to cats and dogs, unlike its string-of-pearls shelf-mate.",
    size: "Strands to 1–2 m",
    origin: "South Africa, Eswatini and Zimbabwe",
    difficulty: "Easy",
  },
  "peperomia-prostrata": {
    blurb:
      "String of turtles: tiny round leaves patterned like a turtle's shell, on slow trailing stems. It is a peperomia rather than a succulent, so it wants more humidity and less sun than the other string plants — and it is very slow, so a full pot is worth paying for.",
    size: "Strands to 30 cm",
    origin: "Brazil",
    difficulty: "Needs attention",
    humidity: "Above 60%",
  },
  "cissus-discolor": {
    blurb:
      "Rex begonia vine: velvety leaves quilted in silver, green and deep pink with red undersides, on a fast climbing vine with curling tendrils. It looks like a begonia and is actually a grape relative. It is beautiful and it is a humidity plant — below about 60% it crisps and drops.",
    size: "Vines to 2 m",
    origin: "Southeast Asia",
    difficulty: "Fussy",
  },
  "pilea-peperomioides": {
    blurb:
      "The Chinese money plant: round coin-shaped leaves on long stalks radiating from a central stem. It was carried out of Yunnan by a Norwegian missionary in 1946 and spread through Scandinavia entirely by cuttings passed between friends, decades before it reached the trade. It pups freely, which is why.",
    size: "30–40 cm tall and wide",
    origin: "Yunnan province, China",
    difficulty: "Easy",
  },
  "peperomia-obtusifolia": {
    blurb:
      "The baby rubber plant: thick, glossy, spoon-shaped leaves on a compact upright plant, often variegated in cream. Semi-succulent, non-toxic, slow and almost unkillable as long as the pot is small and the watering is restrained.",
    size: "25–30 cm tall",
    origin: "Florida, Mexico and the Caribbean",
    difficulty: "Easy",
  },
  "peperomia-caperata": {
    blurb:
      "Ripple peperomia: deeply corrugated heart-shaped leaves in dark green, silver or burgundy, forming a tight rosette, with odd rat-tail flower spikes. Compact enough for a desk and one of the best small plants for a household with pets.",
    size: "20–25 cm tall",
    origin: "Brazil",
    difficulty: "Easy",
  },
  "peperomia-argyreia": {
    blurb:
      "Watermelon peperomia: round leaves striped in silver and dark green exactly like a watermelon rind, on red stalks. Thicker and more water-storing than it looks, and the most common cause of death is a pot that is too big.",
    size: "20–30 cm tall",
    origin: "South America",
    difficulty: "Easy",
  },
  "hoya-publicalyx-splash": {
    blurb:
      "A fast, tough hoya with long dark leaves flecked in silver, and clusters of deep burgundy-black flowers. It is the hoya to start with: vigorous, quick to climb, and readier to bloom young than most of the genus.",
    size: "Vines to 3 m",
    origin: "The Philippines",
    difficulty: "Easy",
  },
  "hoya-australis-lisa": {
    blurb:
      "A variegated australis with rounded leaves splashed in gold and cream on pink-tinged stems. It is vigorous for a variegated hoya and produces scented white flowers with red centres once established.",
    size: "Vines to 3 m",
    origin: "Australia and the Pacific",
    difficulty: "Easy",
  },
  "tradescantia-tricolor": {
    blurb:
      "The pink-striped tradescantia: leaves banded in white, green and bright pink, and among the fastest-growing plants in this catalogue. Keep it bright or the pink vanishes, and restart it from cuttings each year before it goes bare in the middle.",
    size: "Trails to 1 m",
    origin: "A cultivar of a Central American species",
    difficulty: "Easy",
  },
  "peperomia-ginny": {
    blurb:
      "Also sold as rainbow peperomia: thick oval leaves edged in cream and rose over mid-green. It is a sport of the baby rubber plant and wants the same treatment — small pot, bright indirect light, and much less water than you would think.",
    size: "25–30 cm tall",
    origin: "A cultivar of a tropical American species",
    difficulty: "Easy",
  },

  // ------------------------------------------------------- Prayer plants
  "maranta-leuconeura": {
    blurb:
      "The prayer plant proper: velvety leaves patterned in herringbone red veins or dark chocolate blotches, which fold upright at night and open again at dawn. The movement is real and worth watching — it is driven by water pressure in a hinge at the base of each leaf. It trails as it grows and is the most forgiving of this family.",
    size: "20–30 cm tall, trailing to 40 cm",
    origin: "Brazil",
    difficulty: "Straightforward",
    faq: [
      ["Why does my prayer plant fold its leaves up at night?", "It's called nyctinasty, and it's driven by a hinge of water-filled cells at the base of each leaf stalk that swells and shrinks on a daily rhythm. Folding at night is healthy. Leaves that stay folded all day mean something is wrong — usually thirst, cold, or too little light."],
    ],
  },
  "goeppertia-orbifolia": {
    blurb:
      "Big round leaves, up to 30 cm across, banded in pale silver-green stripes — the calathea most people want and the one that punishes tap water hardest. It was moved from Calathea to Goeppertia in 2012, and nobody selling it has noticed. Rainwater and 60% humidity are not optional here.",
    size: "50–80 cm tall; leaves to 30 cm",
    origin: "Bolivia",
    difficulty: "Fussy",
  },
  "goeppertia-makoyana": {
    blurb:
      "The peacock plant: thin, almost translucent leaves painted with dark feathered brushstrokes over pale green, with purple undersides that show when it folds up at night. The thinnest leaves in this family, and correspondingly the quickest to show a brown edge.",
    size: "30–50 cm tall",
    origin: "Eastern Brazil",
    difficulty: "Fussy",
  },
  "goeppertia-roseopicta": {
    blurb:
      "The rose-painted calathea: dark leaves with a pink or cream feathered ring drawn inside the margin, sold in dozens of named forms — Medallion, Dottie, Rosy, Corona. All want the same thing: shade, damp, humid air and rainwater.",
    size: "40–60 cm tall",
    origin: "Northwest Brazil",
    difficulty: "Fussy",
  },
  "goeppertia-lancifolia": {
    blurb:
      "The rattlesnake plant: long wavy-edged leaves marked with alternating large and small dark blotches, with deep purple undersides. It is the toughest and most tolerant member of this family — the one to try first if calatheas have defeated you before.",
    size: "50–75 cm tall",
    origin: "Brazil",
    difficulty: "Needs attention",
  },
  "calathea-ornata": {
    blurb:
      "The pinstripe calathea: dark green leaves ruled with fine pink lines that fade toward white as the leaf ages, with purple undersides. Beautiful, widely sold, and genuinely demanding — the pink lines show every bit of leaf damage.",
    size: "40–60 cm tall",
    origin: "Colombia and Venezuela",
    difficulty: "Fussy",
  },
  "ctenanthe-burle-marxii": {
    blurb:
      "The fishbone prayer plant: pale leaves with dark herringbone bars, on a spreading plant that keeps making new shoots from the base. Ctenanthes are the most robust of the prayer plants and the best bet for someone who wants the look without the misery.",
    size: "30–50 cm tall, spreading wide",
    origin: "Brazil",
    difficulty: "Straightforward",
  },
  "stromanthe-sanguinea": {
    blurb:
      "Almost always sold as 'Triostar': leaves splashed in cream, green and white on top and a solid shocking pink underneath, so the plant flashes pink whenever it moves. It needs more light than a calathea to hold that variegation, and the same humidity.",
    size: "50–80 cm tall",
    origin: "Brazil",
    difficulty: "Fussy",
  },
  "calathea-white-fusion": {
    blurb:
      "The most difficult plant in this catalogue, and the most photographed: leaves marbled in white, green and lilac, with purple undersides. The white tissue cannot photosynthesise, so the plant runs on a fraction of a normal leaf's output and collapses at the first dry spell. A cabinet plant, honestly.",
    size: "30–50 cm tall",
    origin: "A cultivar of a South American species",
    difficulty: "Fussy",
    humidity: "Above 70%, without exception",
  },
  "ctenanthe-amagris": {
    blurb:
      "A compact ctenanthe with silvery leaves feathered in darker green — quieter than the striped prayer plants and rather elegant for it. As with the rest of the genus, it is markedly less demanding than a calathea.",
    size: "25–40 cm tall",
    origin: "A cultivar of a Brazilian species",
    difficulty: "Straightforward",
  },

  // ----------------------------------------------------------------- Ferns
  "nephrolepis-exaltata": {
    blurb:
      "The Boston fern: arching fronds of fine leaflets, the Victorian parlour plant that never went away. It wants what no centrally-heated room offers — constant damp and humid air — which is why it is best kept in a bathroom, and why it sheds leaflets over the carpet everywhere else.",
    size: "50–90 cm tall and wide",
    origin: "Tropical America; the cultivar arose in Boston in 1894",
    difficulty: "Needs attention",
  },
  "adiantum-raddianum": {
    blurb:
      "The maidenhair fern: fan-shaped leaflets on wiry black stems, so fine the whole plant trembles. It is the least forgiving plant in this catalogue about drying out — one missed watering can strip every frond. Cut it back to the compost when that happens; it usually reshoots.",
    size: "30–45 cm tall",
    origin: "Tropical South America",
    difficulty: "Fussy",
  },
  "asplenium-nidus": {
    blurb:
      "The bird's nest fern: broad, undivided, glossy fronds in a rosette around a central crown, growing on tree branches in the wild. The simplest fern to keep — it has none of the maidenhair's drama — but water must never sit in the centre of the rosette.",
    size: "50–90 cm across",
    origin: "Tropical Asia and Australasia",
    difficulty: "Straightforward",
  },
  "platycerium-bifurcatum": {
    blurb:
      "The staghorn fern: two kinds of frond — flat round shield fronds that clasp the mount and brown as they age, and forked antler fronds that hang out from it. It is an epiphyte and is happiest mounted on a board with sphagnum rather than in a pot of compost.",
    size: "Fronds to 60–90 cm",
    origin: "Java, New Guinea and eastern Australia",
    difficulty: "Straightforward",
  },
  "phlebodium-aureum": {
    blurb:
      "The blue star fern: wavy blue-grey fronds growing from furry golden rhizomes that creep along the surface. It tolerates drier air than most ferns, which makes it one of the few realistic ferns for an ordinary room — just never bury the rhizomes.",
    size: "40–70 cm tall",
    origin: "Tropical America",
    difficulty: "Straightforward",
  },
  "davallia-fejeensis": {
    blurb:
      "Rabbit's foot fern: lacy fronds and thick furry rhizomes that crawl over the edge of the pot and hang down like paws. The rhizomes are the point and must stay on the surface — a rabbit's foot fern potted 'properly', with them buried, will die.",
    size: "30–50 cm tall",
    origin: "Fiji",
    difficulty: "Straightforward",
  },

  // ------------------------------------------------------ Begonias & violets
  "begonia-maculata": {
    blurb:
      "The polka dot begonia: angel-wing leaves, olive above with silver spots, deep red beneath, on tall cane stems, with clusters of white flowers. It is the begonia that Instagram made ubiquitous, and it wants humid air that is nonetheless moving — still damp air gives it mildew.",
    size: "60–120 cm tall",
    origin: "Southeast Brazil",
    difficulty: "Needs attention",
  },
  "begonia-rex": {
    blurb:
      "The painted-leaf begonia: grown entirely for foliage in metallic silver, purple, pink and near-black, often spiralled at the base of the leaf. It grows from a rhizome on the surface, is short-lived by houseplant standards, and is propagated from a single leaf — which is how collections spread.",
    size: "25–40 cm tall and wide",
    origin: "Northeast India; the group is a vast set of hybrids",
    difficulty: "Needs attention",
  },
  "saintpaulia-ionantha": {
    blurb:
      "The African violet: a rosette of furry leaves and clusters of small velvety flowers, on a plant that can bloom almost year-round on an east windowsill. It has been bred into thousands of named varieties since its discovery in Tanzania in 1892, and it is propagated from a single leaf — which is why grandmothers' plants outlive grandmothers.",
    size: "15–20 cm across",
    origin: "The Eastern Arc mountains of Tanzania",
    difficulty: "Straightforward",
    faq: [
      ["Why does my African violet have pale rings on the leaves?", "Cold water splashed on the leaves. The furry surface holds droplets against the tissue and chills it, leaving permanent pale rings. Water from below with tepid water — stand the pot in 2 cm of water for twenty minutes and then drain it."],
    ],
  },
  "streptocarpus-hybridus": {
    blurb:
      "Cape primrose: a relative of the African violet with long crinkled leaves and sprays of trumpet flowers held clear of the foliage, in violet, pink, white and near-black. It flowers for months, prefers a cooler room than most houseplants, and propagates from a leaf cut in half lengthways.",
    size: "20–30 cm tall",
    origin: "South Africa",
    difficulty: "Straightforward",
  },
  "episcia-cupreata": {
    blurb:
      "The flame violet: quilted copper and silver leaves on trailing runners, with small scarlet flowers. Another gesneriad — same family as the African violet — but it wants more warmth and more humidity, and it spreads by strawberry-style runners rather than leaf cuttings.",
    size: "15 cm tall, trailing to 40 cm",
    origin: "Northern South America",
    difficulty: "Needs attention",
  },

  // -------------------------------------------------- Succulents & cacti
  "echeveria-elegans": {
    blurb:
      "The Mexican snowball: a tight rosette of pale blue-green leaves coated in a chalky bloom that protects it from sun — and which rubs off permanently on a fingerprint. It needs four to six hours of direct sun to stay compact; anything less and it stretches into a pale tower that cannot be fixed.",
    size: "10–15 cm across, clumping",
    origin: "Central Mexico",
    difficulty: "Straightforward",
  },
  "haworthiopsis-attenuata": {
    blurb:
      "The zebra plant: a small stiff rosette of dark leaves banded in raised white dots. Unlike most succulents it grows under scrub rather than in open desert, so it wants bright indirect light rather than blazing sun, and it is happy on a desk indefinitely.",
    size: "10–15 cm across",
    origin: "The Eastern Cape, South Africa",
    difficulty: "Easy",
  },
  "aloe-vera": {
    blurb:
      "The aloe everyone knows: thick toothed leaves full of clear gel, used on burns for four thousand years. It wants full sun and very little water, and it pups prolifically — one plant becomes six. Worth noting the gel is harmless but the yellow latex just under the skin is what makes it toxic to cats and dogs.",
    size: "40–60 cm tall, clumping",
    origin: "The Arabian peninsula; cultivated worldwide",
    difficulty: "Easy",
  },
  "gasteria-carinata": {
    blurb:
      "Ox tongue: thick, rough, tongue-shaped leaves stacked in two ranks, speckled white. It takes more shade than almost any other succulent, which makes it one of the few that genuinely works away from a window.",
    size: "10–20 cm tall",
    origin: "The Western Cape, South Africa",
    difficulty: "Easy",
  },
  "kalanchoe-blossfeldiana": {
    blurb:
      "Flaming Katy: scalloped succulent leaves under a dense head of small bright flowers, sold in every supermarket and thrown away after one flush. It can be made to rebloom, but only with fourteen hours of complete darkness a night for six weeks — which is why it never happens by accident. It is also one of the more seriously pet-toxic plants sold as a houseplant.",
    size: "20–40 cm tall",
    origin: "Madagascar",
    difficulty: "Easy",
  },
  "sempervivum-tectorum": {
    blurb:
      "Houseleeks, or hens and chicks: flat rosettes that multiply into mats of offsets, hardy to well below freezing. They were planted on roofs across Europe for centuries in the belief they turned away lightning. Honestly better on an outdoor sill than indoors — they want cold nights.",
    size: "5–10 cm across, spreading",
    origin: "The mountains of southern Europe",
    difficulty: "Easy",
  },
  "sedum-morganianum": {
    blurb:
      "Burro's tail: long trailing stems packed with plump blue-green leaves that fall off at the slightest touch — which is both its main fault and its easiest method of propagation. Hang it somewhere nothing brushes past.",
    size: "Strands to 60 cm",
    origin: "Southern Mexico",
    difficulty: "Straightforward",
  },
  "euphorbia-trigona": {
    blurb:
      "African milk tree: upright three-sided green columns with paired thorns and small leaves along the ridges. It looks like a cactus and isn't — and the white latex inside is genuinely caustic, capable of serious eye injury. Wear gloves and eye protection if you cut one.",
    size: "1–2 m indoors",
    origin: "Central Africa",
    difficulty: "Easy",
  },
  "euphorbia-tirucalli": {
    blurb:
      "Pencil cactus, or firesticks: a tangle of smooth green pencil-thick stems with almost no leaves, turning coral-orange in strong sun and cold. Also not a cactus, and carrying the same dangerous latex as its milk-tree relative — this is the plant to be most careful with in the house.",
    size: "1–2 m indoors",
    origin: "Eastern and southern Africa",
    difficulty: "Easy",
  },
  "schlumbergera-truncata": {
    blurb:
      "The Christmas or Thanksgiving cactus: flat segmented stems that arch over and, in late autumn, hang tubular flowers off every tip. It is a forest cactus that grows in tree forks in Brazil, not a desert plant — so it wants more water and less sun than its shape suggests. Plants passed down for fifty years are common.",
    size: "30–50 cm across, arching",
    origin: "The coastal mountains of southeast Brazil",
    difficulty: "Easy",
    faq: [
      ["How do I make a Christmas cactus flower?", "It sets buds in response to long nights and cool temperatures. From early autumn, give it twelve to fourteen hours of complete darkness a night and nights around 12–15 °C for six weeks, and keep it on the dry side. Once buds appear, stop moving it — that is what makes them drop."],
    ],
  },
  "opuntia-microdasys": {
    blurb:
      "Bunny ears cactus: flat oval pads sprouting in pairs, dotted with tufts of fine golden glochids. It has no long spines, which makes it look harmless — it isn't. The glochids detach at a touch, embed in skin and are miserable to get out. Handle with folded newspaper.",
    size: "30–60 cm tall",
    origin: "Northern Mexico",
    difficulty: "Easy",
  },
  "mammillaria-elongata": {
    blurb:
      "Ladyfinger cactus: clusters of short upright fingers covered in neat radiating golden spines, forming a dense colony. It is one of the easiest cacti to keep alive on a sunny windowsill and flowers readily in spring with a ring of small cream flowers.",
    size: "15–20 cm tall, clumping",
    origin: "Central Mexico",
    difficulty: "Easy",
  },
  "cereus-repandus": {
    blurb:
      "The Peruvian apple cactus: a tall ribbed blue-green column that grows steadily upward and is often sold as an architectural floor plant. It is straightforward and long-lived, and it gets heavy — put it in a substantial pot from the start.",
    size: "1–3 m indoors",
    origin: "Northern South America",
    difficulty: "Easy",
  },
  "epiphyllum-oxypetalum": {
    blurb:
      "Queen of the night: flat strappy stems that look untidy for most of the year and then, on one or two nights in summer, open enormous white flowers that are fully open by midnight, heavily scented, and finished by dawn. People hold parties for it.",
    size: "Stems to 1–2 m, arching",
    origin: "Southern Mexico and Central America",
    difficulty: "Straightforward",
  },
  "rhipsalis-baccifera": {
    blurb:
      "Mistletoe cactus: a mass of thin trailing green strands with small white berries — and the only cactus that grows wild outside the Americas, found in Africa and Sri Lanka too. It is an epiphyte from humid forest, so it is the one cactus that wants regular water and hates drying out hard.",
    size: "Strands to 1–2 m",
    origin: "Tropical America, Africa and Sri Lanka",
    difficulty: "Easy",
  },
  "lithops-lesliei": {
    blurb:
      "Living stones: a pair of fused leaves flush with the ground, patterned to look like the pebbles around them. Each year the plant absorbs the old pair of leaves to grow a new one, and watering during that changeover is the standard way people kill them. It is the most specific watering regime in this catalogue and the most unforgiving.",
    size: "2–4 cm across",
    origin: "South Africa",
    difficulty: "Fussy",
    faq: [
      ["When should I water lithops?", "Only in autumn and spring, and only lightly. From late autumn through to when the old pair of leaves has shrivelled to a dry papery shell — usually late spring — give it nothing at all. Watering during the leaf change makes the plant split or rot, and it is the single most common way they die."],
    ],
  },
  "echeveria-lola": {
    blurb:
      "A hybrid echeveria forming an almost perfectly symmetrical rosette in pale lavender-grey with a chalky bloom, blushing pink in strong light. Compact, slow, and one of the most photographed succulents there is.",
    size: "10–12 cm across",
    origin: "A hybrid of Mexican parents",
    difficulty: "Straightforward",
  },
  "echeveria-perle-von-nurnberg": {
    blurb:
      "A 1930s German hybrid: flat pointed leaves in dusty grey-violet with a pink flush, opening into a wide rosette. It colours most strongly in full sun and fades to grey-green without it — it is a plant that tells you plainly whether it is getting enough light.",
    size: "12–15 cm across",
    origin: "A hybrid raised in Germany in the 1930s",
    difficulty: "Straightforward",
  },

  // ------------------------------------------------------------- Flowering
  "phalaenopsis-amabilis": {
    blurb:
      "The moth orchid: arching sprays of flat flowers that last for months, on a plant with no bulbs and only a few thick leaves. It is an epiphyte whose silvery-green aerial roots photosynthesise, which is why it is sold in a clear pot and why it must never be planted in compost. The most-sold orchid in the world and by some distance the easiest.",
    size: "40–70 cm tall including the flower spike",
    origin: "Southeast Asia and northern Australia",
    difficulty: "Easy",
    faq: [
      ["How do I get an orchid to flower again?", "Keep it in bright indirect light — the leaves should be mid grass-green, not dark — and give it a few weeks of nights around 16 °C in autumn. That temperature drop is what triggers a new spike. After flowering, cut the spike off at the base if it browns, or just above a node if it stays green."],
      ["How often do you water a moth orchid?", "About once a week: take it to the sink, run water through the bark for a minute, let it drain completely, and put it back. Never leave water sitting in the decorative cover. Silvery-white roots mean it is thirsty; plump green roots mean it has had enough."],
      ["Should I cut off my orchid's aerial roots?", "No. Those grey-green roots wandering out of the pot are healthy and are doing part of the plant's photosynthesis. Cutting them sets the plant back. Only remove roots that are brown, hollow and papery."],
    ],
  },
  "dendrobium-nobile": {
    blurb:
      "An orchid that flowers along the length of its leafless canes rather than on a spike, covering them in scented blooms. It needs a genuinely cold, dry winter rest — nights near 10 °C and almost no water for six weeks — to set buds, which is why the ones sold in flower rarely repeat indoors.",
    size: "40–60 cm tall",
    origin: "The Himalayas and Southeast Asia",
    difficulty: "Needs attention",
  },
  "cattleya-labiata": {
    blurb:
      "The corsage orchid: large, heavily scented flowers with an extravagant frilled lip, from thick pseudobulbs. It wants brighter light than a moth orchid — some direct sun — and a proper dry period between waterings, which its pseudobulbs are built to carry it through.",
    size: "40–60 cm tall",
    origin: "Northeast Brazil",
    difficulty: "Needs attention",
  },
  "gardenia-jasminoides": {
    blurb:
      "The gardenia: glossy dark leaves and thick white flowers with one of the strongest scents of any plant. It is also the most demanding plant on this list — it needs acid soil, rainwater, humidity above 60% and absolute consistency, and it drops every bud if any of those slip.",
    size: "50–100 cm indoors",
    origin: "Southern China, Taiwan and Japan",
    difficulty: "Fussy",
  },
  "jasminum-polyanthum": {
    blurb:
      "Pink jasmine: a vigorous twining climber that covers itself in pink buds opening to white, scenting a whole room. It is sold trained around a hoop in midwinter and needs a cool, dry autumn to flower again — which is why most are treated as a one-season plant.",
    size: "Climbs to 2–3 m",
    origin: "Southwest China",
    difficulty: "Needs attention",
  },
  "hibiscus-rosa-sinensis": {
    blurb:
      "Chinese hibiscus: enormous flowers, each lasting a day or two, produced all summer on new growth if it gets enough sun and enough feeding. It is greedy on both counts and will not flower indoors without a genuinely sunny window.",
    size: "1–1.5 m indoors",
    origin: "Probably eastern Asia; unknown in the wild",
    difficulty: "Needs attention",
  },
  "anthurium-scherzerianum": {
    blurb:
      "The flamingo lily: smaller and narrower-leaved than the common anthurium, with a curled orange spadix like a pig's tail over a bright spathe. It is a little more tolerant of ordinary room conditions than the velvet anthuriums and flowers more freely.",
    size: "30–40 cm tall",
    origin: "Costa Rica",
    difficulty: "Straightforward",
  },
  "cyclamen-persicum": {
    blurb:
      "Cyclamen: swept-back flowers in white, pink and red over marbled heart-shaped leaves, flowering right through winter. It wants a cool room — 12–15 °C — and collapses in a warm one, which is why most are treated as disposable. Kept cool and rested dry through summer, the tuber comes back for years.",
    size: "20–30 cm tall",
    origin: "The eastern Mediterranean",
    difficulty: "Needs attention",
  },
  "clivia-miniata": {
    blurb:
      "Bush lily: strap leaves in a flat fan and, after a cold dry winter rest, a head of orange trumpet flowers on a thick stalk. It is long-lived — plants outlive their owners — flowers best jammed in a pot it has outgrown, and is one of the few flowering plants that does well away from direct sun.",
    size: "50–70 cm tall",
    origin: "South Africa",
    difficulty: "Straightforward",
  },
  "hippeastrum-hybridum": {
    blurb:
      "Amaryllis: a bulb the size of a fist that produces a thick stalk and three or four huge trumpet flowers, usually forced for Christmas. The bulb is perennial and improves with age — the trick is to let the leaves grow all summer to feed it, then give it eight to ten weeks completely dry in autumn.",
    size: "50–70 cm tall in flower",
    origin: "South America",
    difficulty: "Straightforward",
  },

  // ------------------------------------------------- Bromeliads & air plants
  "guzmania-lingulata": {
    blurb:
      "Scarlet star: a rosette of soft green straps around a vivid red, orange or yellow bract that lasts for months. The colour is bracts, not flowers. The rosette flowers once and then dies slowly over a year or two, leaving pups around the base — so it is normal, not a failure, when it starts to go.",
    size: "30–40 cm tall and wide",
    origin: "Central and South America",
    difficulty: "Straightforward",
  },
  "aechmea-fasciata": {
    blurb:
      "The urn plant: stiff grey leaves banded in silvery scale, forming a watertight vase, with a spiky pink bract and small blue flowers. The vase is the plant's water supply and must be kept topped up and flushed out — the compost barely matters.",
    size: "40–60 cm tall and wide",
    origin: "Brazil",
    difficulty: "Straightforward",
  },
  "tillandsia-ionantha": {
    blurb:
      "A small air plant that grows on nothing at all — no soil, no pot — taking water and nutrients through scales on its leaves. It blushes red and puts out violet flowers when it is about to bloom, then pups from the base. The one rule is to shake it dry after every soak.",
    size: "5–8 cm",
    origin: "Mexico and Central America",
    difficulty: "Straightforward",
  },
  "tillandsia-xerographica": {
    blurb:
      "The king of air plants: a big silver rosette of broad leaves curling into loose spirals, slow-growing and sculptural. It comes from drier country than most tillandsias, so it needs less frequent soaking and even more careful drying — water held in that tight centre rots it.",
    size: "25–50 cm across",
    origin: "Southern Mexico to El Salvador",
    difficulty: "Straightforward",
  },

  // -------------------------------------------------------- Herbs & edibles
  "ocimum-basilicum": {
    blurb:
      "Basil: the supermarket pot that dies in a fortnight, almost always because it is thirty seedlings crammed into one small pot competing for light and root room. Split it into three or four pots the day you get it home, give it the sunniest windowsill you have, and take cuttings through the summer.",
    size: "30–50 cm tall",
    origin: "Tropical Asia and Africa",
    difficulty: "Needs attention",
  },
  "mentha-spicata": {
    blurb:
      "Spearmint: vigorous, invasive, and best kept in a pot for exactly that reason — in open ground it takes over. Indoors it wants bright light and constantly damp compost, and it should be cut back to a stub each time it goes woody, which it will.",
    size: "30–50 cm tall, spreading",
    origin: "Europe and Asia",
    difficulty: "Easy",
  },
  "rosmarinus-officinalis": {
    blurb:
      "Rosemary: a Mediterranean shrub growing on thin stony hillsides, which tells you everything about what it wants — full sun, gritty compost, and to be left dry. Indoor rosemary usually dies suddenly and without warning, and the cause is almost always a pot that stayed wet.",
    size: "40–80 cm in a pot",
    origin: "The Mediterranean",
    difficulty: "Needs attention",
  },
  "citrus-limon": {
    blurb:
      "The Meyer lemon: a compact citrus that flowers and fruits readily in a pot, scenting a room when it blooms. It needs the brightest position you have, a citrus-specific feed, and rainwater — the yellow-with-green-veins leaves on most indoor lemons are hard water locking out iron.",
    size: "1–2 m in a pot",
    origin: "China; the Meyer is a hybrid",
    difficulty: "Needs attention",
  },
  "coffea-arabica": {
    blurb:
      "The coffee plant: glossy, deeply veined dark leaves on an upright shrub, growing as understorey in the Ethiopian highlands. It makes a handsome foliage plant indoors and will, at four or five years old and in good conditions, flower and set a few cherries — enough for a novelty, not a cup.",
    size: "1–1.5 m indoors",
    origin: "The highlands of Ethiopia",
    difficulty: "Needs attention",
  },

  // ----------------------------------------------------------------- Other
  "dracaena-surculosa": {
    blurb:
      "Gold dust dracaena: slender wiry stems with oval leaves spotted in cream, looking more like a shrub than the strap-leaved dracaenas. It is slow, takes low light well, and is one of the more unusual-looking easy plants.",
    size: "60–100 cm tall",
    origin: "West Africa",
    difficulty: "Easy",
  },
  "codiaeum-variegatum": {
    blurb:
      "Croton: leathery leaves splashed in yellow, orange, red and green, in leaf shapes ranging from oak to corkscrew. The colour is made by light, so a croton in a dim spot slowly turns green and stops being worth having. It also drops every leaf when it is moved or allowed to dry — expect a sulk after you bring it home.",
    size: "60–150 cm indoors",
    origin: "Indonesia, Malaysia and the Pacific islands",
    difficulty: "Needs attention",
  },
  "cordyline-fruticosa": {
    blurb:
      "The ti plant: strap leaves in pink, red, cream and green on slim canes, grown across Polynesia for centuries for food, thatch and ceremony. Indoors it wants bright light to hold its colour and rainwater to keep its tips green — it is markedly fluoride-sensitive.",
    size: "1–1.5 m indoors",
    origin: "Southeast Asia and the Pacific",
    difficulty: "Straightforward",
  },
  "fittonia-albivenis": {
    blurb:
      "The nerve plant: small oval leaves netted in white, pink or red veins, on a low creeping plant. It is famous for fainting — it collapses completely when the compost dries and stands back up within an hour of water. Charming once, exhausting repeatedly; it is really a terrarium plant.",
    size: "15–20 cm tall, spreading",
    origin: "Peru and the western Amazon",
    difficulty: "Needs attention",
  },
  "hypoestes-phyllostachya": {
    blurb:
      "The polka dot plant: leaves freckled in pink, white or red over green, in a small bushy plant. It is short-lived and wants pinching constantly to stay dense — once it flowers it goes leggy and tired, so pinch out the flower spikes and take cuttings each year.",
    size: "20–30 cm tall",
    origin: "Madagascar",
    difficulty: "Straightforward",
  },
  "oxalis-triangularis": {
    blurb:
      "Purple shamrock: triangular deep-purple leaflets on thin stalks that fold down at night and open again in the morning, with small pale pink flowers. It grows from little scaly rhizomes and dies back completely once a year — which looks like death and isn't. Stop watering, wait a month, and it returns thicker.",
    size: "20–30 cm tall",
    origin: "Brazil",
    difficulty: "Easy",
  },
  "aspidistra-elatior": {
    blurb:
      "The cast iron plant: broad dark leaves straight out of the compost, and the toughest genuinely low-light plant there is. It survived Victorian parlours lit by gas and heated by coal, which is where the name came from — and it is still the right answer for a dark hallway. Expect two or three new leaves a year and no drama.",
    size: "50–70 cm tall",
    origin: "Japan and Taiwan",
    difficulty: "Easy",
  },
  "cyperus-alternifolius": {
    blurb:
      "Umbrella papyrus: tall thin stems topped with a whorl of narrow bracts like the spokes of an umbrella. It is a marsh plant and the one houseplant that genuinely cannot be overwatered — stand the pot permanently in a saucer of water and it will thank you.",
    size: "60–120 cm tall",
    origin: "Madagascar",
    difficulty: "Easy",
  },
  "soleirolia-soleirolii": {
    blurb:
      "Baby's tears: a dense mat of tiny round leaves that spills over the edge of a pot like green foam. It needs constant damp and collapses within hours of drying out, which makes it a good terrarium groundcover and a demanding pot plant.",
    size: "5–10 cm tall, spreading widely",
    origin: "The western Mediterranean islands",
    difficulty: "Needs attention",
  },
  "asparagus-setaceus": {
    blurb:
      "Asparagus fern: soft, flat, feathery sprays that look like fern fronds and aren't — this is a relative of edible asparagus, with true leaves reduced to scales. It is tougher than any real fern, grows from a mass of water-storing tubers, and is toxic to cats and dogs, unlike the ferns it imitates.",
    size: "50–100 cm, climbing or trailing",
    origin: "Southern Africa",
    difficulty: "Easy",
  },
  "bambusa-vulgaris": {
    blurb:
      "Common bamboo: a true woody bamboo, fast, thirsty and demanding of light, which grows into a substantial clump in a large pot. Worth knowing that the 'lucky bamboo' sold in a vase of pebbles and water is not this plant at all — it is Dracaena sanderiana, a dracaena, and it is toxic to cats and dogs where true bamboo is not.",
    size: "2–3 m in a large pot indoors",
    origin: "Southeast Asia; cultivated pantropically",
    difficulty: "Needs attention",
    faq: [
      ["Is lucky bamboo the same as real bamboo?", "No. Lucky bamboo — the stems sold standing in pebbles and water, sometimes spiralled — is Dracaena sanderiana, a member of the asparagus family. True bamboos are grasses and will not grow in a vase of water. The practical difference that matters at home: lucky bamboo is toxic to cats and dogs, and true bamboo is not."],
    ],
  },
  "dracaena-sanderiana": {
    blurb:
      "Lucky bamboo: the upright or spiralled green stems sold standing in a vase of pebbles and water. It is not a bamboo — it is a dracaena, in the asparagus family, and the resemblance is only in the jointed stem. That matters in a house with animals, because this is toxic to cats and dogs and true bamboo is not.",
    size: "30–90 cm, taller in soil than in water",
    origin: "Central Africa; the vase-grown form is a horticultural trade",
    difficulty: "Easy-going",
    lightLong:
      "Bright indirect light, and never direct sun — the leaves of a plant grown in water scorch faster than one in compost. It survives a dim corner, but pales and stops putting out new leaves.",
    waterHow:
      "Grown in water: keep the roots covered, change the water every week or two, and use rainwater, filtered or tap water left standing overnight. It is unusually sensitive to the fluoride and chlorine in fresh tap water, which shows as burnt tips. Grown in compost: keep it evenly damp, and let only the top centimetre dry.",
    faq: [
      ["Can lucky bamboo live in water forever?", "Yes, and most do. It will stay smaller and needs a drop of weak feed every couple of months, since pebbles hold nothing for it to eat. Moving it to compost makes it grow faster and larger, and it will not go back happily once it has rooted in soil."],
      ["Why are the leaves turning yellow?", "Usually the water. Fluoride, chlorine and salts build up in a vase that is topped up rather than emptied, and this plant is more sensitive to them than most. Empty and refill rather than topping up, and use filtered or stood water. Yellow that starts at the stem base instead is rot, and that part will not recover — cut above it and re-root the green section."],
      ["Is lucky bamboo poisonous to cats?", "Yes. Like other dracaenas it contains saponins, which cause vomiting, drooling and dilated pupils in cats. It is not usually dangerous beyond that, but a cat that chews it will be unwell. True bamboo, which this is often mistaken for, is not toxic."],
    ],
  },
};
