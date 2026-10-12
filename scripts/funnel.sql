-- The keeper funnel, by the week they signed up. Read-only; counts, no names.
--
--   signed_up       accounts created that week (not anonymous)
--   came_back       signed in again a day or more after signing up
--   added_a_plant   have at least one plant on the server (plants reach the
--                   server when they sync, which every signed-in phone does)
--   used_a_check    spent at least one AI photo check
--   used_all        spent every one -- the people with nothing left to try,
--                   and the number that says when to switch a paid plan on
--                   (docs/PRICING.md: about 100)
--
-- Leaves out the owner (ai_unlimited) and the test accounts: the e2e
-- fixtures, example.com addresses and the Play reviewer.
-- Run it in the SQL editor, or ask Claude to.
with people as (
  select u.id, u.created_at, u.last_sign_in_at,
         coalesce(k.photo_calls, 0) as checks
  from auth.users u
  left join public.keepers k on k.id = u.id
  where not u.is_anonymous
    and coalesce(k.ai_unlimited, false) = false
    and u.email not ilike '%e2e%'
    and u.email not ilike '%@example.com'
    and u.email not ilike '%playreview%'
),
planted as (
  select distinct keeper_id from public.plants where deleted_at is null
),
trial as (
  select coalesce(nullif(current_setting('app.photo_trial', true), ''), '5')::int as n
)
select date_trunc('week', p.created_at)::date as week,
       count(*) as signed_up,
       count(*) filter (where p.last_sign_in_at > p.created_at + interval '1 day') as came_back,
       count(*) filter (where pl.keeper_id is not null) as added_a_plant,
       count(*) filter (where p.checks > 0) as used_a_check,
       count(*) filter (where p.checks >= (select n from trial)) as used_all
from people p
left join planted pl on pl.keeper_id = p.id
group by rollup (1)
order by 1 nulls last;
