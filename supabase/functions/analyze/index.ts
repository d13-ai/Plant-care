// AI photo analysis: POST /analyze  { images: [{ data, media_type, taken_at? }], mode?, species_hint?, care_brief?, known? }
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
/**
 * A health check on a plant the keeper has already named does not need the
 * skill Opus is here for. What made Opus the default is cultivar-grade
 * identification -- naming a Thai Constellation rather than an Albo -- and a
 * keeper asking "why are the leaves yellowing on my Monstera" has already
 * told us which plant it is. Reading a leaf is the cheaper job.
 *
 * So `mode: "health"` runs on Sonnet: $2/$10 per million against $5/$25, or
 * about 40% of the cost, on what will be the commonest scan once somebody's
 * collection is photographed. Identification keeps Opus.
 *
 * Overridable with AI_HEALTH_MODEL, and an explicit `model` in the request
 * still wins over both, so the two can be compared on the same photo.
 */
const HEALTH_MODEL = MODELS.find((m) => m === Deno.env.get("AI_HEALTH_MODEL")) ?? "claude-sonnet-5";
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
When the keeper's care record is given, treat it as fact — it is what they logged, not a guess from the photo — and read the photo in its light: wet soil eleven days after a repot means something different from wet soil on a plant watered twice this week. Weigh it against what you see, say plainly where the two disagree, and never repeat a piece of the record back as a finding on its own.
When a photo's date is given, use it: say whether something has spread, held or improved between one photo and another, and between the photos and any issue already on the record. That comparison is what a keeper wants on a second look, and only the dates make it possible.
Say so plainly when the photo itself is the limit — leaves thick with dust, a picture taken at night under a warm lamp, motion blur, a plant too far from the camera. Name it as a finding and say which of your other findings it makes unreliable. A confident reading of a photograph you cannot actually read is worse than no reading.
You are told to take the keeper's species as given, and you should — but if the plant in the photo plainly is not that species, say so in the notes and name what you think it is. Health advice keyed to the wrong plant is wrong advice, and a keeper who has mislabelled something would rather find out.
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
    mode?: string; species_hint?: unknown; care_brief?: unknown; model?: string; known?: unknown;
  };
  try { body = await req.json(); } catch { return json({ error: "Expected JSON." }, 400); }
  const { mode = "both" } = body;
  // Bounded like every other input: it is interpolated into the prompt,
  // and an unbounded one lets a caller choose how many input tokens the
  // owner is billed for. 120 chars is what `care` allows for a species.
  const species_hint = boundedText(body.species_hint, 120);
  // What the keeper's own record says about this plant — when it was watered,
  // repotted, fed, and what is unresolved. The app builds it (src/domain/care-brief.ts)
  // and bounds it to 600; bounded again here, because the app is not the only
  // thing that can call this.
  const care_brief = mode === "health" ? boundedText(body.care_brief, 600) : "";
  const MEDIA = ["image/jpeg", "image/png", "image/webp"];
  type Img = { data: string; media_type: "image/jpeg" | "image/png" | "image/webp"; taken_at?: string };
  const images: Img[] = [];
  const raw = Array.isArray(body.images) ? body.images : body.image ? [{ data: body.image, media_type: body.media_type ?? "image/jpeg" }] : [];
  for (const r of raw.slice(0, 3)) {
    const data = (r as { data?: unknown })?.data;
    const media_type = (r as { media_type?: unknown })?.media_type ?? "image/jpeg";
    if (typeof data !== "string" || !data) return json({ error: "Missing image." }, 400);
    if (typeof media_type !== "string" || !MEDIA.includes(media_type)) return json({ error: "Unsupported image type." }, 400);
    if (data.length > 6_000_000) return json({ error: "Image too large — send it smaller." }, 413);
    const taken = (r as { taken_at?: unknown })?.taken_at;
    images.push({
      data,
      media_type: media_type as Img["media_type"],
      taken_at: typeof taken === "string" ? taken : undefined,
    });
  }
  if (!images.length) return json({ error: "Missing image." }, 400);
  // Cultivar names the app's catalogue knows — a short, bounded list.
  const known = Array.isArray(body.known)
    ? body.known.filter((k): k is string => typeof k === "string" && k.length <= 60).slice(0, 200)
    : [];
  // A request may pick a model from the allow-list — for comparing answers on
  // the same photo. The daily cap bounds what that can cost.
  const MODEL = MODELS.find((m) => m === body.model)
    ?? (mode === "health" ? HEALTH_MODEL : DEFAULT_MODEL);

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
      ? `Focus on this plant's health.${species_hint ? ` The keeper keeps it as a ${species_hint} — take that as given and read its health in that light, rather than re-identifying it.` : ""}`
      : mode === "identify"
        ? "Focus on identifying this plant."
        : `Identify this plant and read its health.${species_hint ? ` The keeper thinks it's a ${species_hint}.` : ""}`;
  const several = images.length > 1
    ? ` There are ${images.length} photos of the same plant: identify it from the first, the whole plant, and read its health from all of them — the close-ups especially.`
    : "";
  const askWithKnown = known.length
    ? `${ask}${several}\n\nCultivar names the keeper's app tracks (prefer these names when one fits; the list isn't exhaustive): ${known.join("; ")}.`
    : `${ask}${several}`;
  const askWithRecord = care_brief ? `${askWithKnown}\n\n${care_brief}` : askWithKnown;
  // "taken 5 days ago" turns a pile of pictures into a sequence. Without it a
  // model shown two photos of the same leaf cannot say whether a mark grew;
  // with it, the commonest question on a second check becomes answerable.
  const DAY = 86_400_000;
  const when = (iso?: string) => {
    if (!iso) return "";
    const then = Date.parse(iso);
    if (!Number.isFinite(then)) return "";
    const d = Math.max(0, Math.round((Date.now() - then) / DAY));
    return d === 0 ? ", taken today" : d === 1 ? ", taken yesterday" : `, taken ${d} days ago`;
  };
  const label = (i: number) => {
    const base = i === 0 ? (images.length > 1 ? "Photo 1 — the whole plant" : "The photo") : `Photo ${i + 1} — a closer look`;
    return `${base}${when(images[i].taken_at)}:`;
  };

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
            { type: "text", text: askWithRecord },
          ],
        },
      ],
    });
    // Recorded the moment an answer exists, BEFORE anything is checked about
    // whether it is usable. A refusal and an unparseable answer both cost the
    // same as a good one -- the model ran -- and both used to return above
    // this line, so the money was spent and `ai_usage` never heard about it.
    // Half of one month's Console bill was missing from our own table because
    // of it. What we record has to be what Anthropic charges, or nothing
    // downstream (the cap, docs/PRICING.md, "what did that cost") is true.
    const { input_tokens, output_tokens } = response.usage;
    const cost_usd = costOf(MODEL, input_tokens, output_tokens);
    console.log(JSON.stringify({ fn: "analyze", model: MODEL, effort: EFFORT, mode, photos: images.length, brief: care_brief.length, input_tokens, output_tokens, cost_usd: Number(cost_usd.toFixed(5)), stop_reason: response.stop_reason }));
    await admin.rpc("record_ai_usage", { p_keeper: user.id, p_day: day, p_input: input_tokens, p_output: output_tokens, p_cost: cost_usd });

    if (response.stop_reason === "refusal") return json({ error: "The photo couldn't be analysed." }, 422);
    if (!response.parsed_output) return json({ error: "No usable answer came back — try another photo." }, 502);
    return json({ verdict: response.parsed_output, remaining: claim.remaining, photos_left: photos.left, model: MODEL, effort: EFFORT, usage: { input_tokens, output_tokens }, cost_usd });
  } catch (err) {
    // Give the slot back only when the model cannot have run. An auth
    // failure, a rate limit or a connection that never opened cost nothing,
    // so the keeper keeps their allowance. Anything else -- a validation
    // error on a response that did arrive, a timeout while reading it --
    // was billed by Anthropic whether or not we could use it, and handing
    // the allowance back there is how a failing loop gets to spend money
    // forever without ever running out of allowance.
    const neverRan =
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.APIConnectionError;
    if (neverRan) {
      await refundAiCall(admin, user.id, day);
      await refundPhotoCall(admin, user.id);
    } else {
      console.error(JSON.stringify({ fn: "analyze", billed_but_unrecorded: true, error: err instanceof Error ? err.message : String(err) }));
    }
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The AI key for this project isn't valid." }, 503);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "The AI is busy — try again in a minute." }, 503);
    return json({ error: err instanceof Error ? err.message : "Analysis failed." }, 502);
  }
});
