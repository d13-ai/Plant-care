-- Reaping abandoned anonymous accounts.
--
-- A SKETCH, not a migration. Read it, run the SELECT, and only then decide
-- whether to run the DELETE. It is checked in so the reasoning is on the
-- record, not so it runs on a schedule.
--
--
-- WHY THIS EXISTS
--
-- `ensureSession()` mints an anonymous auth.users row the first time the app
-- opens without an account. That is the product working as intended -- no
-- account needed to start -- but it means every visitor who opens
-- plantparlour.org and does nothing leaves a permanent row behind. On
-- 20 Sep 2026 five of twelve accounts were exactly that: opened the app,
-- added nothing, never came back. Four of them had not even reached the
-- app's own tables; there was no `keepers` row, only the auth record.
--
-- That count scales with curiosity, not with use. Ten thousand visitors who
-- never add a plant is ten thousand permanent rows.
--
--
-- WHY IT IS NOT AUTOMATIC
--
-- An anonymous account is a real person's account. If they still hold the
-- session token in their browser, it is their greenhouse -- empty today is
-- not abandoned. Deleting one takes away a plant record they could still
-- come back and add to, and they have no email with which to recover it.
--
-- So: a long cut-off, every guard the schema allows, and a human reading the
-- SELECT first. A reaper that is nearly always a no-op is the right shape.
--
--
-- WHAT THE GUARDS ARE FOR
--
-- Every foreign key into auth.users is ON DELETE CASCADE -- including
-- ai_usage, which is the ledger that answers "what did that cost".
-- A delete guarded only on `plants` would take spend history with it
-- silently. That is not hypothetical: this file exists because a guard on
-- plants alone was written first, and the cascade was checked afterwards.
-- Check the cascade before widening these conditions:
--
--   select c.conrelid::regclass, c.confdeltype from pg_constraint c
--   where c.contype = 'f' and c.confrelid = 'auth.users'::regclass;
--
-- Tables carrying a keeper's work as of 20 Sep 2026: keepers, plants,
-- ai_usage, calling_cards, bug_reports, game_progress. If a table is added
-- later and not listed here, this reaper will delete its rows without
-- mentioning it.

-- ---------------------------------------------------------------- look first
--
-- Run this as-is. Read the rows. On a healthy week it should return nothing.
-- Only then change `select u.id, u.created_at, u.last_sign_in_at` below to
-- `delete` and append `returning id, created_at`, so the run leaves a record
-- of exactly what went.
--
-- Every table a keeper's work can live in is named here, one per line, so
-- the protection is visible on one screen rather than buried in a join.

select u.id, u.created_at, u.last_sign_in_at
from auth.users u
where u.is_anonymous
  -- Long enough that a browser still holding the session has had every
  -- chance to come back and use it.
  and u.created_at                              < now() - interval '90 days'
  and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '90 days'
  -- Nothing of theirs anywhere. Each of these is one CASCADE away.
  and not exists (select 1 from public.plants        t where t.keeper_id = u.id)
  and not exists (select 1 from public.ai_usage      t where t.keeper_id = u.id)
  and not exists (select 1 from public.calling_cards t where t.keeper_id = u.id or t.follows_id = u.id)
  and not exists (select 1 from public.bug_reports   t where t.keeper_id = u.id)
  and not exists (select 1 from public.game_progress t where t.user_id   = u.id)
  -- A bare keepers row is a side effect of opening the app. A display name,
  -- a handle, a spent photo call or an unlimited flag are all somebody
  -- having done something: that account is not abandoned, whatever else is
  -- empty.
  and not exists (
    select 1 from public.keepers t
    where t.id = u.id
      and (t.display_name is not null
           or t.handle is not null
           or coalesce(t.photo_calls, 0) > 0
           or coalesce(t.ai_unlimited, false))
  );


-- WHAT THIS DOES NOT COVER
--
-- Storage. A keeper's photos live in the `plant-photos` bucket under their
-- id, and no foreign key reaches them, so a cascade leaves the objects
-- orphaned. Any account with photos is excluded above by the `plants` guard,
-- which is what keeps this honest today -- but if a future account can hold
-- photos without plants, the bucket needs sweeping too:
--
--   select name from storage.objects
--   where bucket_id = 'plant-photos'
--     and split_part(name, '/', 1) not in (select id::text from auth.users);
