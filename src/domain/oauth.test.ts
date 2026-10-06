import { describe, expect, test } from "vitest";
import { NATIVE_REDIRECT, readOAuthReturn } from "./oauth";

describe("coming back from Google in the app", () => {
  test("reads the one-time code", () => {
    expect(readOAuthReturn(`${NATIVE_REDIRECT}?code=abc-123`)).toEqual({ kind: "code", code: "abc-123" });
  });

  test("reads an error from the query or the fragment, in plain words", () => {
    expect(readOAuthReturn(`${NATIVE_REDIRECT}?error=access_denied&error_description=User+cancelled`)).toEqual({
      kind: "error",
      message: "User cancelled",
    });
    expect(readOAuthReturn(`${NATIVE_REDIRECT}#error_description=Something+went+wrong`)).toEqual({
      kind: "error",
      message: "Something went wrong",
    });
  });

  test("treats anything else as nothing to act on", () => {
    expect(readOAuthReturn(NATIVE_REDIRECT)).toEqual({ kind: "none" });
    expect(readOAuthReturn("not a url")).toEqual({ kind: "none" });
  });
});
