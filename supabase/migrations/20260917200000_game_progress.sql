-- Trickle's progress, one row per keeper. The game page talks to PostgREST
-- directly with the session the app already holds, so this is the whole
-- server side of it.
create table if not exists public.game_progress (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  boards_finished integer not null default 0 check (boards_finished between 0 and 1000000),
  boards_by_size  jsonb   not null default '{}'::jsonb,
  current_board   jsonb,
  stats           jsonb   not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.game_progress enable row level security;

-- A keeper's own row and nobody else's. `for all` because the page reads,
-- inserts and updates the same single row.
drop policy if exists "game_progress: own row" on public.game_progress;
create policy "game_progress: own row" on public.game_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
