import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import { afterScanLine, PHOTO_TRIAL, type Allowance } from "@/domain/allowance";
import { KNOWN_CULTIVARS } from "@/domain/species";
import { ensureSession, supabase, supabaseConfigured } from "./supabase";

/** Bump when the prompt changes, so a remembered answer from the old one isn't reused. */
const PROMPT_VERSION = 4;
/** Photos per scan. Each extra one adds ~1,100 input tokens, about half a cent on Opus. */
export const MAX_SCAN_PHOTOS = 3;

/** What the analyze function returns — mirrors its zod schema. */
export interface Verdict {
  is_plant: boolean;
  species: { genus: string; species: string; cultivar: string; common_name: string; confidence: number }[];
  health: {
    overall: "healthy" | "watch" | "unwell" | "unknown";
    findings: { observation: string; likely_cause: string; suggested_action: string; severity: "low" | "medium" | "high" }[];
  };
  notes: string;
}

export type AnalysisMode = "identify" | "health" | "both";

/** FNV-1a over the image bytes — enough to recognise the same photo again. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + text.length.toString(16);
}

type Answer = {
  verdict: Verdict;
  remaining: number;
  /** Identifications left on the lifetime trial; null for an unlimited keeper. */
  photosLeft?: number | null;
  cached?: boolean;
  cost_usd?: number;
  model?: string;
};

/**
 * The most recent scan, photos included, so a cleared Add plant screen can
 * bring it back without another call. The photos are the 1024px copies
 * that were sent — a few hundred KB, well within storage on any device.
 */
export interface LastScan {
  at: string;
  mode: AnalysisMode;
  speciesHint: string | null;
  photos: string[];
  answer: Answer;
}
const LAST_SCAN_KEY = "ai:lastScan";

export async function loadLastScan(): Promise<LastScan | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SCAN_KEY);
    const last = raw ? (JSON.parse(raw) as LastScan) : null;
    return last?.answer?.verdict && last.photos?.length ? last : null;
  } catch {
    return null;
  }
}

export async function clearLastScan(): Promise<void> {
  await AsyncStorage.removeItem(LAST_SCAN_KEY).catch(() => {});
}

/**
 * One line for the screen after a scan: what is left, not what it cost.
 *
 * It used to lead with the price — "This scan cost about 4c" — which answers
 * a question the owner has and the keeper does not. `ai_usage` records every
 * cent, so nothing is lost by keeping it out of the app; what a keeper needs
 * to know is how many identifications remain, and they now see that before
 * the button as well as after the answer.
 */
export function describeScan(a: Answer): string | null {
  // Report whichever allowance actually binds. For a keeper on the trial that
  // is the trial -- being told "17 of 20 left today" while three identifications
  // remain in total would be worse than saying nothing.
  if (a.cached) return afterScanLine({ left: a.photosLeft ?? null, cached: true });
  if (typeof a.photosLeft === "number") return afterScanLine({ left: a.photosLeft });
  if (a.photosLeft === null) return null; // unlimited keeper
  return Number.isFinite(a.remaining) ? `${a.remaining} of 20 scans left today.` : null;
}

/**
 * What the keeper has left, read from their own row rather than remembered
 * from the last answer — so a phone that has never scanned still knows, and
 * two phones agree. Falls back to the default when there is no session or
 * the read fails: saying "5 free identifications" to somebody who has four
 * is a smaller wrong than saying nothing at all.
 */
export async function photoAllowance(): Promise<Allowance> {
  const { data: session } = await supabase.auth.getSession();
  const id = session.session?.user?.id;
  if (!id) return { left: null };
  const { data, error } = await supabase
    .from("keepers")
    .select("photo_calls, ai_unlimited")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { left: null };
  const row = data as { photo_calls: number | null; ai_unlimited: boolean | null };
  if (row.ai_unlimited) return { left: null, unlimited: true };
  return { left: Math.max(0, PHOTO_TRIAL - (row.photo_calls ?? 0)) };
}

/**
 * Ask the AI about one to three photos of the same plant — the whole plant
 * first, then close-ups. Each is shrunk to 1024px on its long side first —
 * plenty for a plant, and it keeps each call cheap; the words in the prompt
 * cost more than the pictures. The answer is kept on the device per set of
 * photos, so asking again about the same pictures (after backing out of a
 * screen, say) costs nothing.
 */
export async function analyzePhoto(
  uris: string | string[],
  options: { mode?: AnalysisMode; speciesHint?: string | null; careBrief?: string | null } = {},
): Promise<Answer> {
  if (!supabaseConfigured) throw new Error("Supabase isn't configured.");
  const list = (Array.isArray(uris) ? uris : [uris]).slice(0, MAX_SCAN_PHOTOS);
  if (!list.length) throw new Error("Pick a photo first.");

  const images: string[] = [];
  for (const uri of list) {
    const shrunk = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!shrunk.base64) throw new Error("Couldn't read the photo.");
    images.push(shrunk.base64);
  }

  // The brief is part of the question, so it is part of the key: watering a
  // plant and asking again about the same photo must not return the answer
  // given before the watering was on the record.
  const cacheKey = `ai:${PROMPT_VERSION}:${images.map(fingerprint).join("+")}:${options.mode ?? "both"}:${(options.speciesHint ?? "").toLowerCase()}:${options.careBrief ? fingerprint(options.careBrief) : ""}`;
  try {
    const hit = await AsyncStorage.getItem(cacheKey);
    if (hit) {
      const saved = JSON.parse(hit) as Answer;
      if (saved?.verdict) return { ...saved, cached: true };
    }
  } catch {
    // an unreadable cache entry just means asking again
  }

  const session = await ensureSession();

  const { data, error } = await supabase.functions.invoke<{ verdict: Verdict; remaining: number; photos_left?: number | null; cost_usd?: number; model?: string; error?: string }>(
    "analyze",
    {
      // Send the session token explicitly: right after an anonymous sign-in the
      // client hasn't always attached it yet, and the function would 401.
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        images: images.map((data) => ({ data, media_type: "image/jpeg" })),
        mode: options.mode ?? "both",
        // What the keeper has logged for this plant. Only the health check
        // sends it, and only when there is something on the record.
        care_brief: options.careBrief || undefined,
        species_hint: options.speciesHint ?? undefined,
        known: KNOWN_CULTIVARS,
      },
    },
  );
  if (error) {
    // The function's own message is the useful one; surface it if we can get at it.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) throw new Error(body.error);
      } catch (inner) {
        if (inner instanceof Error && inner.message !== "Unexpected end of JSON input") throw inner;
      }
    }
    throw new Error(error.message || "Analysis failed.");
  }
  if (!data?.verdict) throw new Error(data?.error ?? "No answer came back.");
  const answer: Answer = { verdict: data.verdict, remaining: data.remaining, photosLeft: data.photos_left, cost_usd: data.cost_usd, model: data.model };
  AsyncStorage.setItem(cacheKey, JSON.stringify(answer)).catch(() => {});
  const last: LastScan = {
    at: new Date().toISOString(),
    mode: options.mode ?? "both",
    speciesHint: options.speciesHint ?? null,
    photos: images.map((b64) => `data:image/jpeg;base64,${b64}`),
    answer,
  };
  AsyncStorage.setItem(LAST_SCAN_KEY, JSON.stringify(last)).catch(() => {});
  return answer;
}
