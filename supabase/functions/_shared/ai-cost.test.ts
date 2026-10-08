import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { callCost } from "./ai-cost.ts";

Deno.test("a plain answer costs its tokens at the requested model's price", () => {
  const c = callCost("claude-sonnet-5-5", { input_tokens: 10_000, output_tokens: 1_000 });
  assertAlmostEquals(c.cost_usd, 0.03, 1e-9); // 10k x $2/M + 1k x $10/M
  assertEquals([c.input_tokens, c.output_tokens], [10_000, 1_000]);
});

Deno.test("a fallback adds every attempt, each at its own model's price", () => {
  // Opus 5.5 declined partway, Opus 4.8 answered. Top-level usage is only the answer.
  const c = callCost("claude-opus-5-5", {
    input_tokens: 9_000,
    output_tokens: 1_500,
    iterations: [
      { type: "message", model: "claude-opus-5-5", input_tokens: 9_000, output_tokens: 200 },
      { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 9_000, output_tokens: 1_500 },
    ] as never,
  });
  assertAlmostEquals(c.cost_usd, (9_000 * 4 + 200 * 20 + 9_000 * 5 + 1_500 * 25) / 1e6, 1e-9);
  assertEquals([c.input_tokens, c.output_tokens], [18_000, 1_700]);
});

Deno.test("an attempt with no model named is the requested model", () => {
  const c = callCost("claude-opus-5-5", {
    input_tokens: 1_000,
    output_tokens: 100,
    iterations: [{ type: "message", model: null, input_tokens: 1_000, output_tokens: 100 }] as never,
  });
  assertAlmostEquals(c.cost_usd, (1_000 * 4 + 100 * 20) / 1e6, 1e-9);
});
