-- Account emails: a welcome when someone makes an account, and a link to
-- reset a forgotten password.
--
-- Until now there was no way back in for anyone who forgot their password:
-- Supabase's built-in mailer only sends to the project's own team, and no
-- SMTP server was set. The `account-email` edge function sends both through
-- Resend from plantparlour.org instead, and this table is what it answers to.
--
-- Every email is a row here, and every send is claimed first, in one locked
-- statement, the way AI calls are (claim_ai_call). That is what stops the
-- reset form from being turned against somebody: a stranger who types your
-- address forty times gets you three emails, not forty. Addresses are stored
-- hashed -- this table only needs to count, never to read them back.
--
-- The Resend key lives in Vault (name 'resend_api_key'), not in a function
-- secret, and only the service role can read it through resend_api_key().

create table public.account_emails (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('welcome', 'reset')),
  user_id uuid not null references auth.users (id) on delete cascade,
  address_hash text not null,
  ip_hash text,
  sent_at timestamptz not null default now()
);

-- One welcome per account, ever: a second device signing in must not get a
-- second one, and the unique index makes that a fact rather than a check.
create unique index account_emails_one_welcome on public.account_emails (user_id) where kind = 'welcome';
create index account_emails_by_address on public.account_emails (address_hash, sent_at desc);
create index account_emails_by_ip on public.account_emails (ip_hash, sent_at desc) where ip_hash is not null;
create index account_emails_by_time on public.account_emails (sent_at desc);

alter table public.account_emails enable row level security;
-- No policies: nobody but the service role reads or writes it.

/**
 * Claim one email, or say why not. Returns
 *   { allowed: true, id, user_id, email }   -- go ahead and send
 *   { allowed: false, reason }               -- don't
 *
 * reset:   looks the address up itself, so the function never has to ask
 *          "does this account exist" anywhere a caller could see the answer.
 *          At most 3 an hour and 6 a day to one address, 10 an hour from one
 *          IP. Claimed BEFORE a reset link is generated: generating one
 *          replaces the last, so a refused request that still generated a
 *          link would quietly break the one already in someone's inbox.
 * welcome: the caller's own account, once, and only within a week of it
 *          being made -- so the two keepers who signed up before this existed
 *          aren't welcomed out of the blue (they have a row already; see
 *          below), and an old account on a new phone never is.
 * Both:    200 a day across the whole project.
 */
create or replace function public.claim_account_email(
  p_kind text,
  p_email text default null,
  p_user uuid default null,
  p_ip_hash text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_hash text;
  v_hour int;
  v_day int;
  v_ip int;
  v_all int;
  v_id bigint;
begin
  if p_kind = 'reset' then
    select * into v_user from auth.users
      where lower(email) = lower(trim(p_email)) and not coalesce(is_anonymous, false)
      limit 1;
  elsif p_kind = 'welcome' then
    select * into v_user from auth.users where id = p_user;
  else
    return jsonb_build_object('allowed', false, 'reason', 'kind');
  end if;

  if v_user.id is null or v_user.email is null or coalesce(v_user.is_anonymous, false) then
    return jsonb_build_object('allowed', false, 'reason', 'no_account');
  end if;

  v_hash := encode(extensions.digest(lower(v_user.email), 'sha256'), 'hex');
  -- One address at a time: two requests racing for the last slot of the hour
  -- must not both get it.
  perform pg_advisory_xact_lock(hashtext('account_emails:' || v_hash));

  if p_kind = 'welcome' then
    if v_user.created_at < now() - interval '7 days' then
      return jsonb_build_object('allowed', false, 'reason', 'old_account');
    end if;
    if exists (select 1 from public.account_emails where user_id = v_user.id and kind = 'welcome') then
      return jsonb_build_object('allowed', false, 'reason', 'already_sent');
    end if;
  else
    select count(*) filter (where sent_at > now() - interval '1 hour'), count(*)
      into v_hour, v_day
      from public.account_emails
      where address_hash = v_hash and kind = 'reset' and sent_at > now() - interval '1 day';
    if v_hour >= 3 or v_day >= 6 then
      return jsonb_build_object('allowed', false, 'reason', 'address_limit');
    end if;
    if p_ip_hash is not null then
      select count(*) into v_ip from public.account_emails
        where ip_hash = p_ip_hash and sent_at > now() - interval '1 hour';
      if v_ip >= 10 then
        return jsonb_build_object('allowed', false, 'reason', 'ip_limit');
      end if;
    end if;
  end if;

  select count(*) into v_all from public.account_emails where sent_at > now() - interval '1 day';
  if v_all >= 200 then
    return jsonb_build_object('allowed', false, 'reason', 'global_limit');
  end if;

  insert into public.account_emails (kind, user_id, address_hash, ip_hash)
    values (p_kind, v_user.id, v_hash, p_ip_hash)
    returning id into v_id;
  return jsonb_build_object('allowed', true, 'id', v_id, 'user_id', v_user.id, 'email', v_user.email);
end;
$$;

/** Hand a claim back when the email never left -- Resend refused it, say --
 *  so a welcome can be tried again and a reset doesn't count against the
 *  hour's three. */
create or replace function public.release_account_email(p_id bigint) returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.account_emails where id = p_id;
$$;

/** The Resend key, for the account-email function and nothing else. */
create or replace function public.resend_api_key() returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
$$;

revoke all on function public.claim_account_email(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.release_account_email(bigint) from public, anon, authenticated;
revoke all on function public.resend_api_key() from public, anon, authenticated;
grant execute on function public.claim_account_email(text, text, uuid, text) to service_role;
grant execute on function public.release_account_email(bigint) to service_role;
grant execute on function public.resend_api_key() to service_role;

-- Everyone who already has an account counts as welcomed. The welcome is for
-- people signing up from now on; writing to the keepers who came before it
-- is a separate decision, made by a person, not by a migration.
insert into public.account_emails (kind, user_id, address_hash)
  select 'welcome', id, encode(extensions.digest(lower(email), 'sha256'), 'hex')
  from auth.users
  where email is not null and not coalesce(is_anonymous, false);
