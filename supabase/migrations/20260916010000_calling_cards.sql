-- Calling cards: following, in the register the rest of this is written in.
-- You leave your card at someone's conservatory and it joins your rounds.
--
-- The point of the design is what a card does NOT do. It grants no access: the
-- rounds read exactly the same published plants a stranger sees at /@handle,
-- through the same rule. A private plant is as invisible to a friend as to
-- anyone else, and no policy on plants, photos or care_events had to move to
-- build this. That is deliberate — the one sharing feature that existed before
-- this had a cross-tenant hole in it, and the cheapest way not to repeat that
-- is a feature that hands out nothing to leak.

create table if not exists public.calling_cards (
  -- Who left the card.
  keeper_id  uuid not null references auth.users(id) on delete cascade,
  -- Whose conservatory they left it at.
  follows_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (keeper_id, follows_id),
  constraint calling_cards_not_self check (keeper_id <> follows_id)
);

create index if not exists calling_cards_follows_idx on public.calling_cards (follows_id);

alter table public.calling_cards enable row level security;

-- Your cards are yours. Nobody can read anyone else's, so the graph of who
-- follows whom is not a thing the publishable key can walk.
drop policy if exists "calling cards: own" on public.calling_cards;
create policy "calling cards: own" on public.calling_cards
  for all to authenticated
  using ((select auth.uid()) = keeper_id)
  with check ((select auth.uid()) = keeper_id);

-- Leaving a card needs the other keeper's id, which RLS rightly hides, so it
-- goes through a function. Handles are public by design — they are in URLs —
-- so resolving one leaks nothing that /@handle doesn't.
create or replace function public.leave_card(handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me     uuid := auth.uid();
  target uuid;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'not signed in');
  end if;

  select k.id into target from public.keepers k where lower(k.handle) = lower(leave_card.handle);
  if target is null then
    return jsonb_build_object('ok', false, 'reason', 'no such conservatory');
  end if;
  if target = me then
    return jsonb_build_object('ok', false, 'reason', 'that is your own');
  end if;

  insert into public.calling_cards (keeper_id, follows_id)
  values (me, target)
  on conflict do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.take_card_back(handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'not signed in');
  end if;
  delete from public.calling_cards c
  using public.keepers k
  where c.keeper_id = me and c.follows_id = k.id and lower(k.handle) = lower(take_card_back.handle);
  return jsonb_build_object('ok', true);
end;
$$;

-- The rounds: the conservatories whose cards you hold. Public fields only, and
-- the same is_public rule as conservatory() — an allow-list, so a column added
-- to plants later stays private until somebody decides otherwise.
create or replace function public.rounds()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row order by row->>'display_name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'handle',        k.handle,
      'display_name',  coalesce(nullif(k.display_name, ''), 'A keeper'),
      'on_show', (
        select count(*) from public.plants p
        where p.keeper_id = k.id and p.is_public and p.deleted_at is null
      ),
      'newest', (
        select max(p.published_at) from public.plants p
        where p.keeper_id = k.id and p.is_public and p.deleted_at is null
      ),
      'photos', coalesce((
        select jsonb_agg(path order by taken_at desc)
        from (
          select (
            select ph.path from public.photos ph
            where ph.plant_id = p.id
            order by coalesce(ph.id = p.cover_photo_uuid, false) desc, ph.taken_at desc
            limit 1
          ) as path, p.published_at as taken_at
          from public.plants p
          where p.keeper_id = k.id and p.is_public and p.deleted_at is null
          order by p.published_at desc nulls last
          limit 3
        ) top where path is not null
      ), '[]'::jsonb)
    ) as row
    from public.calling_cards c
    join public.keepers k on k.id = c.follows_id
    where c.keeper_id = auth.uid() and k.handle is not null
  ) rows;
$$;

revoke all on function public.leave_card(text) from public;
revoke all on function public.take_card_back(text) from public;
revoke all on function public.rounds() from public;
grant execute on function public.leave_card(text) to authenticated;
grant execute on function public.take_card_back(text) to authenticated;
grant execute on function public.rounds() to authenticated;
