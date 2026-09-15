-- Security and data-integrity hardening for the public tag surface and the
-- AI spend cap. Four things, in the order they matter:
--
--   1. The blanket public SELECT on storage.objects let anyone *list* the
--      whole plant-photos bucket with the shipped publishable key. Downloads
--      from a public bucket bypass RLS anyway, so the policy bought nothing
--      and gave away the index of every keeper's photos, published or not.
--   2. mother_plant_id was never constrained to the keeper's own plants, and
--      FK checks bypass RLS — so any account could graft a plant onto a
--      stranger's public tag page and have it render under "Cuttings".
--   3. passport() published plant columns by deny-list, so `location` (the
--      room in someone's home), the four care cadences and the plant's id
--      went out on every tag link. It is an allow-list now.
--   4. is_public gated only the *token* in the mother/cuttings branches, so
--      unpublished plants' nicknames were rendered on a public tag.

-- 1 ------------------------------------------------------------------------
-- Photos stay readable (the bucket is public and tag pages show them by URL);
-- what goes away is the ability to enumerate paths.
drop policy if exists "plant-photos: public read" on storage.objects;

-- 2 ------------------------------------------------------------------------
-- AFTER, not BEFORE: the sync push upserts a cutting and its mother in one
-- statement, and AFTER-row triggers are queued to the end of the statement —
-- the same point the FK beside it is checked, so a valid pair still lands.
-- A constraint trigger so it can be deferred if a bulk load ever needs it,
-- but INITIALLY IMMEDIATE: no weaker than the foreign key it complements.
-- SECURITY DEFINER so the lookup sees the would-be mother even though RLS
-- would hide another keeper's row — hiding it would turn "not yours" into
-- "does not exist" and still reject, but this way the message is honest.
create or replace function public.plants_mother_same_keeper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.plants m
    where m.id = new.mother_plant_id and m.keeper_id = new.keeper_id
  ) then
    raise exception 'mother_plant_id must name a plant belonging to the same keeper'
      using errcode = '42501';
  end if;
  return null;
end $$;

drop trigger if exists plants_mother_same_keeper on public.plants;
create constraint trigger plants_mother_same_keeper
  after insert or update of mother_plant_id, keeper_id on public.plants
  deferrable initially immediate
  for each row
  when (new.mother_plant_id is not null)
  execute function public.plants_mother_same_keeper();

-- Any link that crossed keepers before the trigger existed is either the bug
-- or the exploit; either way it is not lineage. Only those rows are touched.
update public.plants c
   set mother_plant_id = null
  from public.plants m
 where c.mother_plant_id = m.id
   and c.keeper_id <> m.keeper_id;

-- 3 and 4 ------------------------------------------------------------------
-- The whole public surface, stated positively: every field here is one a
-- keeper who published a tag meant to show. A column added to plants from
-- now on stays private until it is named here.
create or replace function public.passport(token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'plant', jsonb_build_object(
      'nickname',       p.nickname,
      'species',        p.species,
      'status',         p.status,
      'acquired_at',    p.acquired_at,
      'acquired_from',  p.acquired_from,
      'notes',          p.notes,
      'propagated_at',  p.propagated_at,
      'published_at',   p.published_at,
      -- The caller supplied this one; echoing it leaks nothing.
      'passport_token', p.passport_token
    ),
    'keeper', (
      select jsonb_build_object('display_name', coalesce(nullif(k.display_name, ''), 'A keeper'))
      from public.keepers k where k.id = p.keeper_id
    ),
    -- A cutting says it is a cutting even when the mother is private; the
    -- mother's name and link are what stay behind the is_public gate.
    'mother', (
      select jsonb_build_object(
        'nickname',       case when m.is_public and m.deleted_at is null then m.nickname end,
        'passport_token', case when m.is_public and m.deleted_at is null then m.passport_token end
      )
      from public.plants m where m.id = p.mother_plant_id
    ),
    -- Unpublished cuttings are left out entirely: listing them without a
    -- name would still publish how many there are.
    'cuttings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nickname', c.nickname,
        'propagated_at', c.propagated_at,
        'passport_token', c.passport_token
      ) order by c.propagated_at), '[]'::jsonb)
      from public.plants c
      where c.mother_plant_id = p.id and c.deleted_at is null and c.is_public
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'type', e.type, 'notes', e.notes,
        'occurred_at', e.occurred_at, 'resolved_at', e.resolved_at
      ) order by e.occurred_at desc), '[]'::jsonb)
      from public.care_events e where e.plant_id = p.id and e.deleted_at is null
    ),
    'photos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'path', ph.path, 'caption', ph.caption, 'taken_at', ph.taken_at
      ) order by coalesce(ph.id = p.cover_photo_uuid, false) desc, ph.taken_at desc), '[]'::jsonb)
      from public.photos ph where ph.plant_id = p.id
    )
  )
  from public.plants p
  where p.passport_token = token and p.is_public and p.deleted_at is null;
$$;

revoke all on function public.passport(text) from public;
grant execute on function public.passport(text) to anon, authenticated;
