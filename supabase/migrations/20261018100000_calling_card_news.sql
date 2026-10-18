-- Making a calling card worth leaving.
--
-- Until now a card was a bookmark: it put a conservatory in your rounds and
-- nothing else. The rounds showed each one as it stood, so seeing what had
-- changed meant remembering what was there last time, and the keeper whose
-- conservatory it was never knew a card had been left at all.
--
-- 1. What's new. A card remembers when you last visited (seen_at), and the
--    rounds count what has gone on show since: plants put on show, and new
--    photos of plants that were already there. The rounds sort by the most
--    recent change, so the conservatories with something new come first.
--
-- 2. How many cards. A keeper sees how many cards have been left at their
--    conservatory, and so does anyone visiting it. A number only: who left
--    them stays as private as it has always been, since the graph of who
--    follows whom is not something the publishable key may walk.
--
-- Both read the same is_public rule as everything else here, so neither
-- shows anything a stranger couldn't already see at /@handle.

alter table public.calling_cards add column if not exists seen_at timestamptz;

-- Opening a conservatory from your rounds. A handle you hold no card for
-- matches nothing, so this can't be used to learn anything.
create or replace function public.visit_round(handle text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.calling_cards c
  set seen_at = now()
  from public.keepers k
  where c.keeper_id = (select auth.uid())
    and c.follows_id = k.id
    and lower(k.handle) = lower(visit_round.handle);
$$;

-- The rounds, as before, plus what's new since your last visit and the time
-- of the latest change. "New" is measured from the last visit, or from when
-- the card was left: what was already on show then was never new to you.
create or replace function public.rounds()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select k.id, k.handle, coalesce(nullif(k.display_name, ''), 'A keeper') as display_name,
      coalesce(c.seen_at, c.created_at) as since
    from public.calling_cards c
    join public.keepers k on k.id = c.follows_id
    where c.keeper_id = (select auth.uid()) and k.handle is not null
  ),
  counted as (
    select m.*,
      (select count(*) from public.plants p
        where p.keeper_id = m.id and p.is_public and p.deleted_at is null) as on_show,
      (select max(p.published_at) from public.plants p
        where p.keeper_id = m.id and p.is_public and p.deleted_at is null) as newest,
      (select count(*) from public.plants p
        where p.keeper_id = m.id and p.is_public and p.deleted_at is null
          and coalesce(p.published_at, p.created_at) > m.since) as new_plants,
      -- Photos of plants that were already on show; a newly shown plant's
      -- photos come with it and are counted as the plant.
      (select count(*) from public.photos ph join public.plants p on p.id = ph.plant_id
        where p.keeper_id = m.id and p.is_public and p.deleted_at is null
          and coalesce(p.published_at, p.created_at) <= m.since
          and ph.created_at > m.since) as new_photos,
      (select max(greatest(coalesce(p.published_at, p.created_at), coalesce(ph.created_at, '-infinity')))
        from public.plants p left join public.photos ph on ph.plant_id = p.id
        where p.keeper_id = m.id and p.is_public and p.deleted_at is null) as updated
    from mine m
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'handle',       c.handle,
    'display_name', c.display_name,
    'on_show',      c.on_show,
    'newest',       c.newest,
    'updated',      c.updated,
    'new_plants',   c.new_plants,
    'new_photos',   c.new_photos,
    'photos', coalesce((
      select jsonb_agg(path order by published desc nulls last)
      from (
        select (
          select ph.path from public.photos ph
          where ph.plant_id = p.id
          order by coalesce(ph.id = p.cover_photo_uuid, false) desc, ph.taken_at desc
          limit 1
        ) as path, p.published_at as published
        from public.plants p
        where p.keeper_id = c.id and p.is_public and p.deleted_at is null
        order by p.published_at desc nulls last
        limit 3
      ) top where path is not null
    ), '[]'::jsonb)
  ) order by c.updated desc nulls last, c.display_name), '[]'::jsonb)
  from counted c;
$$;

-- How many cards have been left at your own conservatory.
create or replace function public.cards_left_with_me()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.calling_cards where follows_id = (select auth.uid());
$$;

-- The conservatory page's read, with the number of cards left there. The
-- rest is unchanged: an allow-list over is_public plants.
create or replace function public.conservatory(handle text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'keeper', jsonb_build_object(
      'handle',       k.handle,
      'display_name', coalesce(nullif(k.display_name, ''), 'A keeper'),
      'keeping_since', k.created_at
    ),
    'cards', (select count(*) from public.calling_cards c where c.follows_id = k.id),
    'plants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nickname',       p.nickname,
        'species',        p.species,
        'status',         p.status,
        'acquired_at',    p.acquired_at,
        'propagated_at',  p.propagated_at,
        'passport_token', p.passport_token,
        'photo', (
          select ph.path
          from public.photos ph
          where ph.plant_id = p.id
          order by coalesce(ph.id = p.cover_photo_uuid, false) desc, ph.taken_at desc
          limit 1
        )
      ) order by p.published_at desc nulls last, p.nickname)
      from public.plants p
      where p.keeper_id = k.id
        and p.is_public
        and p.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.keepers k
  where lower(k.handle) = lower(conservatory.handle)
$$;

-- Supabase grants every new function to anon directly, so revoking from
-- PUBLIC alone leaves it callable without a session; both are revoked.
revoke all on function public.visit_round(text) from public, anon;
revoke all on function public.cards_left_with_me() from public, anon;
grant execute on function public.visit_round(text) to authenticated;
grant execute on function public.cards_left_with_me() to authenticated;
