-- ============================================================
-- ATEMA STUDIO — Admin User Setup
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- Create admin user (change email/password before running!)
-- This uses Supabase Auth — run via Dashboard > Authentication > Users
-- OR use this SQL (requires service_role key):

-- INSERT INTO auth.users (email, encrypted_password, role, ...)
-- Better: create via Supabase Dashboard → Authentication → Users → Add User

-- ── Admin RLS policies ────────────────────────────────────
-- Allow authenticated users (admins) to read/write everything

ALTER TABLE bookings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons    ENABLE ROW LEVEL SECURITY;

-- Authenticated users = admins
CREATE POLICY "admin_all_bookings"  ON bookings  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_payments"  ON payments  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_packages"  ON packages  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_addons"    ON addons    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── How to create your admin account ─────────────────────
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User"
-- 3. Enter: admin@atemastudio.com + strong password
-- 4. That's it — use these credentials in the admin login page
