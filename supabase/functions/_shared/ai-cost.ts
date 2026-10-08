// What an AI call cost, from its token counts. Shared so the arithmetic can
// be tested without calling a model (ai-cost.test.ts).

// Anthropic list prices, $ per million tokens, so each answer can say what
// it cost and the day's spend adds up in ai_usage. Update when prices move.
// The fallback targets are here too: a refused photo can be answered by one.
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
export const costOf = (model: string, input: number, output: number) => {
  const p = PRICES[model] ?? { input: 0, output: 0 };
  return (input * p.input + output * p.output) / 1_000_000;
};

export type Attempt = { model?: string | null; input_tokens: number; output_tokens: number };

/**
 * What a call cost, attempt by attempt. With a fallback, `usage` covers only
 * the attempt that answered; `usage.iterations` lists every model that ran,
 * each billed at its own rates. A declined attempt is counted too, which may
 * overstate by the odd fraction of a cent -- the safe side, for a number the
 * daily budget and the pricing notes rely on.
 */
export function callCost(
  requested: string,
  usage: { input_tokens: number; output_tokens: number; iterations?: Attempt[] | null },
): { cost_usd: number; input_tokens: number; output_tokens: number } {
  const attempts: Attempt[] = usage.iterations?.length ? usage.iterations : [{ model: requested, ...usage }];
  let cost_usd = 0, input_tokens = 0, output_tokens = 0;
  for (const a of attempts) {
    cost_usd += costOf(a.model ?? requested, a.input_tokens, a.output_tokens);
    input_tokens += a.input_tokens;
    output_tokens += a.output_tokens;
  }
  return { cost_usd, input_tokens, output_tokens };
}
