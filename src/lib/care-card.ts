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
  /** "library": the plant library's own hand-written care. Absent on guides saved before it existed, which were all AI. */
  source?: "library" | "ai";
  /** Set when this is the species' guide shown for one of its cultivars. */
  note?: string;
  /** The library page it came from. */
  url?: string;
}

/** How a species is filed in the on-device guide cache. */
export const keyFor = (species: string) => species.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The care guide for a species: the on-device copy if we have one, otherwise
 * the `care` function (which is itself cached and shared across everyone), and
 * then stored locally so it's instant and offline next time.
 */
export async function getCareCard(db: SQLiteDatabase, species: string): Promise<CareCard> {
  const key = keyFor(species);
  const cached = await getCachedCareCard<CareCard>(db, key);
  // A copy saved before guides said where they came from (no `source`) is
  // from before the plant library was loaded: ask again, once, so the phone
  // swaps it for the library's guide where there is one. If that fails the
  // old copy stays, marked as what it is -- every guide before the library
  // was AI-written -- so a name the server now refuses isn't asked about
  // (and maybe paid for) on every visit.
  if (cached?.source) return cached;
  if (cached) {
    return fetchCareCard(db, key, species).catch(async () => {
      const kept: CareCard = { ...cached, source: "ai" };
      await saveCareCard(db, key, kept).catch(() => {});
      return kept;
    });
  }
  return fetchCareCard(db, key, species);
}

async function fetchCareCard(db: SQLiteDatabase, key: string, species: string): Promise<CareCard> {
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
