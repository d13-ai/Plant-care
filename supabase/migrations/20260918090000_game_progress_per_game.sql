-- One row per keeper per game, instead of one row per keeper.
--
-- The table was written when Parlour Games was Trickle, so its columns are
-- Trickle's vocabulary: boards finished, boards by size, the board in play. A
-- second game cannot say anything in those words, and it cannot have a row at
-- all while the primary key is the keeper alone.
--
-- So: a `game` in the key, and the game's own shape folded into one opaque
-- `progress` blob that the server does not need to understand. The reserved
-- name 'parlour' holds the streak, which is shared across every game rather
-- than kept per game -- with more than one game, one streak a keeper can feed
-- from any of them is both kinder and harder to break.
--
-- Done in place rather than by replacing the table, so the rows that exist
-- keep their history.

alter table public.game_progress add column if not exists game text not null default 'trickle';
alter table public.game_progress add column if not exists progress jsonb not null default '{}'::jsonb;

-- Fold the old columns in before they go.
update public.game_progress
   set progress = jsonb_build_object(
         'done',   boards_finished,
         'bySize', boards_by_size,
         'board',  current_board,
         'stats',  stats)
 where progress = '{}'::jsonb;

alter table public.game_progress drop constraint game_progress_pkey;
alter table public.game_progress add constraint game_progress_pkey primary key (user_id, game);
alter table public.game_progress alter column game drop default;

-- A game name is a slug we chose, not free text from a client that happens to
-- be allowed to write its own row.
alter table public.game_progress
  add constraint game_progress_game_ok check (game ~ '^[a-z][a-z0-9_-]{0,31}$');

-- The blob is opaque, which is exactly why it needs a ceiling: a keeper may
-- write their own row, and nothing else would stop that row being a megabyte.
alter table public.game_progress
  add constraint game_progress_progress_size check (pg_column_size(progress) < 100000);

alter table public.game_progress
  drop column boards_finished,
  drop column boards_by_size,
  drop column current_board,
  drop column stats;

-- The policy keyed on user_id alone and still does; it needs no change, but
-- it is restated here so the file reads as the table's current truth.
drop policy if exists "game_progress: own row" on public.game_progress;
create policy "game_progress: own row" on public.game_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
