-- News emails: who has said no.
--
-- /privacy allows occasional news about PlantParlour, no more than monthly,
-- and promises a way to stop it. US law (CAN-SPAM) gives ten business days to
-- honour an opt-out; a note in someone's inbox is not a system. This is.
--
-- One row per account that has opted out. No row means news is fine. A
-- separate table rather than a column on `keepers`, because a keeper row only
-- exists once a phone has synced, and plenty of accounts never get that far --
-- the people news is most likely to be written for.
--
--   via 'app'    -- the News emails switch in Account
--   via 'reply'  -- they replied "unsubscribe" (or pressed the mail client's
--                   unsubscribe button, which emails us); entered by hand
--
-- Deleting the account deletes the row with it (on delete cascade).

create table if not exists public.news_opt_outs (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  opted_out_at timestamptz not null default now(),
  via          text not null default 'app' check (via in ('app', 'reply'))
);

alter table public.news_opt_outs enable row level security;

-- A keeper reads and changes their own row and nobody else's: the switch reads
-- it, inserts it to opt out and deletes it to opt back in. What they write is
-- always 'app' -- 'reply' is ours to record.
create policy "news_opt_outs: own row" on public.news_opt_outs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and via = 'app');

-- Who a news email may go to: every account with an email that hasn't opted
-- out. The owner (ai_unlimited) and the test accounts are left out, matching
-- scripts/funnel.sql. Service role only -- it returns addresses.
create or replace function public.news_recipients()
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  left join public.keepers k on k.id = u.id
  where not u.is_anonymous
    and u.email is not null
    and coalesce(k.ai_unlimited, false) = false
    and u.email not ilike '%e2e%'
    and u.email not ilike '%@example.com'
    and u.email not ilike '%playreview%'
    and not exists (select 1 from public.news_opt_outs o where o.user_id = u.id)
  order by u.created_at
$$;

revoke all on function public.news_recipients() from public, anon, authenticated;
grant execute on function public.news_recipients() to service_role;
