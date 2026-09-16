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
  markAllDirty,
  markPhotoUploaded,
  regenerateIdentities,
  setSyncMeta,
  type Applied,
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

/**
 * One pull cursor per table.
 *
 * v1 kept a single "cursor" for all three, advanced to the newest synced_at
 * seen across three separately fetched queries. Each query is capped by
 * PostgREST's max_rows, so when care_events truncated at the cap but photos
 * came back with a later synced_at, the shared cursor moved past the events
 * that were never returned and they were never fetched again — care history
 * lost, silently. Separate cursors mean one table's truncation cannot skip
 * another's rows, and the paging below means truncation stops happening.
 */
const CURSORS = {
  plants: "cursor:plants",
  care_events: "cursor:care_events",
  photos: "cursor:photos",
} as const;
type PullTable = keyof typeof CURSORS;

/** v1's single cursor. Still read once, to notice an install that predates the
 *  per-table ones — see seedCursors. */
const CURSOR = "cursor";
const EPOCH = "1970-01-01T00:00:00Z";
/** Rows per request. Comfortably under PostgREST's default max_rows of 1000,
 *  so a short page always means "that was the last one" and never "the server
 *  truncated you". */
const PAGE = 500;
/** Runaway guard: 200 pages is 100,000 rows, far past any real greenhouse. */
const MAX_PAGES = 200;

const LAST_SYNCED = "last_synced_at";
const KEEPER = "keeper_id";
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

/**
 * Move an install from v1's single cursor to the per-table ones.
 *
 * The per-table cursors start at the epoch rather than at the old cursor's
 * value, so the first sync after this upgrade re-pulls the whole greenhouse
 * once. That is deliberate: it is also the repair. Any row the shared cursor
 * skipped past is still on the server, and a full re-pull brings it back.
 * Re-applying rows is safe — applyRemote* is last-write-wins on updated_at,
 * so a newer local edit stays put.
 */
async function seedCursors(db: SQLiteDatabase): Promise<void> {
  // Emptied below once the seeding is done, so this is a one-time step and
  // not four extra queries on every sync forever.
  if (!(await getSyncMeta(db, CURSOR))) return;
  for (const key of Object.values(CURSORS)) {
    if ((await getSyncMeta(db, key)) === null) await setSyncMeta(db, key, EPOCH);
  }
  await setSyncMeta(db, CURSOR, "");
}

/**
 * Every row of one table the server has touched since that table's cursor,
 * in pages, so a greenhouse bigger than one response is still pulled whole.
 *
 * The filter is `gte`, not `gt`: synced_at comes from now() in a trigger, so
 * every row written by one statement shares a timestamp, and a strict `gt`
 * would step over the rest of a group that straddles a page boundary. The
 * boundary row is fetched again next sync instead, and applying it again is a
 * no-op.
 */
async function pullTable<T>(db: SQLiteDatabase, table: PullTable): Promise<(T & { synced_at: string })[]> {
  const since = (await getSyncMeta(db, CURSORS[table])) || EPOCH;
  const rows: (T & { synced_at: string })[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .gte("synced_at", since)
      .order("synced_at")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Pull ${table}: ${error.message}`);
    const batch = (data ?? []) as (T & { synced_at: string })[];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
  throw new Error(`Pull ${table}: more than ${MAX_PAGES * PAGE} rows pending`);
}

/**
 * Walks rows in synced_at order, remembering how far the cursor may safely
 * move. A row that was applied — or that was already current — lets the
 * cursor past it. A deferred row (its plant isn't on this device yet) stops
 * the cursor where it is, so that row is fetched again next sync instead of
 * being lost. Later rows are still attempted; only the cursor waits.
 */
class Cursor {
  private safe: string;
  private blocked = false;
  changed = 0;

  constructor(private readonly start: string) {
    this.safe = start;
  }

  record(outcome: Applied, syncedAt: string): void {
    if (outcome === "deferred") {
      this.blocked = true;
      return;
    }
    if (outcome !== "skipped") this.changed++;
    if (!this.blocked && Date.parse(syncedAt) > Date.parse(this.safe)) this.safe = syncedAt;
  }

  get value(): string {
    return this.safe;
  }

  get moved(): boolean {
    return this.safe !== this.start;
  }
}

async function pull(db: SQLiteDatabase): Promise<number> {
  await seedCursors(db);

  // Fetched before the transaction opens: each table is paged to exhaustion,
  // and plants are applied first so a cutting's mother and an event's plant
  // are already local by the time the rows that need them are applied.
  const remotePlants = await pullTable<RemotePlant>(db, "plants");
  const remoteEvents = await pullTable<RemoteEvent>(db, "care_events");
  const remotePhotos = await pullTable<RemotePhoto>(db, "photos");

  const plantCursor = new Cursor((await getSyncMeta(db, CURSORS.plants)) || EPOCH);
  const eventCursor = new Cursor((await getSyncMeta(db, CURSORS.care_events)) || EPOCH);
  const photoCursor = new Cursor((await getSyncMeta(db, CURSORS.photos)) || EPOCH);

  await db.withTransactionAsync(async () => {
    for (const p of remotePlants) {
      const outcome = p.deleted_at
        ? (await deletePlantByUuid(db, p.id)) ? "updated" : "skipped"
        : await applyRemotePlant(db, p);
      plantCursor.record(outcome, p.synced_at);
    }
    // Mothers second, once every plant of this pull exists locally.
    for (const p of remotePlants) {
      if (!p.deleted_at) await linkMotherByUuid(db, p.id, p.mother_plant_id);
    }
    for (const e of remoteEvents) {
      eventCursor.record(await applyRemoteEvent(db, e), e.synced_at);
    }
    for (const ph of remotePhotos) {
      photoCursor.record(await applyRemotePhoto(db, ph, photoUrl(ph.path)), ph.synced_at);
    }
    if (plantCursor.moved) await setSyncMeta(db, CURSORS.plants, plantCursor.value);
    if (eventCursor.moved) await setSyncMeta(db, CURSORS.care_events, eventCursor.value);
    if (photoCursor.moved) await setSyncMeta(db, CURSORS.photos, photoCursor.value);
  });
  return plantCursor.changed + eventCursor.changed + photoCursor.changed;
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

  // Deletions first: a row that came back dirty after a delete shouldn't resurrect.
  //
  // A plant and a care entry are tombstoned on the server -- other devices
  // have to be able to learn that they went. A photo is different: its file
  // sits in a public-read bucket, where a URL is the only thing standing
  // between a stranger and the picture, so a delete has to actually take the
  // file down. Nothing did, and photos of deleted plants stayed readable for
  // anyone who had ever seen a link to one.
  //
  // Each tombstone is cleared as it lands rather than all of them at the end,
  // so a failure part-way through doesn't re-send the deletions that already
  // succeeded. Re-sending would be harmless -- removing an object that isn't
  // there is not an error, and the updates are idempotent -- but it would
  // repeat every round until the failing one cleared.
  const tombstones = await listTombstones(db);
  for (const t of tombstones) {
    if (t.kind === "photo") {
      if (t.path) {
        const { error } = await supabase.storage.from(BUCKET).remove([t.path]);
        if (error) throw new Error(`Delete photo file: ${error.message}`);
      }
      // The row last: while it exists, the plant it belongs to still grants
      // access to it, and a row pointing at a file that has gone is worse
      // than no row -- another device would render a dead image.
      const { error } = await supabase.from("photos").delete().eq("id", t.uuid);
      if (error) throw new Error(`Delete photo: ${error.message}`);
    } else {
      const stamp = { deleted_at: t.deletedAt, updated_at: t.deletedAt };
      const { error } =
        t.kind === "event"
          ? await supabase.from("care_events").update(stamp).eq("id", t.uuid)
          : await supabase.from("plants").update(stamp).eq("id", t.uuid).eq("keeper_id", keeperId);
      if (error) throw new Error(`Delete: ${error.message}`);
    }
    await clearTombstones(db, [t.uuid]);
    pushed++;
  }

  // Plants, mothers before cuttings (a cutting's id is always higher).
  let plants = await dirtyPlants(db);
  if (plants.length) {
    let { error } = await upsertPlants(keeperId, plants);
    if (error && isSomeoneElsesRow(error)) {
      // These ids already exist on the server under another keeper: this
      // phone synced as a different account before. Rather than fail
      // forever, this account gets its own copy — fresh identities for
      // everything, then push again. (Only when the session itself is
      // good; an expired one fails the same policy for a different reason.)
      const { error: who } = await supabase.auth.getUser();
      if (who) throw new Error(`Plants: ${error.message}`);
      await regenerateIdentities(db);
      plants = await dirtyPlants(db);
      ({ error } = await upsertPlants(keeperId, plants));
    }
    if (error) throw new Error(`Plants: ${error.message}`);
    await clearDirty(db, "plants", plants.map((p) => ({ uuid: p.uuid, updatedAt: p.updatedAt })));
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
    await clearDirty(db, "care_events", events.map((e) => ({ uuid: e.uuid, updatedAt: e.updatedAt })));
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
    await clearDirty(db, "photos", [{ uuid: ph.uuid, updatedAt: ph.updatedAt }]);
    pushed++;
  }

  return pushed;
}

function upsertPlants(keeperId: string, plants: Awaited<ReturnType<typeof dirtyPlants>>) {
  return supabase.from("plants").upsert(
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
      cover_photo_uuid: p.coverPhotoUuid,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      // deleted_at is deliberately absent. Writing null here resurrected a
      // plant another device had deleted: publishTag pushes without pulling
      // first, so this phone would not yet know about the tombstone, and the
      // upsert cleared it. Deletion travels one way only, through the
      // tombstone push above.
    })),
    { onConflict: "id" },
  );
}

/** The policy's USING clause failing on an upsert means the conflicting row
 *  exists but isn't ours; a WITH CHECK failure would read differently. */
function isSomeoneElsesRow(error: { message: string }): boolean {
  return /row-level security/i.test(error.message) && /USING expression/i.test(error.message);
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
    // A different account than last time (first sign-in, or a switch):
    // whatever is on this phone now belongs to it, and its greenhouse is
    // pulled from the start.
    const keeperId = session!.user.id;
    if ((await getSyncMeta(db, KEEPER)) !== keeperId) {
      await markAllDirty(db);
      await setSyncMeta(db, KEEPER, keeperId);
    }
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
