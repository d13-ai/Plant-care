/**
 * On-device schema. Dates are ISO-8601 strings
 * because that is what SQLite stores and what the domain layer parses.
 *
 * mother_plant_id already exists so propagation lineage doesn't need a
 * migration later; a mother is another local plant.
 */
export const SCHEMA_VERSION = 5;

/** A v4 uuid in SQLite, for backfilling rows that predate sync. */
const UUID_SQL = "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))";

/**
 * Incremental migrations, keyed by the version they upgrade *to*. v1 is the
 * base CREATE_TABLES; each later step is a list of statements.
 */
export const MIGRATIONS: Record<number, string[]> = {
  2: [
    // Passport bookkeeping: set once a plant is published to Supabase.
    "ALTER TABLE plants ADD COLUMN passport_token TEXT",
    "ALTER TABLE plants ADD COLUMN published_at TEXT",
    // Storage object path once a photo has been uploaded, so republishing
    // doesn't re-upload it.
    "ALTER TABLE photos ADD COLUMN remote_path TEXT",
  ],
  3: [
    // A local cache of the per-species care guide, so it shows offline and
    // isn't re-fetched. Keyed by the normalized species name.
    "CREATE TABLE IF NOT EXISTS care_cards (species_key TEXT PRIMARY KEY, card_json TEXT NOT NULL, fetched_at TEXT NOT NULL)",
  ],
  4: [
    // Web photos used to be stored as the browser's blob: URL, which dies
    // with the page that made it — those rows can never render again.
    // Photos are stored as data: URLs now. (No-op on native.)
    "DELETE FROM photos WHERE uri LIKE 'blob:%'",
  ],
  5: [
    // v2 sync. Every row gets a uuid the server keys on (backfilled here
    // for rows that predate sync — a v4 uuid built in SQL), a `dirty` flag
    // set by every local write and cleared by a push, and `updated_at` for
    // last-write-wins between devices. Tombstones remember deletes until
    // they're pushed; sync_meta holds the pull cursor.
    "ALTER TABLE plants ADD COLUMN uuid TEXT",
    "ALTER TABLE plants ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1",
    `UPDATE plants SET uuid = ${UUID_SQL} WHERE uuid IS NULL`,
    "CREATE UNIQUE INDEX IF NOT EXISTS plants_uuid_idx ON plants(uuid)",
    "ALTER TABLE care_events ADD COLUMN uuid TEXT",
    "ALTER TABLE care_events ADD COLUMN updated_at TEXT",
    "ALTER TABLE care_events ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1",
    `UPDATE care_events SET uuid = ${UUID_SQL}, updated_at = COALESCE(updated_at, created_at) WHERE uuid IS NULL`,
    "CREATE UNIQUE INDEX IF NOT EXISTS care_events_uuid_idx ON care_events(uuid)",
    "ALTER TABLE photos ADD COLUMN uuid TEXT",
    "ALTER TABLE photos ADD COLUMN updated_at TEXT",
    "ALTER TABLE photos ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1",
    `UPDATE photos SET uuid = ${UUID_SQL}, updated_at = COALESCE(updated_at, created_at) WHERE uuid IS NULL`,
    "CREATE UNIQUE INDEX IF NOT EXISTS photos_uuid_idx ON photos(uuid)",
    "CREATE TABLE IF NOT EXISTS sync_tombstones (uuid TEXT PRIMARY KEY, deleted_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  ],
};

export const CREATE_TABLES = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS plants (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname            TEXT    NOT NULL,
  species             TEXT,
  location            TEXT,
  status              TEXT    NOT NULL DEFAULT 'ACTIVE',
  acquired_at         TEXT    NOT NULL,
  acquired_from       TEXT,
  notes               TEXT,
  water_every_days    INTEGER,
  fertilize_every_days INTEGER,
  repot_every_days    INTEGER,
  photo_every_days    INTEGER,
  mother_plant_id     INTEGER REFERENCES plants(id) ON DELETE SET NULL,
  propagated_at       TEXT,
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS care_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plant_id    INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  notes       TEXT,
  occurred_at TEXT    NOT NULL,
  resolved_at TEXT,
  created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS care_events_plant_idx ON care_events(plant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plant_id   INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  uri        TEXT    NOT NULL,
  caption    TEXT,
  taken_at   TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_plant_idx ON photos(plant_id, taken_at DESC);
`;
