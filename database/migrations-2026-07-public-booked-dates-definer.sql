-- ATEMA STUDIO — fix public_booked_dates after the bookings PII lockdown
--
-- Companion to migrations-2026-07-bookings-pii-lockdown.sql. That migration
-- removed the broad anon SELECT policy on bookings (which was leaking the whole
-- table). But public_booked_dates was defined `with (security_invoker = true)`,
-- i.e. it evaluated bookings RLS AS THE CALLER — so it only ever worked because
-- of that same leaky anon policy. With the policy gone, the customer DatePicker
-- would see zero booked dates and could let two brides book the same day.
--
-- The security-invoker approach was the wrong tool: RLS is row-level, so the
-- policy that fed the view also exposed every column of the table. Correct fix:
-- make this a DEFINER-semantics view (security_invoker = false) owned by a
-- BYPASSRLS role, so it returns ONLY the safe event_date + status projection
-- regardless of the table's (now locked-down) RLS. No PII, no anon table access.
--
-- Idempotent. Run AS service_role, AFTER the lockdown migration.

drop view if exists public.public_booked_dates;

create view public.public_booked_dates
  with (security_invoker = false)     -- run as the view OWNER, not the anon caller
  as
select event_date, status
  from public.bookings
 where status <> 'cancelled';

-- Owner must bypass RLS for the definer view to see rows. In Supabase the
-- `postgres` role has BYPASSRLS; this is the standard "safe projection" pattern.
alter view public.public_booked_dates owner to postgres;

grant select on public.public_booked_dates to anon, authenticated;

-- ── Verify ────────────────────────────────────────────────────────────────
-- As anon (e.g. via PostgREST):
--   GET /rest/v1/public_booked_dates?select=event_date,status  → returns rows
--   GET /rest/v1/bookings?select=customer_phone                → still []
select 'public_booked_dates rows:' as check, count(*) from public.public_booked_dates;
