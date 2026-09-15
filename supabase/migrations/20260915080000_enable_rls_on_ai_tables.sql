-- ai_usage and care_cards were created by hand against the live project, so
-- 20260915020000's create-with-RLS only helps a database built from this
-- directory. On the project that already has them, this is what turns RLS on.
--
-- Neither table needs a policy: both are written only by the edge functions
-- under the service role, which bypasses RLS. With RLS on and no policy, a
-- keeper holding the publishable key cannot read another keeper's spend, and
-- cannot zero their own `count` to lift the daily cap. Nothing in the app
-- reads either table directly -- the local SQLite `care_cards` is a different
-- table with different columns.
alter table public.ai_usage   enable row level security;
alter table public.care_cards enable row level security;
