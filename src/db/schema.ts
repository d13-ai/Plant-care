/**
 * On-device schema (v0: no accounts, no sync). Dates are ISO-8601 strings
 * because that is what SQLite stores and what the domain layer parses.
 *
 * mother_plant_id already exists so propagation lineage doesn't need a
 * migration later; a mother is another local plant.
 */
export const SCHEMA_VERSION = 3;

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
