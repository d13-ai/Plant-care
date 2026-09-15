-- Take the service-only functions off the public REST API.
--
-- `revoke all ... from public` in the migrations that created these does not
-- do it. PUBLIC is the implicit grantee; Supabase separately hands anon and
-- authenticated EXECUTE on new functions in the `public` schema through
-- default privileges, and revoking from PUBLIC leaves those explicit grants
-- standing. The database linter caught all three exposed at
-- /rest/v1/rpc/<name> after the spend-cap migration went in.
--
-- refund_ai_call was the bad one: it takes a keeper id and decrements that
-- keeper's daily count, so anyone holding the publishable key could call it
-- in a loop and lift the cap it exists to enforce -- a worse hole than the
-- read-then-write race it shipped alongside. claim_ai_call takes the cap
-- values as arguments, so a caller could pass their own. record_ai_usage,
-- which predates all of this, let anyone inflate the recorded spend.
--
-- All three are called only by the edge functions, which use the service role.
-- passport() is deliberately left executable by anon: it is the tag page's
-- entire public surface, and it returns one published plant or nothing.
revoke execute on function public.claim_ai_call(uuid, date, integer, integer) from public, anon, authenticated;
revoke execute on function public.refund_ai_call(uuid, date)                  from public, anon, authenticated;
revoke execute on function public.record_ai_usage(uuid, date, bigint, bigint, numeric) from public, anon, authenticated;

-- A trigger function cannot usefully be invoked over REST -- Postgres refuses
-- to run one outside a trigger -- but it has no business being listed either.
revoke execute on function public.plants_mother_same_keeper() from public, anon, authenticated;

grant execute on function public.claim_ai_call(uuid, date, integer, integer) to service_role;
grant execute on function public.refund_ai_call(uuid, date) to service_role;
grant execute on function public.record_ai_usage(uuid, date, bigint, bigint, numeric) to service_role;
