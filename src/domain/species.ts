/**
 * A catalogue of the houseplants people actually keep, with the reminder
 * cadences that suit each. Typing in the species field suggests from here,
 * and picking one sets sensible reminders instead of the flat defaults.
 *
 * Cadences are days and deliberately conservative: a plant nagging a little
 * early beats one that rots. Keepers can still change them per plant.
 */
export interface SpeciesEntry {
  /** Where it sits in the browse list — aroids, succulents, ferns … */
  group: string;
  genus: string;
  species: string;
  /** Names people search by. The first is the one shown. */
  common: string[];
  waterEveryDays: number;
  fertilizeEveryDays: number;
  repotEveryDays: number;
}

// genus, species, common names, water, fertilize, repot
type Row = [string, string, string[], number, number, number];

const CATALOGUE: { group: string; rows: Row[] }[] = [
  { group: "Aroids", rows: [
    ["Monstera", "deliciosa", ["Swiss cheese plant", "Monstera"], 7, 30, 365],
    ["Monstera", "adansonii", ["Swiss cheese vine", "Monkey mask"], 7, 30, 365],
    ["Monstera", "obliqua", [], 6, 30, 365],
    ["Philodendron", "hederaceum", ["Heartleaf philodendron"], 7, 30, 365],
    ["Philodendron", "erubescens", ["Pink princess", "Blushing philodendron"], 7, 30, 365],
    ["Philodendron", "gloriosum", [], 7, 30, 365],
    ["Philodendron", "melanochrysum", ["Black gold philodendron"], 7, 30, 365],
    ["Philodendron", "birkin", ["Birkin"], 7, 30, 365],
    ["Thaumatophyllum", "bipinnatifidum", ["Tree philodendron", "Philodendron selloum"], 7, 30, 540],
    ["Epipremnum", "aureum", ["Pothos", "Golden pothos", "Devil's ivy"], 8, 30, 365],
    ["Epipremnum", "pinnatum", ["Dragon tail", "Cebu blue"], 8, 30, 365],
    ["Scindapsus", "pictus", ["Satin pothos", "Silver pothos"], 8, 30, 365],
    ["Anthurium", "andraeanum", ["Flamingo flower", "Anthurium"], 7, 21, 365],
    ["Anthurium", "clarinervium", ["Velvet cardboard anthurium"], 7, 30, 365],
    ["Anthurium", "crystallinum", [], 7, 30, 365],
    ["Alocasia", "amazonica", ["Alocasia Polly", "African mask"], 6, 21, 365],
    ["Alocasia", "zebrina", [], 6, 21, 365],
    ["Alocasia", "macrorrhizos", ["Giant taro", "Elephant ear"], 5, 21, 365],
    ["Alocasia", "baginda", ["Dragon scale"], 7, 21, 365],
    ["Colocasia", "esculenta", ["Taro", "Elephant ear"], 4, 21, 365],
    ["Caladium", "bicolor", ["Caladium", "Angel wings"], 4, 21, 365],
    ["Zamioculcas", "zamiifolia", ["ZZ plant", "Zanzibar gem"], 21, 60, 730],
    ["Spathiphyllum", "wallisii", ["Peace lily"], 5, 30, 365],
    ["Aglaonema", "commutatum", ["Chinese evergreen", "Aglaonema"], 9, 30, 540],
    ["Dieffenbachia", "seguine", ["Dumb cane"], 7, 30, 365],
    ["Syngonium", "podophyllum", ["Arrowhead plant", "Arrowhead vine"], 7, 30, 365],
    ["Rhaphidophora", "tetrasperma", ["Mini monstera"], 7, 30, 365],
  ] },
  { group: "Trees", rows: [
    ["Ficus", "lyrata", ["Fiddle-leaf fig"], 7, 30, 540],
    ["Ficus", "elastica", ["Rubber plant", "Rubber tree"], 9, 30, 540],
    ["Ficus", "benjamina", ["Weeping fig"], 7, 30, 540],
    ["Ficus", "microcarpa", ["Ginseng ficus", "Chinese banyan"], 7, 30, 540],
    ["Ficus", "audrey", ["Ficus Audrey", "Banyan fig"], 7, 30, 540],
    ["Ficus", "triangularis", ["Triangle fig"], 8, 30, 540],
    ["Schefflera", "arboricola", ["Umbrella plant", "Dwarf umbrella tree"], 8, 30, 540],
    ["Dracaena", "trifasciata", ["Snake plant", "Mother-in-law's tongue", "Sansevieria"], 21, 60, 730],
    ["Dracaena", "marginata", ["Dragon tree"], 10, 30, 730],
    ["Dracaena", "fragrans", ["Corn plant"], 10, 30, 730],
    ["Dracaena", "angolensis", ["Cylindrical snake plant", "Sansevieria cylindrica"], 21, 60, 730],
    ["Yucca", "elephantipes", ["Spineless yucca"], 14, 60, 730],
    ["Pachira", "aquatica", ["Money tree"], 8, 30, 540],
    ["Crassula", "ovata", ["Jade plant", "Money plant"], 14, 60, 730],
    ["Beaucarnea", "recurvata", ["Ponytail palm"], 14, 60, 730],
    ["Polyscias", "fruticosa", ["Ming aralia"], 7, 30, 540],
    ["Fatsia", "japonica", ["Japanese aralia", "Paper plant"], 7, 30, 540],
    ["Strelitzia", "nicolai", ["Bird of paradise", "White bird of paradise"], 7, 21, 540],
    ["Strelitzia", "reginae", ["Orange bird of paradise"], 7, 21, 540],
    ["Musa", "acuminata", ["Dwarf banana"], 4, 14, 365],
  ] },
  { group: "Palms", rows: [
    ["Chamaedorea", "elegans", ["Parlour palm", "Parlor palm"], 7, 30, 540],
    ["Dypsis", "lutescens", ["Areca palm", "Butterfly palm"], 6, 30, 540],
    ["Howea", "forsteriana", ["Kentia palm"], 8, 30, 730],
    ["Rhapis", "excelsa", ["Lady palm"], 7, 30, 730],
    ["Phoenix", "roebelenii", ["Pygmy date palm"], 7, 30, 730],
    ["Livistona", "chinensis", ["Chinese fan palm"], 7, 30, 730],
  ] },
  { group: "Vines & trailers", rows: [
    ["Hoya", "carnosa", ["Wax plant", "Hoya"], 10, 30, 730],
    ["Hoya", "kerrii", ["Sweetheart hoya"], 12, 30, 730],
    ["Hoya", "linearis", [], 8, 30, 730],
    ["Tradescantia", "zebrina", ["Inch plant", "Wandering dude"], 5, 30, 365],
    ["Tradescantia", "nanouk", ["Nanouk"], 5, 30, 365],
    ["Chlorophytum", "comosum", ["Spider plant"], 6, 30, 365],
    ["Hedera", "helix", ["English ivy"], 6, 30, 365],
    ["Senecio", "rowleyanus", ["String of pearls"], 14, 60, 730],
    ["Ceropegia", "woodii", ["String of hearts", "Rosary vine"], 12, 60, 730],
    ["Peperomia", "prostrata", ["String of turtles"], 9, 30, 730],
    ["Cissus", "discolor", ["Rex begonia vine"], 5, 30, 365],
    ["Pilea", "peperomioides", ["Chinese money plant", "Pancake plant", "UFO plant"], 7, 30, 365],
    ["Peperomia", "obtusifolia", ["Baby rubber plant"], 9, 30, 730],
    ["Peperomia", "caperata", ["Ripple peperomia", "Emerald ripple"], 8, 30, 730],
    ["Peperomia", "argyreia", ["Watermelon peperomia"], 7, 30, 730],
  ] },
  { group: "Prayer plants", rows: [
    ["Maranta", "leuconeura", ["Prayer plant"], 5, 21, 365],
    ["Goeppertia", "orbifolia", ["Calathea orbifolia"], 5, 21, 365],
    ["Goeppertia", "makoyana", ["Peacock plant", "Calathea makoyana"], 5, 21, 365],
    ["Goeppertia", "roseopicta", ["Rose-painted calathea"], 5, 21, 365],
    ["Goeppertia", "lancifolia", ["Rattlesnake plant", "Calathea lancifolia"], 5, 21, 365],
    ["Calathea", "ornata", ["Pinstripe calathea"], 5, 21, 365],
    ["Ctenanthe", "burle-marxii", ["Fishbone prayer plant", "Never never plant"], 5, 21, 365],
    ["Stromanthe", "sanguinea", ["Triostar", "Stromanthe"], 5, 21, 365],
  ] },
  { group: "Ferns", rows: [
    ["Nephrolepis", "exaltata", ["Boston fern", "Sword fern"], 4, 30, 365],
    ["Adiantum", "raddianum", ["Maidenhair fern"], 3, 30, 365],
    ["Asplenium", "nidus", ["Bird's nest fern"], 5, 30, 365],
    ["Platycerium", "bifurcatum", ["Staghorn fern"], 7, 30, 730],
    ["Phlebodium", "aureum", ["Blue star fern"], 6, 30, 365],
    ["Davallia", "fejeensis", ["Rabbit's foot fern"], 5, 30, 365],
  ] },
  { group: "Begonias & violets", rows: [
    ["Begonia", "maculata", ["Polka dot begonia"], 6, 21, 365],
    ["Begonia", "rex", ["Rex begonia", "Painted-leaf begonia"], 5, 21, 365],
    ["Saintpaulia", "ionantha", ["African violet"], 6, 14, 365],
    ["Streptocarpus", "hybridus", ["Cape primrose"], 5, 14, 365],
    ["Episcia", "cupreata", ["Flame violet"], 5, 21, 365],
  ] },
  { group: "Succulents & cacti", rows: [
    ["Echeveria", "elegans", ["Mexican snowball", "Echeveria"], 14, 60, 730],
    ["Haworthiopsis", "attenuata", ["Zebra plant", "Zebra haworthia"], 14, 60, 730],
    ["Aloe", "vera", ["Aloe vera", "Aloe"], 14, 60, 730],
    ["Gasteria", "carinata", ["Ox tongue"], 14, 60, 730],
    ["Kalanchoe", "blossfeldiana", ["Flaming Katy", "Kalanchoe"], 10, 30, 365],
    ["Sempervivum", "tectorum", ["Hens and chicks", "Houseleek"], 14, 90, 730],
    ["Sedum", "morganianum", ["Burro's tail", "Donkey tail"], 14, 60, 730],
    ["Euphorbia", "trigona", ["African milk tree"], 14, 60, 730],
    ["Euphorbia", "tirucalli", ["Pencil cactus", "Firestick"], 14, 60, 730],
    ["Schlumbergera", "truncata", ["Christmas cactus", "Thanksgiving cactus", "Holiday cactus"], 10, 30, 730],
    ["Opuntia", "microdasys", ["Bunny ears cactus"], 21, 90, 730],
    ["Mammillaria", "elongata", ["Ladyfinger cactus"], 21, 90, 730],
    ["Cereus", "repandus", ["Peruvian apple cactus"], 21, 90, 730],
    ["Epiphyllum", "oxypetalum", ["Queen of the night", "Orchid cactus"], 10, 30, 730],
    ["Rhipsalis", "baccifera", ["Mistletoe cactus"], 8, 30, 730],
    ["Lithops", "lesliei", ["Living stones", "Lithops"], 30, 180, 1095],
  ] },
  { group: "Flowering", rows: [
    ["Phalaenopsis", "amabilis", ["Moth orchid", "Phalaenopsis orchid", "Orchid"], 8, 21, 540],
    ["Dendrobium", "nobile", ["Dendrobium orchid"], 7, 21, 540],
    ["Cattleya", "labiata", ["Cattleya orchid"], 8, 21, 540],
    ["Gardenia", "jasminoides", ["Gardenia", "Cape jasmine"], 5, 21, 365],
    ["Jasminum", "polyanthum", ["Pink jasmine"], 5, 21, 365],
    ["Hibiscus", "rosa-sinensis", ["Chinese hibiscus"], 4, 14, 365],
    ["Anthurium", "scherzerianum", ["Flamingo lily"], 7, 21, 365],
    ["Cyclamen", "persicum", ["Cyclamen"], 6, 21, 365],
    ["Clivia", "miniata", ["Bush lily", "Natal lily"], 10, 30, 730],
    ["Hippeastrum", "hybridum", ["Amaryllis"], 7, 21, 730],
  ] },
  { group: "Bromeliads & air plants", rows: [
    ["Guzmania", "lingulata", ["Scarlet star", "Guzmania"], 7, 60, 730],
    ["Aechmea", "fasciata", ["Urn plant", "Silver vase"], 7, 60, 730],
    ["Tillandsia", "ionantha", ["Air plant", "Sky plant"], 5, 30, 1095],
    ["Tillandsia", "xerographica", ["Xerographica"], 7, 30, 1095],
  ] },
  { group: "Herbs & edibles", rows: [
    ["Ocimum", "basilicum", ["Basil"], 3, 14, 180],
    ["Mentha", "spicata", ["Mint", "Spearmint"], 3, 21, 365],
    ["Rosmarinus", "officinalis", ["Rosemary"], 7, 30, 365],
    ["Citrus", "limon", ["Lemon tree", "Meyer lemon"], 6, 21, 730],
    ["Coffea", "arabica", ["Coffee plant"], 6, 21, 365],
  ] },
  { group: "Other", rows: [
    ["Dracaena", "surculosa", ["Gold dust dracaena"], 9, 30, 730],
    ["Codiaeum", "variegatum", ["Croton"], 6, 21, 540],
    ["Cordyline", "fruticosa", ["Ti plant", "Hawaiian ti"], 6, 30, 540],
    ["Fittonia", "albivenis", ["Nerve plant", "Mosaic plant"], 4, 30, 365],
    ["Hypoestes", "phyllostachya", ["Polka dot plant"], 4, 21, 365],
    ["Oxalis", "triangularis", ["Purple shamrock", "False shamrock"], 6, 30, 365],
    ["Aspidistra", "elatior", ["Cast iron plant"], 12, 60, 730],
    ["Cyperus", "alternifolius", ["Umbrella papyrus"], 3, 30, 365],
    ["Soleirolia", "soleirolii", ["Baby's tears"], 3, 30, 365],
    ["Asparagus", "setaceus", ["Asparagus fern"], 5, 30, 365],
    ["Bambusa", "vulgaris", ["Lucky bamboo", "Bamboo"], 5, 30, 730],
  ] },
];

export const SPECIES: SpeciesEntry[] = CATALOGUE.flatMap(({ group, rows }) =>
  rows.map(([genus, species, common, water, fert, repot]) => ({
    group,
    genus,
    species,
    common,
    waterEveryDays: water,
    fertilizeEveryDays: fert,
    repotEveryDays: repot,
  })),
);

/** Browse-list sections, in the order they're shown. */
export const SPECIES_GROUPS: string[] = CATALOGUE.map((c) => c.group);

export const scientificName = (e: SpeciesEntry) => `${e.genus} ${e.species}`;

/** "Monstera deliciosa" or "Swiss cheese plant (Monstera deliciosa)". */
export function displayName(e: SpeciesEntry): string {
  return e.common[0] ? `${e.common[0]} (${scientificName(e)})` : scientificName(e);
}

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "");

/**
 * Suggestions for what the keeper has typed so far. A hit at the start of
 * a name outranks one in the middle; scientific names outrank common ones
 * so "mon" leads with Monstera, not "Chinese money plant".
 */
export function searchSpecies(query: string, limit = 5): SpeciesEntry[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const scored: { entry: SpeciesEntry; score: number }[] = [];
  for (const entry of SPECIES) {
    const sci = fold(scientificName(entry));
    const commons = entry.common.map(fold);
    let score = 0;
    if (sci.startsWith(q)) score = 100;
    else if (fold(entry.species).startsWith(q)) score = 90;
    else if (commons.some((c) => c.startsWith(q))) score = 80;
    else if (commons.some((c) => c.split(" ").some((w) => w.startsWith(q)))) score = 60;
    else if (sci.includes(q) || commons.some((c) => c.includes(q))) score = 40;
    if (score) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || scientificName(a.entry).localeCompare(scientificName(b.entry)))
    .slice(0, limit)
    .map((s) => s.entry);
}

/** The catalogue entry a stored species string refers to, if any. */
export function findSpecies(name: string | null | undefined): SpeciesEntry | null {
  if (!name) return null;
  const n = fold(name.trim());
  return (
    SPECIES.find((e) => fold(scientificName(e)) === n) ??
    SPECIES.find((e) => e.common.some((c) => fold(c) === n)) ??
    null
  );
}

/**
 * The catalogue entry for an identification like { genus: "Monstera",
 * species: "deliciosa" }: the exact species when we have it, else the first
 * plant of that genus (its reminders are a fair default for its relatives).
 */
export function matchCandidate(candidate: { genus: string; species?: string | null }): SpeciesEntry | null {
  const genus = fold(candidate.genus.trim());
  if (!genus) return null;
  const sp = fold((candidate.species ?? "").trim());
  return (
    (sp ? SPECIES.find((e) => fold(e.genus) === genus && fold(e.species) === sp) : undefined) ??
    SPECIES.find((e) => fold(e.genus) === genus) ??
    null
  );
}
