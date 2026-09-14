-- v2 sync: the server becomes the synced copy of every keeper's whole
-- greenhouse, not just a snapshot of the plants they published.
--
-- Rows are keyed by uuids the phone generates, so a sync is idempotent and
-- the same plant lands as the same row from any device. Plants carry
-- everything the phone knows (location, reminder cadences). Deletes are
-- tombstones (deleted_at) so other devices learn about them. `updated_at`
-- is the phone's clock and decides last-write-wins between devices;
-- `synced_at` is the server's clock and is the pull cursor, so a phone
-- with a wrong clock can't miss rows.
--
-- Plants are private by default now: publishing a tag flips is_public.
-- Applied to project ixagjvntbgyqemxxinqe as migration "greenhouse_sync".

alter table public.plants
  add column if not exists location            text,
  add column if not exists water_every_days     integer,
  add column if not exists fertilize_every_days integer,
  add column if not exists repot_every_days     integer,
  add column if not exists photo_every_days     integer,
  add column if not exists updated_at           timestamptz not null default now(),
  add column if not exists deleted_at           timestamptz,
  add column if not exists synced_at            timestamptz not null default now();
alter table public.plants alter column local_id drop not null;
alter table public.plants alter column is_public set default false;
alter table public.plants alter column published_at drop not null;
alter table public.plants alter column published_at drop default;
create index if not exists plants_keeper_synced_idx on public.plants(keeper_id, synced_at);

alter table public.care_events
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists synced_at  timestamptz not null default now();
create index if not exists care_events_synced_idx on public.care_events(synced_at);

alter table public.photos
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists synced_at  timestamptz not null default now();
create index if not exists photos_synced_idx on public.photos(synced_at);

-- synced_at is always the server's idea of "when this row last changed".
create or replace function public.touch_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at = now();
  return new;
end $$;

drop trigger if exists plants_touch_synced on public.plants;
create trigger plants_touch_synced before update on public.plants
  for each row execute function public.touch_synced_at();
drop trigger if exists care_events_touch_synced on public.care_events;
create trigger care_events_touch_synced before update on public.care_events
  for each row execute function public.touch_synced_at();
drop trigger if exists photos_touch_synced on public.photos;
create trigger photos_touch_synced before update on public.photos
  for each row execute function public.touch_synced_at();

-- The tag page must not show a plant (or list a cutting) its keeper deleted.
create or replace function public.passport(token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'plant', to_jsonb(p) - 'keeper_id' - 'local_id' - 'mother_plant_id' - 'deleted_at' - 'synced_at' - 'updated_at',
    'keeper', (
      select jsonb_build_object('display_name', coalesce(nullif(k.display_name, ''), 'A keeper'))
      from public.keepers k where k.id = p.keeper_id
    ),
    'mother', (
      select jsonb_build_object(
        'nickname', m.nickname,
        'passport_token', case when m.is_public and m.deleted_at is null then m.passport_token end
      )
      from public.plants m where m.id = p.mother_plant_id
    ),
    'cuttings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nickname', c.nickname,
        'propagated_at', c.propagated_at,
        'passport_token', case when c.is_public then c.passport_token end
      ) order by c.propagated_at), '[]'::jsonb)
      from public.plants c where c.mother_plant_id = p.id and c.deleted_at is null
    ),
    'events', (
      select coalesce(jsonb_agg((to_jsonb(e) - 'plant_id' - 'id' - 'created_at' - 'updated_at' - 'synced_at') order by e.occurred_at desc), '[]'::jsonb)
      from public.care_events e where e.plant_id = p.id
    ),
    'photos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'path', ph.path, 'caption', ph.caption, 'taken_at', ph.taken_at
      ) order by ph.taken_at desc), '[]'::jsonb)
      from public.photos ph where ph.plant_id = p.id
    )
  )
  from public.plants p
  where p.passport_token = token and p.is_public and p.deleted_at is null;
$$;
