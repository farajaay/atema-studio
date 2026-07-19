-- ATEMA STUDIO — First-party visitor analytics (July 2026)
--
-- Why: the owner wants traffic visibility in the admin panel — visits over
-- time, how many sessions reach /book, and each session's departure page —
-- without handing visitor data to a third-party tracker (PDPL posture,
-- women-only clientele).
--
-- What the client stores per pageview (see src/services/analytics.ts):
--   session_id  random per-tab id minted client-side (sessionStorage) —
--               NOT a cookie, NOT a fingerprint, resets when the tab closes
--   path        sanitized ROUTE TEMPLATE only. Token-bearing routes are
--               redacted client-side (/board/:token, /manage/:token,
--               /album/:token) so capability tokens never reach this table.
--   referrer    hostname only (never the full URL)
--   device      'mobile' | 'desktop'
--   lang        'ar' | 'en'
-- No IP, no user agent, no name, nothing joinable to bookings.
--
-- RLS: anon may INSERT under tight column/range checks (simple predicates
-- only — the booking-insert incident taught us subqueries in policies fail
-- silently; see migrations-2026-06-fix-booking-insert.sql). Only the
-- authenticated admin may SELECT. Nobody gets UPDATE/DELETE via the API.
--
-- Idempotent — safe to re-run.

begin;

create table if not exists public.site_visits (
  id          bigint generated always as identity primary key,
  session_id  text        not null,
  path        text        not null,
  referrer    text,
  device      text,
  lang        text,
  created_at  timestamptz not null default now()
);

create index if not exists site_visits_created_idx
  on public.site_visits (created_at desc);

create index if not exists site_visits_session_idx
  on public.site_visits (session_id, created_at);

alter table public.site_visits enable row level security;

-- Visitors write pageviews; bounds keep junk and abuse out of the table.
drop policy if exists "Constrained anonymous visit insert" on public.site_visits;
create policy "Constrained anonymous visit insert"
  on public.site_visits
  for insert
  to anon
  with check (
        length(session_id) between 8 and 64
    and path like '/%'
    and length(path) <= 40
    and (referrer is null or length(referrer) <= 120)
    and (device is null or device in ('mobile', 'desktop'))
    and (lang is null or lang in ('ar', 'en'))
  );

-- Only the signed-in owner reads the stats.
drop policy if exists "Admin reads site_visits" on public.site_visits;
create policy "Admin reads site_visits"
  on public.site_visits
  for select
  using (auth.role() = 'authenticated');

commit;

-- Sanity check
select '— site_visits ready —' as section, count(*) as rows_so_far
from public.site_visits;
