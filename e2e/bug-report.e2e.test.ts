/**
 * The counts a bug report carries are read from the *local* schema, which is
 * not the server's — a deleted plant leaves `plants` here and lands in
 * `sync_tombstones`, so there is no deleted_at to filter on.
 *
 * localCounts swallows its own errors on purpose, so that a broken query
 * cannot stop a report being sent. That is the right behaviour and it is also
 * why the first version shipped querying a column that does not exist: every
 * report quietly said "unreadable" instead of failing. This asserts the
 * queries actually run against a real migrated database.
 */
import { describe, expect, test } from "vitest";
import { createPlant, deletePlant, migrate } from "@/db";
import { localCounts } from "@/lib/bug-report";
import { openTestDatabase } from "./node-sqlite";

describe("the counts a bug report carries", () => {
  test("read cleanly from a migrated local database", async () => {
    const local = openTestDatabase();
    try {
      await migrate(local.db);
      const empty = await localCounts(local.db);
      // The tell: any failure comes back as this pair instead of counts.
      expect(empty.db, `localCounts failed: ${empty.dbError}`).toBeUndefined();
      expect(empty).toMatchObject({ plants: 0, dirtyPlants: 0, photos: 0, pendingDeletes: 0 });

      const id = await createPlant(local.db, {
        nickname: "Counted",
        acquiredAt: new Date().toISOString(),
      });
      const withOne = await localCounts(local.db);
      expect(withOne).toMatchObject({ plants: 1, dirtyPlants: 1 });

      // A removed plant leaves the table and becomes a tombstone, which is
      // the bit the server-shaped query got wrong.
      await deletePlant(local.db, id);
      const after = await localCounts(local.db);
      expect(after.db, `localCounts failed after a delete: ${after.dbError}`).toBeUndefined();
      expect(after).toMatchObject({ plants: 0, pendingDeletes: 1 });
    } finally {
      local.close();
    }
  });

  test("say so plainly when there is no database at all", async () => {
    expect(await localCounts(null)).toEqual({ db: "unavailable" });
  });
});
