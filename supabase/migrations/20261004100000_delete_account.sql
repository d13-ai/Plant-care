-- Deleting an account, from inside the app.
--
-- Apple requires it of any app that lets people sign up, and the privacy page
-- used to say "email us and we'll do it within 30 days". The `delete-account`
-- edge function now does it on the spot: it empties the keeper's photo folder
-- in storage (which nothing in the database can reach), then calls
-- delete_account() below, which does the rest in one transaction.
--
-- Every per-keeper table already hangs off auth.users with ON DELETE CASCADE
-- -- keepers, plants (and through them care_events and photos), calling
-- cards in both directions, game progress, account emails -- so deleting the
-- auth.users row is what removes the records. Two things are kept, with the
-- keeper taken out of them:
--
--   ai_usage     what the AI cost on each day. That money was spent whoever
--                spent it, and the project's totals ("what did September
--                cost?") must not shrink when somebody leaves. Folded into
--                ai_usage_retired by day, with no keeper on it.
--   bug_reports  the report itself. Its keeper_id becomes null instead of the
--                row going: the app state and trail in it are already scrubbed
--                of addresses and tokens (src/lib/bug-report.ts).
--
-- A cutting someone else grew from one of this keeper's plants stays theirs;
-- plants.mother_plant_id is ON DELETE SET NULL, so only the link goes.

create table if not exists public.ai_usage_retired (
  day date primary key,
  count integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_usd numeric not null default 0
);
alter table public.ai_usage_retired enable row level security;
-- No policies: the owner reads it with the service role, like ai_usage.

alter table public.bug_reports alter column keeper_id drop not null;
alter table public.bug_reports drop constraint if exists bug_reports_keeper_id_fkey;
alter table public.bug_reports
  add constraint bug_reports_keeper_id_fkey foreign key (keeper_id) references auth.users (id) on delete set null;

/**
 * Delete one account and everything it owns, or nothing at all. Returns what
 * went, for the function to report and the e2e test to check.
 *
 * Called only by the delete-account function, with the id from the caller's
 * own verified session -- never one taken from a request body.
 */
create or replace function public.delete_account(p_user uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plants int;
  v_photos int;
  v_events int;
begin
  if not exists (select 1 from auth.users where id = p_user) then
    return jsonb_build_object('deleted', false, 'reason', 'no_account');
  end if;

  select count(*) into v_plants from public.plants where keeper_id = p_user;
  select count(*) into v_photos from public.photos ph join public.plants p on p.id = ph.plant_id where p.keeper_id = p_user;
  select count(*) into v_events from public.care_events e join public.plants p on p.id = e.plant_id where p.keeper_id = p_user;

  insert into public.ai_usage_retired as r (day, count, input_tokens, output_tokens, cost_usd)
    select day, count, input_tokens, output_tokens, cost_usd from public.ai_usage where keeper_id = p_user
  on conflict (day) do update set
    count = r.count + excluded.count,
    input_tokens = r.input_tokens + excluded.input_tokens,
    output_tokens = r.output_tokens + excluded.output_tokens,
    cost_usd = r.cost_usd + excluded.cost_usd;

  -- The cascade does the rest; bug_reports.keeper_id goes to null.
  delete from auth.users where id = p_user;

  return jsonb_build_object('deleted', true, 'plants', v_plants, 'photos', v_photos, 'care_events', v_events);
end;
$$;

revoke all on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
