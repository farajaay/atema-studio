-- ============================================================
-- ATEMA STUDIO — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PACKAGES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id              SERIAL PRIMARY KEY,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  price           INTEGER NOT NULL,
  duration_hours  INTEGER NOT NULL,
  edited_photos   INTEGER NOT NULL,
  album           TEXT,
  video           BOOLEAN DEFAULT false,
  description     TEXT,
  features        TEXT[],
  badge           TEXT,
  is_popular      BOOLEAN DEFAULT false,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ADD-ONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addons (
  id         TEXT PRIMARY KEY,
  name_ar    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  price      INTEGER NOT NULL,
  active     BOOLEAN DEFAULT true
);

-- ── CUSTOMERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name    TEXT NOT NULL,
  phone        TEXT NOT NULL UNIQUE,
  email        TEXT,
  city         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── BOOKINGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref      TEXT NOT NULL UNIQUE DEFAULT
                     'ATEMA-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)),
  customer_id      UUID REFERENCES customers(id),
  package_id       INTEGER REFERENCES packages(id),
  addon_ids        TEXT[] DEFAULT '{}',
  event_date       DATE NOT NULL,
  event_time       TIME NOT NULL,
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  customer_email   TEXT,
  location         TEXT,
  special_requests TEXT,
  subtotal         INTEGER NOT NULL,
  vat              INTEGER NOT NULL,
  total            INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','completed','cancelled')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid'
                     CHECK (payment_status IN ('unpaid','paid','refunded')),
  whatsapp_sent    BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAYMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id     UUID REFERENCES bookings(id),
  booking_ref    TEXT NOT NULL,
  transaction_id TEXT UNIQUE,
  amount         INTEGER NOT NULL,
  currency       TEXT DEFAULT 'SAR',
  gateway        TEXT DEFAULT 'raed',
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','success','failed','refunded')),
  gateway_ref    JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── WHATSAPP LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref TEXT NOT NULL,
  phone       TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT DEFAULT 'sent',
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE bookings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from the booking form)
CREATE POLICY "anon_insert_bookings"  ON bookings  FOR INSERT TO anon  WITH CHECK (true);
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon  WITH CHECK (true);

-- Service role has full access (Edge Functions use service role)
CREATE POLICY "service_all_bookings"  ON bookings  FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_payments"  ON payments  FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_customers" ON customers FOR ALL TO service_role USING (true);

-- Packages & addons are public read
CREATE POLICY "public_read_packages" ON packages FOR SELECT USING (true);
CREATE POLICY "public_read_addons"   ON addons   FOR SELECT USING (true);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_ref    ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_bookings_phone  ON bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at  BEFORE UPDATE ON bookings  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
