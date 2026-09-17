-- Bug reports from testers: what they typed, plus the trail of what the app
-- was doing just before they pressed the button.
create table if not exists public.bug_reports (
  id         uuid primary key default gen_random_uuid(),
  keeper_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Short and quotable, so a tester can say "PP-4K7Q2K" in a message.
  ref        text not null unique
             default 'PP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  -- What the tester typed. Bounded so a report can't be used as storage.
  note       text check (note is null or length(note) <= 4000),
  -- Environment: platform, version, viewport, online, sync state.
  app        jsonb not null default '{}'::jsonb,
  -- The breadcrumb trail. Scrubbed client-side; see src/domain/trail.ts.
  trail      jsonb not null default '[]'::jsonb,
  -- Set by hand once a report has been looked at.
  handled_at timestamptz
);

create index if not exists bug_reports_created_idx on public.bug_reports (created_at desc);

alter table public.bug_reports enable row level security;

-- A keeper files their own reports and can see their own. Nobody reads
-- anybody else's; triage happens with the service role, in the dashboard.
drop policy if exists "bug_reports: keeper files own" on public.bug_reports;
create policy "bug_reports: keeper files own" on public.bug_reports
  for insert to authenticated
  with check (keeper_id = (select auth.uid()));

drop policy if exists "bug_reports: keeper reads own" on public.bug_reports;
create policy "bug_reports: keeper reads own" on public.bug_reports
  for select to authenticated
  using (keeper_id = (select auth.uid()));
