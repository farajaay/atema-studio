-- ATEMA STUDIO — Restore anon SELECT on bookings (June 2026)
--
-- Problem (live, 2026-06-26):
--   After fix-booking-insert.sql removed the broken M-9 INSERT policy,
--   the anon INSERT now succeeds. However, migrations-2026-05-audit-patches.sql
--   (H-9) dropped the anon SELECT policy on bookings so that the DatePicker
--   goes via the public_booked_dates view instead. This means the
--   INSERT … RETURNING in the client fallback path (resilientInsert in
--   src/services/booking.ts) returns PGRST116 ("0 rows") because anon
--   cannot read the just-inserted row.
--
--   In the master branch (live site) this PGRST116 is surfaced as a
--   "حدث خطأ: The result contains 0 rows [PGRST116]" error, which the
--   user sees as a booking failure — even though the record WAS inserted.
--
-- Fix:
--   Restore a permissive anon SELECT policy on bookings. This is the
--   same policy that migrations-2026-05-rls-hardening.sql added (and that
--   H-9 subsequently dropped). It lets INSERT … RETURNING work correctly
--   for the fallback path.
--
--   PII note: the anon SELECT policy with USING(true) lets any anon holder
--   read all booking rows (including customer_name). This is the original
--   state from rls-hardening.sql, which was live for weeks. The permanent
--   fix is to deploy the code from branch claude/project-skills-assessment-xfx51u
--   (PGRST116 handled via client-side UUID synthesis), after which the
--   fallback path no longer needs to SELECT from bookings, and this policy
--   can be dropped again. See TODO below.
--
-- Idempotent. Run AS service_role (Supabase SQL editor or migrations workflow).

begin;

drop policy if exists "Public select event_date status only" on public.bookings;
drop policy if exists "Allow public booking select"           on public.bookings;
drop policy if exists "anon_select_bookings"                  on public.bookings;
drop policy if exists "Anon read own booking after insert"    on public.bookings;

create policy "Anon read own booking after insert"
  on public.bookings
  for select
  to anon
  using (true);

commit;

-- ── TODO (remove after code fix is on master) ────────────────────────────────
-- Once branch claude/project-skills-assessment-xfx51u is merged to master
-- and deployed (the PGRST116 / client-UUID fix in src/services/booking.ts),
-- drop this policy again and route all anon date reads through the
-- public_booked_dates view as H-9 intended:
--
--   drop policy if exists "Anon read own booking after insert" on public.bookings;
--
-- ── Verify ────────────────────────────────────────────────────────────────────
select policyname, cmd, roles
  from pg_policies
 where schemaname = 'public' and tablename = 'bookings'
 order by cmd, policyname;
