/**
 * The privacy notice has to describe the site that actually exists.
 *
 * Until analytics went in it said, in published text: "There is no
 * analytics, no advertising, no tracking pixels and no third-party cookies
 * anywhere in PlantParlour." Adding a page counter made the first clause
 * false, and a privacy notice that is false in a way nobody outside can
 * check is worse than not having one.
 *
 * This renders the real page through its real handler and holds it to what
 * the code does: the old claim gone, the counting described, and the page
 * itself carrying the counter with the redaction registered first.
 */
import { expect, test } from "vitest";
import handler from "../api/privacy";

test("the privacy notice renders and says what the site actually does", async () => {
  let body = "";
  const res = {
    status() { return this; },
    setHeader() { return this; },
    send(b: string) { body = b; return this; },
    end(b: string) { body = b ?? body; return this; },
  };
  await (handler as unknown as (req: unknown, res: unknown) => Promise<void>)(
    { method: "GET", url: "/privacy", headers: {} }, res,
  );
  expect(body.length).toBeGreaterThan(500);
  for (const s of ["Counting page views", "the token goes", "no advertising", "vercel.com/legal/privacy-policy"]) {
    expect(body).toContain(s);
  }
  // The claim that installing analytics made false.
  expect(body).not.toContain("There is no analytics");
  // And the page carries the counter itself, redaction first.
  expect(body).toContain("insights/script.js");
  expect(body.indexOf("beforeSend")).toBeLessThan(body.indexOf("insights/script.js"));
});
