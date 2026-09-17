// AI photo analysis: POST /analyze  { images: [{ data, media_type }], mode?, species_hint?, known? }
// (or the older single { image, media_type }). Up to three photos of the
// same plant: the whole plant first, then close-ups; one call, one answer.
//
// Sends one plant photo to Claude and returns a typed verdict — what the
// plant looks like, and what its health looks like. Only signed-in keepers
// can call it — the function checks the caller's session itself, since the
// gateway lets publishable-key requests through — and every call claims a
// slot from two budgets: the keeper's own for the day, and the project's.
// The second one is what actually bounds the bill, because a new anonymous
// keeper is free to mint; see _shared/cap.ts. Needs ANTHROPIC_API_KEY set as
// a function secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";
import { boundedText, claimAiCall, claimPhotoCall, refundAiCall, refundPhotoCall, today } from "../_shared/cap.ts";

// Model and effort can be overridden by function secrets without a
// redeploy: AI_MODEL (claude-opus-5 | claude-sonnet-5 | claude-haiku-4-5)
// and AI_EFFORT (low | medium | high). Opus 5 is the default: on five real
// photos it named every plant, cultivars included (Thai Constellation,
// White Princess); Sonnet got two, calling the Thai Con an Albo. About 3¢ a
// photo versus 1¢ — the difference a collector notices is worth it.
const MODELS = ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5"] as const;
const DEFAULT_MODEL = MODELS.find((m) => m === Deno.env.get("AI_MODEL")) ?? "claude-opus-5";
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

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
const EFFORT = EFFORTS.find((e) => e === Deno.env.get("AI_EFFORT")) ?? "medium";

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
        cultivar: z.string().describe("named cultivar or variegation if it's recognisable — 'Thai Constellation', 'Albo Variegata', 'Marble Queen', 'Pink Princess' — else empty"),
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
Identify the plant that fills the frame — the one in the pot at the centre. Other plants at the edges are neighbours, not candidates, unless the main one isn't clear.
Identify it as precisely as the photo allows — give the genus and, if you're reasonably sure, the species — and be honest in the confidence numbers: 0.9 means near-certain, 0.4 means a guess among several look-alikes. Give up to three candidates, most likely first, and use the common name people in shops use. Collectors care about varieties: if the variegation or leaf form marks a known cultivar (cream splashes on a monstera — Thai Constellation or Albo; a pink-splashed philodendron — Pink Princess), name it, and say which when two look alike.
Decide between look-alikes on diagnostic features, not overall impression: leaf margin (toothed or serrated edges on a variegated philodendron point to 'Ring of Fire', smooth lobed edges to 'Golden Dragon' or 'Florida Beauty'), lobing, petiole colour and texture, the colours in the variegation (orange and pink tones as well as cream), leaf shape at maturity. Say in the notes which feature decided it.
When the keeper's app lists the cultivar names it tracks, prefer those names and spellings whenever one fits — they are the plants this keeper is likely to own — but don't force a match that the photo doesn't support.
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

  let body: {
    image?: string; media_type?: string; images?: unknown;
    mode?: string; species_hint?: unknown; model?: string; known?: unknown;
  };
  try { body = await req.json(); } catch { return json({ error: "Expected JSON." }, 400); }
  const { mode = "both" } = body;
  // Bounded like every other input: it is interpolated into the prompt,
  // and an unbounded one lets a caller choose how many input tokens the
  // owner is billed for. 120 chars is what `care` allows for a species.
  const species_hint = boundedText(body.species_hint, 120);
  const MEDIA = ["image/jpeg", "image/png", "image/webp"];
  type Img = { data: string; media_type: "image/jpeg" | "image/png" | "image/webp" };
  const images: Img[] = [];
  const raw = Array.isArray(body.images) ? body.images : body.image ? [{ data: body.image, media_type: body.media_type ?? "image/jpeg" }] : [];
  for (const r of raw.slice(0, 3)) {
    const data = (r as { data?: unknown })?.data;
    const media_type = (r as { media_type?: unknown })?.media_type ?? "image/jpeg";
    if (typeof data !== "string" || !data) return json({ error: "Missing image." }, 400);
    if (typeof media_type !== "string" || !MEDIA.includes(media_type)) return json({ error: "Unsupported image type." }, 400);
    if (data.length > 6_000_000) return json({ error: "Image too large — send it smaller." }, 413);
    images.push({ data, media_type: media_type as Img["media_type"] });
  }
  if (!images.length) return json({ error: "Missing image." }, 400);
  // Cultivar names the app's catalogue knows — a short, bounded list.
  const known = Array.isArray(body.known)
    ? body.known.filter((k): k is string => typeof k === "string" && k.length <= 60).slice(0, 200)
    : [];
  // A request may pick a model from the allow-list — for comparing answers on
  // the same photo. The daily cap bounds what that can cost.
  const MODEL = MODELS.find((m) => m === body.model) ?? DEFAULT_MODEL;

  // Daily cap, claimed before the call so a burst can't slip past it. One
  // locked statement checks and increments, and a claim that can't be
  // recorded refuses the call instead of lifting the cap.
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const day = today();
  // The lifetime trial first: it is the one a keeper runs out of, and being
  // told so before the day's budget is spent on them is the clearer message.
  const photos = await claimPhotoCall(admin, user.id);
  if (!photos.ok) return json({ error: photos.error }, photos.status);

  const claim = await claimAiCall(admin, user.id, day, "photos");
  if (!claim.ok) {
    // The day's budget stopped this, not the trial — so put the trial back.
    await refundPhotoCall(admin, user.id);
    return json({ error: claim.error }, claim.status);
  }

  const ask =
    mode === "health"
      ? `Focus on this plant's health.${species_hint ? ` The keeper says it's a ${species_hint}; still identify it, but weight your health reading to that.` : ""}`
      : mode === "identify"
        ? "Focus on identifying this plant."
        : `Identify this plant and read its health.${species_hint ? ` The keeper thinks it's a ${species_hint}.` : ""}`;
  const several = images.length > 1
    ? ` There are ${images.length} photos of the same plant: identify it from the first, the whole plant, and read its health from all of them — the close-ups especially.`
    : "";
  const askWithKnown = known.length
    ? `${ask}${several}\n\nCultivar names the keeper's app tracks (prefer these names when one fits; the list isn't exhaustive): ${known.join("; ")}.`
    : `${ask}${several}`;
  const label = (i: number) => (i === 0 ? (images.length > 1 ? "Photo 1 — the whole plant:" : "The photo:") : `Photo ${i + 1} — a closer look:`);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { effort: EFFORT, format: zodOutputFormat(Verdict) },
      messages: [
        {
          role: "user",
          content: [
            ...images.flatMap((img, i) => [
              { type: "text" as const, text: label(i) },
              { type: "image" as const, source: { type: "base64" as const, media_type: img.media_type, data: img.data } },
            ]),
            { type: "text", text: askWithKnown },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return json({ error: "The photo couldn't be analysed." }, 422);
    if (!response.parsed_output) return json({ error: "No usable answer came back — try another photo." }, 502);
    // Token counts and cost ride along, and the day's totals are recorded,
    // so cost per photo is measured, not guessed.
    const { input_tokens, output_tokens } = response.usage;
    const cost_usd = costOf(MODEL, input_tokens, output_tokens);
    console.log(JSON.stringify({ fn: "analyze", model: MODEL, effort: EFFORT, mode, photos: images.length, input_tokens, output_tokens, cost_usd: Number(cost_usd.toFixed(5)) }));
    await admin.rpc("record_ai_usage", { p_keeper: user.id, p_day: day, p_input: input_tokens, p_output: output_tokens, p_cost: cost_usd });
    return json({ verdict: response.parsed_output, remaining: claim.remaining, photos_left: photos.left, model: MODEL, effort: EFFORT, usage: { input_tokens, output_tokens }, cost_usd });
  } catch (err) {
    // Nothing was generated, so the slot goes back.
    await refundAiCall(admin, user.id, day);
    await refundPhotoCall(admin, user.id);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The AI key for this project isn't valid." }, 503);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "The AI is busy — try again in a minute." }, 503);
    return json({ error: err instanceof Error ? err.message : "Analysis failed." }, 502);
  }
});
