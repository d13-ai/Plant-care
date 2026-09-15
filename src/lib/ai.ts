import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import { ensureSession, supabase, supabaseConfigured } from "./supabase";

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

type Answer = { verdict: Verdict; remaining: number; cached?: boolean; cost_usd?: number; model?: string };

/** One line for the screen: what this answer cost, or that it was free. */
export function describeCost(a: Answer): string {
  if (a.cached) return "Remembered from before — no charge.";
  const cents = a.cost_usd != null ? Math.max(1, Math.round(a.cost_usd * 100)) : null;
  const left = Number.isFinite(a.remaining) ? ` · ${a.remaining} of 20 scans left today` : "";
  return cents != null ? `This scan cost about ${cents}¢${left}.` : `Scan done${left}.`;
}

/**
 * Ask the AI about one photo. The image is shrunk to 1024px on its long
 * side first — plenty for a plant, and it keeps each call cheap. The
 * answer is kept on the device per photo, so asking again about the same
 * picture (after backing out of a screen, say) costs nothing.
 */
export async function analyzePhoto(
  uri: string,
  options: { mode?: AnalysisMode; speciesHint?: string | null } = {},
): Promise<Answer> {
  if (!supabaseConfigured) throw new Error("Supabase isn't configured.");

  const shrunk = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!shrunk.base64) throw new Error("Couldn't read the photo.");

  const cacheKey = `ai:${fingerprint(shrunk.base64)}:${options.mode ?? "both"}:${(options.speciesHint ?? "").toLowerCase()}`;
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

  const { data, error } = await supabase.functions.invoke<{ verdict: Verdict; remaining: number; cost_usd?: number; model?: string; error?: string }>(
    "analyze",
    {
      // Send the session token explicitly: right after an anonymous sign-in the
      // client hasn't always attached it yet, and the function would 401.
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { image: shrunk.base64, media_type: "image/jpeg", mode: options.mode ?? "both", species_hint: options.speciesHint ?? undefined },
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
  const answer: Answer = { verdict: data.verdict, remaining: data.remaining, cost_usd: data.cost_usd, model: data.model };
  AsyncStorage.setItem(cacheKey, JSON.stringify(answer)).catch(() => {});
  return answer;
}
