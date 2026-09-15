-- Remediation for the cross-keeper lineage graft that 20260915050000 closed.
--
-- Until the trigger in that migration existed, mother_plant_id was never
-- constrained to the keeper's own plants, and FK checks bypass RLS -- so any
-- account could point a plant at a stranger's and have it render under
-- "Cuttings" on their public tag. A link whose two ends have different
-- keepers is either that graft or a bug; it is not lineage either way.
--
-- Split out of the migration that closed the hole because this one rewrites
-- rows rather than schema. Look before applying it:
--
--   select c.id, c.keeper_id as claimed_by, c.nickname, m.keeper_id as real_owner
--     from public.plants c
--     join public.plants m on c.mother_plant_id = m.id
--    where c.keeper_id <> m.keeper_id;
--
-- Only the plants listed there are touched, and only their mother_plant_id:
-- nothing is deleted, and the link is the only thing that was never theirs.
update public.plants c
   set mother_plant_id = null
  from public.plants m
 where c.mother_plant_id = m.id
   and c.keeper_id <> m.keeper_id;
