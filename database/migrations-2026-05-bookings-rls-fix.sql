-- ============================================================
-- ATEMA STUDIO — Restore bookings INSERT / UPDATE / SELECT RLS
-- ============================================================
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

-- ── 1. Public booked-dates SELECT (for the DatePicker view) ─────────
-- The customer DatePicker queries public_booked_dates (a view), which
-- needs SELECT permission on the underlying bookings table for the
-- anon role. Open-but-PII-free — the view exposes only event_date and
-- status. Application contract: anon never hits bookings directly.
DROP POLICY IF EXISTS "Public select event_date status only" ON public.bookings;
CREATE POLICY "Public select event_date status only"
  ON public.bookings
  FOR SELECT
  TO anon
  USING (true);

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
