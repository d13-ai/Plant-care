import { describe, expect, test } from "vitest";
import { aiFailure } from "../../supabase/functions/_shared/ai-failure";

const SAID = "The photo check didn't go through.";

describe("a failed AI call gives the allowance back", () => {
  test("when Anthropic refused it before the model ran", () => {
    // 400 is the one that wasn't: a key not scoped to a workspace, 15 Oct 2026.
    for (const status of [400, 401, 403, 404, 413, 422, 429, 529]) {
      expect(aiFailure(status, SAID).neverRan, String(status)).toBe(true);
    }
  });

  test("when the request never got there", () => {
    expect(aiFailure("unreached", SAID).neverRan).toBe(true);
  });

  test("but not when it may have been billed", () => {
    for (const outcome of [500, 502, "other"] as const) {
      expect(aiFailure(outcome, SAID).neverRan, String(outcome)).toBe(false);
    }
  });
});

describe("what the keeper reads", () => {
  test("is never Anthropic's own message", () => {
    for (const outcome of [400, 401, 403, 429, 500, 529, "unreached", "other"] as const) {
      const { message } = aiFailure(outcome, SAID);
      expect(message, String(outcome)).not.toMatch(/[{}]|error|api|key|workspace|\d{3}/i);
    }
  });

  test("says busy for a rate limit or overload, and our side for a key problem", () => {
    expect(aiFailure(429, SAID)).toMatchObject({ status: 503, message: expect.stringMatching(/busy/) });
    expect(aiFailure(529, SAID)).toMatchObject({ status: 503, message: expect.stringMatching(/busy/) });
    expect(aiFailure(401, SAID)).toMatchObject({ status: 503, message: expect.stringMatching(/our side/) });
  });

  test("otherwise starts with what didn't work", () => {
    expect(aiFailure(400, SAID).message).toBe(`${SAID} Try again in a little while.`);
    expect(aiFailure("other", "The care guide didn't come through.").message).toMatch(/^The care guide/);
  });
});
