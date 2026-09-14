import type { Session } from "@supabase/supabase-js";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  applyRemoteEvent,
  applyRemotePhoto,
  applyRemotePlant,
  clearDirty,
  clearTombstones,
  deletePlantByUuid,
  dirtyEvents,
  dirtyPhotos,
  dirtyPlants,
  getSyncMeta,
  linkMotherByUuid,
  listTombstones,
  markPhotoUploaded,
  setSyncMeta,
  type RemoteEvent,
  type RemotePhoto,
  type RemotePlant,
} from "@/db";
import { getKeeperName } from "./keeper";
import { SUPABASE_URL, supabase, supabaseConfigured } from "./supabase";

/**
 * Keeps the phone's greenhouse and the server's copy the same.
 *
 * The phone stays the source of truth for what the keeper sees; the server
 * is the backup and the way a second device gets the same plants. A sync is
 * a pull (rows the server has changed since our cursor, applied with
 * last-write-wins by updated_at — a local edit at least as new stays) and
 * then a push (every row a local write left dirty, plus tombstones for
 * deleted plants). Photos are uploaded once to storage; another device
 * shows them straight from their URL.
 *
 * Only accounts with an email sync automatically: an anonymous session has
 * nothing to sign back into on a new phone, so backing it up would promise
 * something it can't deliver. Publishing a tag pushes under any session.
 */

export interface SyncStatus {
  state: "idle" | "syncing" | "error";
  /** ISO time of the last sync that finished cleanly, if any. */
  lastSyncedAt: string | null;
  error: string | null;
  /** Bumps whenever a pull changed local rows — screens re-query on it. */
  version: number;
}

const CURSOR = "cursor";
const LAST_SYNCED = "last_synced_at";
const BUCKET = "plant-photos";

let status: SyncStatus = { state: "idle", lastSyncedAt: null, error: null, version: 0 };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSync(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

/** Public URL of a stored photo — the bucket is public-read with unguessable paths. */
export function photoUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** A session that can be signed into again elsewhere — i.e. one with an email. */
export function sessionHasAccount(session: Session | null): boolean {
  return Boolean(session && !session.user.is_anonymous && session.user.email);
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

async function pull(db: SQLiteDatabase): Promise<number> {
  const since = (await getSyncMeta(db, CURSOR)) ?? "1970-01-01T00:00:00Z";

  const [plants, events, photos] = await Promise.all([
    supabase.from("plants").select("*").gt("synced_at", since).order("synced_at"),
    supabase.from("care_events").select("*").gt("synced_at", since).order("synced_at"),
    supabase.from("photos").select("*").gt("synced_at", since).order("synced_at"),
  ]);
  for (const r of [plants, events, photos]) {
    if (r.error) throw new Error(`Pull: ${r.error.message}`);
  }
  const remotePlants = (plants.data ?? []) as (RemotePlant & { synced_at: string })[];
  const remoteEvents = (events.data ?? []) as (RemoteEvent & { synced_at: string })[];
  const remotePhotos = (photos.data ?? []) as (RemotePhoto & { synced_at: string })[];

  let changed = 0;
  let cursor = since;
  const advance = (t: string) => {
    if (Date.parse(t) > Date.parse(cursor)) cursor = t;
  };

  await db.withTransactionAsync(async () => {
    for (const p of remotePlants) {
      if (p.deleted_at) {
        if (await deletePlantByUuid(db, p.id)) changed++;
      } else if ((await applyRemotePlant(db, p)) !== "skipped") changed++;
      advance(p.synced_at);
    }
    // Mothers second, once every plant of this pull exists locally.
    for (const p of remotePlants) {
      if (!p.deleted_at) await linkMotherByUuid(db, p.id, p.mother_plant_id);
    }
    for (const e of remoteEvents) {
      if ((await applyRemoteEvent(db, e)) !== "skipped") changed++;
      advance(e.synced_at);
    }
    for (const ph of remotePhotos) {
      if ((await applyRemotePhoto(db, ph, photoUrl(ph.path))) !== "skipped") changed++;
      advance(ph.synced_at);
    }
    await setSyncMeta(db, CURSOR, cursor);
  });
  return changed;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

async function uploadPhoto(keeperId: string, plantUuid: string, photoUuid: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  const path = `${keeperId}/${plantUuid}/${photoUuid}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Upload: ${error.message}`);
  return path;
}

/**
 * Send every local change to the server under `session`'s keeper. Safe to
 * call under an anonymous session (publishing a tag does); rows that fail
 * stay dirty and go next time.
 */
export async function pushAll(db: SQLiteDatabase, session: Session): Promise<number> {
  const keeperId = session.user.id;
  const now = new Date().toISOString();
  let pushed = 0;

  const { error: keeperError } = await supabase
    .from("keepers")
    .upsert({ id: keeperId, display_name: (await getKeeperName()) || null, updated_at: now });
  if (keeperError) throw new Error(`Keeper: ${keeperError.message}`);

  // Deletions first: a plant that came back dirty after a delete shouldn't resurrect.
  const tombstones = await listTombstones(db);
  for (const t of tombstones) {
    const { error } = await supabase
      .from("plants")
      .update({ deleted_at: t.deletedAt, updated_at: t.deletedAt })
      .eq("id", t.uuid)
      .eq("keeper_id", keeperId);
    if (error) throw new Error(`Delete: ${error.message}`);
  }
  await clearTombstones(db, tombstones.map((t) => t.uuid));
  pushed += tombstones.length;

  // Plants, mothers before cuttings (a cutting's id is always higher).
  const plants = await dirtyPlants(db);
  if (plants.length) {
    const { error } = await supabase.from("plants").upsert(
      plants.map((p) => ({
        id: p.uuid,
        keeper_id: keeperId,
        nickname: p.nickname,
        species: p.species,
        location: p.location,
        status: p.status,
        acquired_at: p.acquiredAt,
        acquired_from: p.acquiredFrom,
        notes: p.notes,
        water_every_days: p.waterEveryDays,
        fertilize_every_days: p.fertilizeEveryDays,
        repot_every_days: p.repotEveryDays,
        photo_every_days: p.photoEveryDays,
        mother_plant_id: p.motherUuid,
        propagated_at: p.propagatedAt,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        deleted_at: null,
      })),
      { onConflict: "id" },
    );
    if (error) throw new Error(`Plants: ${error.message}`);
    await clearDirty(db, "plants", plants.map((p) => p.uuid));
    pushed += plants.length;
  }

  const events = await dirtyEvents(db);
  if (events.length) {
    const { error } = await supabase.from("care_events").upsert(
      events.map((e) => ({
        id: e.uuid,
        plant_id: e.plantUuid,
        type: e.type,
        notes: e.notes,
        occurred_at: e.occurredAt,
        resolved_at: e.resolvedAt,
        created_at: e.createdAt,
        updated_at: e.updatedAt,
      })),
      { onConflict: "id" },
    );
    if (error) throw new Error(`Events: ${error.message}`);
    await clearDirty(db, "care_events", events.map((e) => e.uuid));
    pushed += events.length;
  }

  const photos = await dirtyPhotos(db);
  for (const ph of photos) {
    const path = ph.remotePath ?? (await uploadPhoto(keeperId, ph.plantUuid, ph.uuid, ph.uri));
    if (!ph.remotePath) await markPhotoUploaded(db, ph.id, path);
    const { error } = await supabase.from("photos").upsert(
      {
        id: ph.uuid,
        plant_id: ph.plantUuid,
        path,
        caption: ph.caption,
        taken_at: ph.takenAt,
        created_at: ph.createdAt,
        updated_at: ph.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(`Photos: ${error.message}`);
    await clearDirty(db, "photos", [ph.uuid]);
    pushed++;
  }

  return pushed;
}

// ---------------------------------------------------------------------------
// The sync itself
// ---------------------------------------------------------------------------

let running: Promise<void> | null = null;
let queued = false;

/**
 * Pull then push, once, for the signed-in account. Overlapping calls fold
 * into one follow-up run. Resolves quietly when there's nothing to sync
 * with (no Supabase, no account); throws on a failed sync after recording
 * it in the status.
 */
export async function syncNow(db: SQLiteDatabase): Promise<void> {
  if (running) {
    queued = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        queued = false;
        await runOnce(db);
      } while (queued);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function runOnce(db: SQLiteDatabase): Promise<void> {
  if (!supabaseConfigured) return;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!sessionHasAccount(session)) return;

  setStatus({ state: "syncing", error: null });
  try {
    const changed = await pull(db);
    await pushAll(db, session!);
    const finished = new Date().toISOString();
    await setSyncMeta(db, LAST_SYNCED, finished);
    setStatus({
      state: "idle",
      lastSyncedAt: finished,
      error: null,
      version: changed ? status.version + 1 : status.version,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus({ state: "error", error: message });
    throw err;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Sync soon — after a write, on focus. Coalesces bursts; never throws. */
export function requestSync(db: SQLiteDatabase, delayMs = 1500): void {
  if (!supabaseConfigured) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow(db).catch(() => {
      // Recorded in the status; the rows stay dirty for next time.
    });
  }, delayMs);
}

/** Read the last sync time into the status on startup. */
export async function loadSyncStatus(db: SQLiteDatabase): Promise<void> {
  const last = await getSyncMeta(db, LAST_SYNCED);
  if (last && !status.lastSyncedAt) setStatus({ lastSyncedAt: last });
}
