# Working notes for Claude in this repo

## Spending
- **Never spend the project's Anthropic API key on evaluations, comparisons or
  sample generation.** That key (the `ANTHROPIC_API_KEY` function secret behind
  `supabase/functions/analyze` and `care`) is the owner's Console credit. When a
  comparison is asked for — care-guide quality, data sources, prompt wording —
  produce the samples in the assistant session itself (which runs on the
  owner's subscription) and compare there. Calling the deployed functions or
  the API directly costs real money; if a check genuinely needs the live model
  (e.g. an image-identification A/B), ask first and state the expected cost.
- Every AI answer reports `cost_usd`; `ai_usage` records tokens and cost per
  keeper per day. Use those, or the edge-function logs, to answer "what did
  that cost" — don't run a call to find out.

## Data safety
- Never blanket-delete rows in `auth.users` or any keeper's data. Delete only
  specific ids you created for a test, and only what they own.

## Verify before shipping
- `npm run typecheck`, `npm test`, `npm run smoke` locally; `npm run e2e` for
  anything touching Supabase (needs `PASSPORT_E2E_EMAIL/_PASSWORD` for the sync
  test). Commit on the working branch; merge to `main` only when asked — it
  deploys to Vercel automatically.
