-- ============================================================
-- ATEMA STUDIO — Restore bookings INSERT / UPDATE / SELECT RLS
-- ============================================================
-- ⛔ DO NOT RE-RUN AS ORIGINALLY WRITTEN — section 1 has been
-- commented out (2026-08-20). It re-created the anon SELECT
-- policy on bookings that migrations-2026-07-bookings-pii-lockdown.sql
-- exists to kill: RLS policies are ROW-level, so `using (true)`
-- exposed every column — customer_phone, customer_email and the
-- manage_token / album_token capability secrets — to anyone
-- holding the anon key baked into the client bundle. Re-running
-- this file with section 1 live silently re-opens that P0.
-- The rest of the file (INSERT / UPDATE / authenticated policies)
-- is still current and safe to re-apply.
--
-- Symptom this fixes:
--   حدث خطأ: new row violates row-level security policy for table "bookings"
--
-- Why it happens:
--   Bookings has RLS enabled (from the original schema + audit migration)
--   but lacks the "Constrained anonymous booking insert" policy from
--   migrations-2026-05-rls-hardening.sql. With RLS enabled and no
--   permitting policy for the anon role, every customer insert is
--   blocked. The Edge Function (service_role) can bypass RLS, but the
--   direct-insert fallback path can't.
--
-- This migration is a focused re-application of the bookings policies
-- from rls-hardening, plus the BankTransferPayment update policy so
-- the bride can attach her receipt later.
--
-- Safe to re-run. Run AS service_role (Supabase SQL Editor).
-- ============================================================

BEGIN;

-- ── 0. Ensure RLS is on (no-op if already enabled) ──────────────────
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ── 1. Public booked-dates SELECT — ⛔ RETRACTED 2026-08-20 ──────────
-- The premise below was wrong. The claim "open-but-PII-free — the view
-- exposes only event_date and status" confuses the VIEW's projection
-- with the POLICY's scope: an RLS policy grants rows, not columns, so
-- this `using (true)` handed anon the whole bookings table through a
-- direct PostgREST call. That was the July 2026 P0, closed by
-- migrations-2026-07-bookings-pii-lockdown.sql.
--
-- The policy is also no longer needed: migrations-2026-07-public-booked-
-- dates-definer.sql flipped public_booked_dates to security_invoker =
-- false, owned by postgres, so the DatePicker reads the view without any
-- anon grant on the base table.
--
-- The DROP stays — it is now the desired end state. The CREATE is left
-- commented as history; do not restore it.
DROP POLICY IF EXISTS "Public select event_date status only" ON public.bookings;
-- CREATE POLICY "Public select event_date status only"
--   ON public.bookings
--   FOR SELECT
--   TO anon
--   USING (true);

-- ── 2. Constrained anonymous booking INSERT ─────────────────────────
-- The customer-facing booking form (and the direct-insert fallback in
-- src/services/booking.ts) writes here using the anon key. This policy
-- enforces basic shape: presence of customer details, future date, sane
-- amounts, forced initial status. Anything more lenient invites abuse;
-- anything stricter blocks real customers.
DROP POLICY IF EXISTS "anon_insert_bookings"                  ON public.bookings;
DROP POLICY IF EXISTS "Allow public booking insert"           ON public.bookings;
DROP POLICY IF EXISTS "Constrained anonymous booking insert"  ON public.bookings;
CREATE POLICY "Constrained anonymous booking insert"
  ON public.bookings
  FOR INSERT
  TO anon
  WITH CHECK (
        customer_name  IS NOT NULL
    AND length(trim(customer_name))  BETWEEN 2 AND 120
    AND customer_phone IS NOT NULL
    AND length(trim(customer_phone)) BETWEEN 7 AND 25
    AND event_date IS NOT NULL
    AND event_date >= current_date          -- no past-date bookings
    AND subtotal > 0     AND subtotal <= 200000
    AND total    > 0     AND total    <= 230000
    AND vat      >= 0    AND vat      <= 50000
    AND status         = 'pending'          -- admin must confirm
    AND payment_status = 'unpaid'           -- payment flows through update
  );

-- ── 3. Constrained anonymous booking UPDATE (bank transfer flow) ────
-- BankTransferPayment.tsx writes payment_method = 'bank_transfer' and
-- flips payment_status from 'unpaid' to 'awaiting_transfer' once the
-- bride uploads her receipt. Anything else is admin territory.
DROP POLICY IF EXISTS "Allow public booking update"      ON public.bookings;
DROP POLICY IF EXISTS "anon_update_bookings"             ON public.bookings;
DROP POLICY IF EXISTS "Anon update — payment intent only" ON public.bookings;
CREATE POLICY "Anon update — payment intent only"
  ON public.bookings
  FOR UPDATE
  TO anon
  USING (status = 'pending' AND payment_status = 'unpaid')
  WITH CHECK (
        payment_method IN ('bank_transfer','card')
    AND payment_status IN ('unpaid','awaiting_transfer')
    AND status = 'pending'
  );

-- ── 4. Authenticated (admin) full access ────────────────────────────
DROP POLICY IF EXISTS "authenticated_all_bookings"        ON public.bookings;
DROP POLICY IF EXISTS "Authenticated full access — bookings" ON public.bookings;
CREATE POLICY "Authenticated full access — bookings"
  ON public.bookings FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ── 5. Customers — restore the constrained anon INSERT policy too ───
-- The booking flow may insert a customer row alongside the booking
-- (depends on app code path). Mirror the rls-hardening shape.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_customers"                    ON public.customers;
DROP POLICY IF EXISTS "Constrained anonymous customer insert"    ON public.customers;
CREATE POLICY "Constrained anonymous customer insert"
  ON public.customers
  FOR INSERT
  TO anon
  WITH CHECK (
        full_name  IS NOT NULL AND length(trim(full_name))  BETWEEN 2 AND 120
    AND phone      IS NOT NULL AND length(trim(phone))      BETWEEN 7 AND 25
  );

DROP POLICY IF EXISTS "Authenticated full access — customers" ON public.customers;
CREATE POLICY "Authenticated full access — customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
/*

-- All current policies on bookings (expect 4: select, insert, update, admin)
SELECT policyname, cmd, roles
FROM   pg_policies
WHERE  schemaname = 'public' AND tablename = 'bookings'
ORDER  BY cmd, policyname;

-- Smoke test: simulate the customer insert as the anon role.
-- Should INSERT 1 row, not error.
SET LOCAL ROLE anon;
INSERT INTO public.bookings (
  booking_ref, customer_name, customer_phone,
  event_date, event_time,
  subtotal, vat, total,
  status, payment_status
) VALUES (
  'TEST-' || substr(md5(random()::text), 1, 8),
  'RLS Smoke Test',
  '+966500000000',
  CURRENT_DATE + INTERVAL '7 days', '18:00',
  1000, 0, 1000,
  'pending', 'unpaid'
) RETURNING booking_ref, status, payment_status;
RESET ROLE;

-- Clean up the smoke-test row
DELETE FROM public.bookings WHERE customer_name = 'RLS Smoke Test';

*/
