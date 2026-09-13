import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  clearPhotoUploads,
  getPlant,
  markPhotoUploaded,
  markPublished,
  markUnpublished,
  type Photo,
} from "@/db";
import { ensureSession, passportUrl, supabase, supabaseConfigured } from "./supabase";

const KEEPER_NAME_KEY = "keeperName";

export async function getKeeperName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEEPER_NAME_KEY)) ?? "";
  } catch {
    return "";
  }
}

export async function setKeeperName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEEPER_NAME_KEY, name.trim());
}

/**
 * Publish one plant as a passport: a snapshot of its record, events and
 * photos pushed to Supabase. Re-running replaces the snapshot; the phone's
 * database stays the source of truth. Returns the shareable URL.
 */
export async function publishPassport(db: SQLiteDatabase, plantId: number): Promise<string> {
  if (!supabaseConfigured) {
    throw new Error("Supabase isn't configured — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.");
  }
  const session = await ensureSession();
  const keeperId = session.user.id;

  const local = await getPlant(db, plantId);
  if (!local) throw new Error("Plant not found.");
  const { plant, events, photos } = local;

  const keeperName = await getKeeperName();
  const { error: keeperError } = await supabase
    .from("keepers")
    .upsert({ id: keeperId, display_name: keeperName || null, updated_at: new Date().toISOString() });
  if (keeperError) throw new Error(`Keeper: ${keeperError.message}`);

  // The mother plant only links if it has been published too.
  let motherRemoteId: string | null = null;
  if (plant.motherPlantId) {
    const { data: mother } = await supabase
      .from("plants")
      .select("id")
      .eq("keeper_id", keeperId)
      .eq("local_id", plant.motherPlantId)
      .maybeSingle();
    motherRemoteId = mother?.id ?? null;
  }

  const { data: remote, error: plantError } = await supabase
    .from("plants")
    .upsert(
      {
        keeper_id: keeperId,
        local_id: plant.id,
        nickname: plant.nickname,
        species: plant.species,
        status: plant.status,
        acquired_at: plant.acquiredAt,
        acquired_from: plant.acquiredFrom,
        notes: plant.notes,
        mother_plant_id: motherRemoteId,
        propagated_at: plant.propagatedAt,
        is_public: true,
        published_at: new Date().toISOString(),
      },
      { onConflict: "keeper_id,local_id" },
    )
    .select("id, passport_token")
    .single();
  if (plantError || !remote) throw new Error(`Plant: ${plantError?.message ?? "no row returned"}`);

  // Events: replace wholesale. They're small and this keeps edits honest.
  const { error: clearError } = await supabase.from("care_events").delete().eq("plant_id", remote.id);
  if (clearError) throw new Error(`Events: ${clearError.message}`);
  if (events.length) {
    const { error: eventsError } = await supabase.from("care_events").insert(
      events.map((e) => ({
        plant_id: remote.id,
        type: e.type,
        notes: e.notes,
        occurred_at: e.occurredAt,
        resolved_at: e.resolvedAt,
      })),
    );
    if (eventsError) throw new Error(`Events: ${eventsError.message}`);
  }

  // Photos: upload anything not yet in storage, then replace the rows.
  const uploaded: { path: string; caption: string | null; taken_at: string }[] = [];
  for (const photo of photos) {
    const path = photo.remotePath ?? (await uploadPhoto(keeperId, plant.id, photo));
    if (!photo.remotePath) await markPhotoUploaded(db, photo.id, path);
    uploaded.push({ path, caption: photo.caption, taken_at: photo.takenAt });
  }
  const { error: clearPhotos } = await supabase.from("photos").delete().eq("plant_id", remote.id);
  if (clearPhotos) throw new Error(`Photos: ${clearPhotos.message}`);
  if (uploaded.length) {
    const { error: photosError } = await supabase
      .from("photos")
      .insert(uploaded.map((p) => ({ ...p, plant_id: remote.id })));
    if (photosError) throw new Error(`Photos: ${photosError.message}`);
  }

  await markPublished(db, plant.id, remote.passport_token);
  return passportUrl(remote.passport_token);
}

/**
 * Take the passport down. The local record is untouched. The photos come
 * down too: the bucket is public-read, so anyone who had the passport open
 * could otherwise keep the image URLs working after the link goes dark. A
 * republish uploads them again.
 */
export async function unpublishPassport(db: SQLiteDatabase, plantId: number): Promise<void> {
  const session = await ensureSession();
  const keeperId = session.user.id;

  // Page first, so the link stops resolving even if the rest fails and is retried.
  const { error } = await supabase
    .from("plants")
    .update({ is_public: false })
    .eq("keeper_id", keeperId)
    .eq("local_id", plantId);
  if (error) throw new Error(error.message);

  // Everything in this plant's folder, not just what the local db remembers
  // uploading — a reinstall may have forgotten photos that are still up.
  const folder = `${keeperId}/${plantId}`;
  const { data: objects, error: listError } = await supabase.storage.from("plant-photos").list(folder);
  if (listError) throw new Error(`Photos: ${listError.message}`);
  if (objects?.length) {
    const { error: removeError } = await supabase.storage
      .from("plant-photos")
      .remove(objects.map((o) => `${folder}/${o.name}`));
    if (removeError) throw new Error(`Photos: ${removeError.message}`);
  }

  await clearPhotoUploads(db, plantId);
  await markUnpublished(db, plantId);
}

async function uploadPhoto(keeperId: string, plantLocalId: number, photo: Photo): Promise<string> {
  const response = await fetch(photo.uri);
  const body = await response.arrayBuffer();
  const path = `${keeperId}/${plantLocalId}/${photo.id}.jpg`;
  const { error } = await supabase.storage
    .from("plant-photos")
    .upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Upload: ${error.message}`);
  return path;
}
