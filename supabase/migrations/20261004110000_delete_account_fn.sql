-- delete_account(): the database half of deleting an account. See the
-- previous migration for what is deleted and what is kept.
--
-- One SQL statement rather than a plpgsql block. The plpgsql version could
-- not be applied: the Supabase tool holds anything that deletes from
-- auth.users for a confirmation this session can't show, and the dashboard's
-- SQL editor, offered the same text, split the function at the semicolons
-- inside it and pasted "enable RLS" lines into the middle. A body with no
-- semicolons and no declared variables gives it nothing to split.
--
-- It is also the stronger shape. Every part below runs against one snapshot
-- and commits or fails together: the counts are read before anything goes,
-- the AI costs are folded into ai_usage_retired by day, the bug reports are
-- copied into bug_reports_retired without the keeper, and deleting the
-- auth.users row cascades to every per-keeper table. Data-modifying CTEs run
-- to completion whether or not the final select reads them.
--
-- Called only by the delete-account function, with the id from the caller's
-- own verified session -- never one taken from a request body.
create or replace function public.delete_account(p_user uuid) returns jsonb
language sql
security definer
set search_path = ''
as $fn$
  with
    owned as (
      select id from public.plants where keeper_id = p_user
    ),
    counts as (
      select
        (select count(*) from owned) as plants,
        (select count(*) from public.photos where plant_id in (select id from owned)) as photos,
        (select count(*) from public.care_events where plant_id in (select id from owned)) as care_events
    ),
    kept_costs as (
      insert into public.ai_usage_retired as r (day, count, input_tokens, output_tokens, cost_usd)
        select day, count, input_tokens, output_tokens, cost_usd from public.ai_usage where keeper_id = p_user
      on conflict (day) do update set
        count = r.count + excluded.count,
        input_tokens = r.input_tokens + excluded.input_tokens,
        output_tokens = r.output_tokens + excluded.output_tokens,
        cost_usd = r.cost_usd + excluded.cost_usd
      returning 1
    ),
    kept_reports as (
      insert into public.bug_reports_retired (id, created_at, ref, note, app, trail, handled_at)
        select id, created_at, ref, note, app, trail, handled_at from public.bug_reports where keeper_id = p_user
      on conflict (id) do nothing
      returning 1
    ),
    gone as (
      delete from auth.users where id = p_user returning id
    )
  select case
    when exists (select 1 from gone) then jsonb_build_object(
      'deleted', true,
      'plants', c.plants,
      'photos', c.photos,
      'care_events', c.care_events,
      'ai_days', (select count(*) from kept_costs),
      'bug_reports', (select count(*) from kept_reports)
    )
    else jsonb_build_object('deleted', false, 'reason', 'no_account')
  end
  from counts c
$fn$;

revoke all on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
