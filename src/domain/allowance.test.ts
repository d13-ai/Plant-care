import { describe, expect, test } from "vitest";
import { afterScanLine, allowanceLine, PHOTO_TRIAL } from "./allowance";

describe("what a keeper is told about their AI allowance", () => {
  test("before they have scanned anything, the allowance is stated rather than implied", () => {
    expect(allowanceLine({ left: null })).toBe(`${PHOTO_TRIAL} free AI identifications with your account.`);
  });

  test("the count is singular when it should be", () => {
    expect(allowanceLine({ left: 1 })).toBe("1 AI identification left.");
    expect(allowanceLine({ left: 2 })).toBe("2 AI identifications left.");
  });

  test("at zero it says what still works, not only what stopped", () => {
    for (const line of [allowanceLine({ left: 0 }), afterScanLine({ left: 0 })]) {
      expect(line).toMatch(/still/);
      expect(line).toMatch(/add/);
    }
  });

  test("an unlimited keeper is not given a running total", () => {
    expect(allowanceLine({ left: null, unlimited: true })).toBeNull();
    expect(afterScanLine({ left: 3, unlimited: true })).toBeNull();
  });

  test("an answer that came from the cache says so, and says it cost nothing of theirs", () => {
    const line = afterScanLine({ left: 3, cached: true });
    expect(line).toMatch(/didn't use an identification/);
  });

  test("nothing anywhere quotes a price", () => {
    // What a scan costs is the owner's question, answered by ai_usage. A
    // keeper told their photo cost 4c starts counting, and the number is
    // both alarming and none of their business.
    const lines = [
      allowanceLine({ left: null }),
      allowanceLine({ left: 5 }),
      allowanceLine({ left: 1 }),
      allowanceLine({ left: 0 }),
      afterScanLine({ left: 4 }),
      afterScanLine({ left: 0 }),
      afterScanLine({ left: 4, cached: true }),
    ];
    for (const line of lines) {
      expect(line ?? "").not.toMatch(/¢|\$|cost|cents|charge/i);
    }
  });
});
