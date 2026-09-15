/**
 * The tag page renderer in api/tag.ts, called directly (no Vercel needed):
 * a published plant renders as HTML with its record; a bad or unpublished
 * token is a 404 page. The live URL is covered by tag.e2e.test.ts.
 */
import { afterAll, beforeAll, expect, test } from "vitest";
import handler, { tagPage } from "../api/tag";
import { createPlant, logCare, migrate } from "@/db";
import { supabase } from "@/lib/supabase";
import { publishTag, unpublishTag } from "@/lib/tag";
import { openTestDatabase } from "./node-sqlite";

const t = openTestDatabase();
let plantId: number;
let token: string;

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.PASSPORT_E2E_EMAIL!,
    password: process.env.PASSPORT_E2E_PASSWORD!,
  });
  if (error) throw new Error(`Test account sign-in failed: ${error.message}`);
  await migrate(t.db);
  plantId = await createPlant(t.db, { nickname: "Handler check", species: "Monstera deliciosa", location: null, acquiredFrom: null, acquiredAt: null, motherPlantId: null, photoUri: null });
  await logCare(t.db, plantId, "AI_CHECK", { notes: "Looks healthy." });
  token = new URL(await publishTag(t.db, plantId)).searchParams.get("t")!;
});

afterAll(async () => {
  await unpublishTag(t.db, plantId).catch(() => {});
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.from("plants").delete().eq("nickname", "Handler check").eq("keeper_id", data.session.user.id);
  t.close();
  await supabase.auth.signOut();
});

test("a published plant renders as HTML", async () => {
  const { status, html } = await tagPage(token);
  expect(status).toBe(200);
  expect(html).toContain("<!doctype html>");
  expect(html).toContain("Handler check");
  expect(html).toContain("AI check");
  expect(html).toContain("Looks healthy.");
});

test("the handler sets the HTML content type and a real 404 for a bad link", async () => {
  const calls: { status?: number; headers: Record<string, string>; body?: string } = { headers: {} };
  const res = {
    status(code: number) { calls.status = code; return res; },
    setHeader(name: string, value: string) { calls.headers[name] = value; },
    send(body: string) { calls.body = body; },
  };
  await handler({ method: "GET", query: { t: "nope" } }, res);
  expect(calls.status).toBe(404);
  expect(calls.headers["Content-Type"]).toContain("text/html");
  expect(calls.body).toContain("No tag here");

  await handler({ method: "GET", query: { t: token } }, res);
  expect(calls.status).toBe(200);
  expect(calls.body).toContain("Handler check");
});
