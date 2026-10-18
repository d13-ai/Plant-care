-- The day's AI budget counts calls made by accounts deleted since.
--
-- claim_ai_call summed today's calls from ai_usage alone. Deleting an account
-- moves its ai_usage rows into ai_usage_retired (delete_account(), so the
-- cost record survives) -- which took that account's calls out of the day's
-- total. Sign-ups confirm themselves, so a script could sign up, spend an
-- account's 20 calls, delete it and go again, and the 200-call ceiling that
-- protects the owner's Anthropic bill would never be reached. Found in an
-- audit on 18 Oct 2026; ai_usage_retired was still empty, so it was not used.
--
-- The per-keeper count still lives on ai_usage: a deleted account has no
-- keeper left to claim for.
create or replace function public.claim_ai_call(p_keeper uuid, p_day date, p_cap integer, p_global_cap integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used   integer;
  v_global bigint;
begin
  -- One lock for the whole day's budget. Without it, N requests from N fresh
  -- keepers each lock a different ai_usage row, all read the same global
  -- total and all pass.
  perform pg_advisory_xact_lock(hashtext('ai_daily_budget:' || p_day::text));

  select coalesce((select sum(count) from public.ai_usage where day = p_day), 0)
       + coalesce((select sum(count) from public.ai_usage_retired where day = p_day), 0)
    into v_global;
  if v_global >= p_global_cap then
    return jsonb_build_object('allowed', false, 'scope', 'global', 'remaining', 0);
  end if;

  insert into public.ai_usage (keeper_id, day, count)
  values (p_keeper, p_day, 0)
  on conflict (keeper_id, day) do nothing;

  select count into v_used from public.ai_usage
   where keeper_id = p_keeper and day = p_day;

  if v_used >= p_cap then
    return jsonb_build_object('allowed', false, 'scope', 'keeper', 'remaining', 0);
  end if;

  update public.ai_usage set count = count + 1
   where keeper_id = p_keeper and day = p_day;

  return jsonb_build_object('allowed', true, 'scope', 'ok', 'remaining', p_cap - v_used - 1);
end $$;

revoke all on function public.claim_ai_call(uuid, date, integer, integer) from public, anon, authenticated;
