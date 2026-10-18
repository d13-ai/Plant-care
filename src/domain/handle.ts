/**
 * A keeper's handle, as people actually pass one around: "@amanda", "amanda",
 * or the whole conservatory link pasted out of a message.
 *
 * Same rule as the database's own check constraint on `keepers.handle`, which
 * is the one that actually holds; this copy exists so the app can say no
 * before a round trip. api/conservatory.ts carries a third copy for the web
 * page, and e2e/conservatory-render.e2e.test.ts checks that one.
 */
export const HANDLE_RULE = /^[A-Za-z0-9_]{3,20}$/;

/** The handle in whatever was typed or pasted, or null if there isn't one. */
export function handleFrom(input: string): string | null {
  let s = input.trim();
  // A link: whatever follows the "/@", which a messenger may have escaped.
  const link = s.match(/\/(?:@|%40)([^/?#\s]+)\/?(?:[?#]\S*)?$/i);
  if (link) s = link[1];
  s = s.replace(/^@/, "");
  return HANDLE_RULE.test(s) ? s : null;
}

/** @Amanda and @amanda are one keeper, as the database's unique index says. */
export function sameHandle(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
