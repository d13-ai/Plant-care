/**
 * A short trail of what just happened, kept in memory so a bug report can say
 * what led up to it rather than only that something went wrong.
 *
 * Two rules, because this leaves the device:
 *
 * 1. Crumbs record *events*, never content. "logged WATER" and a plant's id,
 *    never the nickname or the note. Callers are trusted to honour this; the
 *    scrub below is the second line of defence, not the first.
 * 2. Everything is scrubbed anyway. Error messages are the leaky ones — a
 *    failed request can carry a signed URL, a passport token or an email
 *    address in its text, and none of those belong in a report.
 */

export type CrumbKind = "nav" | "act" | "sync" | "warn" | "error";

export type Crumb = {
  /** ISO timestamp — the whole point is being able to line events up. */
  at: string;
  kind: CrumbKind;
  msg: string;
  data?: Record<string, unknown>;
};

/** Enough to cover the minute before a bug; small enough to post. */
export const LIMIT = 120;
const MSG_MAX = 400;
const VALUE_MAX = 120;
const KEYS_MAX = 12;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** Long unbroken runs of hex or base64url: tokens, JWTs, signed-URL params. */
const TOKEN = /\b[A-Za-z0-9_-]{24,}\b/g;

/** Strips the things that ride along inside error text. */
export function scrub(text: string): string {
  return text.replace(EMAIL, "[email]").replace(TOKEN, "[token]");
}

function clip(text: string, max: number): string {
  const s = scrub(text);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** Only primitives survive, clipped and scrubbed; nesting is dropped. */
function clean(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data).slice(0, KEYS_MAX)) {
    if (typeof v === "string") out[k] = clip(v, VALUE_MAX);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (v === undefined) continue;
    else out[k] = `[${typeof v}]`;
  }
  return out;
}

/**
 * A trail, as a value. Kept as a class so tests get a fresh one instead of
 * fighting whatever the module-level trail has already collected.
 */
export class Trail {
  private crumbs: Crumb[] = [];

  leave(kind: CrumbKind, msg: string, data?: Record<string, unknown>): void {
    const crumb: Crumb = { at: new Date().toISOString(), kind, msg: clip(msg, MSG_MAX) };
    if (data) crumb.data = clean(data);
    this.crumbs.push(crumb);
    // Drop the oldest rather than the newest: what happened just before the
    // report is what matters.
    if (this.crumbs.length > LIMIT) this.crumbs.splice(0, this.crumbs.length - LIMIT);
  }

  /** A copy, so a report can't be changed underneath by later crumbs. */
  snapshot(): Crumb[] {
    return this.crumbs.map((c) => ({ ...c }));
  }

  get size(): number {
    return this.crumbs.length;
  }

  clear(): void {
    this.crumbs = [];
  }
}

/** The app's trail. One per page, cleared only by a reload. */
export const trail = new Trail();

/** Shorthand, since this is called from all over. */
export const leave = (kind: CrumbKind, msg: string, data?: Record<string, unknown>): void =>
  trail.leave(kind, msg, data);
