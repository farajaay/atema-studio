-- ============================================================
-- ATEMA STUDIO — REPAIR AFTER AUDIT MIGRATION
-- ============================================================
-- Purpose : Undo the parts of database-alteration-v2.sql that
--           conflicted with the live site's pre-existing
--           rls-hardening + admin policies, while KEEPING the
--           additive audit columns (event_type, guest_count,
--           shot_list, consent snapshots — those are safe).
--
-- Symptoms it fixes:
--   - Booking INSERT failing
--   - Admin dashboard slow / unable to see bookings
--   - Payment status filters broken (old "unpaid" rows showing
--     as "pending_verification")
--   - Packages / Addons not loading for admin
--
-- Safe to re-run.
-- Run AS service_role (Supabase SQL Editor uses service_role).
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 0 — RESTORE LIVE addons SCHEMA (URGENT — fixes hang)
-- ============================================================
-- The earlier `database-cleanup-legacy-price.sql` dropped addons.price
-- because the audit-script introduced price_sar as the canonical column.
-- But the LIVE frontend (src/hooks/useAddonsData.ts) reads `addon.price`
-- and crashes on `.toLocaleString()` when the field is undefined — which
-- bricks the booking page entirely.
--
-- Fix: restore the column, back-fill from price_sar, and keep both in
-- sync so the rest of the live codebase keeps working.

-- 0.1  Restore the legacy column (idempotent).
ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS price       NUMERIC(10,2);

-- 0.1b Make sure the live-expected ancillary columns exist too. These
--      are referenced by useAddonsData.ts but the audit script never
--      added them in this naming.
ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS active      BOOLEAN     DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order  INT         DEFAULT 0;

-- 0.2  Back-fill price from price_sar (audit migration's column) where
--      the legacy column is now NULL. If price_sar is also NULL we
--      can't recover the value — log a warning rather than fail silently.
DO $$
DECLARE
  recoverable INT;
  unrecoverable INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'addons' AND column_name = 'price_sar'
  ) THEN
    UPDATE public.addons SET price = price_sar
      WHERE price IS NULL AND price_sar IS NOT NULL;
    GET DIAGNOSTICS recoverable = ROW_COUNT;
    RAISE NOTICE 'Repair: back-filled price from price_sar on % addon row(s).', recoverable;
  END IF;
  SELECT COUNT(*) INTO unrecoverable FROM public.addons WHERE price IS NULL;
  IF unrecoverable > 0 THEN
    RAISE WARNING 'Repair: % addon row(s) still have NULL price. Set them manually in PackagesManager.', unrecoverable;
  END IF;
END $$;

-- 0.3  Mirror live-vs-audit boolean naming if the audit script added a
--      separate is_active column. Keep `active` (live) as the source of
--      truth; sync it from is_active where possible.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'addons' AND column_name = 'is_active'
  ) THEN
    EXECUTE 'UPDATE public.addons SET active = is_active WHERE active IS DISTINCT FROM is_active';
  END IF;
END $$;

-- 0.4  Same defensive sweep for packages — the audit script added
--      parallel columns (edited_photos_count, album_type, includes_video,
--      description_ar/_en, features_ar/_en, is_active) that the live
--      frontend doesn't read. The live columns (edited_photos, album,
--      video, description, features, active) MUST stay populated.
--      If a parallel column has data and the live column is empty,
--      back-fill it so the booking page renders correctly.
DO $$
BEGIN
  -- price (in case any package was inserted by the audit seed)
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='packages' AND column_name='price_sar')
    AND EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='packages' AND column_name='price')
  THEN
    EXECUTE 'UPDATE public.packages SET price = price_sar WHERE price IS NULL AND price_sar IS NOT NULL';
  END IF;

  -- edited_photos
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='packages' AND column_name='edited_photos_count')
    AND EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='packages' AND column_name='edited_photos')
  THEN
    EXECUTE 'UPDATE public.packages SET edited_photos = edited_photos_count
             WHERE (edited_photos IS NULL OR edited_photos = 0) AND edited_photos_count IS NOT NULL';
  END IF;

  -- album text
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='packages' AND column_name='album_type')
    AND EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='packages' AND column_name='album')
  THEN
    EXECUTE 'UPDATE public.packages SET album = album_type WHERE album IS NULL AND album_type IS NOT NULL';
  END IF;

  -- video flag
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='packages' AND column_name='includes_video')
    AND EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='packages' AND column_name='video')
  THEN
    EXECUTE 'UPDATE public.packages SET video = includes_video WHERE video IS NULL';
  END IF;

  -- active flag
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='packages' AND column_name='is_active')
    AND EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='packages' AND column_name='active')
  THEN
    EXECUTE 'UPDATE public.packages SET active = is_active WHERE active IS DISTINCT FROM is_active';
  END IF;
END $$;

-- 0.5  Default NOT-NULL safety net: any remaining NULL prices get 0.
--      The admin must then set the real price via PackagesManager, but
--      the booking page will at least render without crashing.
UPDATE public.addons   SET price = 0 WHERE price IS NULL;
UPDATE public.packages SET price = 0 WHERE price IS NULL;

-- ============================================================
-- SECTION 1 — REVERT payment_status REWRITE
-- ============================================================
-- The live CHECK constraint is:
--   payment_status IN ('unpaid','awaiting_transfer','paid','refunded')
-- but my migration set default 'pending_verification' AND rewrote
-- every existing 'unpaid' row to that value. Reverse it.

-- 1.1 Move every audit-introduced 'pending_verification' back to 'unpaid'.
--     (None of the live code ever wrote 'pending_verification', so any row
--     carrying that value can only have come from our migration.)
UPDATE public.bookings
SET    payment_status = 'unpaid'
WHERE  payment_status = 'pending_verification';

-- 1.2 Restore the canonical default.
ALTER TABLE public.bookings
  ALTER COLUMN payment_status SET DEFAULT 'unpaid';

-- 1.3 Re-assert the live CHECK constraint (idempotent — drop first then add).
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings
  ADD  CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('unpaid','awaiting_transfer','paid','refunded'));

-- ============================================================
-- SECTION 2 — REMOVE CONFLICTING BOOKINGS RLS POLICIES
-- ============================================================
-- My migration created three policies on `bookings` written for the
-- v2 audit scaffold (which would have a customer_id linked to auth.uid()).
-- They DON'T match the live site, where the customer is stored as
-- customer_name + customer_phone columns and bookings.customer_id is
-- unused. These policies are noise at best, restrictive at worst.
--
-- The live site's correct policies (kept intact) are:
--   - "Authenticated full access — bookings"   (admins, ALL ops)
--   - "Constrained anonymous booking insert"   (customer flow)
--   - "Anon update — payment intent only"      (bank transfer flow)
--   - "Public select event_date status only"   (datepicker via view)

DROP POLICY IF EXISTS "bookings_select_own"          ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_own"          ON public.bookings;
DROP POLICY IF EXISTS "service_role_all_bookings"    ON public.bookings;

-- ============================================================
-- SECTION 3 — RESTORE PUBLIC READ ON packages / addons
-- ============================================================
-- The live site never enabled RLS on these two tables — they're public
-- catalogue data. My migration enabled RLS + a USING (is_active = TRUE)
-- policy, which made admin SELECTs miss inactive rows and slowed the
-- public booking page.

-- 3.1 Drop the policies I added (idempotent).
DROP POLICY IF EXISTS "packages_public_read"   ON public.packages;
DROP POLICY IF EXISTS "addons_public_read"     ON public.addons;
DROP POLICY IF EXISTS "service_role_all_packages" ON public.packages;
DROP POLICY IF EXISTS "service_role_all_addons"   ON public.addons;

-- 3.2 Disable RLS so reads work the way the existing app expects.
--     If you later want to harden these, do it via a deliberate
--     migration that mirrors the bookings hardening pattern (one
--     authenticated full-access policy + scoped anon SELECT).
ALTER TABLE public.packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons   DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 4 — UNDO RLS ON booking_addons / profit_reports / system_logs
-- ============================================================
-- Same story. The live admin code reads these directly with the
-- authenticated session. Enabling RLS without an "authenticated"
-- policy breaks the admin UI.

DROP POLICY IF EXISTS "booking_addons_select_own"      ON public.booking_addons;
DROP POLICY IF EXISTS "service_role_all_booking_addons" ON public.booking_addons;
DROP POLICY IF EXISTS "service_role_all_profit_reports" ON public.profit_reports;
DROP POLICY IF EXISTS "service_role_all_system_logs"    ON public.system_logs;

ALTER TABLE public.booking_addons  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_reports  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs     DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 5 — REMOVE CONFLICTING customers POLICIES
-- ============================================================
-- The audit migration added a "customers_select_own" policy that
-- requires id = auth.uid(). The live site uses customers very
-- differently (anonymous booking inserts a customer row with no
-- auth tie). That policy is harmless in practice (other policies
-- are permissive and OR with it), but it's dead code — drop it.

DROP POLICY IF EXISTS "customers_select_own"      ON public.customers;
DROP POLICY IF EXISTS "service_role_all_customers" ON public.customers;

-- The live "Constrained anonymous customer insert" policy from
-- rls-hardening stays in place.

-- ============================================================
-- SECTION 6 — UNDO PAYMENTS / NOTIFICATIONS ADJUSTMENTS
-- ============================================================
-- The audit-spec payments policies aren't wired into the live site
-- (which uses Moyasar's own webhook + the bookings.payment_status
-- column as source of truth). They're not breaking anything, but
-- they're noise in pg_policies. Remove for cleanliness.

DROP POLICY IF EXISTS "payments_select_own"          ON public.payments;
DROP POLICY IF EXISTS "service_role_all_payments"    ON public.payments;
DROP POLICY IF EXISTS "service_role_all_notifications" ON public.notifications;

-- ============================================================
-- SECTION 7 — KEEP THE ADDITIVE COLUMNS
-- ============================================================
-- We intentionally do NOT drop these:
--   bookings.event_type
--   bookings.guest_count
--   bookings.shot_list
--   bookings.event_city
--   bookings.address
--   bookings.receipt_url, receipt_uploaded_at
--   bookings.net_sar, seller_vat_number
--   bookings.tc_accepted, tc_accepted_at
--   bookings.pdpl_consent_snapshot
--   bookings.whatsapp_opt_in_snapshot
--   customers.pdpl_consent, pdpl_consent_at
--   customers.whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_opt_out_at
--   packages.photographer_count, female_photographers, delivery_days,
--           features_ar, features_en
--   payments.net_sar, gross_sar, seller_vat_number, bank_name, iban,
--            receipt_url, verified_at, verified_by
-- These are all nullable / have safe defaults and the new commits
-- (51d6af9, 32e9cf5, 407a354) on origin/master rely on them.

-- ============================================================
-- SECTION 8 — DROP DUPLICATE INDEX ON CHECK CONSTRAINTS
-- ============================================================
-- Sanity: make sure no leftover constraint blocks inserts.
-- (No-op if everything is clean.)

DO $$
DECLARE
  bad_count INT;
BEGIN
  -- After Section 1 every row should have a valid payment_status.
  SELECT COUNT(*) INTO bad_count
  FROM public.bookings
  WHERE payment_status NOT IN ('unpaid','awaiting_transfer','paid','refunded');
  IF bad_count > 0 THEN
    RAISE WARNING 'Repair: % bookings still have an invalid payment_status. '
                  'Manual review needed before re-adding the CHECK constraint.',
                  bad_count;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES (run after COMMIT)
-- ============================================================
/*

-- 1. Distribution of payment_status — should be only the canonical 4 values
SELECT payment_status, COUNT(*) AS rows
FROM   public.bookings
GROUP  BY payment_status
ORDER  BY rows DESC;

-- 2. RLS status of all tables
SELECT relname  AS table_name,
       relrowsecurity AS rls_enabled,
       relforcerowsecurity AS rls_forced
FROM   pg_class
WHERE  relnamespace = 'public'::regnamespace
  AND  relkind = 'r'
ORDER  BY relname;

-- 3. All current policies (look for the bookings policies — should be ONLY
--    the 4 from rls-hardening + admin policies)
SELECT schemaname, tablename, policyname, cmd, roles
FROM   pg_policies
WHERE  schemaname = 'public'
ORDER  BY tablename, cmd, policyname;

-- 4. Confirm packages / addons are readable without auth
SELECT count(*) FROM public.packages;
SELECT count(*) FROM public.addons;

-- 5. Confirm CHECK constraint is correct
SELECT conname, pg_get_constraintdef(oid)
FROM   pg_constraint
WHERE  conrelid = 'public.bookings'::regclass
  AND  contype  = 'c';

*/
