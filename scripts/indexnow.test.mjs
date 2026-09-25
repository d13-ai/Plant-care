import { describe, expect, test } from "vitest";
import { changedUrls, parseSitemap } from "./indexnow.mjs";

describe("what IndexNow is told", () => {
  const map = (xs) => parseSitemap(xs.map(([loc, d]) => `<url><loc>${loc}</loc><lastmod>${d}</lastmod></url>`).join(""));

  test("only pages whose content date moved, plus new and removed ones", () => {
    const before = map([["https://x/a", "2026-09-24"], ["https://x/b", "2026-09-24"], ["https://x/gone", "2026-09-20"]]);
    const after = map([["https://x/a", "2026-09-24"], ["https://x/b", "2026-09-26"], ["https://x/new", "2026-09-26"]]);
    expect(changedUrls(before, after).sort()).toEqual(["https://x/b", "https://x/gone", "https://x/new"]);
  });

  test("an unchanged sitemap submits nothing", () => {
    const same = map([["https://x/a", "2026-09-24"]]);
    expect(changedUrls(same, same)).toEqual([]);
  });
});
