-- ============================================================
-- ATEMA STUDIO — Enable RLS on remaining public tables
-- ============================================================
-- Fixes Supabase security advisor warning:
--   "rls_disabled_in_public" on packages, addons, payments, whatsapp_logs
--
-- admin-setup.sql enabled RLS on these but is NOT in the auto-run
-- manifest (not idempotent). This migration re-applies it cleanly.
--
-- Safe to re-run (idempotent).
-- ============================================================

BEGIN;

-- ── packages ────────────────────────────────────────────────
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_packages"          ON public.packages;
DROP POLICY IF EXISTS "Public read packages"        ON public.packages;
DROP POLICY IF EXISTS "Authenticated full access — packages" ON public.packages;

-- Anon can SELECT (booking page reads the catalogue)
CREATE POLICY "Public read packages"
  ON public.packages FOR SELECT TO anon USING (true);

-- Authenticated (admin) full access
CREATE POLICY "Authenticated full access — packages"
  ON public.packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── addons ──────────────────────────────────────────────────
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_addons"           ON public.addons;
DROP POLICY IF EXISTS "Public read addons"         ON public.addons;
DROP POLICY IF EXISTS "Authenticated full access — addons" ON public.addons;

CREATE POLICY "Public read addons"
  ON public.addons FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated full access — addons"
  ON public.addons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── payments ────────────────────────────────────────────────
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_payments"         ON public.payments;
DROP POLICY IF EXISTS "Authenticated full access — payments" ON public.payments;

-- No anon access to payments; only admin and service_role
CREATE POLICY "Authenticated full access — payments"
  ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── whatsapp_logs (legacy table, internal only) ──────────────
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access — whatsapp_logs" ON public.whatsapp_logs;

CREATE POLICY "Authenticated full access — whatsapp_logs"
  ON public.whatsapp_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
