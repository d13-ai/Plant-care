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

/**
 * Ask the AI about one photo. The image is shrunk to 1024px on its long
 * side first — plenty for a plant, and it keeps each call cheap.
 */
export async function analyzePhoto(
  uri: string,
  options: { mode?: AnalysisMode; speciesHint?: string | null } = {},
): Promise<{ verdict: Verdict; remaining: number }> {
  if (!supabaseConfigured) throw new Error("Supabase isn't configured.");
  await ensureSession();

  const shrunk = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!shrunk.base64) throw new Error("Couldn't read the photo.");

  const { data, error } = await supabase.functions.invoke<{ verdict: Verdict; remaining: number; error?: string }>(
    "analyze",
    { body: { image: shrunk.base64, media_type: "image/jpeg", mode: options.mode ?? "both", species_hint: options.speciesHint ?? undefined } },
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
  return { verdict: data.verdict, remaining: data.remaining };
}
