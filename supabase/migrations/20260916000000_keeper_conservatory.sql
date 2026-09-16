-- A keeper's conservatory: every plant they have published, at one link.
-- (The parlour is the private room; the conservatory is the glass house you
-- show people into.)
--
-- Until now a keeper had N unlisted tag links and no identity — nothing to
-- hand someone that says "this is my collection". A handle gives them one
-- page, and stage 2 (following) has something to follow.
--
-- It publishes nothing new. Only plants already marked is_public appear, which
-- is the same set the tag links already expose; the handle just gathers them.
-- A private plant is invisible here exactly as it is everywhere else.

-- 1 ------------------------------------------------------------------------
-- The handle. Case-insensitively unique, because @Amanda and @amanda must not
-- be two people, and stored as typed so it can be shown the way it was chosen.
alter table public.keepers add column if not exists handle text;

create unique index if not exists keepers_handle_lower_idx on public.keepers (lower(handle));

-- Shape rules in the database, not only in the app: this ends up in a URL, and
-- the app is not the only thing that can write to this column.
alter table public.keepers drop constraint if exists keepers_handle_shape;
alter table public.keepers add constraint keepers_handle_shape check (
  handle is null or handle ~ '^[A-Za-z0-9_]{3,20}$'
);

-- Names the routes already use, plus the ones an impersonator would want.
alter table public.keepers drop constraint if exists keepers_handle_not_reserved;
alter table public.keepers add constraint keepers_handle_not_reserved check (
  handle is null or lower(handle) not in (
    'tag', 'welcome', 'api', 'account', 'plant', 'plants', 'parlour', 'parlor',
    'conservatory',
    'admin', 'support', 'help', 'about', 'settings', 'signin', 'signup', 'login',
    'plantparlour', 'official', 'staff', 'root', 'me', 'new', 'index'
  )
);

-- 2 ------------------------------------------------------------------------
-- The page's only read. SECURITY DEFINER because RLS hides other keepers'
-- rows, and an allow-list rather than `to_jsonb(k) - ...` so that a column
-- added later is private until someone decides otherwise.
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
    'plants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nickname',       p.nickname,
        'species',        p.species,
        'status',         p.status,
        'acquired_at',    p.acquired_at,
        'propagated_at',  p.propagated_at,
        -- The link to the plant's own tag, which is public by definition here.
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

revoke all on function public.conservatory(text) from public;
grant execute on function public.conservatory(text) to anon, authenticated;
