import type { SQLiteDatabase } from "expo-sqlite";
import { getPlant, markPublished, markUnpublished } from "@/db";
import { ensureSession, supabase, supabaseConfigured, tagUrl } from "./supabase";
import { pushAll } from "./sync";

export { getKeeperName, setKeeperName } from "./keeper";

/**
 * Publish one plant as a tag. The plant (and everything else waiting) is
 * pushed to the server the same way a sync would, then the plant is marked
 * public. Re-publishing just pushes what changed; the link stays the same.
 * Returns the shareable URL.
 */
export async function publishTag(db: SQLiteDatabase, plantId: number): Promise<string> {
  if (!supabaseConfigured) {
    throw new Error("Supabase isn't configured — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.");
  }
  const local = await getPlant(db, plantId);
  if (!local) throw new Error("Plant not found.");

  const session = await ensureSession();
  await pushAll(db, session);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("plants")
    .update({ is_public: true, published_at: now, updated_at: now })
    .eq("id", local.plant.uuid)
    .select("passport_token")
    .single();
  if (error || !data) throw new Error(`Publish: ${error?.message ?? "no row returned"}`);

  await markPublished(db, plantId, data.passport_token);
  return tagUrl(data.passport_token);
}

/**
 * Take the tag down: the link stops resolving. The plant's record and photos
 * stay on the server as the keeper's own synced copy — the photo URLs are
 * unguessable, but anyone who saved one while the tag was up keeps it.
 */
export async function unpublishTag(db: SQLiteDatabase, plantId: number): Promise<void> {
  const local = await getPlant(db, plantId);
  if (!local) throw new Error("Plant not found.");
  const session = await ensureSession();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("plants")
    .update({ is_public: false, updated_at: now })
    .eq("id", local.plant.uuid)
    .eq("keeper_id", session.user.id);
  if (error) throw new Error(error.message);

  await markUnpublished(db, plantId);
}
