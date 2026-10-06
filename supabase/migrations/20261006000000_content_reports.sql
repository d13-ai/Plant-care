-- Reports of published pages: a plant tag or a conservatory that somebody
-- thinks breaks the rules (Terms, "What not to do").
--
-- Google Play's user-generated content policy asks for a way to report
-- shared content, and the published pages are PlantParlour's shared content.
-- Anyone can report -- most people who see a tag aren't keepers -- so the
-- `report-content` edge function takes the report, writes it here with the
-- service role, and emails it to us. Nobody reads or writes this table any
-- other way.
--
-- The reporter's network address is kept only as a hash, to stop one source
-- filing the same report over and over; the function counts by it and
-- never needs it back.

create table public.content_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('tag', 'conservatory')),
  -- The page as a path: /tag?t=<token> or /@handle.
  page text not null check (length(page) <= 200),
  reason text not null check (reason in ('offensive', 'not_theirs', 'spam', 'other')),
  note text check (note is null or length(note) <= 1000),
  ip_hash text,
  -- Set by hand once it has been looked at.
  handled_at timestamptz
);

create index content_reports_by_time on public.content_reports (created_at desc);
create index content_reports_by_ip on public.content_reports (ip_hash, created_at desc) where ip_hash is not null;

alter table public.content_reports enable row level security;
-- No policies: the service role only.
