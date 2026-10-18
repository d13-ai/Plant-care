-- The conservatory directory, and a hole in the keepers row closed first.
--
-- 1. The hole. "keepers: own row" lets a signed-in keeper write their own
--    row, and the table-level grants Supabase gives every table meant every
--    column of it: ai_unlimited (the owners' exemption from the photo trial)
--    and photo_calls (the trial's count) included. Anyone with the publishable
--    key and their own session could hand themselves unlimited AI photo checks,
--    or set the count back to nought -- and deleting the row and letting the
--    next sync recreate it did the same. Found 18 Oct 2026 while adding the
--    `listed` column below; nothing in the logs suggests it was used.
--
--    The app writes three columns here and never deletes the row: sync sends
--    display_name, the handle screen sends handle, both send updated_at, and
--    both upsert by id. So the grants become exactly those, plus `listed`.
--    The counters are written only by the SECURITY DEFINER functions the edge
--    functions call (claim_photo_call and friends), which these grants don't
--    touch. Deleting an account goes through delete_account(), as service_role.
--
-- 2. The directory. A conservatory has always been public at /@handle, but
--    only to someone who already had the link. Listing is the keeper's
--    choice, off by default -- a handle claimed to send one friend a link is
--    not a request to be browsed -- and a listed conservatory with nothing on
--    show stays out of the list, since there would be nothing to see.
--
--    The directory reads what /@handle already shows (handle, display name,
--    plants on show) through the same is_public rule, so listing publishes
--    nothing new: it only makes it findable. Signed-in keepers only; the web
--    pages stay where they are.

-- 2 first, so the grants below can name the column -------------------------
alter table public.keepers add column if not exists listed boolean not null default false;

-- 1 ------------------------------------------------------------------------
revoke insert, update, delete on public.keepers from anon, authenticated;

-- id is in the update list because PostgREST's upsert sets every column it
-- was given, the conflict key included; the row policy still pins it to the
-- caller's own id. created_at is left to its default: it is "keeping since"
-- on the public page.
grant insert (id, display_name, handle, listed, updated_at) on public.keepers to authenticated;
grant update (id, display_name, handle, listed, updated_at) on public.keepers to authenticated;

-- 2 ------------------------------------------------------------------------
-- Listed conservatories with at least one plant on show, newest first,
-- optionally narrowed by a search over handle, display name, and the
-- nicknames and species of what is on show. An allow-list of fields, as in
-- conservatory() and rounds(): a column added to plants or keepers later is
-- private until somebody decides otherwise.
create or replace function public.conservatory_directory(q text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with wanted as (
    -- Bounded, a leading @ dropped, and the LIKE wildcards escaped, so a
    -- search for "_" finds an underscore rather than everyone.
    select nullif(left(btrim(regexp_replace(coalesce(q, ''), '^\s*@', '')), 40), '') as raw
  ),
  pattern as (
    select case when raw is null then null
      else '%' || replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as p
    from wanted
  ),
  listed as (
    select k.id, k.handle, coalesce(nullif(k.display_name, ''), 'A keeper') as display_name, k.created_at,
      (select count(*) from public.plants p
        where p.keeper_id = k.id and p.is_public and p.deleted_at is null) as on_show,
      (select max(p.published_at) from public.plants p
        where p.keeper_id = k.id and p.is_public and p.deleted_at is null) as newest
    from public.keepers k
    where k.listed and k.handle is not null
  ),
  found as (
    select l.*
    from listed l, pattern
    where l.on_show > 0
      and (
        pattern.p is null
        or l.handle ilike pattern.p
        or l.display_name ilike pattern.p
        or exists (
          select 1 from public.plants p
          where p.keeper_id = l.id and p.is_public and p.deleted_at is null
            and (p.nickname ilike pattern.p or p.species ilike pattern.p)
        )
      )
    order by l.newest desc nulls last, l.on_show desc, l.handle
    limit 60
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'handle',        f.handle,
    'display_name',  f.display_name,
    'on_show',       f.on_show,
    'newest',        f.newest,
    'keeping_since', f.created_at,
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
        where p.keeper_id = f.id and p.is_public and p.deleted_at is null
        order by p.published_at desc nulls last
        limit 3
      ) top where path is not null
    ), '[]'::jsonb),
    -- Two things about the caller, so the list can say "in your rounds" or
    -- "yours" instead of offering a card that would be refused.
    'carded', exists (
      select 1 from public.calling_cards c
      where c.keeper_id = (select auth.uid()) and c.follows_id = f.id
    ),
    'mine', f.id = (select auth.uid())
  ) order by f.newest desc nulls last, f.on_show desc, f.handle), '[]'::jsonb)
  from found f;
$$;

revoke all on function public.conservatory_directory(text) from public, anon, authenticated;
grant execute on function public.conservatory_directory(text) to authenticated;
