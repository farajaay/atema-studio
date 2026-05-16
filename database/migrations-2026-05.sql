-- ATEMA Studio — May 2026 migrations
-- Run once in Supabase SQL editor (after schema.sql).

-- 1) Per-booking VAT toggle (allows disabling VAT for specific bookings).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vat_enabled boolean NOT NULL DEFAULT true;

-- 2) Admin-managed calendar — blocked dates.
CREATE TABLE IF NOT EXISTS blocked_dates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date         date NOT NULL UNIQUE,
  reason       text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_dates_public_select" ON blocked_dates;
CREATE POLICY "blocked_dates_public_select"
  ON blocked_dates FOR SELECT USING (true);

DROP POLICY IF EXISTS "blocked_dates_admin_write" ON blocked_dates;
CREATE POLICY "blocked_dates_admin_write"
  ON blocked_dates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
