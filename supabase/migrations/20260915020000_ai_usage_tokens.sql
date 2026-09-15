-- Per-day token and cost totals alongside the call count, so "what did the
-- AI cost today" is a query, not a guess. Written only by the functions
-- (service role) through record_ai_usage.
-- Applied to project ixagjvntbgyqemxxinqe as migration "ai_usage_tokens".
--
-- The two tables the AI functions depend on were created by hand against the
-- live project and never written down, so `supabase db push` against a fresh
-- project failed right here on "relation public.ai_usage does not exist".
-- They are created below, before the alter that assumed them. Every statement
-- is idempotent, so this is inert for a project that already has them — what
-- it changes is that the project can be rebuilt from this directory, and that
-- their RLS state is stated rather than assumed.
--
-- Neither table gets a policy: both are written only by the edge functions
-- under the service role, which bypasses RLS. With RLS enabled and no policy,
-- a keeper holding the publishable key cannot read another keeper's spend --
-- and, more to the point, cannot zero their own `count` to lift the cap.
create table if not exists public.ai_usage (
  keeper_id uuid not null references auth.users(id) on delete cascade,
  day       date not null,
  count     integer not null default 0,
  primary key (keeper_id, day)
);
alter table public.ai_usage enable row level security;

create table if not exists public.care_cards (
  species_key text primary key,
  species     text not null,
  card        jsonb not null,
  model       text,
  created_at  timestamptz not null default now()
);
alter table public.care_cards enable row level security;

alter table public.ai_usage
  add column if not exists input_tokens  bigint  not null default 0,
  add column if not exists output_tokens bigint  not null default 0,
  add column if not exists cost_usd      numeric(10, 6) not null default 0;

create or replace function public.record_ai_usage(
  p_keeper uuid, p_day date, p_input bigint, p_output bigint, p_cost numeric
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (keeper_id, day, count, input_tokens, output_tokens, cost_usd)
  values (p_keeper, p_day, 0, p_input, p_output, p_cost)
  on conflict (keeper_id, day) do update
    set input_tokens  = public.ai_usage.input_tokens  + excluded.input_tokens,
        output_tokens = public.ai_usage.output_tokens + excluded.output_tokens,
        cost_usd      = public.ai_usage.cost_usd      + excluded.cost_usd;
$$;
revoke all on function public.record_ai_usage(uuid, date, bigint, bigint, numeric) from public;
grant execute on function public.record_ai_usage(uuid, date, bigint, bigint, numeric) to service_role;
