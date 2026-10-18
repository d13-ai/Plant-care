import { describe, expect, it } from "vitest";
import { lastSignIn, signedInRecently } from "../../supabase/functions/_shared/recent-sign-in";

/** A token-shaped string with these claims; the signature isn't read. */
const token = (claims: unknown) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

const NOW = 1_792_300_000;

describe("how long ago the keeper signed in", () => {
  it("reads the latest sign-in from the token", () => {
    const t = token({ amr: [{ method: "password", timestamp: NOW - 600 }, { method: "oauth", timestamp: NOW - 60 }] });
    expect(lastSignIn(t)).toBe(NOW - 60);
  });

  it("says nothing for a token without one, or for something that isn't a token", () => {
    expect(lastSignIn(token({ sub: "someone" }))).toBeNull();
    expect(lastSignIn(token({ amr: [{ method: "password", timestamp: "yesterday" }] }))).toBeNull();
    expect(lastSignIn("not-a-token")).toBeNull();
    expect(lastSignIn("a.%%%.b")).toBeNull();
  });
});

describe("recent enough to delete an account", () => {
  it("allows a sign-in from the last half hour", () => {
    expect(signedInRecently(token({ amr: [{ method: "password", timestamp: NOW - 29 * 60 }] }), NOW)).toBe(true);
  });

  it("refuses an older one, however fresh the token itself", () => {
    // A session refreshed this minute still carries the sign-in from weeks ago.
    expect(signedInRecently(token({ iat: NOW, amr: [{ method: "password", timestamp: NOW - 31 * 60 }] }), NOW)).toBe(false);
  });

  it("refuses a token that doesn't say when", () => {
    expect(signedInRecently(token({ iat: NOW }), NOW)).toBe(false);
  });
});
