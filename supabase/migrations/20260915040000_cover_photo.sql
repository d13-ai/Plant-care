-- A keeper can pick which photo fronts the plant; the tag page shows it first.
alter table public.plants add column if not exists cover_photo_uuid uuid;

create or replace function public.passport(token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'plant', to_jsonb(p) - 'keeper_id' - 'local_id' - 'mother_plant_id' - 'deleted_at' - 'synced_at' - 'updated_at' - 'cover_photo_uuid',
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
      select coalesce(jsonb_agg((to_jsonb(e) - 'plant_id' - 'id' - 'created_at' - 'updated_at' - 'synced_at' - 'deleted_at') order by e.occurred_at desc), '[]'::jsonb)
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
