-- The photo-trial counter, locked to the edge functions as it was meant to be.
--
-- 20260917110000_photo_trial_cap.sql revoked execute from anon and
-- authenticated, but a function's execute is granted to PUBLIC by default,
-- and both roles inherit it from there -- so the revoke changed nothing. The
-- same mistake was made and fixed for claim_ai_call / refund_ai_call two days
-- earlier (20260915090000_revoke_rpc_on_service_functions.sql); the photo
-- trial, added after, repeated it.
--
-- What it allowed, found by Supabase's security advisor on 14 Oct 2026: any
-- signed-in keeper, or anyone with the publishable key, could call
--   refund_photo_call(<their id>)        -- and reset their own five free AI
--                                           photo checks, as often as they liked
--   claim_photo_call(<someone's id>, 0)  -- and spend another keeper's
-- Each check is a paid model call. The daily caps still bounded the spend.
-- Only the edge functions (service role) call either, so nothing else changes.

revoke execute on function public.claim_photo_call(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_photo_call(uuid)         from public, anon, authenticated;
grant execute on function public.claim_photo_call(uuid, integer) to service_role;
grant execute on function public.refund_photo_call(uuid)         to service_role;
