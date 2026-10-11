-- Loads the plant library's care guides into care_cards, from the copy the
-- site serves (scripts/care-library.mjs writes public/care-library.json).
-- Run it after a deploy that changed the library -- Supabase SQL editor, or
-- the MCP execute_sql tool. It upserts: library guides replace model-written
-- ones for the same species, and model-written guides for anything else stay.
--
-- The http extension is only here for the fetch, and goes again after.
create extension if not exists http with schema extensions;

with page as (
  select (extensions.http_get('https://plantparlour.org/care-library.json')).content::jsonb as rows
)
insert into public.care_cards (species_key, species, card, model)
select r->>'key', r->>'species', r->'card', 'library'
from page, jsonb_array_elements(page.rows) as r
on conflict (species_key) do update set species = excluded.species, card = excluded.card, model = excluded.model;

drop extension http;

select count(*) filter (where model = 'library') as library, count(*) filter (where model <> 'library') as written_by_ai from public.care_cards;
