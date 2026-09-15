# PlantParlour — Plant data: what we use and why

*A reply to the "Plant Data Source Reference" note. Context for the build team
and for Amanda: what the app already does for plant data, what a hands-on look
at Perenual showed, and the recommendation.*

## What the app does today

Two layers, both already live:

1. **A curated species catalogue** (`src/domain/species.ts`): ~135 houseplants
   and ~110 named cultivars and variegations — Thai Constellation, Albo, Pink
   Princess, Dragon Scale, Raven ZZ — each with the watering, feeding,
   repotting and photo cadences that suit it. It powers the species picker and
   sets a plant's reminders the moment it's named.
2. **AI care guides, generated once and shared** (`supabase/functions/care`):
   the first keeper to open a species pays a couple of cents and waits ~15 s;
   every keeper after reads the same card instantly and free. Each card is
   cultivar-aware and explains *why* — light, water, humidity, soil recipe,
   feeding, repotting, the problems that species is prone to with fixes, and
   toxicity to pets and children.

Cost so far for the ten species below: about 20¢, once, for everyone.

## Hands-on: Perenual vs our guides, ten species

Five everyday plants and five collector plants, through both. (Perenual's
public species pages carry the same data as its API; we did not buy a key.)

| Species | Perenual | Our guide |
|---|---|---|
| Monstera deliciosa 'Thai Constellation' | No cultivar entry. Nearest is a generic "Variegated Swiss Cheese Plant" — sunlight *"full sun (if soil kept moist)"*, water *"weekly, every two weeks in winter"*. | Cultivar-specific: cream tissue can't photosynthesise so it needs more light but scorches; more rot-prone than green Monstera; reversion and how to prune it back. |
| Philodendron 'Pink Princess' | Yes — a decent cultivar page: watering "average", part shade, care level medium, toxic to pets, three short tips. | Same facts plus the ones collectors ask: 6–8 h of bright light to hold the pink, what reversion looks like, why all-white leaves are pruned off. |
| Alocasia baginda 'Dragon Scale' | Not found. | Full card ("fussy"): humidity 60%+, dormancy after repotting is normal, spider mites in dry air. |
| Anthurium clarinervium | Not found. | Full card. |
| Zamioculcas zamiifolia 'Raven' | Yes (species and cultivar). | Full card, incl. why new growth emerges lime green. |
| Calathea orbifolia | Not found. | Full card, incl. tap-water sensitivity (the usual killer). |
| Epipremnum aureum (pothos) | Yes. | Full card. |
| Ficus lyrata | Yes. | Full card. |
| Hoya carnosa | Yes. | Full card, incl. blooming from old spurs. |
| Dracaena trifasciata (snake plant) | Yes. | Full card. |

What Perenual does well: a consistent set of **structured attributes** —
watering band, sunlight band, care level, growth rate, hardiness zone,
propagation methods, indoor flag, toxicity flags — and CC-licensed images.
That's a real strength for a general gardening app.

What it doesn't do for us: the **collector plants are the gap** (3 of 5
missing, the fourth generic), and where it has a page the guidance is a
paragraph of general advice rather than what that cultivar needs.

Terms: the free tier is **non-commercial**, 100 requests/day, care guides only
for species IDs 1–3000. Commercial use starts at **$59.99/month** (10,000
requests/day). For comparison, our approach costs about 2¢ per species, once.

## USDA PLANTS

Amanda's own caveat is the decisive one: it's the flora of the United States.
It has nothing on monsteras, philodendrons or alocasias — the plants this app
is about. It's the right source for a native-plant or agriculture product,
not this one. GBIF is taxonomy and occurrence, not care.

## Recommendation

1. **Keep the catalogue + cached AI guides as the care source.** It's more
   specific for collectors, cheaper, and already live.
2. **Add GBIF's free name-matching** (`api.gbif.org/v1/species/match`, no key)
   to validate and normalise scientific names for species *outside* our
   catalogue — correct spelling, accepted name vs synonym (Calathea →
   Goeppertia), family — and cite it on the card. This is the "authoritative
   backbone" the note was after, for the plants we actually have.
3. **Use the ASPCA toxic/non-toxic plant list as the pet-safety reference**,
   checked against the AI's toxicity line, and cite it.
4. **Skip USDA PLANTS.** Revisit Perenual only if we want its structured
   attributes (hardiness zone, propagation methods) for an outdoor or
   marketplace feature — as a supplement on the paid tier, not the backbone.

*Method note: Perenual coverage was checked through its public species pages
and web search, not an authenticated API crawl; treat "not found" as
"not surfaced", indicative rather than exhaustive.*
