-- ATEMA Studio — Global App Settings (singleton row)
-- Stores system-wide VAT toggle, seller identity, etc.
-- Run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS app_settings (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vat_enabled     boolean NOT NULL DEFAULT false,
  vat_number      text    NOT NULL DEFAULT '',
  cr_number       text    NOT NULL DEFAULT '',
  seller_name_ar  text    NOT NULL DEFAULT 'ATEMA Studio',
  seller_name_en  text    NOT NULL DEFAULT 'ATEMA Studio',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row (idempotent).
INSERT INTO app_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Row-level security.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Public can read settings (so the customer-facing booking page can render correctly).
DROP POLICY IF EXISTS "app_settings_public_select" ON app_settings;
CREATE POLICY "app_settings_public_select"
  ON app_settings FOR SELECT
  USING (true);

-- Only authenticated admins can update settings.
DROP POLICY IF EXISTS "app_settings_admin_upsert" ON app_settings;
CREATE POLICY "app_settings_admin_upsert"
  ON app_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
