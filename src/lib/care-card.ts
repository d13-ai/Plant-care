import type { SQLiteDatabase } from "expo-sqlite";
import { getCachedCareCard, saveCareCard } from "@/db";
import { ensureSession, supabase, supabaseConfigured } from "./supabase";

/** Mirrors the care function's schema. */
export interface CareCard {
  summary: string;
  difficulty: "easy" | "moderate" | "fussy";
  light: string;
  water: string;
  humidity: string;
  temperature: string;
  soil: string;
  feeding: string;
  repotting: string;
  common_problems: { problem: string; fix: string }[];
  toxicity: string;
}

const keyFor = (species: string) => species.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The care guide for a species: the on-device copy if we have one, otherwise
 * the `care` function (which is itself cached and shared across everyone), and
 * then stored locally so it's instant and offline next time.
 */
export async function getCareCard(db: SQLiteDatabase, species: string): Promise<CareCard> {
  const key = keyFor(species);
  const cached = await getCachedCareCard<CareCard>(db, key);
  if (cached) return cached;

  if (!supabaseConfigured) throw new Error("Supabase isn't configured.");
  const session = await ensureSession();
  const { data, error } = await supabase.functions.invoke<{ card: CareCard; error?: string }>("care", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { species },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) throw new Error(body.error);
      } catch (inner) {
        if (inner instanceof Error && inner.message !== "Unexpected end of JSON input") throw inner;
      }
    }
    throw new Error(error.message || "Couldn't get the care guide.");
  }
  if (!data?.card) throw new Error(data?.error ?? "No care guide came back.");
  await saveCareCard(db, key, data.card);
  return data.card;
}
