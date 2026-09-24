/**
 * The problem guides: one page per thing a keeper can see going wrong.
 *
 * The plant pages file problems under the plant, which is how a keeper who
 * already knows what they have thinks. Someone with a sick plant searches the
 * other way round -- "why are my leaves turning yellow" -- so these pages
 * turn the same knowledge on its side: the symptom first, how to read it,
 * then every plant in the library where it is a known problem, with that
 * plant's own cause and fix.
 *
 * Each guide has two halves:
 *
 *   Written here: the reading of the symptom, the causes in order of
 *   likelihood, and the questions people ask. This is the part that has to
 *   be worth reading on its own -- a page that was only a list gathered from
 *   plant pages would be thin, and search engines treat it that way.
 *
 *   Gathered from plants-data.mjs: `match` picks out the problems on plant
 *   pages that describe this symptom, so a problem added to a plant shows up
 *   on the right guide without anyone remembering to put it there.
 *
 * Inside `signs` and `body`, [[slug|words]] links the words to another guide.
 *
 * Same rule as plants-data.mjs: keep the claims conservative. These are read
 * by people about to do something to a plant, and sometimes near a pet.
 */

export const GUIDES = [
  {
    slug: "yellow-leaves",
    name: "Yellow leaves",
    title: "Why are my plant's leaves turning yellow?",
    description:
      "Yellow houseplant leaves, read by pattern: which leaves, how fast, and what the compost feels like. Overwatering, rot, age, light, hard water and cold, with the fix for each — and what yellowing means plant by plant.",
    match: (s) => /yellow/.test(s),
    answer:
      "Most often, overwatering. Roots sitting in wet compost can't breathe, they start to die back, and the plant lets go of the leaves it can no longer supply — usually the oldest, lowest ones first. One old leaf yellowing now and then is just age. Several at once, compost that stays wet for days, or a soft brown base mean too much water or rot, and that is worth acting on today. Yellow between green veins points to the compost or the water, and a whole plant fading pale points to too little light or food.",
    signs: [
      ["One old, low leaf at a time; the rest look fine", "Normal ageing. Every plant sheds its oldest leaves. Pull the leaf off once it comes away easily."],
      ["Several lower leaves at once, and the compost is still damp days after watering", "Overwatering, or a mix or pot that doesn't drain. The most common cause by far."],
      ["Yellow with a soft, dark or mushy stem or base", "Rot. Unpot it today and look at the roots — see below."],
      ["Yellow and limp, compost bone dry, leaves crisp at the edges", "Underwatering. Water thoroughly, until it runs from the bottom."],
      ["Yellow between the veins while the veins stay green", "Nutrients locked out, often by hard water or compost that has turned alkaline. Worst on gardenias and citrus."],
      ["The whole plant pale, new leaves small", "Too little light, or hungry after a long time in the same compost."],
      ["Yellow speckling, dull leaves, fine webbing", "Spider mites — see [[spider-mites|the spider mite guide]]."],
      ["Yellowing a week or two after a move, a cold night or a draught", "Shock or cold damage. Keep it stable and warm, and wait."],
    ],
    body: [
      ["How to check the roots", "Slide the plant out of its pot — tip it sideways and support the base of the stems. Healthy roots are firm and pale: white, cream or light tan. Rotten ones are brown or black, soft, come apart when you pinch them, and often smell sour. If you find rot, cut every soft root back to firm tissue with clean scissors, repot into fresh, airy mix in a pot with a drainage hole, and water sparingly until you see new growth. If the whole root system is gone, take healthy cuttings from the top and start again."],
      ["Why overwatering is so common", "Most houseplants are killed by kindness. A plant uses far less water in a dim room in winter than in a bright one in summer, but a watering habit doesn't change with the seasons. Check the compost before watering rather than watering on a day of the week: push a finger in up to the second knuckle, and for most plants only water if it is dry there. A cachepot or saucer that holds water under the pot undoes a free-draining mix, so empty it after watering."],
    ],
    faq: [
      ["Should I cut off yellow leaves?", "Yes, once the leaf is mostly yellow — it won't turn green again, and the plant has already taken back what it can from it. Wait until it pulls away easily, or cut it at the base with clean scissors. Removing it is tidying, not a fix: find out why it yellowed."],
      ["Can a yellow leaf turn green again?", "Usually not. A leaf that is pale from lack of light or food can green up a little if the cause is fixed early, but a leaf that has gone properly yellow stays yellow. Judge recovery by the new growth."],
      ["How do I tell overwatering from underwatering?", "Feel the compost a few centimetres down. Yellow leaves with wet compost, a limp or soft stem, and sometimes a sour smell mean too much water. Yellow leaves with dry compost, crisp brown edges, and a pot that feels light when you lift it mean too little."],
    ],
  },
  {
    slug: "brown-leaf-tips",
    name: "Brown tips and edges",
    title: "Why are my plant's leaf tips turning brown?",
    description:
      "Brown, crispy leaf tips and edges on houseplants: dry air, dried-out compost, and salts and fluoride from tap water. How to tell which, how to trim it, and how to stop it on the next leaf.",
    match: (s) => /brown|crisp/.test(s) && /tip|edge|crisp/.test(s),
    answer:
      "Brown, crispy tips and edges mean the far end of the leaf lost water faster than the roots could replace it — because the air is dry, the compost dried out too far, or salts and fluoride from tap water and fertiliser have built up in the pot. Brown tissue never turns green again, so the aim is to stop new damage: water thoroughly when it is due, flush the pot with plain water every few months, feed less, and raise the humidity for plants that need it. Soft, dark brown patches are a different problem — usually too much water, not too little.",
    signs: [
      ["Tips papery and light brown, on many leaves", "Dry air, or compost that dried out completely between waterings."],
      ["Brown tips on long, narrow leaves — dracaena, spider plant, cordyline", "Fluoride and salts in tap water. These plants are unusually sensitive."],
      ["A white crust on the compost or the rim of the pot", "Salts building up from tap water and fertiliser. Flush the pot."],
      ["Brown edges only on leaves that opened recently", "Dry air while the leaf was unfurling. The damage is fixed on that leaf; protect the next one."],
      ["Dark, soft brown patches, often with a yellow edge", "Overwatering, rot or a leaf infection — not dry air. Check the roots."],
      ["Pale, dry, brown patches on the side facing the window", "Sun scorch. Move it back from the glass."],
    ],
    body: [
      ["How to flush a pot", "Take the plant to a sink or bath and run plain, room-temperature water slowly through the compost for a few minutes, so it drains out of the bottom several times over. Then let it drain completely before it goes back on its saucer. Rainwater, filtered or distilled water is best for the sensitive plants; tap water left to stand overnight loses its chlorine but not its fluoride or salts."],
      ["Trimming the brown off", "It is purely cosmetic, and fine to do. Use sharp, clean scissors and follow the leaf's own outline, so the trimmed leaf still looks like a leaf. Leave a thin line of brown rather than cutting into green tissue — a cut into living tissue browns again."],
      ["Raising humidity, honestly", "Misting raises the humidity around a leaf for a few minutes, not for the rest of the day. Grouping plants together helps a little. A humidifier is the thing that reliably works, and a cheap hygrometer tells you whether it is. Most homes run at 30–40% in winter with the heating on; many tropical plants want 50–60% or more."],
    ],
    faq: [
      ["Should I cut off brown leaf tips?", "You can. It doesn't help the plant, but it doesn't hurt it either if you follow the leaf's shape and leave a sliver of brown at the edge of the cut. Fix the cause first, or the new tip will brown too."],
      ["Can brown tips turn green again?", "No. Brown tissue is dead. The leaf will stay as it is, and the plant is recovering if its new leaves come in clean."],
      ["Does misting stop brown tips?", "Not by itself. The effect lasts minutes. For a plant that really needs humidity, a humidifier or a grouping of plants in a closed cabinet does what misting can't."],
    ],
  },
  {
    slug: "spider-mites",
    name: "Spider mites",
    title: "Spider mites on houseplants: how to spot them and get rid of them",
    description:
      "How to tell if a houseplant has spider mites — stippled leaves, a dusty look, fine webbing — and how to get rid of them: isolate, shower, treat on a schedule for a month, and fix the dry air that brought them.",
    match: (s) => /spider mite|webbing|stippl/.test(s),
    answer:
      "Spider mites are tiny sap-sucking mites, barely visible without a magnifier, that thrive in warm, dry indoor air. The first sign is usually fine pale speckling on the leaves, then a dull, dusty look, and at worst fine webbing between leaves and stems. Move the plant away from others, shower it hard on both sides of every leaf, and repeat a treatment every five to seven days for three to four weeks — a single treatment never reaches the eggs. Then raise the humidity, because dry air is what let them multiply.",
    signs: [
      ["Fine pale dots on the upper side of leaves", "Early spider mite feeding. Look underneath, along the veins."],
      ["Leaves look dull, dusty or bronzed even after wiping", "An established colony."],
      ["Fine, silky webbing in the leaf joints or between leaves", "A heavy infestation. Act today, and check every plant nearby."],
      ["Specks that move when you tap a leaf over white paper", "Mites. Dust stays still; mites walk."],
      ["Stippling with no mites, webbing or movement", "Possibly thrips or old damage. A magnifier settles it."],
    ],
    body: [
      ["Getting rid of them", [
        "Move the plant away from the others.",
        "Shower it in the bath or sink, hard enough to knock the mites off, and wipe both sides of every leaf.",
        "Treat it with a product labelled for spider mites on houseplants — an insecticidal soap or horticultural oil is the usual choice — following the label exactly.",
        "Repeat every five to seven days for three to four weeks. Eggs hatch after the first treatment, and stopping early is why they \"come back\".",
        "Check the plants that were nearby, and keep checking for a month.",
        "Raise the humidity and move it away from radiators, or they will return.",
      ]],
      ["If you have pets or children", "Read the label of anything you spray for whether it is safe around animals and people, keep pets away from a treated plant until it is dry, and store the product out of reach. Some products sold as natural are still harmful to cats in particular. If you are unsure, a hard shower and wiping, repeated every few days, is slower but uses nothing at all."],
      ["Badly infested growth", "Leaves that are yellow, bronzed and webbed won't recover. Cut them off, bag them, and put them straight in the bin rather than the compost heap."],
    ],
    faq: [
      ["Where do spider mites come from?", "Usually a new plant, occasionally an open window or cut flowers. They are always around in small numbers; warm, dry air in heated rooms is what lets them multiply fast enough to notice."],
      ["Are spider mites harmful to people or pets?", "No — they feed on plants. What you treat them with may be, so read the label."],
      ["Can a plant recover from spider mites?", "Yes, if it still has healthy growth. Damaged leaves stay marked, but a plant that is treated on schedule and moved into more humid air will put out clean new leaves."],
    ],
  },
  {
    slug: "leggy-plants",
    name: "Leggy, stretched growth",
    title: "Why is my plant leggy? Stretched stems and bare vines",
    description:
      "Long bare stems, leaves far apart, a plant leaning at the window, a succulent stretching into a column: almost always too little light. How to get compact growth back, and when bare stems are just age.",
    match: (s) => /leggy|stretch|bare|far apart|leaning|tuft of leaves|leaves only at|reaching|column/.test(s),
    answer:
      "A leggy plant — long bare stems, leaves spaced far apart, growth leaning toward the window — is almost always short of light, and stretching to find more. Stretched growth never shrinks back, so the fix has two parts: move it somewhere brighter so new growth comes in compact, and cut the leggy stems back so the plant branches from below the cut. Many of those cuttings will root. Some plants go bare at the base as they age whatever you do, and that is normal.",
    signs: [
      ["Leaning hard toward the window", "Light from one side. Turn the pot a quarter turn every week or so."],
      ["Pale, stretched succulent or cactus, gaps between the leaves", "Too little light — often these want direct sun. The stretch is permanent."],
      ["Long vines that are bare along the middle", "Light from one direction and no pruning. Cut back and replant the cuttings in the same pot."],
      ["A bare woody stem with a tuft of leaves on top — dracaena, yucca, rubber plant", "Often normal ageing. Cut the top off and re-root it, and the stump usually shoots again."],
      ["Small leaves on long stems on a climbing aroid", "Nothing to climb. Give it a moss pole; climbing plants make bigger leaves when they have something to hold."],
    ],
    body: [
      ["How far is bright?", "Much closer than most people think. Light falls away fast with distance from a window: a spot two metres back gets a small fraction of the light on the sill, even if the room looks bright to you. Moving a plant from the middle of the room to right beside the window is often the whole fix. In a dark room, a grow light does the same job."],
      ["How to prune a leggy plant", "Cut each long stem just above a node — the point where a leaf joins, or joined, the stem. New shoots come from the nodes below the cut, so the shorter you cut, the bushier the regrowth. Spring and early summer are the best time. For vining plants, root the cuttings in water and plant them back into the same pot to fill it out."],
    ],
    faq: [
      ["Will a leggy plant fill back in on its own?", "Not usually. A bare section of stem rarely grows new leaves by itself. Cutting it back is what makes the plant branch."],
      ["Can stretched succulents go back to normal?", "The stretched part can't. Move the plant into more light, then cut the top off and re-root it; the base usually sends out new rosettes."],
      ["Do grow lights help?", "Yes. A plant doesn't care whether its light comes from a window or a lamp, as long as there is enough of it. Keep the light close to the plant and on a timer for 12 to 14 hours a day."],
    ],
  },
  {
    slug: "leaves-falling-off",
    name: "Leaves falling off",
    title: "Why is my plant dropping leaves?",
    description:
      "A houseplant dropping leaves: a move or a draught, watering gone wrong, dry heat from a radiator, or a normal winter rest. How to read which leaves are falling, and what to do about each.",
    match: (s) => /drop|falling/.test(s) && !/bud|flower/.test(s),
    answer:
      "Leaf drop is a plant cutting its losses. The usual causes are a change it didn't like — a move, a cold draught, a radiator switched on — watering that has gone wrong in either direction, or a normal seasonal rest. Look at which leaves are falling and what changed in the last two weeks: old lower leaves one at a time is ageing, a sudden shower of green leaves is shock, yellow leaves falling from a wet pot is overwatering. Most plants recover once they are somewhere stable and the watering is right.",
    signs: [
      ["Green leaves dropping within weeks of a move or a delivery", "Shock. Ficus are famous for it. Put it somewhere good and leave it there."],
      ["Leaves dropping after a cold night or near a door", "Cold damage or a draught. Most houseplants want to stay above about 12–15 °C."],
      ["Crisp or green leaves falling near a radiator", "Dry heat. Move it away from the heat source and raise the humidity."],
      ["Yellow leaves falling, compost wet", "Overwatering. See [[yellow-leaves|the yellow leaves guide]], and check the roots."],
      ["One old leaf at a time from the bottom", "Normal ageing as the plant grows upward."],
      ["The whole plant dying back in autumn or winter — alocasia, caladium, some bulbs", "Dormancy. Water much less, stop feeding, and don't throw it out."],
    ],
    body: [
      ["What to do while it recovers", "Put the plant in the best spot you have and leave it there — every extra move is another shock. Keep watering on the compost's schedule, not the calendar's, and don't feed or repot a plant that is actively dropping leaves: a stressed root system can't use fertiliser, and repotting adds a second shock to the first. New growth, not the leaves still falling, is how you'll know it has settled."],
    ],
    faq: [
      ["Should I move a plant that is dropping leaves?", "Once, if where it is now is clearly wrong — cold, dark or next to a radiator. Then leave it alone. Moving it around looking for the right spot makes the drop worse."],
      ["Will the leaves grow back?", "Not on the bare stretches of stem, in most plants. New leaves come from the growing tips and from nodes, so a plant that dropped many leaves may need cutting back later to fill in."],
      ["Is it normal for a plant to lose leaves in winter?", "Some loss is normal: less light means the plant can support fewer leaves. A plant that goes down to nothing in autumn may be going dormant rather than dying — check whether the corm, bulb or tuber underneath is still firm."],
    ],
  },
  {
    slug: "variegation-reverting",
    name: "Variegation fading",
    title: "Why is my variegated plant turning green?",
    description:
      "Why variegated houseplants lose their white, cream, pink or silver and revert to green — usually light, sometimes a runaway green shoot, occasionally just age — and how to prune it back.",
    match: (s) => /variegat|plain green|stripes fading|silver is fading|colour (washing|fading)|colour fading/.test(s),
    answer:
      "White, cream, pink or silver parts of a leaf have little or no chlorophyll, so they cost the plant energy it can only afford in good light. In too little light a variegated plant makes greener leaves, and in many plants an all-green shoot grows faster than the variegated ones and takes over. Move it brighter — bright indirect light, not scorching sun — and cut any all-green stems back to the last well-marked leaf. A leaf that has come out green stays green: recovery shows in the new growth. Some plants lose their markings as they mature, and that is normal.",
    signs: [
      ["Whole stems coming out plain green", "Reversion. Cut them out at their base or back to a variegated leaf, or they will outgrow the rest."],
      ["New leaves less marked than the old ones", "Too little light. Move it brighter."],
      ["Pink or red fading to green on a pink-leaved variety", "Too little light — the colour needs it."],
      ["Silver fading as a climbing plant gets bigger", "Often maturity, not a problem: some species lose their juvenile silver as they grow up."],
      ["White parts going brown and crispy", "The white tissue is fragile. Dry air or strong sun, not a lack of light."],
    ],
    body: [
      ["How to prune a reverting plant", "Follow the green stem back to where it grew from and cut it off just above the last leaf that still has good variegation, or at its base if it comes from the soil. The plant grows on from the node below the cut, and that node carries the pattern of the leaf it belongs to. Keep checking: a plant that has reverted once tends to try again."],
    ],
    faq: [
      ["Can a reverted plant get its variegation back?", "The green leaves won't change. The plant can go back to variegated growth if you cut it back to a node that still has the pattern and give it more light."],
      ["Is more sun better for variegation?", "More light, yes; midday sun, no. White and cream tissue scorches more easily than green, so bright indirect light is the target."],
    ],
  },
];

/** The first guide a plant-page problem belongs on, or null. */
export const guideFor = (symptom) => {
  const s = symptom.toLowerCase();
  return GUIDES.find((g) => g.match(s)) ?? null;
};
