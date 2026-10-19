import { describe, expect, test } from "vitest";
import { openTestDatabase } from "../../e2e/node-sqlite";
import { claimGreenhouse, createPlant, getSyncMeta, greenhouseKeeper, markAllDirty, migrate, setSyncMeta, wipeLocalData } from "./index";

const AMANDA = "6b0f2a7e-3c1d-4e5f-9a8b-7c6d5e4f3a2b";
const DAVID = "0d1c2b3a-4f5e-4d6c-8b7a-9f8e7d6c5b4a";

async function freshGreenhouse() {
  const t = openTestDatabase();
  await migrate(t.db);
  return t;
}

describe("a greenhouse file is one account's", () => {
  test("the first account to open it keeps it; a second doesn't take it over", async () => {
    const { db, close } = await freshGreenhouse();
    try {
      expect(await claimGreenhouse(db, AMANDA)).toBe(AMANDA);
      expect(await claimGreenhouse(db, DAVID)).toBe(AMANDA);
      expect(await greenhouseKeeper(db)).toBe(AMANDA);
    } finally {
      close();
    }
  });

  test("plants nobody synced go up under the account that adopts them", async () => {
    const { db, close } = await freshGreenhouse();
    try {
      await createPlant(db, { nickname: "Fern", species: null, location: null, acquiredAt: null, waterEveryDays: 7 });
      await db.execAsync("UPDATE plants SET dirty = 0");
      await claimGreenhouse(db, AMANDA);
      const row = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM plants WHERE dirty = 1");
      expect(row?.n).toBe(1);
    } finally {
      close();
    }
  });

  test("marking everything for upload forgets the cursors, not whose it is", async () => {
    const { db, close } = await freshGreenhouse();
    try {
      await claimGreenhouse(db, AMANDA);
      await setSyncMeta(db, "cursor:plants", "2026-10-18T00:00:00Z");
      await markAllDirty(db);
      expect(await getSyncMeta(db, "cursor:plants")).toBeNull();
      expect(await greenhouseKeeper(db)).toBe(AMANDA);
    } finally {
      close();
    }
  });

  test("a deleted account's emptied greenhouse isn't handed to the next one", async () => {
    const { db, close } = await freshGreenhouse();
    try {
      await claimGreenhouse(db, AMANDA);
      await createPlant(db, { nickname: "Fern", species: null, location: null, acquiredAt: null, waterEveryDays: 7 });
      await wipeLocalData(db);
      const row = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM plants");
      expect(row?.n).toBe(0);
      expect(await claimGreenhouse(db, DAVID)).toBe(AMANDA);
    } finally {
      close();
    }
  });
});
