-- Plant Passport v1: published plant records.
-- The phone's SQLite stays the source of truth; publishing pushes a snapshot
-- of one plant (record, events, photos) here so it can be shared by link.
-- Applied to project ixagjvntbgyqemxxinqe as migration "plant_passports".

create table public.keepers (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.plants (
  id              uuid primary key default gen_random_uuid(),
  keeper_id       uuid not null references auth.users(id) on delete cascade,
  local_id        integer not null,                 -- id in the keeper's on-device database
  passport_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  nickname        text not null,
  species         text,
  status          text not null default 'ACTIVE',
  acquired_at     timestamptz not null,
  acquired_from   text,
  notes           text,
  mother_plant_id uuid references public.plants(id) on delete set null,
  propagated_at   timestamptz,
  is_public       boolean not null default true,
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (keeper_id, local_id)
);
create index plants_keeper_idx on public.plants(keeper_id);
create index plants_mother_idx on public.plants(mother_plant_id);

create table public.care_events (
  id          uuid primary key default gen_random_uuid(),
  plant_id    uuid not null references public.plants(id) on delete cascade,
  type        text not null,
  notes       text,
  occurred_at timestamptz not null,
  resolved_at timestamptz
);
create index care_events_plant_idx on public.care_events(plant_id, occurred_at desc);

create table public.photos (
  id       uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  path     text not null,                            -- object path in the plant-photos bucket
  caption  text,
  taken_at timestamptz not null
);
create index photos_plant_idx on public.photos(plant_id, taken_at desc);

-- Row level security: keepers see and edit only their own rows. Nobody reads
-- tables directly for passports; that goes through the passport() function.
alter table public.keepers     enable row level security;
alter table public.plants      enable row level security;
alter table public.care_events enable row level security;
alter table public.photos      enable row level security;

create policy "keepers: own row" on public.keepers
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "plants: own rows" on public.plants
  for all to authenticated
  using (keeper_id = (select auth.uid())) with check (keeper_id = (select auth.uid()));

create policy "care_events: via own plant" on public.care_events
  for all to authenticated
  using (exists (select 1 from public.plants p where p.id = plant_id and p.keeper_id = (select auth.uid())))
  with check (exists (select 1 from public.plants p where p.id = plant_id and p.keeper_id = (select auth.uid())));

create policy "photos: via own plant" on public.photos
  for all to authenticated
  using (exists (select 1 from public.plants p where p.id = plant_id and p.keeper_id = (select auth.uid())))
  with check (exists (select 1 from public.plants p where p.id = plant_id and p.keeper_id = (select auth.uid())));

-- Photos live in a public-read bucket (they appear on public passports);
-- keepers can only write inside their own folder.
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do nothing;

create policy "plant-photos: public read" on storage.objects
  for select to public using (bucket_id = 'plant-photos');
create policy "plant-photos: keeper writes own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plant-photos: keeper updates own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plant-photos: keeper deletes own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The passport: one plant's public record, looked up by its unguessable
-- token. SECURITY DEFINER so the anon role can read exactly this and nothing
-- else — there is no anon SELECT policy on any table, so passports are
-- unlisted links, not a browsable directory.
--
-- Supabase's security advisor flags "anon can execute a SECURITY DEFINER
-- function" for this. That is intentional and is the entire public surface:
-- the function returns one plant whose keeper chose to publish it, or null.
create or replace function public.passport(token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'plant', to_jsonb(p) - 'keeper_id' - 'local_id' - 'mother_plant_id',
    'keeper', (
      select jsonb_build_object('display_name', coalesce(nullif(k.display_name, ''), 'A keeper'))
      from public.keepers k where k.id = p.keeper_id
    ),
    'mother', (
      select jsonb_build_object(
        'nickname', m.nickname,
        'passport_token', case when m.is_public then m.passport_token end
      )
      from public.plants m where m.id = p.mother_plant_id
    ),
    'cuttings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nickname', c.nickname,
        'propagated_at', c.propagated_at,
        'passport_token', case when c.is_public then c.passport_token end
      ) order by c.propagated_at), '[]'::jsonb)
      from public.plants c where c.mother_plant_id = p.id
    ),
    'events', (
      select coalesce(jsonb_agg((to_jsonb(e) - 'plant_id' - 'id') order by e.occurred_at desc), '[]'::jsonb)
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
  where p.passport_token = token and p.is_public;
$$;

revoke all on function public.passport(text) from public;
grant execute on function public.passport(text) to anon, authenticated;
