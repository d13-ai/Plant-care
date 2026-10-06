import { describe, expect, test } from "vitest";
import { isReason, reportEmail, reportedPage } from "../../supabase/functions/_shared/content-report";

const TOKEN = "0123456789abcdef0123456789abcdef";

describe("the page being reported", () => {
  test("is a tag, by path or by full address", () => {
    expect(reportedPage(`/tag?t=${TOKEN}`)).toEqual({ kind: "tag", page: `/tag?t=${TOKEN}` });
    expect(reportedPage(`https://plantparlour.org/tag?t=${TOKEN}&utm=x`)).toEqual({ kind: "tag", page: `/tag?t=${TOKEN}` });
  });

  test("is a conservatory", () => {
    expect(reportedPage("/@dana_k")).toEqual({ kind: "conservatory", page: "/@dana_k" });
    expect(reportedPage("https://www.plantparlour.org/@dana_k/")).toEqual({ kind: "conservatory", page: "/@dana_k" });
  });

  test("is never another site, another page, or a broken link", () => {
    for (const bad of [
      `https://evil.example/tag?t=${TOKEN}`,
      `http://plantparlour.org/tag?t=${TOKEN}`,
      "/tag?t=short",
      "/plants/aloe-vera",
      "/@a",
      "/@has-dash",
      "javascript:alert(1)",
      42,
      "x".repeat(400),
    ]) {
      expect(reportedPage(bad)).toBeNull();
    }
  });
});

describe("a report", () => {
  test("only takes the reasons on the form", () => {
    expect(isReason("offensive")).toBe(true);
    expect(isReason("because")).toBe(false);
  });

  test("reaches us with the stranger's words escaped", () => {
    const e = reportEmail({ kind: "tag", page: `/tag?t=${TOKEN}`, reason: "spam", note: "<script>x</script>", id: 7 });
    expect(e.subject).toBe("Reported plant tag: Spam or a scam");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.text).toContain(`https://plantparlour.org/tag?t=${TOKEN}`);
  });
});
