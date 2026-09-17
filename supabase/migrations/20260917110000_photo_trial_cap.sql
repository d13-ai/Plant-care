-- A lifetime allowance of AI photo identifications for a new keeper, separate
-- from the daily cap in ai_usage. That counter cannot serve here: it counts
-- photo analyses and care-guide lookups together, and resets every day.
--
-- ai_unlimited is the exemption, set by hand for the people running this.
alter table public.keepers
  add column if not exists photo_calls  integer not null default 0,
  add column if not exists ai_unlimited boolean not null default false;

-- Claim one identification, or say there are none left. Check and increment
-- in one locked statement, for the same reason claim_ai_call does it.
create or replace function public.claim_photo_call(p_keeper uuid, p_cap integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlimited boolean;
  v_used      integer;
begin
  insert into public.keepers (id) values (p_keeper) on conflict (id) do nothing;

  select ai_unlimited, photo_calls into v_unlimited, v_used
  from public.keepers where id = p_keeper for update;

  if v_unlimited then
    update public.keepers set photo_calls = photo_calls + 1 where id = p_keeper;
    return jsonb_build_object('allowed', true, 'remaining', null, 'unlimited', true);
  end if;

  if v_used >= p_cap then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'unlimited', false);
  end if;

  update public.keepers set photo_calls = photo_calls + 1 where id = p_keeper;
  return jsonb_build_object('allowed', true, 'remaining', p_cap - v_used - 1, 'unlimited', false);
end;
$$;

-- Hand it back when the call never reached the model, so a run of failures
-- cannot eat a keeper's whole trial.
create or replace function public.refund_photo_call(p_keeper uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.keepers set photo_calls = greatest(photo_calls - 1, 0) where id = p_keeper;
$$;

-- Only the edge functions (service role) may move the counter.
revoke execute on function public.claim_photo_call(uuid, integer) from anon, authenticated;
revoke execute on function public.refund_photo_call(uuid) from anon, authenticated;
