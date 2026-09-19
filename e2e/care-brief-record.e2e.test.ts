/**
 * The brief the AI is sent has to come out of the real record.
 *
 * `careBrief` takes `occurredAt`, `resolvedAt`, `type` — the shape the db
 * layer returns. If a column were ever renamed, or `getPlant` stopped
 * mapping one, the brief would quietly go empty and the health check would
 * be back to reading soil colour off a photograph: no error, no failing
 * type, just a worse answer. So this builds a plant the way the app does,
 * logs care through the same functions the screen calls, and reads the brief
 * off `getPlant` exactly as the plant page does.
 */
import { expect, test } from "vitest";
import { careBrief } from "@/domain/care-brief";
import { createPlant, getPlant, logCare, migrate, resolveIssue } from "@/db";
import { openTestDatabase } from "./node-sqlite";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

test("a plant's own record reaches the AI as plain facts", async () => {
  const { db, close } = openTestDatabase();
  try {
    await migrate(db);
    // Gepetto Two-step, as the record actually stood on 18 Sep 2026.
    const plantId = await createPlant(db, {
      nickname: "Gepetto",
      species: "Monstera deliciosa 'Thai Constellation'",
      waterEveryDays: 7,
    });
    await logCare(db, plantId, "REPOT", { occurredAt: daysAgo(11) });
    await logCare(db, plantId, "WATER", { occurredAt: daysAgo(5) });
    await logCare(db, plantId, "WATER", { occurredAt: daysAgo(2) });
    const healed = await logCare(db, plantId, "ISSUE", { notes: "Spider mites", occurredAt: daysAgo(40) });
    await resolveIssue(db, healed, "Treated weekly for a month.");
    await logCare(db, plantId, "ISSUE", { notes: "Cream section going papery", occurredAt: daysAgo(1) });

    const data = await getPlant(db, plantId);
    const brief = careBrief(data!.events, data!.plant);

    // The two facts the model inferred at instead of being told.
    expect(brief).toContain("Watered: 2 days ago and 5 days ago");
    expect(brief).toContain("every 7 days");
    expect(brief).toContain("Repotted: 11 days ago");
    // Open issues travel; settled ones stay in the history where they belong.
    expect(brief).toContain("Cream section going papery");
    expect(brief).not.toContain("Spider mites");
    expect(brief).not.toMatch(/NaN|undefined/);
  } finally {
    close();
  }
});

test("a plant with nothing logged sends no brief at all", async () => {
  const { db, close } = openTestDatabase();
  try {
    await migrate(db);
    const plantId = await createPlant(db, { nickname: "Just arrived" });
    const data = await getPlant(db, plantId);
    // createPlant writes an ACQUIRED event, and when the plant arrived is
    // worth saying on its own. What must not happen is a brief built out of
    // empty fields: a heading with nothing under it, or a bare date.
    const brief = careBrief(data!.events, data!.plant);
    expect(brief).toContain("Brought home: today");
    expect(brief).not.toMatch(/Watered|Repotted|Unresolved/);
    expect(brief).not.toMatch(/NaN|undefined|: \./);
  } finally {
    close();
  }
});
