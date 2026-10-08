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
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "npm:zod";
import { callCost } from "../_shared/ai-cost.ts";
import { boundedText, claimAiCall, claimPhotoCall, refundAiCall, refundPhotoCall, today } from "../_shared/cap.ts";

// Model and effort can be overridden by function secrets without a
// redeploy: AI_MODEL (claude-opus-5-5 | claude-opus-5 | claude-sonnet-5-5 |
// claude-sonnet-5 | claude-haiku-4-5) and AI_EFFORT (low | medium | high). Opus is the
// default: on five real photos Opus 5 named every plant, cultivars included
// (Thai Constellation, White Princess); Sonnet got two, calling the Thai Con
// an Albo. About 3¢ a photo versus 1¢ — the difference a collector notices
// is worth it.
//
// Opus 5.5 since 4 Oct 2026: the newer Opus at $4/$20 against Opus 5's
// $5/$25. It always thinks -- there is no switch for it -- and it tends to
// think a little more per answer than Opus 5 at the same effort, so a
// photo costs about what it did rather than a fifth less. Opus 5 stays on
// the list so AI_MODEL can put it back without a redeploy.
const MODELS = ["claude-sonnet-5-5", "claude-sonnet-5", "claude-opus-5-5", "claude-opus-5", "claude-haiku-4-5"] as const;
const DEFAULT_MODEL = MODELS.find((m) => m === Deno.env.get("AI_MODEL")) ?? "claude-opus-5-5";
/**
 * A health check on a plant the keeper has already named does not need the
 * skill Opus is here for. What made Opus the default is cultivar-grade
 * identification -- naming a Thai Constellation rather than an Albo -- and a
 * keeper asking "why are the leaves yellowing on my Monstera" has already
 * told us which plant it is. Reading a leaf is the cheaper job.
 *
 * So `mode: "health"` runs on Sonnet: $2/$10 per million against $4/$20, or
 * about half the cost, on what will be the commonest scan once somebody's
 * collection is photographed. Identification keeps Opus.
 *
 * Sonnet 5.5 since 8 Oct 2026, at Sonnet 5's price. Compared on ten of the
 * owner's plants against Opus 5.5 and Haiku 5.5 (docs/PRICING.md): it read
 * the problems about as well as Opus, and like Opus it said so when a plant
 * was filed under the wrong species -- which Haiku did not. Sonnet 5 stays on
 * the list so AI_HEALTH_MODEL can put it back without a redeploy.
 *
 * Overridable with AI_HEALTH_MODEL, and an explicit `model` in the request
 * still wins over both, so the two can be compared on the same photo.
 */
const HEALTH_MODEL = MODELS.find((m) => m === Deno.env.get("AI_HEALTH_MODEL")) ?? "claude-sonnet-5-5";
/**
 * A model's safety filters can decline a request, and a plant photo is not
 * immune -- a decline used to reach the keeper as "couldn't be analysed",
 * billed, with one of their five trial identifications gone. With
 * `fallbacks: "default"` Anthropic re-runs a declined request on the model it
 * recommends for that kind of decline, inside the same call. Haiku has no
 * server-side fallback, so it is asked without one.
 */
const FALLBACK_MODELS: readonly string[] = ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"];
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

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
        // Everything in `findings` used to be called a finding, which left the
        // app unable to tell "half this leaf is dead" from "the other leaves
        // look fine" from "these leaves are too dusty to read". A keeper
        // pressing "log all" got all three on the record as open problems.
        kind: z
          .enum(["problem", "observation", "photo_quality"])
          .describe(
            "problem = something is wrong with the plant and a keeper might act on it; " +
              "observation = this part of the plant is fine, said so the keeper knows you looked; " +
              "photo_quality = a limit of the photograph itself, not of the plant",
          ),
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
Variegated plants: white or cream tissue has no chlorophyll, so it feeds nothing. New leaves coming in mostly or entirely white (a Birkin, a Thai Constellation, an Albo, a Marble Queen) mean the variegation is drifting towards white, and such leaves tend to brown and die off sooner, not that the plant is tolerating its light well. Treat a run of mostly-white new leaves as something to watch, and say what to do if it continues (cut back to a node below a leaf with good variegation). The same goes the other way: new leaves coming in solid green are reverting. Brown, dry tissue on the white parts first is that tissue failing, or scorched by sun through glass; say which the photo supports.
When the record includes what earlier AI health checks said, those are readings, not facts — they may have been wrong. Don't simply repeat them, and don't contradict them silently: where your reading differs from an earlier one, say so in the notes, which one you think is right and why, so the keeper isn't left holding two opposite pieces of advice.
Mark each finding with its kind. A problem is something wrong with the plant that a keeper might act on; an observation is a part of the plant that is fine, worth saying so they know you looked at it; photo_quality is a limit of the photograph rather than of the plant. Be strict about it: "the new leaf is unfurling and looks healthy" is an observation however welcome it is, and a keeper should never end up with it on their record as an unresolved problem.
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
  // repotted and fed, every issue still open, and their own notes on the pot
  // and mix. The app builds it (src/domain/care-brief.ts) and bounds it to
  // CARE_BRIEF_MAX; bounded again here, because the app is not the only thing
  // that can call this. Keep the two numbers equal: this one was left at 600
  // when the app moved to 1200, which would have quietly cut every brief off
  // mid-issue and dropped the pot notes entirely. 2000 since earlier AI
  // checks started riding along (two, at most 320 characters each).
  const care_brief = mode === "health" ? boundedText(body.care_brief, 2000) : "";
  const MEDIA = ["image/jpeg", "image/png", "image/webp"];
  // `role: "earlier"` marks a photo sent only to compare against (the app
  // sends it smaller); anything else is the plant as it is now. Older app
  // builds send no role, and get exactly what they always did.
  type Img = { data: string; media_type: "image/jpeg" | "image/png" | "image/webp"; taken_at?: string; earlier: boolean };
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
      earlier: (r as { role?: unknown })?.role === "earlier",
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
  const nowCount = images.filter((img) => !img.earlier).length;
  const several =
    (nowCount > 1
      ? ` There are ${nowCount} photos of the plant as it is now: identify it from the first, the whole plant, and read its health from all of them — the close-ups especially.`
      : "") +
    (nowCount < images.length
      ? " The last photo is an earlier one of the same plant, sent smaller, only so you can say what has changed since: read its health now from the current photo" +
        (nowCount > 1 ? "s" : "") + ", and use the earlier one for the comparison."
      : "");
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
    const base = images[i].earlier
      ? "An earlier photo, for comparison only"
      : i === 0
        ? (nowCount > 1 ? "Photo 1 — the whole plant" : "The photo")
        : `Photo ${i + 1} — a closer look`;
    return `${base}${when(images[i].taken_at)}:`;
  };

  try {
    const client = new Anthropic({ apiKey });
    const fallback = FALLBACK_MODELS.includes(MODEL);
    const response = await client.beta.messages.parse({
      model: MODEL,
      ...(fallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
      // Room for the thinking as well as the answer: Opus 5.5 always thinks,
      // and thinking counts against this limit. A limit sized for the answer
      // alone would cut the JSON off half-way and still bill for it. Only
      // what is used is charged.
      max_tokens: 8192,
      system: SYSTEM,
      output_config: { effort: EFFORT, format: betaZodOutputFormat(Verdict) },
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
    const { cost_usd, input_tokens, output_tokens } = callCost(MODEL, response.usage);
    // `response.model` is whoever answered: the fallback, if the first model declined.
    const answeredBy = response.model;
    console.log(JSON.stringify({ fn: "analyze", model: MODEL, answered_by: answeredBy, effort: EFFORT, mode, photos: images.length, brief: care_brief.length, input_tokens, output_tokens, cost_usd: Number(cost_usd.toFixed(5)), stop_reason: response.stop_reason }));
    await admin.rpc("record_ai_usage", { p_keeper: user.id, p_day: day, p_input: input_tokens, p_output: output_tokens, p_cost: cost_usd });

    if (response.stop_reason === "refusal") {
      // Every model asked declined. That cost money and is recorded above,
      // but it isn't an identification the keeper got, so the trial keeps it.
      await refundPhotoCall(admin, user.id);
      return json({ error: "The photo couldn't be analysed." }, 422);
    }
    if (!response.parsed_output) return json({ error: "No usable answer came back — try another photo." }, 502);
    return json({ verdict: response.parsed_output, remaining: claim.remaining, photos_left: photos.left, model: answeredBy, effort: EFFORT, usage: { input_tokens, output_tokens }, cost_usd });
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
