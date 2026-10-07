import { describe, expect, test } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { migrate } from "./index";
import { CREATE_TABLES, SCHEMA_VERSION } from "./schema";

/**
 * Just enough of a database to hold migrate() to Android's rules: changing the
 * journal mode inside a transaction throws, as it did on the first Play build
 * (PP-93D157, 6 Oct 2026: "cannot change into wal mode from within a
 * transaction"), and user_version follows what was committed.
 */
function androidLikeDb() {
  let inTransaction = false;
  let userVersion = 0;
  const statements: { sql: string; inTransaction: boolean }[] = [];
  const db = {
    async execAsync(sql: string) {
      statements.push({ sql, inTransaction });
      if (/journal_mode\s*=\s*wal/i.test(sql) && inTransaction) {
        throw new Error("cannot change into wal mode from within a transaction");
      }
      const v = /PRAGMA user_version = (\d+)/.exec(sql);
      if (v) userVersion = Number(v[1]);
    },
    async getFirstAsync(sql: string) {
      return /user_version/.test(sql) ? { user_version: userVersion } : null;
    },
    async withTransactionAsync(work: () => Promise<void>) {
      inTransaction = true;
      try {
        await work();
      } finally {
        inTransaction = false;
      }
    },
  };
  return { db: db as unknown as SQLiteDatabase, statements, version: () => userVersion };
}

describe("opening the database on a phone", () => {
  test("a brand-new install opens, with WAL switched on outside any transaction", async () => {
    const { db, statements, version } = androidLikeDb();
    await migrate(db, { wal: true });
    expect(version()).toBe(SCHEMA_VERSION);
    const wal = statements.filter((s) => /journal_mode/i.test(s.sql));
    expect(wal).toHaveLength(1);
    expect(wal[0].inTransaction).toBe(false);
  });

  test("the table setup that runs inside a transaction carries no pragmas", () => {
    expect(CREATE_TABLES).not.toMatch(/PRAGMA/i);
  });

  test("the web build leaves the journal mode alone, as it always has", async () => {
    const { db, statements } = androidLikeDb();
    await migrate(db);
    expect(statements.some((s) => /journal_mode/i.test(s.sql))).toBe(false);
  });
});
