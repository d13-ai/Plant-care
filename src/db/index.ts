import type { SQLiteDatabase } from "expo-sqlite";
import type { CareType } from "@/domain/care";
import { CREATE_TABLES, MIGRATIONS, SCHEMA_VERSION } from "./schema";
import { uuid } from "./uuid";

// ---------------------------------------------------------------------------
// Types the rest of the app sees. Column names are snake_case in SQLite and
// camelCase here; the mappers below are the only place that knows both.
//
// Every row carries a `uuid` — the identity the server keys on, so the same
// plant is the same row from any device — and a `dirty` flag that every
// local write sets and a successful push clears. `updatedAt` decides
// last-write-wins between devices.
// ---------------------------------------------------------------------------

export type PlantStatus = "ACTIVE" | "DORMANT" | "DECEASED";

export interface Plant {
  id: number;
  uuid: string;
  nickname: string;
  species: string | null;
  location: string | null;
  status: PlantStatus;
  acquiredAt: string;
  acquiredFrom: string | null;
  notes: string | null;
  waterEveryDays: number | null;
  fertilizeEveryDays: number | null;
  repotEveryDays: number | null;
  photoEveryDays: number | null;
  motherPlantId: number | null;
  propagatedAt: string | null;
  passportToken: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareEvent {
  id: number;
  uuid: string;
  plantId: number;
  type: CareType;
  notes: string | null;
  occurredAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

export interface Photo {
  id: number;
  uuid: string;
  plantId: number;
  uri: string;
  caption: string | null;
  takenAt: string;
  remotePath: string | null;
  updatedAt: string;
}

export const DEFAULT_CADENCE = {
  waterEveryDays: 7,
  fertilizeEveryDays: 30,
  repotEveryDays: 365,
  photoEveryDays: 180,
} as const;

type PlantRow = {
  id: number;
  uuid: string;
  nickname: string;
  species: string | null;
  location: string | null;
  status: string;
  acquired_at: string;
  acquired_from: string | null;
  notes: string | null;
  water_every_days: number | null;
  fertilize_every_days: number | null;
  repot_every_days: number | null;
  photo_every_days: number | null;
  mother_plant_id: number | null;
  propagated_at: string | null;
  passport_token: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  dirty: number;
};

type EventRow = {
  id: number;
  uuid: string;
  plant_id: number;
  type: string;
  notes: string | null;
  occurred_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  dirty: number;
};

type PhotoRow = {
  id: number;
  uuid: string;
  plant_id: number;
  uri: string;
  caption: string | null;
  taken_at: string;
  remote_path: string | null;
  created_at: string;
  updated_at: string;
  dirty: number;
};

const toPlant = (r: PlantRow): Plant => ({
  id: r.id,
  uuid: r.uuid,
  nickname: r.nickname,
  species: r.species,
  location: r.location,
  status: r.status as PlantStatus,
  acquiredAt: r.acquired_at,
  acquiredFrom: r.acquired_from,
  notes: r.notes,
  waterEveryDays: r.water_every_days,
  fertilizeEveryDays: r.fertilize_every_days,
  repotEveryDays: r.repot_every_days,
  photoEveryDays: r.photo_every_days,
  motherPlantId: r.mother_plant_id,
  propagatedAt: r.propagated_at,
  passportToken: r.passport_token,
  publishedAt: r.published_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toEvent = (r: EventRow): CareEvent => ({
  id: r.id,
  uuid: r.uuid,
  plantId: r.plant_id,
  type: r.type as CareType,
  notes: r.notes,
  occurredAt: r.occurred_at,
  resolvedAt: r.resolved_at,
  updatedAt: r.updated_at,
});

const toPhoto = (r: PhotoRow): Photo => ({
  id: r.id,
  uuid: r.uuid,
  plantId: r.plant_id,
  uri: r.uri,
  caption: r.caption,
  takenAt: r.taken_at,
  remotePath: r.remote_path,
  updatedAt: r.updated_at,
});

const nowIso = () => new Date().toISOString();
const blank = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};
/** Is `candidate` strictly later than `current`? Tolerates the server's
 *  "+00:00" and the phone's "Z" spellings. */
const newer = (current: string | null, candidate: string) =>
  !current || Date.parse(candidate) > Date.parse(current);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let current = row?.user_version ?? 0;
  await db.execAsync("PRAGMA foreign_keys = ON;");

  if (current === 0) {
    await db.execAsync(CREATE_TABLES);
    current = 1;
  }
  for (let version = current + 1; version <= SCHEMA_VERSION; version++) {
    for (const statement of MIGRATIONS[version] ?? []) {
      await db.execAsync(statement);
    }
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface PlantWithHistory {
  plant: Plant;
  events: CareEvent[];
  photos: Photo[];
}

/** Every plant with its recent events and latest photo — the collection screen. */
export async function listPlants(db: SQLiteDatabase): Promise<PlantWithHistory[]> {
  const plants = (
    await db.getAllAsync<PlantRow>("SELECT * FROM plants ORDER BY nickname COLLATE NOCASE")
  ).map(toPlant);
  if (plants.length === 0) return [];

  const events = (
    await db.getAllAsync<EventRow>("SELECT * FROM care_events ORDER BY occurred_at DESC")
  ).map(toEvent);
  const photos = (
    await db.getAllAsync<PhotoRow>("SELECT * FROM photos ORDER BY taken_at DESC")
  ).map(toPhoto);

  return plants.map((plant) => ({
    plant,
    events: events.filter((e) => e.plantId === plant.id),
    photos: photos.filter((p) => p.plantId === plant.id).slice(0, 1),
  }));
}

export async function getPlant(
  db: SQLiteDatabase,
  id: number,
): Promise<(PlantWithHistory & { mother: Plant | null; propagations: Plant[] }) | null> {
  const row = await db.getFirstAsync<PlantRow>("SELECT * FROM plants WHERE id = ?", [id]);
  if (!row) return null;
  const plant = toPlant(row);

  const [events, photos, motherRow, children] = await Promise.all([
    db.getAllAsync<EventRow>(
      "SELECT * FROM care_events WHERE plant_id = ? ORDER BY occurred_at DESC, id DESC",
      [id],
    ),
    db.getAllAsync<PhotoRow>(
      "SELECT * FROM photos WHERE plant_id = ? ORDER BY taken_at DESC, id DESC",
      [id],
    ),
    plant.motherPlantId
      ? db.getFirstAsync<PlantRow>("SELECT * FROM plants WHERE id = ?", [plant.motherPlantId])
      : Promise.resolve(null),
    db.getAllAsync<PlantRow>(
      "SELECT * FROM plants WHERE mother_plant_id = ? ORDER BY propagated_at DESC",
      [id],
    ),
  ]);

  return {
    plant,
    events: events.map(toEvent),
    photos: photos.map(toPhoto),
    mother: motherRow ? toPlant(motherRow) : null,
    propagations: children.map(toPlant),
  };
}

/** Walk mother → grandmother → … (oldest first). Depth-capped against bad data. */
export async function motherLine(db: SQLiteDatabase, motherPlantId: number | null, maxDepth = 12) {
  const line: Plant[] = [];
  const seen = new Set<number>();
  let next = motherPlantId;
  while (next && line.length < maxDepth && !seen.has(next)) {
    seen.add(next);
    const row = await db.getFirstAsync<PlantRow>("SELECT * FROM plants WHERE id = ?", [next]);
    if (!row) break;
    const plant = toPlant(row);
    line.unshift(plant);
    next = plant.motherPlantId;
  }
  return line;
}

// ---------------------------------------------------------------------------
// Writes. Each one stamps updated_at and leaves the row dirty (the column
// default) so the next sync pushes it.
// ---------------------------------------------------------------------------

export interface NewPlant {
  nickname: string;
  species?: string | null;
  location?: string | null;
  acquiredAt?: string | null;
  acquiredFrom?: string | null;
  motherPlantId?: number | null;
  photoUri?: string | null;
  /** Reminder cadences in days; the defaults apply where these are unset. */
  waterEveryDays?: number | null;
  fertilizeEveryDays?: number | null;
  repotEveryDays?: number | null;
  photoEveryDays?: number | null;
}

async function insertEvent(
  db: SQLiteDatabase,
  plantId: number,
  type: CareType,
  notes: string | null,
  occurredAt: string,
  now: string,
): Promise<void> {
  await db.runAsync(
    "INSERT INTO care_events (uuid, plant_id, type, notes, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [uuid(), plantId, type, notes, occurredAt, now, now],
  );
}

export async function createPlant(db: SQLiteDatabase, input: NewPlant): Promise<number> {
  const now = nowIso();
  const acquiredAt = input.acquiredAt || now;
  const mother = input.motherPlantId ?? null;
  let id = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO plants (
         uuid, nickname, species, location, status, acquired_at, acquired_from,
         water_every_days, fertilize_every_days, repot_every_days, photo_every_days,
         mother_plant_id, propagated_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        input.nickname.trim(),
        blank(input.species),
        blank(input.location),
        acquiredAt,
        blank(input.acquiredFrom),
        input.waterEveryDays ?? DEFAULT_CADENCE.waterEveryDays,
        input.fertilizeEveryDays ?? DEFAULT_CADENCE.fertilizeEveryDays,
        input.repotEveryDays ?? DEFAULT_CADENCE.repotEveryDays,
        input.photoEveryDays ?? DEFAULT_CADENCE.photoEveryDays,
        mother,
        mother ? acquiredAt : null,
        now,
        now,
      ],
    );
    id = result.lastInsertRowId;

    await insertEvent(
      db,
      id,
      mother ? "PROPAGATED" : "ACQUIRED",
      blank(input.acquiredFrom) ? `From ${blank(input.acquiredFrom)}` : null,
      acquiredAt,
      now,
    );

    if (input.photoUri) {
      await db.runAsync(
        "INSERT INTO photos (uuid, plant_id, uri, taken_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [uuid(), id, input.photoUri, now, now, now],
      );
      await insertEvent(db, id, "PHOTO", null, now, now);
    }
  });

  return id;
}

export async function logCare(
  db: SQLiteDatabase,
  plantId: number,
  type: CareType,
  options: { notes?: string | null; occurredAt?: string | null } = {},
): Promise<void> {
  const now = nowIso();
  await insertEvent(db, plantId, type, blank(options.notes), options.occurredAt || now, now);
}

/** Clears an issue and writes the fix into the record as a TREATMENT. */
export async function resolveIssue(
  db: SQLiteDatabase,
  eventId: number,
  treatmentNotes?: string | null,
): Promise<void> {
  const issue = await db.getFirstAsync<EventRow>(
    "SELECT * FROM care_events WHERE id = ? AND type = 'ISSUE'",
    [eventId],
  );
  if (!issue) return;
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE care_events SET resolved_at = ?, updated_at = ?, dirty = 1 WHERE id = ?", [
      now,
      now,
      eventId,
    ]);
    await insertEvent(
      db,
      issue.plant_id,
      "TREATMENT",
      blank(treatmentNotes) ?? `Resolved: ${issue.notes ?? "issue"}`,
      now,
      now,
    );
  });
}

export async function addPhoto(
  db: SQLiteDatabase,
  plantId: number,
  uri: string,
  options: { caption?: string | null; takenAt?: string | null } = {},
): Promise<void> {
  const now = nowIso();
  const takenAt = options.takenAt || now;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO photos (uuid, plant_id, uri, caption, taken_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [uuid(), plantId, uri, blank(options.caption), takenAt, now, now],
    );
    await insertEvent(db, plantId, "PHOTO", null, takenAt, now);
  });
}

export interface PlantUpdate {
  nickname: string;
  species: string | null;
  location: string | null;
  status: PlantStatus;
  notes: string | null;
  waterEveryDays: number | null;
  fertilizeEveryDays: number | null;
  repotEveryDays: number | null;
  photoEveryDays: number | null;
}

export async function updatePlant(db: SQLiteDatabase, id: number, input: PlantUpdate): Promise<void> {
  await db.runAsync(
    `UPDATE plants SET
       nickname = ?, species = ?, location = ?, status = ?, notes = ?,
       water_every_days = ?, fertilize_every_days = ?, repot_every_days = ?, photo_every_days = ?,
       updated_at = ?, dirty = 1
     WHERE id = ?`,
    [
      input.nickname.trim(),
      blank(input.species),
      blank(input.location),
      input.status,
      blank(input.notes),
      input.waterEveryDays,
      input.fertilizeEveryDays,
      input.repotEveryDays,
      input.photoEveryDays,
      nowIso(),
      id,
    ],
  );
}

/** A cutting: new plant linked to its mother, with a PROPAGATED entry on both. */
export async function propagate(
  db: SQLiteDatabase,
  motherId: number,
  nickname: string,
  propagatedAt?: string | null,
): Promise<number> {
  const mother = await db.getFirstAsync<PlantRow>("SELECT * FROM plants WHERE id = ?", [motherId]);
  if (!mother) throw new Error("Mother plant not found");
  const when = propagatedAt || nowIso();

  const childId = await createPlant(db, {
    nickname,
    species: mother.species,
    acquiredAt: when,
    acquiredFrom: `Propagated from ${mother.nickname}`,
    motherPlantId: motherId,
  });
  await logCare(db, motherId, "PROPAGATED", {
    notes: `Cutting taken for ${nickname.trim()}`,
    occurredAt: when,
  });
  return childId;
}

/** Record that a plant has been published (or republished) as a tag. The
 *  server owns the token, so this doesn't dirty the row. */
export async function markPublished(db: SQLiteDatabase, id: number, passportToken: string): Promise<void> {
  await db.runAsync("UPDATE plants SET passport_token = ?, published_at = ? WHERE id = ?", [
    passportToken,
    nowIso(),
    id,
  ]);
}

export async function markUnpublished(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE plants SET passport_token = NULL, published_at = NULL WHERE id = ?", [id]);
}

export async function markPhotoUploaded(db: SQLiteDatabase, photoId: number, remotePath: string): Promise<void> {
  await db.runAsync("UPDATE photos SET remote_path = ? WHERE id = ?", [remotePath, photoId]);
}

/** The species care guide cached on-device, if we've fetched it before. */
export async function getCachedCareCard<T = unknown>(db: SQLiteDatabase, speciesKey: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ card_json: string }>(
    "SELECT card_json FROM care_cards WHERE species_key = ?",
    [speciesKey],
  );
  if (!row) return null;
  try {
    return JSON.parse(row.card_json) as T;
  } catch {
    return null;
  }
}

export async function saveCareCard(db: SQLiteDatabase, speciesKey: string, card: unknown): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO care_cards (species_key, card_json, fetched_at) VALUES (?, ?, ?)",
    [speciesKey, JSON.stringify(card), nowIso()],
  );
}

/** Remove a plant and its history here, and remember the deletion so the
 *  next sync tells the server (and so other devices) about it. */
export async function deletePlant(db: SQLiteDatabase, id: number): Promise<void> {
  const row = await db.getFirstAsync<{ uuid: string }>("SELECT uuid FROM plants WHERE id = ?", [id]);
  await db.withTransactionAsync(async () => {
    if (row) {
      await db.runAsync("INSERT OR REPLACE INTO sync_tombstones (uuid, deleted_at) VALUES (?, ?)", [
        row.uuid,
        nowIso(),
      ]);
    }
    await db.runAsync("DELETE FROM plants WHERE id = ?", [id]);
  });
}

// ---------------------------------------------------------------------------
// Sync. The engine in src/lib/sync.ts moves rows between here and the
// server; these are the only queries that know about `dirty`, tombstones and
// the pull cursor. Remote rows are the server's column names.
// ---------------------------------------------------------------------------

export interface RemotePlant {
  id: string;
  nickname: string;
  species: string | null;
  location: string | null;
  status: string;
  acquired_at: string;
  acquired_from: string | null;
  notes: string | null;
  water_every_days: number | null;
  fertilize_every_days: number | null;
  repot_every_days: number | null;
  photo_every_days: number | null;
  mother_plant_id: string | null;
  propagated_at: string | null;
  passport_token: string | null;
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteEvent {
  id: string;
  plant_id: string;
  type: string;
  notes: string | null;
  occurred_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemotePhoto {
  id: string;
  plant_id: string;
  path: string;
  caption: string | null;
  taken_at: string;
  created_at: string;
  updated_at: string;
}

export type SyncTable = "plants" | "care_events" | "photos";

export async function dirtyPlants(db: SQLiteDatabase): Promise<(Plant & { motherUuid: string | null })[]> {
  const rows = await db.getAllAsync<PlantRow & { mother_uuid: string | null }>(
    `SELECT p.*, m.uuid AS mother_uuid FROM plants p
       LEFT JOIN plants m ON m.id = p.mother_plant_id
      WHERE p.dirty = 1 ORDER BY p.id`,
  );
  return rows.map((r) => ({ ...toPlant(r), motherUuid: r.mother_uuid }));
}

export async function dirtyEvents(db: SQLiteDatabase): Promise<(CareEvent & { plantUuid: string; createdAt: string })[]> {
  const rows = await db.getAllAsync<EventRow & { plant_uuid: string }>(
    `SELECT e.*, p.uuid AS plant_uuid FROM care_events e JOIN plants p ON p.id = e.plant_id
      WHERE e.dirty = 1 ORDER BY e.id`,
  );
  return rows.map((r) => ({ ...toEvent(r), plantUuid: r.plant_uuid, createdAt: r.created_at }));
}

export async function dirtyPhotos(db: SQLiteDatabase): Promise<(Photo & { plantUuid: string; createdAt: string })[]> {
  const rows = await db.getAllAsync<PhotoRow & { plant_uuid: string }>(
    `SELECT ph.*, p.uuid AS plant_uuid FROM photos ph JOIN plants p ON p.id = ph.plant_id
      WHERE ph.dirty = 1 ORDER BY ph.id`,
  );
  return rows.map((r) => ({ ...toPhoto(r), plantUuid: r.plant_uuid, createdAt: r.created_at }));
}

export async function clearDirty(db: SQLiteDatabase, table: SyncTable, uuids: string[]): Promise<void> {
  for (const id of uuids) {
    await db.runAsync(`UPDATE ${table} SET dirty = 0 WHERE uuid = ?`, [id]);
  }
}

/** Everything still waiting to be pushed — for the account screen. */
export async function pendingChanges(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT count(*) FROM plants WHERE dirty = 1)
          + (SELECT count(*) FROM care_events WHERE dirty = 1)
          + (SELECT count(*) FROM photos WHERE dirty = 1)
          + (SELECT count(*) FROM sync_tombstones) AS n`,
  );
  return row?.n ?? 0;
}

/** Flag every row for the next push — when a different account signs in on
 *  this device, its greenhouse should follow. */
export async function markAllDirty(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(
    "UPDATE plants SET dirty = 1; UPDATE care_events SET dirty = 1; UPDATE photos SET dirty = 1; DELETE FROM sync_meta;",
  );
}

export async function listTombstones(db: SQLiteDatabase): Promise<{ uuid: string; deletedAt: string }[]> {
  const rows = await db.getAllAsync<{ uuid: string; deleted_at: string }>("SELECT * FROM sync_tombstones");
  return rows.map((r) => ({ uuid: r.uuid, deletedAt: r.deleted_at }));
}

export async function clearTombstones(db: SQLiteDatabase, uuids: string[]): Promise<void> {
  for (const id of uuids) await db.runAsync("DELETE FROM sync_tombstones WHERE uuid = ?", [id]);
}

export async function getSyncMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setSyncMeta(db: SQLiteDatabase, key: string, value: string | null): Promise<void> {
  if (value === null) await db.runAsync("DELETE FROM sync_meta WHERE key = ?", [key]);
  else await db.runAsync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)", [key, value]);
}

export async function plantIdByUuid(db: SQLiteDatabase, plantUuid: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>("SELECT id FROM plants WHERE uuid = ?", [plantUuid]);
  return row?.id ?? null;
}

export type Applied = "inserted" | "updated" | "skipped";

/**
 * Bring a plant from the server into the local database. Last write wins by
 * updated_at; a local edit that is at least as new stays (and stays dirty,
 * so it pushes next). The mother link is set afterwards by linkMotherByUuid,
 * once every plant of the pull exists locally.
 */
export async function applyRemotePlant(db: SQLiteDatabase, r: RemotePlant): Promise<Applied> {
  const local = await db.getFirstAsync<{ id: number; updated_at: string }>(
    "SELECT id, updated_at FROM plants WHERE uuid = ?",
    [r.id],
  );
  const token = r.is_public ? r.passport_token : null;
  const publishedAt = r.is_public ? r.published_at : null;
  if (!local) {
    await db.runAsync(
      `INSERT INTO plants (
         uuid, nickname, species, location, status, acquired_at, acquired_from, notes,
         water_every_days, fertilize_every_days, repot_every_days, photo_every_days,
         mother_plant_id, propagated_at, passport_token, published_at, created_at, updated_at, dirty
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0)`,
      [
        r.id, r.nickname, r.species, r.location, r.status, r.acquired_at, r.acquired_from, r.notes,
        r.water_every_days, r.fertilize_every_days, r.repot_every_days, r.photo_every_days,
        r.propagated_at, token, publishedAt, r.created_at, r.updated_at,
      ],
    );
    return "inserted";
  }
  if (!newer(local.updated_at, r.updated_at)) return "skipped";
  await db.runAsync(
    `UPDATE plants SET
       nickname = ?, species = ?, location = ?, status = ?, acquired_at = ?, acquired_from = ?, notes = ?,
       water_every_days = ?, fertilize_every_days = ?, repot_every_days = ?, photo_every_days = ?,
       propagated_at = ?, passport_token = ?, published_at = ?, updated_at = ?, dirty = 0
     WHERE id = ?`,
    [
      r.nickname, r.species, r.location, r.status, r.acquired_at, r.acquired_from, r.notes,
      r.water_every_days, r.fertilize_every_days, r.repot_every_days, r.photo_every_days,
      r.propagated_at, token, publishedAt, r.updated_at, local.id,
    ],
  );
  return "updated";
}

export async function linkMotherByUuid(db: SQLiteDatabase, plantUuid: string, motherUuid: string | null): Promise<void> {
  const motherId = motherUuid ? await plantIdByUuid(db, motherUuid) : null;
  await db.runAsync("UPDATE plants SET mother_plant_id = ? WHERE uuid = ? AND mother_plant_id IS NOT ?", [
    motherId,
    plantUuid,
    motherId,
  ]);
}

/** A deletion learned from the server: the plant and its history go, quietly. */
export async function deletePlantByUuid(db: SQLiteDatabase, plantUuid: string): Promise<boolean> {
  const result = await db.runAsync("DELETE FROM plants WHERE uuid = ?", [plantUuid]);
  await db.runAsync("DELETE FROM sync_tombstones WHERE uuid = ?", [plantUuid]);
  return result.changes > 0;
}

export async function applyRemoteEvent(db: SQLiteDatabase, r: RemoteEvent): Promise<Applied> {
  const local = await db.getFirstAsync<{ id: number; updated_at: string }>(
    "SELECT id, updated_at FROM care_events WHERE uuid = ?",
    [r.id],
  );
  if (!local) {
    const plantId = await plantIdByUuid(db, r.plant_id);
    if (!plantId) return "skipped";
    await db.runAsync(
      "INSERT INTO care_events (uuid, plant_id, type, notes, occurred_at, resolved_at, created_at, updated_at, dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
      [r.id, plantId, r.type, r.notes, r.occurred_at, r.resolved_at, r.created_at, r.updated_at],
    );
    return "inserted";
  }
  if (!newer(local.updated_at, r.updated_at)) return "skipped";
  await db.runAsync(
    "UPDATE care_events SET type = ?, notes = ?, occurred_at = ?, resolved_at = ?, updated_at = ?, dirty = 0 WHERE id = ?",
    [r.type, r.notes, r.occurred_at, r.resolved_at, r.updated_at, local.id],
  );
  return "updated";
}

/** Photos are immutable once taken: a new one is inserted, a known one left alone. */
export async function applyRemotePhoto(db: SQLiteDatabase, r: RemotePhoto, uri: string): Promise<Applied> {
  const local = await db.getFirstAsync<{ id: number }>("SELECT id FROM photos WHERE uuid = ?", [r.id]);
  if (local) return "skipped";
  const plantId = await plantIdByUuid(db, r.plant_id);
  if (!plantId) return "skipped";
  await db.runAsync(
    "INSERT INTO photos (uuid, plant_id, uri, caption, taken_at, remote_path, created_at, updated_at, dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
    [r.id, plantId, uri, r.caption, r.taken_at, r.path, r.created_at, r.updated_at],
  );
  return "inserted";
}
