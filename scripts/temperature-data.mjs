/**
 * Temperature, per genus: the one line a care guide carries that the plant
 * pages don't. Used by scripts/care-library.mjs, which turns the library into
 * the app's care guides.
 *
 * Kept apart from GENUS in plants-data.mjs on purpose. GENUS records inherit
 * (Mentha from Ocimum, Sempervivum from Echeveria), and temperature is the
 * field where that goes wrong: mint is not basil in the cold. So every genus
 * says its own, and care-library.test.mjs fails if one is missing.
 *
 * Same rule as the rest of the library: conservative. The low figure is a
 * floor to stay above, not a dare.
 */
export const TEMPERATURE = {
  // Aroids
  Monstera: "Comfortable at 65–85°F (18–29°C); keep it above 55°F (13°C) and out of cold drafts.",
  Philodendron: "Comfortable at 65–85°F (18–29°C); keep it above 55°F (13°C) and out of cold drafts.",
  Thaumatophyllum: "Comfortable at 65–85°F (18–29°C); tougher than most philodendrons, but keep it above 50°F (10°C).",
  Epipremnum: "Comfortable at 65–85°F (18–29°C); keep it above 55°F (13°C) and away from cold windows in winter.",
  Scindapsus: "Comfortable at 65–85°F (18–29°C); keep it above 60°F (15°C) — it sulks in a cold room.",
  Rhaphidophora: "Comfortable at 65–85°F (18–29°C); keep it above 55°F (13°C) and out of cold drafts.",
  Anthurium: "Comfortable at 65–85°F (18–29°C); keep it above 60°F (15°C) and away from drafts and heaters.",
  Alocasia: "Comfortable at 65–85°F (18–29°C); keep it above 60°F (15°C). A cold spell often makes it drop leaves and go dormant.",
  Colocasia: "Comfortable at 65–85°F (18–29°C); keep it above 50°F (10°C) — colder than that and it dies back to the corm.",
  Caladium: "Wants warmth: 70–85°F (21–29°C). Below about 60°F (15°C) it dies back to its tuber for the winter.",
  Zamioculcas: "Comfortable at 60–85°F (15–29°C); keep it above 50°F (10°C). Ordinary room temperatures suit it fine.",
  Spathiphyllum: "Comfortable at 65–80°F (18–27°C); keep it above 55°F (13°C) — cold drafts brown and collapse the leaves.",
  Aglaonema: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C). Chilled leaves get dark, water-soaked patches.",
  Dieffenbachia: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C) and out of cold drafts.",
  Syngonium: "Comfortable at 65–85°F (18–29°C); keep it above 60°F (15°C).",

  // Trees, shrubs and palms
  Ficus: "Comfortable at 60–80°F (15–27°C); keep it above 55°F (13°C). Drafts and sudden changes are what make figs drop leaves.",
  Schefflera: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Dracaena: "Comfortable at 65–80°F (18–27°C); keep it above 55°F (13°C) and away from cold windows.",
  Yucca: "Comfortable at 60–80°F (15–27°C) and tolerant of a cool room; keep it above 45°F (7°C).",
  Pachira: "Comfortable at 65–80°F (18–27°C); keep it above 55°F (13°C) and out of drafts.",
  Crassula: "Comfortable at 65–80°F (18–27°C). A cool winter around 50–55°F (10–13°C) helps it flower; keep it above 40°F (4°C) and frost-free.",
  Beaucarnea: "Comfortable at 60–85°F (15–29°C) and fine with a cool winter; keep it above 45°F (7°C).",
  Polyscias: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C). Drafts and cold make it drop leaves.",
  Fatsia: "Prefers it cool: 50–70°F (10–21°C). One of the few houseplants happier in a cool room than a warm one; fine down to 40°F (4°C).",
  Strelitzia: "Comfortable at 65–85°F (18–29°C); keep it above 50°F (10°C).",
  Musa: "Comfortable at 65–85°F (18–29°C); keep it above 55°F (13°C). Cold stops growth and scorches the leaves.",
  Chamaedorea: "Comfortable at 65–80°F (18–27°C); keep it above 55°F (13°C).",
  Dypsis: "Comfortable at 65–85°F (18–29°C); keep it above 60°F (15°C) and away from cold windows.",
  Howea: "Comfortable at 60–80°F (15–27°C); tolerates a cool room and stays happy above 50°F (10°C).",
  Rhapis: "Comfortable at 60–80°F (15–27°C) and tolerant of a cool room; keep it above 45°F (7°C).",
  Phoenix: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Livistona: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",

  // Trailers and climbers
  Hoya: "Comfortable at 65–85°F (18–29°C); keep it above 55°F (13°C).",
  Tradescantia: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Chlorophytum: "Comfortable at 55–80°F (13–27°C) and tolerant of a cool room; keep it above 45°F (7°C).",
  Hedera: "Prefers it cool: 50–70°F (10–21°C). Cold isn't the risk — a warm, dry room is, because that is where spider mites thrive.",
  Senecio: "Comfortable at 65–80°F (18–27°C) while growing and fine a little cooler in winter; keep it above 50°F (10°C).",
  Ceropegia: "Comfortable at 65–80°F (18–27°C) while growing and fine a little cooler in winter; keep it above 50°F (10°C).",
  Peperomia: "Comfortable at 65–80°F (18–27°C); keep it above 55°F (13°C) and off cold windowsills in winter.",
  Pilea: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Cissus: "Comfortable at 60–80°F (15–27°C) and tolerant of a cool room; keep it above 50°F (10°C).",

  // Prayer plants
  Maranta: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C). Cold drafts and sudden drops curl and brown the leaves.",
  Goeppertia: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C). Cold drafts and sudden drops curl and brown the leaves.",
  Calathea: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C). Cold drafts and sudden drops curl and brown the leaves.",
  Ctenanthe: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C) and out of cold drafts.",
  Stromanthe: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C) and out of cold drafts.",

  // Ferns
  Nephrolepis: "Comfortable at 60–75°F (15–24°C); keep it above 55°F (13°C). Hot, dry air near a heater does more harm than cool.",
  Adiantum: "Comfortable at 60–75°F (15–24°C); keep it above 55°F (13°C) and well away from heaters and drafts.",
  Asplenium: "Comfortable at 60–80°F (15–27°C); keep it above 55°F (13°C).",
  Platycerium: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Phlebodium: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Davallia: "Comfortable at 60–75°F (15–24°C); keep it above 50°F (10°C).",
  Asparagus: "Comfortable at 60–75°F (15–24°C); keep it above 50°F (10°C).",

  // Flowering foliage
  Begonia: "Comfortable at 65–75°F (18–24°C); keep it above 60°F (15°C) and out of drafts.",
  Saintpaulia: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C), and off a cold windowsill at night.",
  Streptocarpus: "Comfortable at 60–75°F (15–24°C); keep it above 55°F (13°C). It flags in hot summer rooms.",
  Episcia: "Comfortable at 65–85°F (18–29°C); keep it above 60°F (15°C).",

  // Succulents and cacti
  Echeveria: "Comfortable at 65–80°F (18–27°C) while growing; a cool, dry winter around 50–55°F (10–13°C) suits it. Keep it frost-free, above 40°F (4°C).",
  Haworthiopsis: "Comfortable at 65–80°F (18–27°C); fine a little cooler in winter. Keep it above 45°F (7°C).",
  Gasteria: "Comfortable at 65–80°F (18–27°C); fine a little cooler in winter. Keep it above 45°F (7°C).",
  Aloe: "Comfortable at 55–80°F (13–27°C); keep it frost-free, above 40°F (4°C).",
  Kalanchoe: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Sempervivum: "Frost-hardy — an outdoor plant at heart that does best with a cold winter. Indoors, give it the coolest bright spot you have.",
  Sedum: "Comfortable at 60–80°F (15–27°C); fine cooler in winter, but keep it frost-free, above 40°F (4°C).",
  Euphorbia: "Comfortable at 65–85°F (18–29°C); keep it above 50°F (10°C). Cold, wet soil is what rots it.",
  Schlumbergera: "Comfortable at 60–75°F (15–24°C). Cool autumn nights around 50–60°F (10–15°C) help it set buds; keep it above 45°F (7°C).",
  Opuntia: "Comfortable at 65–90°F (18–32°C) while growing; a cool, dry winter at 40–50°F (4–10°C) is fine. Keep it frost-free.",
  Mammillaria: "Comfortable at 65–85°F (18–29°C) while growing; a cool, dry winter around 45–55°F (7–13°C) encourages flowers.",
  Cereus: "Comfortable at 65–85°F (18–29°C) while growing; fine cooler and dry in winter. Keep it above 45°F (7°C).",
  Epiphyllum: "Comfortable at 60–80°F (15–27°C). A cooler winter around 50–55°F (10–13°C) encourages buds; keep it above 45°F (7°C).",
  Rhipsalis: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Lithops: "Comfortable at 65–80°F (18–27°C); fine down to 40°F (4°C) if kept dry, but never frost.",

  // Orchids
  Phalaenopsis: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C). Nights about 10°F (5–6°C) cooler for a few weeks in autumn help it rebloom.",
  Dendrobium: "Comfortable at 60–80°F (15–27°C). Nobile types need cool autumn nights around 50–55°F (10–13°C) to set flowers.",
  Cattleya: "Comfortable at 65–85°F (18–29°C) by day with nights around 55–65°F (13–18°C); keep it above 55°F (13°C).",

  // Flowering plants
  Gardenia: "Comfortable at 65–75°F (18–24°C) by day and a little cooler at night. Sudden swings and drafts make it drop its buds.",
  Jasminum: "Comfortable at 60–75°F (15–24°C). Pink jasmine needs a cool spell — around 40–50°F (4–10°C) for several weeks in winter — to flower.",
  Hibiscus: "Comfortable at 60–85°F (15–29°C); keep it above 50°F (10°C). Cold makes it drop buds and leaves.",
  Cyclamen: "Likes it cool: 50–65°F (10–18°C). A warm room is what usually finishes a cyclamen — much above 70°F (21°C) it yellows and goes dormant.",
  Clivia: "Comfortable at 60–75°F (15–24°C). A cool, dry rest around 50–55°F (10–13°C) for six to eight weeks in winter helps it flower.",
  Hippeastrum: "Comfortable at 65–75°F (18–24°C) while growing; a cooler room makes the flowers last longer. Keep it above 50°F (10°C).",
  Guzmania: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C).",
  Aechmea: "Comfortable at 65–80°F (18–27°C); keep it above 55°F (13°C).",
  Tillandsia: "Comfortable at 60–85°F (15–29°C); keep it above 50°F (10°C).",

  // Herbs and edibles
  Ocimum: "Wants warmth: 65–85°F (18–29°C). Below about 50°F (10°C) the leaves blacken, so never leave it on a cold windowsill overnight.",
  Mentha: "Comfortable at 55–75°F (13–24°C) and tolerant of cool; mint is hardy outdoors, so a chilly windowsill is no threat.",
  Rosmarinus: "Comfortable at 55–75°F (13–24°C). In winter it wants bright and cool, around 45–60°F (7–15°C); a warm, dry room is what kills indoor rosemary.",
  Citrus: "Comfortable at 60–80°F (15–27°C), and fine with a cool, bright winter; keep it above 45°F (7°C).",
  Coffea: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C) and away from cold windows.",

  // Colourful foliage
  Codiaeum: "Comfortable at 65–85°F (18–29°C); keep it above 60°F (15°C). Cold drafts make a croton drop its leaves.",
  Cordyline: "Comfortable at 65–80°F (18–27°C); keep it above 55°F (13°C).",
  Fittonia: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C) and out of drafts.",
  Hypoestes: "Comfortable at 65–80°F (18–27°C); keep it above 60°F (15°C).",
  Oxalis: "Comfortable at 60–75°F (15–24°C); keep it above 50°F (10°C). Long spells of heat or cold can send it dormant.",

  // Tough and unusual
  Aspidistra: "One of the most forgiving: fine anywhere from 45–85°F (7–29°C).",
  Cyperus: "Comfortable at 60–80°F (15–27°C); keep it above 50°F (10°C).",
  Soleirolia: "Prefers it cool: 55–75°F (13–24°C). Warm rooms dry it out fast; it tolerates cold down to about 45°F (7°C).",
  Bambusa: "Comfortable at 60–85°F (15–29°C); keep it above 50°F (10°C).",
};
