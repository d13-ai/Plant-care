// Care guide for a species: POST /care  { species }
//
// Returns a structured care card (light, water, humidity, soil, problems,
// toxicity…). Cards are shared across everyone and cached in care_cards, so
// the first lookup of a species generates it and the rest read it free. Only
// signed-in keepers can call it (the function checks the session itself, so
// the browser's CORS preflight isn't blocked). Generation counts against the
// same daily AI cap as photo analysis, and only on a cache miss.
//
// Before it pays for one, it looks harder (../_shared/care-names.ts): a
// common name we know finds its species' guide, and a cultivar finds its
// species' guide with a note saying so. The plant library's own care is
// loaded into care_cards with model "library" (scripts/care-library.mjs), so
// the common houseplants never reach the model at all. A name the model
// doesn't recognise as a plant is answered but never filed.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";
import { aiFailure } from "../_shared/ai-failure.ts";
import { aiOutcome } from "../_shared/ai-outcome.ts";
import { claimAiCall, refundAiCall, today } from "../_shared/cap.ts";
import { careKey, carePlan, cultivarNote, plausiblePlantName } from "../_shared/care-names.ts";
import { SPECIES_NAMES } from "../_shared/species-names.ts";

// Care text is general knowledge, not a hard vision task, so Sonnet is plenty
// and cheaper — and it's cached once per species anyway. AI_CARE_MODEL overrides.
const MODELS = ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5"] as const;
const MODEL = MODELS.find((m) => m === Deno.env.get("AI_CARE_MODEL")) ?? "claude-sonnet-5";
// Anthropic list prices, $ per million tokens, so each answer can say what
// it cost and the day's spend adds up in ai_usage. Update when prices move.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
const costOf = (model: string, input: number, output: number) => {
  const p = PRICES[model] ?? { input: 0, output: 0 };
  return (input * p.input + output * p.output) / 1_000_000;
};


const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const CareCard = z.object({
  recognized: z
    .boolean()
    .describe("false when the name isn't a plant you recognise (a typo, gibberish, not a plant); the guide is then not kept"),
  summary: z.string().describe("one plain sentence: what kind of plant and how demanding"),
  difficulty: z.enum(["easy", "moderate", "fussy"]),
  light: z.string().describe("light needs, in a sentence"),
  water: z.string().describe("how and how often to water, and how to tell"),
  humidity: z.string(),
  temperature: z.string().describe("comfortable range and what to avoid"),
  soil: z.string().describe("potting mix and drainage"),
  feeding: z.string().describe("fertilizer type and cadence in the growing season"),
  repotting: z.string().describe("how often and the signs it's time"),
  common_problems: z
    .array(z.object({ problem: z.string(), fix: z.string() }))
    .max(5)
    .describe("the handful most likely for this plant, each with what to do"),
  toxicity: z
    .string()
    .describe(
      "toxicity to cats, dogs and people, as the ASPCA's plant list classes it; say 'unconfirmed' when unsure; never call a plant safe for children or 'a safe choice'",
    ),
});
export type CareCard = Omit<z.infer<typeof CareCard>, "recognized">;

type CardRow = { species_key: string; species: string; card: CareCard; model: string };

/** A stored card as the app gets it: where it came from, and a note when it is the species' guide for a cultivar. */
const present = (card: CareCard, model: string, note?: string) => ({
  ...card,
  source: model === "library" ? "library" : "ai",
  ...(note ? { note } : {}),
});

const SYSTEM = `You are a knowledgeable houseplant grower writing a short, practical care guide for one plant a keeper owns. Be specific to this plant, not generic — a fern and a cactus should read nothing alike. Keep each field to a sentence or two of plain, actionable advice a beginner can follow. If the plant is a named variegated cultivar, account for it (variegated leaves need brighter light and grow slower). Be honest about difficulty.

On toxicity, be conservative, because a keeper may act on it with a pet or a child. Say what the ASPCA's plant list says for cats and dogs when you know it ("the ASPCA lists it as non-toxic to cats and dogs"), and what the symptoms are when it is toxic. If you are not sure, say it is unconfirmed rather than guessing it is safe. Never call a plant "safe for children", "child-safe", "a safe choice" or "harmless": the most a plant can be is non-toxic, and a pet or child can still be sick from eating any plant.

If the name isn't a plant you recognise — a typo, gibberish, something that isn't a plant — set recognized to false and keep every other field to a few words. Don't guess at a plant it might be.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "Sign in first." }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "AI isn't set up for this project yet — add ANTHROPIC_API_KEY as a function secret." }, 503);

  let body: { species?: string };
  try { body = await req.json(); } catch { return json({ error: "Expected JSON." }, 400); }
  const species = (body.species ?? "").trim();
  if (!species) return json({ error: "Which species?" }, 400);
  if (species.length > 120) return json({ error: "Species name too long." }, 400);
  if (!plausiblePlantName(species)) {
    return json({ error: "That doesn't look like a plant name. Check the spelling, or pick it from the list." }, 422);
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cache first — the common path, and free: the name as asked, then the
  // species a common name stands for, then the species a cultivar belongs to.
  const plan = carePlan(species, SPECIES_NAMES);
  const { data: rows } = await admin
    .from("care_cards")
    .select("species_key, species, card, model")
    .in("species_key", plan.lookups.map((l) => l.key));
  for (const lookup of plan.lookups) {
    const row = (rows as CardRow[] | null)?.find((r) => r.species_key === lookup.key);
    if (!row) continue;
    const note = lookup.via === "species" ? cultivarNote(species, row.species) : undefined;
    return json({ card: present(row.card, row.model, note), species: row.species, cached: true, matched: lookup.via });
  }

  // Miss: claim a slot against today's budget, then generate. Check and
  // increment happen in one locked statement, and a claim that can't be
  // recorded refuses the call rather than lifting the cap.
  const day = today();
  const claim = await claimAiCall(admin, user.id, day, "AI lookups");
  if (!claim.ok) return json({ error: claim.error }, claim.status);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(CareCard) },
      messages: [{ role: "user", content: `Write the care guide for: ${plan.generate.species}` }],
    });
    // Recorded before the answer is judged: a refusal costs what a guide
    // costs, and returning above this line spent money the table never saw.
    // See the same note in ../analyze/index.ts.
    const { input_tokens, output_tokens } = response.usage;
    const cost_usd = costOf(MODEL, input_tokens, output_tokens);
    console.log(JSON.stringify({ fn: "care", model: MODEL, species, wrote: plan.generate.species, recognized: response.parsed_output?.recognized ?? null, input_tokens, output_tokens, cost_usd: Number(cost_usd.toFixed(5)), stop_reason: response.stop_reason }));
    await admin.rpc("record_ai_usage", { p_keeper: user.id, p_day: day, p_input: input_tokens, p_output: output_tokens, p_cost: cost_usd });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return json({ error: "Couldn't write a care guide for that." }, 502);
    }
    const { recognized, ...card } = response.parsed_output;
    // Not a plant it knows: say so, and file nothing -- a guide to a typo
    // would be served to the next person who makes it.
    if (!recognized) {
      return json({ error: `We don't know a plant called “${species}”. Check the spelling, or pick it from the list.`, cost_usd }, 422);
    }
    // Cache for everyone, under the species it was written for. Ignore a
    // conflict if another request beat us to it.
    const written = plan.generate.species;
    await admin.from("care_cards").upsert({ species_key: careKey(written), species: written, card, model: MODEL }, { onConflict: "species_key" });
    const note = plan.generate.via === "species" ? cultivarNote(species, written) : undefined;
    return json({ card: present(card, MODEL, note), species: written, cached: false, cost_usd });
  } catch (err) {
    // The slot goes back only when the model cannot have run. A response
    // that arrived and then failed to validate was billed, and refunding it
    // lets a failing loop spend without limit. See _shared/ai-failure.ts.
    const failure = aiFailure(aiOutcome(err), "The care guide didn't come through.");
    const error = err instanceof Error ? err.message : String(err);
    if (failure.neverRan) {
      await refundAiCall(admin, user.id, day);
      console.error(JSON.stringify({ fn: "care", refused: true, error }));
    } else {
      console.error(JSON.stringify({ fn: "care", billed_but_unrecorded: true, error }));
    }
    return json({ error: failure.message }, failure.status);
  }
});
