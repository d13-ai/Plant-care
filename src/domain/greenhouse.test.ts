import { describe, expect, test } from "vitest";
import { accountFile, accountKey, greenhouseFile, ORIGINAL_FILE, originalOwner, SOMEONE_ELSE } from "./greenhouse";

const AMANDA = "6b0f2a7e-3c1d-4e5f-9a8b-7c6d5e4f3a2b";
const DAVID = "0d1c2b3a-4f5e-4d6c-8b7a-9f8e7d6c5b4a";

describe("which file is whose greenhouse", () => {
  test("the original file stays with the account it belongs to", () => {
    expect(greenhouseFile(AMANDA, AMANDA)).toBe(ORIGINAL_FILE);
  });

  test("any other account on the same device gets a file of its own", () => {
    expect(greenhouseFile(DAVID, AMANDA)).toBe(`parlour-${DAVID}.db`);
    expect(greenhouseFile(DAVID, AMANDA)).not.toBe(greenhouseFile(AMANDA, AMANDA));
  });

  test("an original file known only to be someone else's goes to nobody", () => {
    expect(greenhouseFile(AMANDA, SOMEONE_ELSE)).toBe(accountFile(AMANDA));
    expect(greenhouseFile(DAVID, SOMEONE_ELSE)).toBe(accountFile(DAVID));
  });

  test("only an account id makes a file name", () => {
    expect(() => accountFile("../plant-passport")).toThrow();
    expect(() => accountFile("")).toThrow();
    expect(accountFile(AMANDA.toUpperCase())).toBe(accountFile(AMANDA));
  });
});

describe("whose the original file is, the first time it's asked", () => {
  test("the account that last synced it", () => {
    expect(originalOwner(AMANDA, DAVID)).toBe(AMANDA);
  });

  test("a file nobody has synced goes to the first account to sign in", () => {
    expect(originalOwner(null, DAVID)).toBe(DAVID);
  });

  test("a file found to be someone else's stays that way", () => {
    expect(originalOwner(SOMEONE_ELSE, DAVID)).toBe(SOMEONE_ELSE);
  });
});

test("an account's settings are kept apart from another's", () => {
  expect(accountKey("keeperName", AMANDA)).not.toBe(accountKey("keeperName", DAVID));
});
