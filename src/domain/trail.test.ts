import { describe, expect, it } from "vitest";
import { LIMIT, scrub, Trail } from "./trail";

describe("scrub", () => {
  it("takes out email addresses", () => {
    expect(scrub("login failed for amanda@bondcreative.com")).toBe("login failed for [email]");
  });

  it("takes out the tokens that ride along in error text", () => {
    const url = "GET /storage/v1/object/public/plant-photos/9f2c1ab4de904f7bb0c3a1e5d7c84f21/a.jpg 403";
    expect(scrub(url)).not.toContain("9f2c1ab4de904f7bb0c3a1e5d7c84f21");
    expect(scrub(url)).toContain("[token]");
  });

  it("leaves ordinary words alone", () => {
    const msg = "Invalid VFS state opening plant-passport.db";
    expect(scrub(msg)).toBe(msg);
  });
});

describe("Trail", () => {
  it("keeps what happened, in order, with times", () => {
    const t = new Trail();
    t.leave("nav", "/account");
    t.leave("act", "logged care", { type: "WATER" });
    const [first, second] = t.snapshot();
    expect(first.msg).toBe("/account");
    expect(second.data).toEqual({ type: "WATER" });
    expect(Date.parse(first.at)).not.toBeNaN();
  });

  it("drops the oldest crumbs, not the newest", () => {
    const t = new Trail();
    for (let i = 0; i < LIMIT + 25; i++) t.leave("act", `step ${i}`);
    const crumbs = t.snapshot();
    expect(crumbs).toHaveLength(LIMIT);
    // The last thing before a report is the thing worth having.
    expect(crumbs[crumbs.length - 1].msg).toBe(`step ${LIMIT + 24}`);
    expect(crumbs[0].msg).toBe("step 25");
  });

  it("scrubs messages and values on the way in", () => {
    const t = new Trail();
    t.leave("error", "sync failed for dave@example.com", { url: "/x?token=abcdefghijklmnopqrstuvwxyz" });
    const [crumb] = t.snapshot();
    expect(crumb.msg).toBe("sync failed for [email]");
    expect(String(crumb.data!.url)).toContain("[token]");
  });

  it("flattens anything that isn't a primitive, so no content rides along", () => {
    const t = new Trail();
    t.leave("act", "saved", { plant: { nickname: "Big Monstera", notes: "secret" }, count: 3, ok: true });
    const [crumb] = t.snapshot();
    expect(crumb.data).toEqual({ plant: "[object]", count: 3, ok: true });
    expect(JSON.stringify(crumb)).not.toContain("Big Monstera");
  });

  it("hands out a copy, so a report can't change underneath it", () => {
    const t = new Trail();
    t.leave("act", "one");
    const snap = t.snapshot();
    t.leave("act", "two");
    expect(snap).toHaveLength(1);
  });
});
