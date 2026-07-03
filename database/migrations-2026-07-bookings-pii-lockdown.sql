-- ATEMA STUDIO — CLOSE anon SELECT leak on public.bookings (2026-07-03) ⚠️ P0
--
-- Discovered during album end-to-end verification: the anon role (the public
-- key baked into the client bundle — i.e. anyone who views source) could read
-- the ENTIRE bookings table via PostgREST:
--     GET /rest/v1/bookings?select=customer_name,customer_phone,customer_email,
--                                  total,manage_token,album_token
-- returning every customer's name, phone, email, price, and — worst — their
-- manage_token and album_token (capability secrets that gate the self-service
-- reschedule / package-change / album pages). That's a PDPL PII breach AND a
-- booking-takeover vector.
--
-- Root cause: a broad anon/public SELECT policy on bookings (RLS policies are
-- ROW-level, so a `using(true)` SELECT policy exposes ALL columns, regardless
-- of a reassuring name like "event_date status only"). The safe public reads
-- already exist elsewhere and do NOT need table access:
--   • calendar        → public_booked_dates VIEW (event_date + status only)
--   • manage page      → get_booking_by_token()        (SECURITY DEFINER RPC)
--   • album page       → get_album_selection_by_token() (SECURITY DEFINER RPC)
-- and the booking write path is the create-booking Edge Function (service
-- role), which returns its own data — so anon needs no SELECT on bookings.
--
-- Fix: drop every anon/public SELECT policy on bookings. Preserve the
-- authenticated (admin) ALL policy and the anon INSERT/UPDATE policies.
-- Idempotent. Run AS service_role IMMEDIATELY.

alter table public.bookings enable row level security;

-- Explicit drops of every known/likely name (harmless if absent).
drop policy if exists "Public select event_date status only" on public.bookings;
drop policy if exists "Allow public booking select"          on public.bookings;
drop policy if exists "anon_select_bookings"                 on public.bookings;
drop policy if exists "Public select bookings"               on public.bookings;
drop policy if exists "Enable read access for all users"     on public.bookings;
drop policy if exists "Allow public read"                    on public.bookings;
drop policy if exists "select_bookings"                      on public.bookings;

-- Catch-all: drop ANY remaining SELECT policy on bookings that is granted to
-- anon or public. Never touches an authenticated-only policy (admin keeps its
-- "Authenticated full access — bookings" ALL policy).
do $$
declare pol record;
begin
  for pol in
    select policyname, roles
      from pg_policies
     where schemaname = 'public' and tablename = 'bookings' and cmd = 'SELECT'
  loop
    if pol.roles && array['anon','public']::name[] then
      execute format('drop policy if exists %I on public.bookings', pol.policyname);
      raise notice 'dropped anon/public SELECT policy on bookings: %', pol.policyname;
    end if;
  end loop;
end $$;

-- ── Verify ────────────────────────────────────────────────────────────────
-- Expect: NO SELECT policy whose roles include anon/public. The only broad
-- policy left should be the authenticated ALL policy.
select policyname, cmd, roles
  from pg_policies
 where schemaname = 'public' and tablename = 'bookings'
 order by cmd, policyname;

-- Smoke test (run as the anon role in a separate session, e.g. via PostgREST):
--   GET /rest/v1/bookings?select=customer_phone&limit=1   → must return []
--   GET /rest/v1/public_booked_dates?select=*&limit=1     → still works
