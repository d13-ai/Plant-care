// Whatever the Anthropic SDK threw, as the AiOutcome that ai-failure.ts
// decides on. Kept apart from it because this needs the SDK, and
// ai-failure.ts has to stay importable from vitest.
import Anthropic from "npm:@anthropic-ai/sdk";
import type { AiOutcome } from "./ai-failure.ts";

export function aiOutcome(err: unknown): AiOutcome {
  // A timeout is a request that got there and may be running: billable.
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "other";
  if (err instanceof Anthropic.APIConnectionError) return "unreached";
  if (err instanceof Anthropic.APIError && typeof err.status === "number") return err.status;
  return "other";
}
