-- Deleting an account, from inside the app.
--
-- Apple requires it of any app that lets people sign up, and the privacy page
-- used to say "email us and we'll do it within 30 days". The `delete-account`
-- edge function now does it on the spot: it empties the keeper's photo folder
-- in storage (which nothing in the database can reach), then calls
-- delete_account() (next migration), which does the rest in one statement.
--
-- Every per-keeper table already hangs off auth.users with ON DELETE CASCADE
-- -- keepers, plants (and through them care_events and photos), calling
-- cards in both directions, game progress, account emails -- so deleting the
-- auth.users row is what removes the records. Two things are kept, with the
-- keeper taken out of them:
--
--   ai_usage     what the AI cost on each day. That money was spent whoever
--                spent it, and the project's totals ("what did September
--                cost?") must not shrink when somebody leaves. Folded into
--                ai_usage_retired by day, with no keeper on it.
--   bug_reports  the report itself, copied into bug_reports_retired without
--                the keeper before the cascade takes the original. The app
--                state and trail in it are already scrubbed of addresses and
--                tokens (src/lib/bug-report.ts). Copied rather than changing
--                bug_reports' own foreign key to SET NULL, which would alter
--                an existing table.
--
-- A cutting someone else grew from one of this keeper's plants stays theirs;
-- plants.mother_plant_id is ON DELETE SET NULL, so only the link goes.

create table if not exists public.ai_usage_retired (
  day date primary key,
  count integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_usd numeric not null default 0
);
alter table public.ai_usage_retired enable row level security;
-- No policies: the owner reads it with the service role, like ai_usage.

create table if not exists public.bug_reports_retired (
  id uuid primary key,
  created_at timestamptz not null,
  ref text,
  note text,
  app jsonb,
  trail jsonb,
  handled_at timestamptz,
  retired_at timestamptz not null default now()
);
alter table public.bug_reports_retired enable row level security;
-- No policies: read with the service role, like bug_reports.
