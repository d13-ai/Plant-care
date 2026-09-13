// AI photo analysis: POST /analyze  { image, media_type, mode?, species_hint? }
//
// Sends one plant photo to Claude and returns a typed verdict — what the
// plant looks like, and what its health looks like. Only signed-in keepers
// can call it — the function checks the caller's session itself, since the
// gateway lets publishable-key requests through — and each keeper gets a
// daily cap so a single device can't run up the bill. Needs
// ANTHROPIC_API_KEY set as a function secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";

const DAILY_CAP = 20;
const MODEL = "claude-opus-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const Verdict = z.object({
  is_plant: z.boolean().describe("false if the photo doesn't clearly show a plant"),
  species: z
    .array(
      z.object({
        genus: z.string(),
        species: z.string().describe("specific epithet, or empty if unsure beyond genus"),
        common_name: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(3)
    .describe("most likely first; empty if not a plant"),
  health: z.object({
    overall: z.enum(["healthy", "watch", "unwell", "unknown"]),
    findings: z.array(
      z.object({
        observation: z.string().describe("what is visible, in plain words"),
        likely_cause: z.string(),
        suggested_action: z.string(),
        severity: z.enum(["low", "medium", "high"]),
      }),
    ),
  }),
  notes: z.string().describe("one or two sentences a keeper would find useful; empty if nothing to add"),
});
export type Verdict = z.infer<typeof Verdict>;

const SYSTEM = `You help people look after houseplants. You are shown one photo of a plant a keeper owns.
Identify it as precisely as the photo allows — give the genus and, if you're reasonably sure, the species — and be honest in the confidence numbers: 0.9 means near-certain, 0.4 means a guess among several look-alikes. Give up to three candidates, most likely first, and use the common name people in shops use.
Then read its health from what is actually visible: leaf colour and texture, spots, pests, drooping, soil, pot. Name only what you can see; say "unknown" when the photo doesn't show enough. For each finding give the likely cause and one concrete thing to do. Don't invent problems for a plant that looks fine.
If the photo isn't clearly a plant, say so and return no candidates.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Who's asking: the keeper behind the JWT the gateway already verified.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "Sign in first." }, 401);

  // Only now say whether the AI is wired up — a stranger doesn't get to learn that.
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "AI isn't set up for this project yet — add ANTHROPIC_API_KEY as a function secret." }, 503);

  let body: { image?: string; media_type?: string; mode?: string; species_hint?: string };
  try { body = await req.json(); } catch { return json({ error: "Expected JSON." }, 400); }
  const { image, media_type = "image/jpeg", mode = "both", species_hint } = body;
  if (!image || typeof image !== "string") return json({ error: "Missing image." }, 400);
  if (!["image/jpeg", "image/png", "image/webp"].includes(media_type)) return json({ error: "Unsupported image type." }, 400);
  if (image.length > 6_000_000) return json({ error: "Image too large — send it smaller." }, 413);

  // Daily cap, counted before the call so a burst can't slip past it.
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await admin.from("ai_usage").select("count").eq("keeper_id", user.id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
  const used = row?.count ?? 0;
  if (used >= DAILY_CAP) return json({ error: `That's ${DAILY_CAP} photos today — try again tomorrow.` }, 429);
  await admin.from("ai_usage").upsert({ keeper_id: user.id, day: new Date().toISOString().slice(0, 10), count: used + 1 });

  const ask =
    mode === "health"
      ? `Focus on this plant's health.${species_hint ? ` The keeper says it's a ${species_hint}; still identify it, but weight your health reading to that.` : ""}`
      : mode === "identify"
        ? "Focus on identifying this plant."
        : `Identify this plant and read its health.${species_hint ? ` The keeper thinks it's a ${species_hint}.` : ""}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(Verdict) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media_type as "image/jpeg" | "image/png" | "image/webp", data: image } },
            { type: "text", text: ask },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return json({ error: "The photo couldn't be analysed." }, 422);
    if (!response.parsed_output) return json({ error: "No usable answer came back — try another photo." }, 502);
    return json({ verdict: response.parsed_output, remaining: DAILY_CAP - used - 1 });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The AI key for this project isn't valid." }, 503);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "The AI is busy — try again in a minute." }, 503);
    return json({ error: err instanceof Error ? err.message : "Analysis failed." }, 502);
  }
});
