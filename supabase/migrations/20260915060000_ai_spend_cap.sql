-- The AI daily cap, made into an actual bound on spend.
--
-- What it was: each edge function read ai_usage.count, compared it to 20, and
-- then wrote back count = used + 1. Three separate holes:
--
--   * Read-then-write. Twenty requests fired at once all read 0 and all wrote
--     1, so the cap cost one call to clear.
--   * The write's error was discarded, so a failed upsert disabled the cap
--     rather than refusing the call -- it failed open.
--   * The cap is per keeper, and `ensureSession()` mints a fresh anonymous
--     keeper on demand against a publishable key that ships in the app. A
--     script could reset its own allowance forever, so "20 per keeper" was
--     never a bound on the owner's Anthropic bill at all.
--
-- claim_ai_call closes the first two by doing the check and the increment in
-- one statement under a lock, and returning what it decided so the caller can
-- refuse on error instead of assuming success. The third needs a bound that
-- does not reset with a new sign-in, so there is a global daily ceiling too:
-- per-keeper fairness first, whole-project spend second.
create or replace function public.claim_ai_call(
  p_keeper uuid, p_day date, p_cap integer, p_global_cap integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used   integer;
  v_global bigint;
begin
  -- One lock for the whole day's budget. Without it, N requests from N fresh
  -- anonymous keepers each lock a different ai_usage row, all read the same
  -- global total, and all pass -- which is the hole this is here to close.
  -- Transaction-scoped, so it is released at commit either way; at twenty
  -- calls a day per keeper the serialisation costs nothing worth measuring.
  perform pg_advisory_xact_lock(hashtext('ai_daily_budget:' || p_day::text));

  select coalesce(sum(count), 0) into v_global from public.ai_usage where day = p_day;
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

-- A call that never reached the model cost nothing, so it should not hold a
-- slot -- and with a global ceiling in play, forcing failures would otherwise
-- burn the whole project's budget for the day.
create or replace function public.refund_ai_call(p_keeper uuid, p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage set count = greatest(count - 1, 0)
   where keeper_id = p_keeper and day = p_day;
$$;

revoke all on function public.claim_ai_call(uuid, date, integer, integer) from public;
grant execute on function public.claim_ai_call(uuid, date, integer, integer) to service_role;
revoke all on function public.refund_ai_call(uuid, date) from public;
grant execute on function public.refund_ai_call(uuid, date) to service_role;
