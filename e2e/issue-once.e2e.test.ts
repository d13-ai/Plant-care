/**
 * An open issue can only be on the record once.
 *
 * On 18 Sep 2026 the "Log as issue" button on a plant's health check wrote
 * eight rows in five seconds. It gave no feedback and did not disable itself,
 * so the keeper pressed it until something visibly happened, then deleted
 * seven duplicate issues by hand. The screen now says what it did — but a
 * record whose whole worth is being readable in three years should not
 * depend on a button behaving, or on which phone the presses landed on.
 *
 * Watering twice in a day is a real thing a keeper might do, so only ISSUE
 * is deduplicated, and only while it is unresolved: the same problem
 * happening again *after* it was fixed is a new entry, and the record should
 * say so. Offline; runs with the e2e suite because it needs node:sqlite.
 */
import { expect, test } from "vitest";
import { createPlant, listPlants, logCare, migrate, resolveIssue } from "@/db";
import { openTestDatabase } from "./node-sqlite";

const NOTE = "A large cream section has gone papery — likely sun through that window. Move it back a foot.";

async function withPlant(fn: (db: Awaited<ReturnType<typeof openTestDatabase>>["db"], plantId: number) => Promise<void>) {
  const { db, close } = openTestDatabase();
  try {
    await migrate(db);
    const plantId = await createPlant(db, { nickname: "Gepetto", species: "Monstera deliciosa 'Thai Constellation'" });
    await fn(db, plantId);
  } finally {
    close();
  }
}

const issues = async (db: Parameters<typeof logCare>[0], plantId: number) => {
  const plants = await listPlants(db);
  const plant = plants.find((p) => p.plant.id === plantId);
  return (plant?.events ?? []).filter((e) => e.type === "ISSUE");
};

test("pressing log-as-issue eight times leaves one open issue, not eight", async () => {
  await withPlant(async (db, plantId) => {
    const ids: number[] = [];
    for (let i = 0; i < 8; i++) ids.push(await logCare(db, plantId, "ISSUE", { notes: NOTE }));

    expect(await issues(db, plantId)).toHaveLength(1);
    // And every press was told about the same entry, so an undo offered after
    // the eighth press removes the issue rather than missing it.
    expect(new Set(ids).size).toBe(1);
  });
});

test("presses that land at the same moment still leave one", async () => {
  await withPlant(async (db, plantId) => {
    // Nothing here is serialised by the screen: two phones, or one thumb
    // faster than a round trip.
    await Promise.all(Array.from({ length: 5 }, () => logCare(db, plantId, "ISSUE", { notes: NOTE })));
    expect(await issues(db, plantId)).toHaveLength(1);
  });
});

test("a different problem is a different issue", async () => {
  await withPlant(async (db, plantId) => {
    await logCare(db, plantId, "ISSUE", { notes: NOTE });
    await logCare(db, plantId, "ISSUE", { notes: "Spider mites under the new leaf — treat weekly." });
    expect(await issues(db, plantId)).toHaveLength(2);
  });
});

test("the same problem again, after it was resolved, is a new entry", async () => {
  await withPlant(async (db, plantId) => {
    const first = await logCare(db, plantId, "ISSUE", { notes: NOTE });
    await resolveIssue(db, first, "Moved it back from the glass.");

    const second = await logCare(db, plantId, "ISSUE", { notes: NOTE });
    expect(second).not.toBe(first);
    // Both are on the record: it happened, it was fixed, it happened again.
    expect(await issues(db, plantId)).toHaveLength(2);
  });
});

test("watering twice is still watering twice", async () => {
  await withPlant(async (db, plantId) => {
    await logCare(db, plantId, "WATER");
    await logCare(db, plantId, "WATER");
    const plants = await listPlants(db);
    const waters = (plants.find((p) => p.plant.id === plantId)?.events ?? []).filter((e) => e.type === "WATER");
    expect(waters).toHaveLength(2);
  });
});
