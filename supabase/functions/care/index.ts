// Care guide for a species: POST /care  { species }
//
// Returns a structured care card (light, water, humidity, soil, problems,
// toxicity…). Cards are shared across everyone and cached in care_cards, so
// the first lookup of a species generates it and the rest read it free. Only
// signed-in keepers can call it (the function checks the session itself, so
// the browser's CORS preflight isn't blocked). Generation counts against the
// same daily AI cap as photo analysis, and only on a cache miss.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";

const DAILY_CAP = 20;
// Care text is general knowledge, not a hard vision task, so Sonnet is plenty
// and cheaper — and it's cached once per species anyway. AI_CARE_MODEL overrides.
const MODELS = ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5"] as const;
const MODEL = MODELS.find((m) => m === Deno.env.get("AI_CARE_MODEL")) ?? "claude-sonnet-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const CareCard = z.object({
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
  toxicity: z.string().describe("safe or toxic to cats, dogs, children — say which and how"),
});
export type CareCard = z.infer<typeof CareCard>;

const SYSTEM = `You are a knowledgeable houseplant grower writing a short, practical care guide for one plant a keeper owns. Be specific to this plant, not generic — a fern and a cactus should read nothing alike. Keep each field to a sentence or two of plain, actionable advice a beginner can follow. If the plant is a named variegated cultivar, account for it (variegated leaves need brighter light and grow slower). Be honest about difficulty and about toxicity to pets and children.`;

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

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
  const speciesKey = key(species);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cache first — the common path, and free.
  const { data: hit } = await admin.from("care_cards").select("card, species").eq("species_key", speciesKey).maybeSingle();
  if (hit) return json({ card: hit.card, species: hit.species, cached: true });

  // Miss: count it against today's cap, then generate.
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await admin.from("ai_usage").select("count").eq("keeper_id", user.id).eq("day", day).maybeSingle();
  const used = row?.count ?? 0;
  if (used >= DAILY_CAP) return json({ error: `That's ${DAILY_CAP} AI lookups today — try again tomorrow.` }, 429);
  await admin.from("ai_usage").upsert({ keeper_id: user.id, day, count: used + 1 });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(CareCard) },
      messages: [{ role: "user", content: `Write the care guide for: ${species}` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return json({ error: "Couldn't write a care guide for that." }, 502);
    }
    const card = response.parsed_output;
    // Cache for everyone. Ignore a conflict if another request beat us to it.
    await admin.from("care_cards").upsert({ species_key: speciesKey, species, card, model: MODEL }, { onConflict: "species_key" });
    return json({ card, species, cached: false });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The AI key for this project isn't valid." }, 503);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "The AI is busy — try again in a minute." }, 503);
    return json({ error: err instanceof Error ? err.message : "Couldn't write a care guide." }, 502);
  }
});
