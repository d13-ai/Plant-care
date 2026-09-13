import type { SQLiteDatabase } from "expo-sqlite";
import type { CareType } from "@/domain/care";
import { CREATE_TABLES, MIGRATIONS, SCHEMA_VERSION } from "./schema";

// ---------------------------------------------------------------------------
// Types the rest of the app sees. Column names are snake_case in SQLite and
// camelCase here; the mappers below are the only place that knows both.
// ---------------------------------------------------------------------------

export type PlantStatus = "ACTIVE" | "DORMANT" | "DECEASED";

export interface Plant {
  id: number;
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
  plantId: number;
  type: CareType;
  notes: string | null;
  occurredAt: string;
  resolvedAt: string | null;
}

export interface Photo {
  id: number;
  plantId: number;
  uri: string;
  caption: string | null;
  takenAt: string;
  remotePath: string | null;
}

export const DEFAULT_CADENCE = {
  waterEveryDays: 7,
  fertilizeEveryDays: 30,
  repotEveryDays: 365,
  photoEveryDays: 180,
} as const;

type PlantRow = {
  id: number;
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
};

type EventRow = {
  id: number;
  plant_id: number;
  type: string;
  notes: string | null;
  occurred_at: string;
  resolved_at: string | null;
};

type PhotoRow = {
  id: number;
  plant_id: number;
  uri: string;
  caption: string | null;
  taken_at: string;
  remote_path: string | null;
};

const toPlant = (r: PlantRow): Plant => ({
  id: r.id,
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
  plantId: r.plant_id,
  type: r.type as CareType,
  notes: r.notes,
  occurredAt: r.occurred_at,
  resolvedAt: r.resolved_at,
});

const toPhoto = (r: PhotoRow): Photo => ({
  id: r.id,
  plantId: r.plant_id,
  uri: r.uri,
  caption: r.caption,
  takenAt: r.taken_at,
  remotePath: r.remote_path,
});

const nowIso = () => new Date().toISOString();
const blank = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

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
// Writes
// ---------------------------------------------------------------------------

export interface NewPlant {
  nickname: string;
  species?: string | null;
  location?: string | null;
  acquiredAt?: string | null;
  acquiredFrom?: string | null;
  motherPlantId?: number | null;
  photoUri?: string | null;
}

export async function createPlant(db: SQLiteDatabase, input: NewPlant): Promise<number> {
  const now = nowIso();
  const acquiredAt = input.acquiredAt || now;
  const mother = input.motherPlantId ?? null;
  let id = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO plants (
         nickname, species, location, status, acquired_at, acquired_from,
         water_every_days, fertilize_every_days, repot_every_days, photo_every_days,
         mother_plant_id, propagated_at, created_at, updated_at
       ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.nickname.trim(),
        blank(input.species),
        blank(input.location),
        acquiredAt,
        blank(input.acquiredFrom),
        DEFAULT_CADENCE.waterEveryDays,
        DEFAULT_CADENCE.fertilizeEveryDays,
        DEFAULT_CADENCE.repotEveryDays,
        DEFAULT_CADENCE.photoEveryDays,
        mother,
        mother ? acquiredAt : null,
        now,
        now,
      ],
    );
    id = result.lastInsertRowId;

    await db.runAsync(
      "INSERT INTO care_events (plant_id, type, notes, occurred_at, created_at) VALUES (?, ?, ?, ?, ?)",
      [
        id,
        mother ? "PROPAGATED" : "ACQUIRED",
        blank(input.acquiredFrom) ? `From ${blank(input.acquiredFrom)}` : null,
        acquiredAt,
        now,
      ],
    );

    if (input.photoUri) {
      await db.runAsync(
        "INSERT INTO photos (plant_id, uri, taken_at, created_at) VALUES (?, ?, ?, ?)",
        [id, input.photoUri, now, now],
      );
      await db.runAsync(
        "INSERT INTO care_events (plant_id, type, occurred_at, created_at) VALUES (?, 'PHOTO', ?, ?)",
        [id, now, now],
      );
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
  await db.runAsync(
    "INSERT INTO care_events (plant_id, type, notes, occurred_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [plantId, type, blank(options.notes), options.occurredAt || nowIso(), nowIso()],
  );
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
    await db.runAsync("UPDATE care_events SET resolved_at = ? WHERE id = ?", [now, eventId]);
    await db.runAsync(
      "INSERT INTO care_events (plant_id, type, notes, occurred_at, created_at) VALUES (?, 'TREATMENT', ?, ?, ?)",
      [issue.plant_id, blank(treatmentNotes) ?? `Resolved: ${issue.notes ?? "issue"}`, now, now],
    );
  });
}

export async function addPhoto(
  db: SQLiteDatabase,
  plantId: number,
  uri: string,
  options: { caption?: string | null; takenAt?: string | null } = {},
): Promise<void> {
  const takenAt = options.takenAt || nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO photos (plant_id, uri, caption, taken_at, created_at) VALUES (?, ?, ?, ?, ?)",
      [plantId, uri, blank(options.caption), takenAt, nowIso()],
    );
    await db.runAsync(
      "INSERT INTO care_events (plant_id, type, occurred_at, created_at) VALUES (?, 'PHOTO', ?, ?)",
      [plantId, takenAt, nowIso()],
    );
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
       updated_at = ?
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

/** Record that a plant has been published (or republished) as a passport. */
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

export async function deletePlant(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("DELETE FROM plants WHERE id = ?", [id]);
}
