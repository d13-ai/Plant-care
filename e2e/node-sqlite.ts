import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Backs the app's real `src/db` layer with node:sqlite so the publish path can
 * run outside Expo. `src/db/index.ts` imports `SQLiteDatabase` as a type only,
 * so anything implementing the five methods it calls is a drop-in.
 */
type Param = string | number | null;

const normalize = (params: unknown[]): Param[] =>
  params.map((p) => (p === undefined || p === null ? null : (p as Param)));

export interface TestDatabase {
  db: SQLiteDatabase;
  close: () => void;
}

export function openTestDatabase(): TestDatabase {
  const sqlite = new DatabaseSync(":memory:");

  const adapter = {
    async execAsync(source: string): Promise<void> {
      sqlite.exec(source);
    },
    async runAsync(source: string, params: unknown[] = []) {
      const result = sqlite.prepare(source).run(...normalize(params));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getFirstAsync(source: string, params: unknown[] = []) {
      return sqlite.prepare(source).get(...normalize(params)) ?? null;
    },
    async getAllAsync(source: string, params: unknown[] = []) {
      return sqlite.prepare(source).all(...normalize(params));
    },
    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      sqlite.exec("BEGIN");
      try {
        await task();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };

  return {
    db: adapter as unknown as SQLiteDatabase,
    close: () => sqlite.close(),
  };
}
