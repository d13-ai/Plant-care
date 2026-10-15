// What `analyze` and `care` do when the call to Claude fails: whether the
// keeper gets their allowance back, and what they are told. A plain function
// with no imports, so vitest can hold it (src/domain/ai-failure.test.ts);
// each function turns the SDK's error into the `AiOutcome` below.
//
// The allowance goes back only when the model cannot have run, because
// handing it back for a call Anthropic billed is how a failing loop spends
// money forever without running out of allowance. What can't have run:
//
//   - a 4xx: Anthropic refused the request before the model saw it -- a key
//     that's expired, or not scoped to a workspace (15 Oct 2026), a rate
//     limit, a photo it won't take;
//   - a 529: overloaded, turned away at the door;
//   - a connection that never got there.
//
// Anything else -- another 5xx, or a reply that arrived and then didn't
// validate -- may have been billed, so the slot stays spent and the log
// says so.
//
// The keeper never sees Anthropic's own message. It was shown verbatim until
// 15 Oct 2026, so a mis-scoped key put a block of JSON on the add-plant
// screen; the detail belongs in the function log, where it still goes.

/** What came back: the HTTP status of Anthropic's error reply,
 *  "unreached" when the request never got there, or "other" for anything
 *  after a reply arrived (or a bug of ours). */
export type AiOutcome = number | "unreached" | "other";

export interface AiFailure {
  /** True when the call cannot have been billed: give the slot back. */
  neverRan: boolean;
  /** The status to answer the app with. */
  status: 502 | 503;
  /** What the keeper reads. */
  message: string;
}

const BUSY = "The AI is busy right now. Try again in a minute.";
const DOWN = "The AI isn't available right now. That's on our side, not yours. Try again later.";

/** `didntWork` is the function's own first sentence, e.g. "The photo check
 *  didn't go through." */
export function aiFailure(outcome: AiOutcome, didntWork: string): AiFailure {
  const retry = `${didntWork} Try again in a little while.`;
  if (outcome === "other") return { neverRan: false, status: 502, message: retry };
  if (outcome === "unreached") return { neverRan: true, status: 503, message: DOWN };
  if (outcome === 429 || outcome === 529) return { neverRan: true, status: 503, message: BUSY };
  // A key that's expired, revoked, or not allowed to do this: nothing the
  // keeper can do about it, so say whose problem it is.
  if (outcome === 401 || outcome === 403) return { neverRan: true, status: 503, message: DOWN };
  // Any other refusal. Could be the request (a photo it won't take) or the
  // setup (the workspace-scoping 400), and the reply doesn't say which.
  if (outcome >= 400 && outcome < 500) return { neverRan: true, status: 502, message: retry };
  return { neverRan: false, status: 502, message: retry };
}
