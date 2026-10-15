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
  /** Empty for a hybrid sold under a cultivar name alone (Philodendron 'Prince of Orange'). */
  species: string;
  /** A named variety or variegation — 'Thai Constellation', 'Marble Queen'. */
  cultivar?: string;
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
    ["Monstera", "standleyana", ["Five holes plant"], 7, 30, 365],
    // Both are sold as "Silver monstera", which is how a Peru ended up in a
    // keeper's greenhouse recorded as a deliciosa: the catalogue had neither,
    // so the nearest Monstera won. Thick, semi-succulent leaves on both --
    // they drink less often than a deliciosa.
    ["Monstera", "karstenianum", ["Monstera Peru", "Marble planet"], 8, 30, 365],
    ["Monstera", "siltepecana", ["Silver monstera"], 8, 30, 365],
    // Two shinglers: young plants press their leaves flat against a board or
    // bark as they climb, and change shape entirely once they reach the top.
    ["Monstera", "dubia", [], 7, 30, 365],
    ["Monstera", "epipremnoides", ["Monstera Esqueleto"], 7, 30, 365],
    ["Philodendron", "hederaceum", ["Heartleaf philodendron"], 7, 30, 365],
    ["Philodendron", "erubescens", ["Blushing philodendron", "Red-leaf philodendron"], 7, 30, 365],
    ["Philodendron", "gloriosum", [], 7, 30, 365],
    ["Philodendron", "melanochrysum", ["Black gold philodendron"], 7, 30, 365],
    ["Philodendron", "verrucosum", [], 6, 30, 365],
    ["Philodendron", "squamiferum", ["Red bristle philodendron"], 7, 30, 365],
    ["Philodendron", "pedatum", ["Oak leaf philodendron"], 7, 30, 365],
    ["Philodendron", "hastatum", ["Silver sword philodendron"], 7, 30, 365],
    ["Philodendron", "brandtianum", ["Silver leaf philodendron"], 7, 30, 365],
    ["Philodendron", "bipennifolium", ["Horsehead philodendron", "Fiddle-leaf philodendron"], 7, 30, 365],
    ["Philodendron", "mamei", ["Silver cloud philodendron"], 7, 30, 365],
    ["Philodendron", "tortum", [], 7, 30, 365],
    ["Thaumatophyllum", "bipinnatifidum", ["Tree philodendron", "Philodendron selloum"], 7, 30, 540],
    ["Thaumatophyllum", "xanadu", ["Philodendron Xanadu", "Xanadu"], 7, 30, 540],
    ["Epipremnum", "aureum", ["Pothos", "Golden pothos", "Devil's ivy"], 8, 30, 365],
    ["Epipremnum", "pinnatum", ["Dragon tail"], 8, 30, 365],
    ["Scindapsus", "pictus", ["Satin pothos", "Silver pothos"], 8, 30, 365],
  ["Scindapsus", "treubii", ["Sterling silver scindapsus"], 8, 30, 365],
    ["Anthurium", "andraeanum", ["Flamingo flower", "Anthurium"], 7, 21, 365],
    ["Anthurium", "clarinervium", ["Velvet cardboard anthurium"], 7, 30, 365],
    ["Anthurium", "crystallinum", [], 7, 30, 365],
    ["Anthurium", "warocqueanum", ["Queen anthurium"], 6, 30, 365],
    ["Anthurium", "veitchii", ["King anthurium"], 6, 30, 365],
    ["Anthurium", "magnificum", [], 6, 30, 365],
    ["Alocasia", "amazonica", ["Alocasia Polly", "African mask"], 6, 21, 365],
    ["Alocasia", "zebrina", [], 6, 21, 365],
    ["Alocasia", "macrorrhizos", ["Giant taro", "Elephant ear"], 5, 21, 365],
    ["Alocasia", "baginda", ["Dragon scale alocasia"], 7, 21, 365],
  ["Alocasia", "reginula", ["Black velvet alocasia"], 8, 21, 365],
  ["Alocasia", "micholitziana", ["Green velvet alocasia"], 6, 21, 365],
    ["Alocasia", "cuprea", ["Alocasia Red Secret", "Mirror plant"], 7, 21, 365],
    ["Alocasia", "lauterbachiana", ["Purple sword"], 6, 21, 365],
    ["Alocasia", "wentii", [], 6, 21, 365],
    ["Alocasia", "sanderiana", ["Kris plant"], 6, 21, 365],
    ["Alocasia", "odora", ["Upright elephant ear"], 5, 21, 365],
    ["Colocasia", "esculenta", ["Taro", "Elephant ear"], 4, 21, 365],
    ["Caladium", "bicolor", ["Caladium", "Angel wings"], 4, 21, 365],
    ["Zamioculcas", "zamiifolia", ["ZZ plant", "Zanzibar gem"], 21, 60, 730],
    ["Spathiphyllum", "wallisii", ["Peace lily"], 5, 30, 365],
    ["Aglaonema", "commutatum", ["Chinese evergreen", "Aglaonema"], 9, 30, 540],
    ["Dieffenbachia", "seguine", ["Dumb cane"], 7, 30, 365],
    ["Syngonium", "podophyllum", ["Arrowhead plant", "Arrowhead vine"], 7, 30, 365],
    ["Syngonium", "wendlandii", [], 7, 30, 365],
    ["Rhaphidophora", "tetrasperma", ["Mini monstera"], 7, 30, 365],
    ["Rhaphidophora", "hayi", ["Shingle plant"], 7, 30, 365],
  ] },
  { group: "Trees", rows: [
    ["Ficus", "lyrata", ["Fiddle-leaf fig"], 7, 30, 540],
    ["Ficus", "elastica", ["Rubber plant", "Rubber tree"], 9, 30, 540],
    ["Ficus", "benjamina", ["Weeping fig"], 7, 30, 540],
    ["Ficus", "microcarpa", ["Ginseng ficus", "Chinese banyan"], 7, 30, 540],
    ["Ficus", "audrey", ["Ficus Audrey", "Banyan fig"], 7, 30, 540],
    ["Ficus", "triangularis", ["Triangle fig"], 8, 30, 540],
    ["Ficus", "altissima", ["Council tree", "Ficus Yellow Gem"], 8, 30, 540],
    ["Ficus", "umbellata", ["Umbrella fig"], 7, 30, 540],
    ["Schefflera", "arboricola", ["Umbrella plant", "Dwarf umbrella tree"], 8, 30, 540],
    ["Schefflera", "actinophylla", ["Umbrella tree", "Queensland umbrella tree"], 8, 30, 540],
    ["Dracaena", "trifasciata", ["Snake plant", "Mother-in-law's tongue", "Sansevieria"], 21, 60, 730],
    ["Dracaena", "marginata", ["Dragon tree"], 10, 30, 730],
    ["Dracaena", "fragrans", ["Corn plant"], 10, 30, 730],
    ["Dracaena", "reflexa", ["Pleomele"], 10, 30, 730],
    ["Dracaena", "angolensis", ["Cylindrical snake plant", "Sansevieria cylindrica"], 21, 60, 730],
  ["Dracaena", "masoniana", ["Whale fin snake plant", "Sansevieria masoniana"], 21, 60, 730],
    // Lucky bamboo is this, not a bamboo. It used to sit on Bambusa vulgaris,
    // which sent anyone searching the name to a true bamboo -- and the two
    // differ on the one fact a keeper looks up: this is toxic to cats and
    // dogs, and Bambusa is not.
    ["Dracaena", "sanderiana", ["Lucky bamboo", "Ribbon plant", "Curly bamboo"], 7, 60, 730],
    ["Yucca", "elephantipes", ["Spineless yucca"], 14, 60, 730],
    ["Pachira", "aquatica", ["Money tree"], 8, 30, 540],
    ["Crassula", "ovata", ["Jade plant", "Money plant"], 14, 60, 730],
    ["Beaucarnea", "recurvata", ["Ponytail palm"], 14, 60, 730],
    ["Polyscias", "fruticosa", ["Ming aralia"], 7, 30, 540],
    ["Polyscias", "scutellaria", ["Shield aralia", "Polyscias Fabian"], 7, 30, 540],
    ["Fatsia", "japonica", ["Japanese aralia", "Paper plant"], 7, 30, 540],
    ["Strelitzia", "nicolai", ["Bird of paradise", "White bird of paradise"], 7, 21, 540],
    ["Strelitzia", "reginae", ["Orange bird of paradise"], 7, 21, 540],
    ["Musa", "acuminata", ["Dwarf banana"], 4, 14, 365],
    ["Araucaria", "heterophylla", ["Norfolk Island pine"], 7, 30, 730],
    ["Olea", "europaea", ["Olive tree"], 10, 30, 730],
  ] },
  { group: "Palms", rows: [
    ["Chamaedorea", "elegans", ["Parlour palm", "Parlor palm"], 7, 30, 540],
    ["Chamaedorea", "seifrizii", ["Bamboo palm", "Reed palm"], 6, 30, 540],
    ["Chamaedorea", "cataractarum", ["Cat palm"], 5, 30, 540],
    ["Dypsis", "lutescens", ["Areca palm", "Butterfly palm"], 6, 30, 540],
    ["Howea", "forsteriana", ["Kentia palm"], 8, 30, 730],
    ["Rhapis", "excelsa", ["Lady palm"], 7, 30, 730],
    ["Phoenix", "roebelenii", ["Pygmy date palm"], 7, 30, 730],
    ["Livistona", "chinensis", ["Chinese fan palm"], 7, 30, 730],
    // Thirsty, unlike most palms: a majesty palm wants the compost kept damp.
    ["Ravenea", "rivularis", ["Majesty palm"], 5, 30, 730],
    ["Caryota", "mitis", ["Fishtail palm"], 6, 30, 730],
    // Not a palm at all but a cycad, filed here because it is sold as one --
    // and worth finding, since it is among the most poisonous plants sold
    // for the house (see plants-data.mjs).
    ["Cycas", "revoluta", ["Sago palm", "King sago"], 14, 60, 1095],
  ] },
  { group: "Vines & trailers", rows: [
    ["Hoya", "carnosa", ["Wax plant", "Hoya"], 10, 30, 730],
    ["Hoya", "kerrii", ["Sweetheart hoya"], 12, 30, 730],
    ["Hoya", "linearis", [], 8, 30, 730],
    ["Hoya", "obovata", [], 10, 30, 730],
    ["Hoya", "krohniana", [], 10, 30, 730],
    ["Hoya", "curtisii", [], 8, 30, 730],
    ["Hoya", "bella", ["Miniature wax plant"], 8, 30, 730],
    ["Hoya", "polyneura", ["Fishtail hoya"], 8, 30, 730],
    ["Hoya", "macrophylla", [], 10, 30, 730],
    ["Dischidia", "ruscifolia", ["Million hearts"], 7, 30, 730],
    ["Tradescantia", "zebrina", ["Inch plant", "Wandering dude"], 5, 30, 365],
    ["Tradescantia", "nanouk", ["Nanouk"], 5, 30, 365],
    ["Tradescantia", "pallida", ["Purple heart", "Purple queen"], 6, 30, 365],
    ["Tradescantia", "fluminensis", ["Small-leaf spiderwort", "River spiderwort"], 5, 30, 365],
    // Upright and clumping, unlike the rest of the genus -- see plants-data.mjs.
    ["Tradescantia", "spathacea", ["Moses-in-the-cradle", "Oyster plant", "Boat lily"], 7, 30, 365],
    ["Callisia", "repens", ["Turtle vine", "Creeping inch plant"], 5, 30, 365],
    ["Plectranthus", "verticillatus", ["Swedish ivy"], 6, 30, 365],
    ["Chlorophytum", "comosum", ["Spider plant"], 6, 30, 365],
    ["Hedera", "helix", ["English ivy"], 6, 30, 365],
    ["Senecio", "rowleyanus", ["String of pearls"], 14, 60, 730],
    ["Senecio", "radicans", ["String of bananas"], 12, 60, 730],
    ["Senecio", "peregrinus", ["String of dolphins"], 14, 60, 730],
    ["Ceropegia", "woodii", ["String of hearts", "Rosary vine"], 12, 60, 730],
    ["Peperomia", "prostrata", ["String of turtles"], 9, 30, 730],
    ["Cissus", "discolor", ["Rex begonia vine"], 5, 30, 365],
    ["Cissus", "rhombifolia", ["Grape ivy"], 7, 30, 365],
    // A climbing fig, not a tree: it shares the genus's care but not its habit,
    // and dries out far faster than any ficus in the Trees list.
    ["Ficus", "pumila", ["Creeping fig"], 4, 30, 365],
    ["Pilea", "peperomioides", ["Chinese money plant", "Pancake plant", "UFO plant"], 7, 30, 365],
    ["Pilea", "cadierei", ["Aluminium plant", "Aluminum plant"], 6, 30, 365],
    ["Pilea", "involucrata", ["Friendship plant", "Moon Valley pilea"], 5, 30, 365],
    ["Pilea", "glauca", ["Silver sparkle pilea"], 6, 30, 365],
    ["Peperomia", "obtusifolia", ["Baby rubber plant"], 9, 30, 730],
    ["Peperomia", "caperata", ["Ripple peperomia", "Emerald ripple"], 8, 30, 730],
    ["Peperomia", "argyreia", ["Watermelon peperomia"], 7, 30, 730],
    ["Peperomia", "polybotrya", ["Raindrop peperomia"], 9, 30, 730],
    ["Peperomia", "rotundifolia", ["Trailing jade", "Jade necklace"], 8, 30, 730],
    ["Peperomia", "scandens", ["Cupid peperomia", "Trailing peperomia"], 8, 30, 730],
    ["Peperomia", "puteolata", ["Parallel peperomia"], 8, 30, 730],
  ] },
  { group: "Prayer plants", rows: [
    ["Maranta", "leuconeura", ["Prayer plant"], 5, 21, 365],
    ["Goeppertia", "orbifolia", ["Calathea orbifolia"], 5, 21, 365],
    ["Goeppertia", "makoyana", ["Peacock plant", "Calathea makoyana"], 5, 21, 365],
    ["Goeppertia", "roseopicta", ["Rose-painted calathea"], 5, 21, 365],
    ["Goeppertia", "lancifolia", ["Rattlesnake plant", "Calathea lancifolia"], 5, 21, 365],
    ["Goeppertia", "zebrina", ["Calathea zebrina", "Zebra calathea"], 5, 21, 365],
    ["Goeppertia", "rufibarba", ["Furry feather calathea", "Calathea rufibarba"], 5, 21, 365],
    ["Goeppertia", "warscewiczii", ["Calathea Jungle Velvet", "Calathea warscewiczii"], 5, 21, 365],
    ["Goeppertia", "crocata", ["Eternal flame calathea", "Calathea crocata"], 5, 21, 365],
    ["Goeppertia", "musaica", ["Calathea Network", "Calathea musaica"], 5, 21, 365],
    ["Calathea", "ornata", ["Pinstripe calathea"], 5, 21, 365],
    ["Ctenanthe", "burle-marxii", ["Fishbone prayer plant", "Never never plant"], 5, 21, 365],
    ["Stromanthe", "sanguinea", ["Stromanthe"], 5, 21, 365],
  ] },
  { group: "Ferns", rows: [
    ["Nephrolepis", "exaltata", ["Boston fern", "Sword fern"], 4, 30, 365],
    ["Nephrolepis", "obliterata", ["Kimberly queen fern"], 6, 30, 365],
    ["Adiantum", "raddianum", ["Maidenhair fern"], 3, 30, 365],
    ["Asplenium", "nidus", ["Bird's nest fern"], 5, 30, 365],
    ["Platycerium", "bifurcatum", ["Staghorn fern"], 7, 30, 730],
    ["Phlebodium", "aureum", ["Blue star fern"], 6, 30, 365],
    ["Davallia", "fejeensis", ["Rabbit's foot fern"], 5, 30, 365],
    ["Microsorum", "musifolium", ["Crocodile fern"], 5, 30, 365],
    ["Pteris", "cretica", ["Ribbon fern", "Cretan brake fern"], 4, 30, 365],
    ["Cyrtomium", "falcatum", ["Japanese holly fern", "Holly fern"], 6, 30, 365],
    ["Pellaea", "rotundifolia", ["Button fern"], 6, 30, 365],
  ] },
  { group: "Begonias & violets", rows: [
    ["Begonia", "maculata", ["Polka dot begonia"], 6, 21, 365],
    ["Begonia", "rex", ["Rex begonia", "Painted-leaf begonia"], 5, 21, 365],
    ["Begonia", "masoniana", ["Iron cross begonia"], 6, 21, 365],
    ["Saintpaulia", "ionantha", ["African violet"], 6, 14, 365],
    ["Streptocarpus", "hybridus", ["Cape primrose"], 5, 14, 365],
    ["Episcia", "cupreata", ["Flame violet"], 5, 21, 365],
    ["Aeschynanthus", "radicans", ["Lipstick plant"], 6, 21, 365],
    ["Nematanthus", "gregarius", ["Goldfish plant", "Guppy plant"], 6, 21, 365],
    ["Sinningia", "speciosa", ["Gloxinia"], 5, 14, 365],
  ] },
  { group: "Succulents & cacti", rows: [
    ["Echeveria", "elegans", ["Mexican snowball", "Echeveria"], 14, 60, 730],
    ["Graptopetalum", "paraguayense", ["Ghost plant"], 14, 60, 730],
    ["Crassula", "perforata", ["String of buttons"], 14, 60, 730],
    ["Portulacaria", "afra", ["Elephant bush", "Dwarf jade"], 14, 60, 730],
    // A winter grower: it rests, and wants least water, in the summer heat.
    ["Aeonium", "arboreum", ["Tree aeonium"], 10, 60, 730],
    ["Haworthiopsis", "attenuata", ["Zebra plant", "Zebra haworthia"], 14, 60, 730],
    ["Haworthia", "cooperi", ["Window haworthia"], 14, 60, 730],
    ["Aloe", "vera", ["Aloe vera", "Aloe"], 14, 60, 730],
    ["Aloe", "aristata", ["Lace aloe"], 14, 60, 730],
    ["Gasteria", "carinata", ["Ox tongue"], 14, 60, 730],
    ["Kalanchoe", "blossfeldiana", ["Flaming Katy", "Kalanchoe"], 10, 30, 365],
    ["Kalanchoe", "tomentosa", ["Panda plant"], 14, 60, 730],
    ["Kalanchoe", "daigremontiana", ["Mother of thousands"], 12, 60, 730],
    ["Kalanchoe", "luciae", ["Flapjack plant", "Paddle plant"], 14, 60, 730],
    ["Sempervivum", "tectorum", ["Hens and chicks", "Houseleek"], 14, 90, 730],
    ["Sedum", "morganianum", ["Burro's tail", "Donkey tail"], 14, 60, 730],
    ["Sedum", "rubrotinctum", ["Jelly bean plant", "Pork and beans"], 14, 60, 730],
    ["Euphorbia", "trigona", ["African milk tree"], 14, 60, 730],
    ["Euphorbia", "tirucalli", ["Pencil cactus", "Firestick"], 14, 60, 730],
    ["Euphorbia", "milii", ["Crown of thorns"], 10, 30, 730],
    ["Schlumbergera", "truncata", ["Christmas cactus", "Thanksgiving cactus", "Holiday cactus"], 10, 30, 730],
    ["Schlumbergera", "gaertneri", ["Easter cactus"], 10, 30, 730],
    ["Opuntia", "microdasys", ["Bunny ears cactus"], 21, 90, 730],
    ["Mammillaria", "elongata", ["Ladyfinger cactus"], 21, 90, 730],
    ["Cereus", "repandus", ["Peruvian apple cactus"], 21, 90, 730],
    ["Echinocactus", "grusonii", ["Golden barrel cactus"], 21, 90, 730],
    // Two cacti grafted together: the coloured top has no chlorophyll at all.
    ["Gymnocalycium", "mihanovichii", ["Moon cactus"], 14, 90, 730],
    ["Epiphyllum", "oxypetalum", ["Queen of the night", "Orchid cactus"], 10, 30, 730],
    // Disocactus anguliger to botanists; sold under this name.
    ["Epiphyllum", "anguliger", ["Fishbone cactus", "Ric rac cactus", "Zigzag cactus"], 9, 30, 730],
    ["Rhipsalis", "baccifera", ["Mistletoe cactus"], 8, 30, 730],
    ["Lithops", "lesliei", ["Living stones", "Lithops"], 30, 180, 1095],
  ] },
  { group: "Flowering", rows: [
    ["Phalaenopsis", "amabilis", ["Moth orchid", "Phalaenopsis orchid", "Orchid"], 8, 21, 540],
    ["Dendrobium", "nobile", ["Dendrobium orchid"], 7, 21, 540],
    ["Cattleya", "labiata", ["Cattleya orchid"], 8, 21, 540],
    // Orchid hybrids are written as a genus and a grex, unquoted.
    ["Oncidium", "Sharry Baby", ["Chocolate orchid", "Oncidium Sharry Baby"], 7, 21, 540],
    ["Paphiopedilum", "Maudiae", ["Slipper orchid", "Lady slipper orchid"], 7, 21, 540],
    ["Gardenia", "jasminoides", ["Gardenia", "Cape jasmine"], 5, 21, 365],
    ["Jasminum", "polyanthum", ["Pink jasmine"], 5, 21, 365],
    ["Hibiscus", "rosa-sinensis", ["Chinese hibiscus"], 4, 14, 365],
    ["Anthurium", "scherzerianum", ["Flamingo lily"], 7, 21, 365],
    ["Cyclamen", "persicum", ["Cyclamen"], 6, 21, 365],
    ["Clivia", "miniata", ["Bush lily", "Natal lily"], 10, 30, 730],
    ["Hippeastrum", "hybridum", ["Amaryllis"], 7, 21, 730],
    // Euphorbias are filed with the succulents; this one is not one, and has
    // its own care in plants-data.mjs.
    ["Euphorbia", "pulcherrima", ["Poinsettia"], 7, 30, 365],
    ["Zantedeschia", "aethiopica", ["Calla lily", "Arum lily"], 5, 21, 365],
  ] },
  { group: "Bromeliads & air plants", rows: [
    ["Guzmania", "lingulata", ["Scarlet star", "Guzmania"], 7, 60, 730],
    ["Aechmea", "fasciata", ["Urn plant", "Silver vase"], 7, 60, 730],
    ["Vriesea", "splendens", ["Flaming sword"], 7, 60, 730],
    ["Neoregelia", "carolinae", ["Blushing bromeliad"], 7, 60, 730],
    ["Cryptanthus", "bivittatus", ["Earth star"], 7, 60, 730],
    ["Ananas", "comosus", ["Pineapple plant"], 7, 30, 730],
    ["Tillandsia", "ionantha", ["Air plant", "Sky plant"], 5, 30, 1095],
    ["Tillandsia", "xerographica", ["Xerographica"], 7, 30, 1095],
    // Grown in a pot of bark, unlike the air plants above it.
    ["Tillandsia", "cyanea", ["Pink quill"], 7, 30, 730],
  ] },
  { group: "Herbs & edibles", rows: [
    ["Ocimum", "basilicum", ["Basil"], 3, 14, 180],
    ["Mentha", "spicata", ["Mint", "Spearmint"], 3, 21, 365],
    ["Rosmarinus", "officinalis", ["Rosemary"], 7, 30, 365],
    ["Thymus", "vulgaris", ["Thyme"], 6, 30, 365],
    ["Petroselinum", "crispum", ["Parsley"], 3, 21, 180],
    ["Allium", "schoenoprasum", ["Chives"], 4, 21, 365],
    ["Citrus", "limon", ["Lemon tree", "Meyer lemon"], 6, 21, 730],
    ["Citrus", "microcarpa", ["Calamondin", "Calamondin orange"], 6, 21, 730],
    ["Coffea", "arabica", ["Coffee plant"], 6, 21, 365],
    ["Persea", "americana", ["Avocado"], 6, 30, 365],
  ] },
  { group: "Other", rows: [
    ["Dracaena", "surculosa", ["Gold dust dracaena"], 9, 30, 730],
    ["Codiaeum", "variegatum", ["Croton"], 6, 21, 540],
    ["Cordyline", "fruticosa", ["Ti plant", "Hawaiian ti"], 6, 30, 540],
    ["Fittonia", "albivenis", ["Nerve plant", "Mosaic plant"], 4, 30, 365],
    ["Hypoestes", "phyllostachya", ["Polka dot plant"], 4, 21, 365],
    ["Coleus", "scutellarioides", ["Coleus", "Painted nettle"], 4, 21, 365],
    ["Oxalis", "triangularis", ["Purple shamrock", "False shamrock"], 6, 30, 365],
    ["Aspidistra", "elatior", ["Cast iron plant"], 12, 60, 730],
    ["Cyperus", "alternifolius", ["Umbrella papyrus"], 3, 30, 365],
    ["Soleirolia", "soleirolii", ["Baby's tears"], 3, 30, 365],
    ["Asparagus", "setaceus", ["Asparagus fern"], 5, 30, 365],
    ["Asparagus", "densiflorus", ["Foxtail fern", "Sprenger's asparagus"], 7, 30, 365],
    ["Bambusa", "vulgaris", ["Bamboo", "Common bamboo"], 5, 30, 730],
  ] },
];


// genus, species ("" for a hybrid), cultivar, common names — and care when
// there's no parent to inherit it from.
type CultivarRow =
  | [string, string, string, string[]]
  | [string, string, string, string[], number, number, number];

const CULTIVARS: CultivarRow[] = [
  // Monstera
  ["Monstera", "deliciosa", "Thai Constellation", ["Thai Constellation", "Thai Con"]],
  ["Monstera", "deliciosa", "Albo Variegata", ["Monstera Albo", "Albo monstera"]],
  ["Monstera", "deliciosa", "Aurea", ["Monstera Aurea", "Marmorata"]],
  ["Monstera", "deliciosa", "Mint", ["Monstera Mint"]],
  ["Monstera", "adansonii", "Albo Variegata", ["Adansonii Albo"]],
  ["Monstera", "adansonii", "Aurea", ["Adansonii Aurea"]],
  ["Monstera", "standleyana", "Albo Variegata", ["Standleyana Albo"]],
  ["Monstera", "karstenianum", "Peru", ["Monstera Peru", "Peru"]],
  // Sold under this name; what it is botanically isn't settled. Young plants
  // have plain leaves -- the cut "flame" leaves come with age -- and the
  // catalogue not having it left one keeper unable to name theirs.
  ["Monstera", "", "Burle Marx Flame", ["Burle Marx Flame", "Monstera Burle Marx Flame"], 7, 30, 365],
  ["Rhaphidophora", "tetrasperma", "Variegata", ["Variegated mini monstera"]],
  // Philodendron
  ["Philodendron", "erubescens", "Birkin", ["Philodendron Birkin", "Birkin"]],
  ["Philodendron", "erubescens", "Pink Princess", ["Pink Princess", "PPP"]],
  ["Philodendron", "erubescens", "White Princess", ["White Princess"]],
  ["Philodendron", "erubescens", "White Knight", ["White Knight"]],
  ["Philodendron", "erubescens", "White Wizard", ["White Wizard"]],
  ["Philodendron", "hederaceum", "Brasil", ["Philodendron Brasil"]],
  ["Philodendron", "hederaceum", "Micans", ["Velvet leaf philodendron", "Micans"]],
  ["Philodendron", "hederaceum", "Rio", ["Philodendron Rio"]],
  ["Philodendron", "hederaceum", "Lemon Lime", ["Lemon Lime philodendron"]],
  ["Philodendron", "", "Florida Ghost", ["Florida Ghost"], 7, 30, 365],
  ["Philodendron", "", "Florida Beauty", ["Florida Beauty"], 7, 30, 365],
  ["Philodendron", "", "Prince of Orange", ["Prince of Orange"], 7, 30, 365],
  ["Philodendron", "", "Moonlight", ["Philodendron Moonlight"], 7, 30, 365],
  ["Philodendron", "", "Ring of Fire", ["Ring of Fire"], 7, 30, 365],
  ["Philodendron", "", "Paraiso Verde", ["Paraiso Verde"], 7, 30, 365],
  ["Philodendron", "", "Burle Marx", ["Philodendron Burle Marx"], 7, 30, 365],
  ["Philodendron", "", "Burle Marx Variegata", ["Variegated Burle Marx"], 7, 30, 365],
  ["Philodendron", "", "Jose Buono", ["Jose Buono"], 7, 30, 365],
  ["Philodendron", "", "Golden Dragon", ["Golden Dragon"], 7, 30, 365],
  ["Philodendron", "", "Congo Rojo", ["Congo Rojo", "Philodendron Rojo Congo"], 7, 30, 365],
  ["Philodendron", "", "Imperial Red", ["Philodendron Imperial Red"], 7, 30, 365],
  ["Philodendron", "", "Imperial Green", ["Philodendron Imperial Green"], 7, 30, 365],
  ["Philodendron", "", "Painted Lady", ["Philodendron Painted Lady"], 7, 30, 365],
  ["Philodendron", "", "Splendid", ["Philodendron Splendid"], 6, 30, 365],
  // Pothos and satin pothos
  ["Epipremnum", "aureum", "Marble Queen", ["Marble Queen pothos"]],
  ["Epipremnum", "aureum", "Snow Queen", ["Snow Queen pothos"]],
  ["Epipremnum", "aureum", "Neon", ["Neon pothos"]],
  ["Epipremnum", "aureum", "Manjula", ["Manjula pothos"]],
  ["Epipremnum", "aureum", "N'Joy", ["N'Joy pothos", "Njoy"]],
  ["Epipremnum", "aureum", "Pearls and Jade", ["Pearls and Jade pothos"]],
  ["Epipremnum", "aureum", "Global Green", ["Global Green pothos"]],
  ["Epipremnum", "aureum", "Jade", ["Jade pothos"]],
  ["Epipremnum", "aureum", "Harlequin", ["Harlequin pothos"]],
  ["Epipremnum", "pinnatum", "Cebu Blue", ["Cebu Blue pothos"]],
  ["Epipremnum", "pinnatum", "Albo Variegata", ["Pinnatum Albo"]],
  ["Epipremnum", "pinnatum", "Aurea", ["Pinnatum Aurea"]],
  ["Epipremnum", "pinnatum", "Baltic Blue", ["Baltic Blue pothos"]],
  ["Scindapsus", "pictus", "Exotica", ["Satin pothos Exotica"]],
  ["Scindapsus", "pictus", "Argyraeus", ["Satin pothos Argyraeus"]],
  ["Scindapsus", "pictus", "Silvery Ann", ["Silvery Ann"]],
  ["Scindapsus", "treubii", "Moonlight", ["Scindapsus Moonlight"]],
  ["Scindapsus", "treubii", "Dark Form", ["Scindapsus Dark Form"]],
  // Alocasia, Syngonium, Anthurium relatives
  ["Alocasia", "baginda", "Dragon Scale", ["Dragon Scale"]],
  ["Alocasia", "baginda", "Silver Dragon", ["Silver Dragon"]],
  ["Alocasia", "micholitziana", "Frydek", ["Frydek"]],
  ["Alocasia", "micholitziana", "Frydek Variegata", ["Variegated Frydek"]],
  ["Alocasia", "", "Pink Dragon", ["Pink Dragon"], 7, 21, 365],
  ["Alocasia", "", "Regal Shield", ["Regal Shield"], 6, 21, 365],
  ["Alocasia", "", "Portodora", ["Alocasia Portodora"], 5, 21, 365],
  ["Alocasia", "macrorrhizos", "Stingray", ["Alocasia Stingray"]],
  ["Syngonium", "podophyllum", "Albo Variegatum", ["Syngonium Albo"]],
  ["Syngonium", "podophyllum", "Pink Splash", ["Pink Splash"]],
  ["Syngonium", "podophyllum", "White Butterfly", ["White Butterfly"]],
  ["Syngonium", "podophyllum", "Pink Allusion", ["Pink Allusion"]],
  ["Syngonium", "podophyllum", "Mojito", ["Syngonium Mojito"]],
  ["Syngonium", "podophyllum", "Neon Robusta", ["Neon Robusta"]],
  ["Syngonium", "podophyllum", "Three Kings", ["Three Kings"]],
  ["Syngonium", "podophyllum", "Confetti", ["Syngonium Confetti"]],
  // Hoya
  ["Hoya", "carnosa", "Krimson Queen", ["Hoya Tricolor", "Krimson Queen"]],
  ["Hoya", "carnosa", "Krimson Princess", ["Krimson Princess"]],
  ["Hoya", "carnosa", "Compacta", ["Hindu rope hoya"]],
  ["Hoya", "kerrii", "Variegata", ["Variegated sweetheart hoya"]],
  ["Hoya", "", "Publicalyx Splash", ["Hoya Splash"], 10, 30, 730],
  ["Hoya", "", "Australis Lisa", ["Hoya Lisa"], 10, 30, 730],
  // Ficus and other trees
  ["Ficus", "elastica", "Tineke", ["Tineke rubber plant"]],
  ["Ficus", "elastica", "Ruby", ["Ruby rubber plant"]],
  ["Ficus", "elastica", "Burgundy", ["Burgundy rubber plant"]],
  ["Ficus", "elastica", "Shivereana", ["Shivereana rubber plant"]],
  ["Ficus", "benjamina", "Starlight", ["Variegated weeping fig"]],
  // Sold as Ficus Alii; no plain species in the catalogue to sit under.
  ["Ficus", "binnendijkii", "Alii", ["Ficus Alii", "Narrow-leaf fig"], 8, 30, 540],
  ["Ficus", "lyrata", "Bambino", ["Dwarf fiddle-leaf fig"]],
  ["Schefflera", "arboricola", "Variegata", ["Variegated umbrella plant"]],
  ["Dracaena", "trifasciata", "Laurentii", ["Variegated snake plant", "Laurentii"]],
  ["Dracaena", "trifasciata", "Moonshine", ["Moonshine snake plant"]],
  ["Dracaena", "trifasciata", "Black Gold", ["Black Gold snake plant"]],
  ["Dracaena", "trifasciata", "Hahnii", ["Bird's nest snake plant"]],
  ["Dracaena", "trifasciata", "Futura Superba", ["Futura Superba snake plant"]],
  ["Dracaena", "trifasciata", "Twisted Sister", ["Twisted Sister snake plant"]],
  ["Dracaena", "trifasciata", "Bantel's Sensation", ["Bantel's Sensation"]],
  ["Dracaena", "angolensis", "Boncel", ["Starfish snake plant"]],
  ["Dracaena", "fragrans", "Lemon Lime", ["Lemon Lime dracaena"]],
  ["Dracaena", "fragrans", "Massangeana", ["Corn plant Massangeana"]],
  ["Dracaena", "fragrans", "Janet Craig", ["Janet Craig dracaena"]],
  ["Dracaena", "reflexa", "Song of India", ["Song of India"]],
  ["Dracaena", "fragrans", "Warneckii", ["Dracaena Warneckii"]],
  ["Dracaena", "fragrans", "Limelight", ["Dracaena Limelight"]],
  ["Dracaena", "marginata", "Tricolor", ["Tricolor dragon tree"]],
  ["Dracaena", "marginata", "Colorama", ["Colorama dragon tree"]],
  ["Zamioculcas", "zamiifolia", "Raven", ["Raven ZZ", "Black ZZ"]],
  ["Zamioculcas", "zamiifolia", "Chameleon", ["Chameleon ZZ"]],
  ["Zamioculcas", "zamiifolia", "Zenzi", ["Zenzi ZZ"]],
  // Prayer plants and calatheas
  ["Calathea", "", "White Fusion", ["Calathea White Fusion"], 4, 21, 365],
  ["Calathea", "ornata", "Beauty Star", ["Calathea Beauty Star"]],
  ["Goeppertia", "roseopicta", "Medallion", ["Calathea Medallion"]],
  ["Goeppertia", "roseopicta", "Dottie", ["Calathea Dottie"]],
  ["Goeppertia", "concinna", "Freddie", ["Calathea Freddie"], 5, 21, 365],
  ["Stromanthe", "sanguinea", "Triostar", ["Triostar", "Tricolor stromanthe"]],
  ["Ctenanthe", "", "Amagris", ["Ctenanthe Amagris"], 5, 21, 365],
  ["Maranta", "leuconeura", "Lemon Lime", ["Lemon Lime prayer plant"]],
  ["Maranta", "leuconeura", "Kerchoveana", ["Rabbit's foot prayer plant"]],
  ["Maranta", "leuconeura", "Erythroneura", ["Red prayer plant", "Herringbone plant"]],
  // Peperomia, Pilea, Tradescantia, Chlorophytum
  ["Peperomia", "obtusifolia", "Variegata", ["Variegated baby rubber plant"]],
  ["Peperomia", "caperata", "Rosso", ["Peperomia Rosso"]],
  ["Peperomia", "", "Ginny", ["Peperomia Ginny", "Rainbow peperomia"], 9, 30, 730],
  ["Peperomia", "", "Hope", ["Peperomia Hope"], 10, 30, 730],
  ["Pilea", "peperomioides", "Mojito", ["Variegated Chinese money plant", "Pilea Mojito"]],
  ["Pilea", "peperomioides", "Sugar", ["Pilea Sugar"]],
  ["Tradescantia", "zebrina", "Quadricolor", ["Quadricolor inch plant"]],
  ["Tradescantia", "", "Tricolor", ["Tricolor tradescantia"], 5, 30, 365],
  ["Chlorophytum", "comosum", "Vittatum", ["Variegated spider plant"]],
  ["Chlorophytum", "comosum", "Bonnie", ["Curly spider plant"]],
  ["Hedera", "helix", "Glacier", ["Variegated ivy"]],
  ["Ceropegia", "woodii", "Variegata", ["Variegated string of hearts"]],
  // Ferns
  ["Nephrolepis", "cordifolia", "Duffii", ["Lemon button fern"], 4, 30, 365],
  ["Asplenium", "nidus", "Crispy Wave", ["Crispy Wave fern"]],
  // Aglaonema, Dieffenbachia, Spathiphyllum
  ["Aglaonema", "commutatum", "Silver Bay", ["Silver Bay"]],
  ["Aglaonema", "", "Red Siam", ["Red Siam"], 9, 30, 540],
  ["Aglaonema", "", "Siam Aurora", ["Siam Aurora"], 9, 30, 540],
  ["Aglaonema", "", "Pink Dalmatian", ["Pink Dalmatian"], 9, 30, 540],
  ["Aglaonema", "", "Lady Valentine", ["Lady Valentine"], 9, 30, 540],
  ["Aglaonema", "commutatum", "Maria", ["Aglaonema Maria"]],
  ["Aglaonema", "commutatum", "Silver Queen", ["Silver Queen"]],
  ["Dieffenbachia", "seguine", "Camille", ["Dumb cane Camille"]],
  ["Dieffenbachia", "seguine", "Compacta", ["Dumb cane Compacta"]],
  ["Dieffenbachia", "seguine", "Tropic Snow", ["Tropic Snow"]],
  ["Spathiphyllum", "wallisii", "Domino", ["Variegated peace lily"]],
  ["Spathiphyllum", "wallisii", "Sensation", ["Giant peace lily"]],
  // Succulents and cacti
  ["Crassula", "ovata", "Gollum", ["Gollum jade"]],
  ["Crassula", "ovata", "Hobbit", ["Hobbit jade"]],
  ["Crassula", "ovata", "Tricolor", ["Variegated jade"]],
  ["Crassula", "ovata", "Hummel's Sunset", ["Golden jade", "Hummel's Sunset"]],
  ["Euphorbia", "trigona", "Rubra", ["Red African milk tree"]],
  ["Echeveria", "", "Lola", ["Echeveria Lola"], 14, 60, 730],
  ["Echeveria", "", "Perle von Nürnberg", ["Perle von Nürnberg"], 14, 60, 730],
  ["Echeveria", "", "Black Prince", ["Echeveria Black Prince"], 14, 60, 730],
  // Others
  ["Codiaeum", "variegatum", "Petra", ["Croton Petra"]],
  ["Codiaeum", "variegatum", "Mammy", ["Croton Mammy"]],
  ["Cordyline", "fruticosa", "Red Sister", ["Red Sister ti plant"]],
  ["Begonia", "maculata", "Wightii", ["Polka dot begonia Wightii"]],
  ["Begonia", "rex", "Escargot", ["Escargot begonia"]],
  ["Begonia", "", "Angel Wing", ["Angel wing begonia"], 6, 21, 365],
];

const BASE: SpeciesEntry[] = CATALOGUE.flatMap(({ group, rows }) =>
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

// Each cultivar sits right under its parent (or its nearest genus-mate, for
// a hybrid), inheriting the parent's group and care unless the row says.
const CULTIVAR_ENTRIES = CULTIVARS.map((row) => {
  const [genus, species, cultivar, common, water, fert, repot] = row;
  const parent = BASE.find((e) => e.genus === genus && e.species === species) ?? BASE.find((e) => e.genus === genus);
  const entry: SpeciesEntry = {
    group: parent?.group ?? "Other",
    genus,
    species,
    cultivar,
    common,
    waterEveryDays: water ?? parent?.waterEveryDays ?? 7,
    fertilizeEveryDays: fert ?? parent?.fertilizeEveryDays ?? 30,
    repotEveryDays: repot ?? parent?.repotEveryDays ?? 365,
  };
  return { entry, parent };
});

export const SPECIES: SpeciesEntry[] = [];
for (const base of BASE) {
  SPECIES.push(base);
  for (const { entry, parent } of CULTIVAR_ENTRIES) if (parent === base) SPECIES.push(entry);
}
for (const { entry, parent } of CULTIVAR_ENTRIES) if (!parent) SPECIES.push(entry);

/** Browse-list sections, in the order they're shown. */
export const SPECIES_GROUPS: string[] = CATALOGUE.map((c) => c.group);

/**
 * Every named cultivar the catalogue knows, as "Genus species 'Cultivar'".
 * Sent along with a photo so the AI reaches for these names (and their
 * spellings) when one fits, instead of a look-alike it happens to know.
 */
export const KNOWN_CULTIVARS: string[] = CULTIVARS.map(([genus, species, cultivar]) =>
  `${genus}${species ? ` ${species}` : ""} '${cultivar}'`,
);

export const scientificName = (e: SpeciesEntry) =>
  `${e.genus}${e.species ? ` ${e.species}` : ""}${e.cultivar ? ` '${e.cultivar}'` : ""}`;

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
    const cult = entry.cultivar ? fold(entry.cultivar) : "";
    const commons = entry.common.map(fold);
    let score = 0;
    if (sci.startsWith(q)) score = 100;
    else if (cult && cult.startsWith(q)) score = 95;
    else if (entry.species && fold(entry.species).startsWith(q)) score = 90;
    else if (commons.some((c) => c.startsWith(q))) score = 80;
    else if (cult && cult.split(" ").some((w) => w.startsWith(q))) score = 70;
    else if (commons.some((c) => c.split(" ").some((w) => w.startsWith(q)))) score = 60;
    else if (sci.includes(q) || commons.some((c) => c.includes(q))) score = 40;
    if (score) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || scientificName(a.entry).localeCompare(scientificName(b.entry)))
    .slice(0, limit)
    .map((s) => s.entry);
}

/** Same plant name, ignoring case, accents and apostrophes. */
export const sameName = (a: string, b: string) => fold(a.trim()) === fold(b.trim());

/** The catalogue entry a stored species string refers to, if any. */
export function findSpecies(name: string | null | undefined): SpeciesEntry | null {
  if (!name) return null;
  const n = fold(name.trim());
  return (
    SPECIES.find((e) => fold(scientificName(e)) === n) ??
    SPECIES.find((e) => e.common.some((c) => fold(c) === n)) ??
    SPECIES.find((e) => e.cultivar !== undefined && fold(e.cultivar) === n) ??
    null
  );
}

/**
 * The catalogue entry for an identification like { genus: "Monstera",
 * species: "deliciosa" }: the exact species when we have it, else the first
 * plant of that genus (its reminders are a fair default for its relatives).
 */
export function matchCandidate(candidate: {
  genus: string;
  species?: string | null;
  cultivar?: string | null;
}): SpeciesEntry | null {
  const genus = fold(candidate.genus.trim());
  if (!genus) return null;
  const sp = fold((candidate.species ?? "").trim());
  const cv = fold((candidate.cultivar ?? "").trim());
  const ofGenus = SPECIES.filter((e) => fold(e.genus) === genus);
  return (
    (cv ? ofGenus.find((e) => e.cultivar && fold(e.cultivar) === cv) : undefined) ??
    (sp ? ofGenus.find((e) => !e.cultivar && fold(e.species) === sp) : undefined) ??
    ofGenus.find((e) => !e.cultivar) ??
    ofGenus[0] ??
    null
  );
}
