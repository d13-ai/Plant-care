-- What a signed-in keeper can write, tightened after an audit (18 Oct 2026).
--
-- The keepers row was the hole (20261018000000). The rest of the tables
-- keepers write -- plants, photos, care_events -- are theirs to write, row
-- by row, and should stay so: sync upserts whole rows and a column grant
-- list would silently refuse every column added later. So instead of
-- narrowing those grants, this pins down the few values that reach someone
-- else's screen or the owner's bill. Nothing found in the data suggests any
-- of it was used: every photo is a JPEG under 1.1 MB in its own keeper's
-- folder, no plant was published in the future, and every tag token is the
-- shape the default makes.

-- 1 ------------------------------------------------------------------------
-- Functions for signed-in keepers only. Supabase grants each new function to
-- anon directly, which `revoke ... from public` in the calling-cards
-- migration never touched: the three below answered a caller with no
-- session. Each one checked auth.uid() and refused, so nothing leaked.
revoke execute on function public.leave_card(text) from anon;
revoke execute on function public.take_card_back(text) from anon;
revoke execute on function public.rounds() from anon;

-- 2 ------------------------------------------------------------------------
-- TRUNCATE skips row-level security altogether. Nothing the API exposes can
-- issue one, but nothing should be one function away from it either.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

-- 3 ------------------------------------------------------------------------
-- The bucket takes what the app uploads -- JPEG, and well under 10 MB -- and
-- nothing else. Before this it would store any file of any type for anyone
-- signed in, and serve it publicly, including through plantparlour.org's own
-- /plant-photos proxy.
update storage.buckets
set allowed_mime_types = array['image/jpeg'], file_size_limit = 10485760
where id = 'plant-photos';

-- 4 ------------------------------------------------------------------------
-- A photo row points into its own keeper's folder. Without this a keeper
-- could hang another keeper's photo, or any other object's path, on a plant
-- of their own and publish it.
create or replace function public.photos_path_in_own_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select p.keeper_id into v_owner from public.plants p where p.id = new.plant_id;
  if v_owner is null or split_part(new.path, '/', 1) <> v_owner::text or position('..' in new.path) > 0 then
    raise exception 'a photo must be in its own keeper''s folder' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.photos_path_in_own_folder() from public, anon, authenticated;
drop trigger if exists photos_path_in_own_folder on public.photos;
create trigger photos_path_in_own_folder
  before insert or update of path, plant_id on public.photos
  for each row execute function public.photos_path_in_own_folder();

-- 5 ------------------------------------------------------------------------
-- A phone's clock doesn't decide what's new. "Newest first" in the directory
-- and "new since your last visit" in the rounds read these, and a date in
-- the future would sit at the top, or count as new, for ever.
create or replace function public.plants_published_not_future()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.published_at > now() then new.published_at := now(); end if;
  return new;
end;
$$;
create or replace function public.photos_created_not_future()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_at > now() then new.created_at := now(); end if;
  return new;
end;
$$;
revoke all on function public.plants_published_not_future() from public, anon, authenticated;
revoke all on function public.photos_created_not_future() from public, anon, authenticated;
drop trigger if exists plants_published_not_future on public.plants;
create trigger plants_published_not_future
  before insert or update of published_at on public.plants
  for each row execute function public.plants_published_not_future();
drop trigger if exists photos_created_not_future on public.photos;
create trigger photos_created_not_future
  before insert or update of created_at on public.photos
  for each row execute function public.photos_created_not_future();

-- 6 ------------------------------------------------------------------------
-- Tag tokens are the shape the default makes. A keeper can't pick their own
-- (a guessable one would be theirs to regret, but it is still a public URL
-- the page and the og: tags print).
alter table public.plants drop constraint if exists plants_passport_token_shape;
alter table public.plants add constraint plants_passport_token_shape
  check (passport_token ~ '^[0-9a-f]{32}$');

-- 7 ------------------------------------------------------------------------
-- Text a keeper writes has a ceiling, far above anything typed by hand (the
-- longest note so far is 2,473 characters), so one account can't fill the
-- database or a public page with megabytes.
alter table public.plants drop constraint if exists plants_text_sizes;
alter table public.plants add constraint plants_text_sizes check (
  coalesce(length(nickname), 0) <= 500 and coalesce(length(species), 0) <= 500
  and coalesce(length(location), 0) <= 500 and coalesce(length(acquired_from), 0) <= 500
  and coalesce(length(status), 0) <= 40 and coalesce(length(notes), 0) <= 50000
);
alter table public.care_events drop constraint if exists care_events_text_sizes;
alter table public.care_events add constraint care_events_text_sizes check (
  coalesce(length(type), 0) <= 40 and coalesce(length(notes), 0) <= 50000
);
alter table public.photos drop constraint if exists photos_text_sizes;
alter table public.photos add constraint photos_text_sizes check (
  coalesce(length(caption), 0) <= 5000 and length(path) <= 300
);

-- 8 ------------------------------------------------------------------------
-- Account emails, so a stranger's address can't be welcomed over and over.
--
-- One welcome per account was the rule, keyed on the account -- and the row
-- went when the account did (ON DELETE CASCADE). Sign-ups confirm
-- themselves, so anyone could sign up as somebody else's address, be
-- welcomed, delete the account and sign up again: up to the day's 200 emails
-- to one inbox from hello@plantparlour.org, every day, and the deleted rows
-- left the day's count too. Welcomes and resets also shared one daily
-- budget, so filling it with welcomes stopped every password reset.
--
-- Now a row outlives its account, without the account (user_id set null),
-- for 30 days, and then it is cleared out; an address is welcomed at most
-- once in those 30 days whichever account asks; and welcomes and resets
-- each have their own day's budget. The rows hold a hash of the address and
-- never the address itself.
alter table public.account_emails alter column user_id drop not null;
alter table public.account_emails drop constraint if exists account_emails_user_id_fkey;
alter table public.account_emails add constraint account_emails_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

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
  -- What a deleted account left behind is kept for 30 days and no longer.
  delete from public.account_emails where user_id is null and sent_at < now() - interval '30 days';

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
    if exists (
      select 1 from public.account_emails
      where kind = 'welcome'
        and (user_id = v_user.id or (address_hash = v_hash and sent_at > now() - interval '30 days'))
    ) then
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

  -- Each kind its own day's budget: welcomes can't use up the resets'.
  select count(*) into v_all from public.account_emails
    where kind = p_kind and sent_at > now() - interval '1 day';
  if v_all >= (case when p_kind = 'welcome' then 100 else 200 end) then
    return jsonb_build_object('allowed', false, 'reason', 'global_limit');
  end if;

  insert into public.account_emails (kind, user_id, address_hash, ip_hash)
    values (p_kind, v_user.id, v_hash, p_ip_hash)
    returning id into v_id;
  return jsonb_build_object('allowed', true, 'id', v_id, 'user_id', v_user.id, 'email', v_user.email);
end;
$$;
revoke all on function public.claim_account_email(text, text, uuid, text) from public, anon, authenticated;
