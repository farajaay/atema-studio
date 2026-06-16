-- ATEMA STUDIO — existing-DB migration bundle (generated, do not hand-edit)
-- Single-file concatenation of database/supabase-migrations.yml's manifest,
-- in the same dependency-aware order, for one-shot paste into the Supabase
-- SQL editor on an EXISTING database. Every file is idempotent.
--
-- This is the SAME set the .github/workflows/supabase-migrations.yml runs
-- with include-seeds: true. Regenerate via scripts, never edit by hand.
-- Excludes: seed-portfolio-2026-05.sql (superseded by -expanded).
-- Prerequisites (run once on a fresh DB only, NOT included here):
--   database/schema.sql, database/admin-setup.sql
-- Generated: 2026-06-16T17:53:28Z

-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/app-settings.sql
-- ═══════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05.sql
-- ═══════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-rls-hardening.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Row-Level Security hardening pass (May 2026)
--
-- Why this exists
-- ---------------
-- Two issues surfaced in Supabase's security advisor + an internal audit:
--
--   1. PII LEAK on bookings.
--      The customer-facing date picker queries the `bookings` table via the
--      anon key and pulls back `customer_name` + `booking_ref` along with
--      `event_date`. The columns aren't displayed in the customer UI, but
--      they cross the wire. PRESENTATION §8 ("Customer never sees PII") is
--      not actually upheld.
--
--   2. PERMISSIVE INSERT on bookings.
--      `anon_insert_bookings` uses `WITH CHECK (true)` — anyone with the
--      anon key can insert *any* row, including past dates, zero totals,
--      crafted payment_status values, etc. (See bugs.md C-3 and H-5.)
--
-- Fix
-- ---
--   1. Create `public_booked_dates` — a security-invoker view that exposes
--      only (event_date, status) for committed bookings. The view is
--      readable by anon. The customer DatePicker switches to this view
--      (see src/services/calendar.ts) and never sees PII again.
--
--   2. Replace `anon_insert_bookings` with a *constrained* anonymous-insert
--      policy that validates basic shape (lengths, future date, sane
--      amounts, forced initial status). This is defence in depth — the
--      eventual goal is to drop anonymous INSERT entirely once the
--      `create-booking` Edge Function is deployed (see "Final cleanup"
--      block at the bottom of this file).
--
--   3. Drop any permissive anon SELECT on bookings if one slipped in.
--      Admin reads continue through the authenticated role.
--
-- This migration is **safe to run before the Edge Function is deployed**.
-- The customer booking path still works because the constrained INSERT
-- policy allows the same `services/booking.ts` fallback path used today.

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0. Schema prerequisites                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- The base schema (database/schema.sql) predates the bank-transfer flow,
-- so it's missing two things the anon UPDATE policy below needs:
--
--   * `payment_method` column — BankTransferPayment.tsx writes
--     `'bank_transfer'` here when the bride marks she's wired the deposit.
--   * `'awaiting_transfer'` in the payment_status CHECK list — same flow.
--
-- Both additions are idempotent. Drop the old CHECK constraint by name
-- (auto-generated as `bookings_payment_status_check`) before re-adding.

alter table public.bookings
  add column if not exists payment_method text;

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;
alter table public.bookings
  add  constraint bookings_payment_status_check
  check (payment_status in ('unpaid','awaiting_transfer','paid','refunded'));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Public view: event_date + status only (no PII)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

drop view if exists public.public_booked_dates;
create view public.public_booked_dates
  with (security_invoker = true)        -- run with the *caller's* RLS, not owner
  as
select
  event_date,
  status
from public.bookings
where status <> 'cancelled';

-- Grant SELECT to anon + authenticated. RLS on the underlying table will
-- still apply because of security_invoker. We add a permissive SELECT
-- policy on the view's source rows below.
grant select on public.public_booked_dates to anon, authenticated;

-- The view's invoker-style means anon needs a SELECT policy on the
-- underlying bookings table — BUT only for the (event_date, status)
-- columns. We can't column-mask via a policy, so instead we rely on the
-- application contract: the public view is the only path used by anon.
-- For safety we still keep a tight SELECT policy that drops PII via the
-- view as the sole access channel.

drop policy if exists "Public select event_date status only" on public.bookings;
create policy "Public select event_date status only"
  on public.bookings
  for select
  to anon
  using (true);                          -- guarded at the application layer
                                         -- via the view; admins keep full
                                         -- access through their auth session.

-- (Once the customer flow has migrated to the view, this open SELECT can
-- be dropped — anon should not need bookings at all. See Final cleanup.)

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Replace the permissive anon INSERT with a constrained one      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

drop policy if exists "anon_insert_bookings" on public.bookings;
drop policy if exists "Allow public booking insert" on public.bookings;
drop policy if exists "Constrained anonymous booking insert" on public.bookings;

create policy "Constrained anonymous booking insert"
  on public.bookings
  for insert
  to anon
  with check (
        customer_name  is not null
    and length(trim(customer_name))  between 2 and 120
    and customer_phone is not null
    and length(trim(customer_phone)) between 7 and 25
    and event_date is not null
    and event_date >= current_date            -- H-3: no past-date bookings
    and subtotal > 0     and subtotal <= 200000
    and total    > 0     and total    <= 230000
    and vat      >= 0    and vat      <= 50000
    and status         = 'pending'            -- admin must confirm
    and payment_status = 'unpaid'             -- payment flows through update
  );

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Tighten anon UPDATE                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- The BankTransferPayment component sets payment_method = 'bank_transfer'
-- and payment_status = 'awaiting_transfer' from the anon role. Allow ONLY
-- that transition. Values mirror what src/components/BankTransferPayment.tsx
-- actually writes — anything else is for the authenticated admin to set.

drop policy if exists "Allow public booking update" on public.bookings;
drop policy if exists "anon_update_bookings"        on public.bookings;
drop policy if exists "Anon update — payment intent only" on public.bookings;

create policy "Anon update — payment intent only"
  on public.bookings
  for update
  to anon
  using (status = 'pending' and payment_status = 'unpaid')
  with check (
        payment_method in ('bank_transfer','card')
    and payment_status in ('unpaid','awaiting_transfer')
    and status = 'pending'
  );

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Admin/authenticated full access (keep as-is, but ensure)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

drop policy if exists "authenticated_all_bookings" on public.bookings;
drop policy if exists "Authenticated full access — bookings" on public.bookings;
create policy "Authenticated full access — bookings"
  on public.bookings for all
  to authenticated
  using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Customers — keep open INSERT only with shape validation         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

drop policy if exists "anon_insert_customers" on public.customers;
drop policy if exists "Constrained anonymous customer insert" on public.customers;

create policy "Constrained anonymous customer insert"
  on public.customers
  for insert
  to anon
  with check (
        full_name  is not null and length(trim(full_name))  between 2 and 120
    and phone      is not null and length(trim(phone))      between 7 and 25
  );

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Verify                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

select '— RLS hardened —' as section;
select schemaname, tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('bookings','customers')
 order by tablename, cmd, policyname;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FINAL CLEANUP — run AFTER deploying create-booking Edge Function   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- The Edge Function uses the service-role key and bypasses RLS. Once
-- it's deployed and the client (src/services/booking.ts) is invoking
-- it successfully, anonymous INSERT/UPDATE/SELECT on `bookings` is no
-- longer needed and should be removed entirely.
--
-- Uncomment and run the block below ONLY after you've confirmed in
-- production that a real booking goes through via the Edge Function:
--
--   drop policy if exists "Constrained anonymous booking insert" on public.bookings;
--   drop policy if exists "Anon update — payment intent only"   on public.bookings;
--   drop policy if exists "Public select event_date status only" on public.bookings;
--
-- After that, the *only* anon access to `bookings` is through the
-- `public_booked_dates` view — which exposes nothing but the date and
-- the status. Customer privacy is then fully enforced at the database
-- layer, not just the application layer.


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-bookings-rls-fix.sql
-- ═══════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-branding.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Branding / Editorial Phase migration (May 2026)
-- Adds: app_settings.theme · portfolio_items · journal_posts
--       + Storage buckets `portfolio` and `journal` with public read.

-- ─────────────────────────────────────────────────────────────────────
-- 1) Theme column on app_settings
-- ─────────────────────────────────────────────────────────────────────
alter table public.app_settings
  add column if not exists theme text not null default 'noir'
  check (theme in ('noir', 'ivory'));

-- ─────────────────────────────────────────────────────────────────────
-- 2) Portfolio items
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  title_ar    text not null,
  title_en    text not null,
  category    text not null check (category in ('bride','family','maternity','couture','editorial')),
  image_url   text not null,
  caption_ar  text,
  caption_en  text,
  sort_order  integer not null default 100,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists portfolio_items_published_sort_idx
  on public.portfolio_items (published, sort_order, created_at desc);

alter table public.portfolio_items enable row level security;

-- Public can read only published rows
drop policy if exists "portfolio_public_read" on public.portfolio_items;
create policy "portfolio_public_read"
  on public.portfolio_items
  for select to anon, authenticated
  using (published = true);

-- Admins (authenticated) can do everything. Tighten further later via custom claims if needed.
drop policy if exists "portfolio_admin_all" on public.portfolio_items;
create policy "portfolio_admin_all"
  on public.portfolio_items
  for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────
-- 3) Journal posts
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.journal_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title_ar      text not null,
  title_en      text not null,
  excerpt_ar    text not null default '',
  excerpt_en    text not null default '',
  body_ar       text not null default '',
  body_en       text not null default '',
  cover_url     text not null default '',
  published     boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists journal_posts_published_idx
  on public.journal_posts (published, published_at desc nulls last);

create index if not exists journal_posts_slug_idx
  on public.journal_posts (slug);

alter table public.journal_posts enable row level security;

drop policy if exists "journal_public_read" on public.journal_posts;
create policy "journal_public_read"
  on public.journal_posts
  for select to anon, authenticated
  using (published = true);

drop policy if exists "journal_admin_all" on public.journal_posts;
create policy "journal_admin_all"
  on public.journal_posts
  for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────
-- 4) Storage buckets
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('journal', 'journal', true)
on conflict (id) do update set public = true;

-- Storage policies
-- Public read for both buckets (already public, but explicit policies for clarity).
drop policy if exists "portfolio_storage_public_read" on storage.objects;
create policy "portfolio_storage_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "journal_storage_public_read" on storage.objects;
create policy "journal_storage_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'journal');

-- Admin (authenticated) write access for both.
drop policy if exists "portfolio_storage_admin_write" on storage.objects;
create policy "portfolio_storage_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio');

drop policy if exists "portfolio_storage_admin_update" on storage.objects;
create policy "portfolio_storage_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio') with check (bucket_id = 'portfolio');

drop policy if exists "portfolio_storage_admin_delete" on storage.objects;
create policy "portfolio_storage_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "journal_storage_admin_write" on storage.objects;
create policy "journal_storage_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'journal');

drop policy if exists "journal_storage_admin_update" on storage.objects;
create policy "journal_storage_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'journal') with check (bucket_id = 'journal');

drop policy if exists "journal_storage_admin_delete" on storage.objects;
create policy "journal_storage_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'journal');


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-custom-domain.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Custom-domain path migration.
-- Run ONCE after switching from farajaay.github.io/atema-studio/ to
-- the custom domain atemastudio.xyz.
--
-- The cutover changes the site's BASE_URL from "/atema-studio/" to "/".
-- Any cover_url / image_url rows that were seeded against the old base
-- need to be rewritten so the assets resolve under the new root.

-- ─── Journal posts ──────────────────────────────────────────────────────
update public.journal_posts
   set cover_url = replace(cover_url, '/atema-studio/photos/', '/photos/')
 where cover_url like '/atema-studio/photos/%';

-- ─── Portfolio items ────────────────────────────────────────────────────
update public.portfolio_items
   set image_url = replace(image_url, '/atema-studio/photos/', '/photos/')
 where image_url like '/atema-studio/photos/%';

-- ─── Verify ─────────────────────────────────────────────────────────────
select '— Journal covers —' as section;
select slug, cover_url from public.journal_posts order by published_at desc;
select '— Portfolio covers —' as section;
select id, image_url from public.portfolio_items order by sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-features-en-backfill.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ============================================================
-- ATEMA STUDIO — Back-fill features_en (audit append, 2026-05)
-- ============================================================
-- Reason
-- ------
-- The live booking page reads pkg.features for the "What's included"
-- bullet list. That column has always been Arabic-only. On the English
-- language toggle the page renders the same Arabic strings — mixed-
-- language UX flagged in Persona 5 / Persona 3 audit.
--
-- The earlier audit migration added a features_en column but only
-- populated it with abbreviated placeholder copy. This migration
-- replaces it with a proper, item-by-item English translation that
-- matches the actual live features in seed-packages-2026-05.sql.
--
-- Safe to re-run. Idempotent on package id (matches the live seed).
-- ============================================================

BEGIN;

-- Defensive: ensure the column exists (audit migration adds it; this
-- is a no-op if already there).
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS features_en TEXT[];

-- ── 1. Engagement Session ───────────────────────────────────────────
UPDATE public.packages SET features_en = ARRAY[
  '2 hours of professional photography',
  '30 carefully edited photos',
  'Curated selection of the best shots',
  'Digital storage drive in the couple''s names',
  'Complimentary digital Save the Date design'
] WHERE id = 1 OR name_en = 'Engagement Session';

-- ── 2. Customise ────────────────────────────────────────────────────
UPDATE public.packages SET features_en = ARRAY[
  '3 hours of full event coverage',
  'All photos delivered as edited JPG files',
  'Digital storage drive',
  'Curated selection of the best shots'
] WHERE id = 2 OR name_en = 'Customise';

-- ── 3. Classic ──────────────────────────────────────────────────────
UPDATE public.packages SET features_en = ARRAY[
  '4 hours of full event coverage',
  'A4 album with 15 pages',
  '5 edited family portraits',
  'Digital storage with all edited photos'
] WHERE id = 3 OR name_en = 'Classic';

-- ── 4. Royal ────────────────────────────────────────────────────────
UPDATE public.packages SET features_en = ARRAY[
  '5 hours of full event coverage',
  'Short cinematic video (3–5 minutes)',
  'A4 album with 15 pages',
  'Mini family album',
  'Digital storage in the couple''s names',
  'Same-day preview (5 curated photos)'
] WHERE id = 4 OR name_en = 'Royal';

-- ── 5. Signature ────────────────────────────────────────────────────
UPDATE public.packages SET features_en = ARRAY[
  '6 hours of full event coverage',
  'Full cinematic wedding film',
  'Bridal preparation session',
  'Premium A3 album with 12 pages',
  'Mini family album',
  'Engraved digital storage drive',
  'Same-day preview (5 curated photos)'
] WHERE id = 5 OR name_en = 'Signature';

-- ── 6. ATEMA Couture ────────────────────────────────────────────────
UPDATE public.packages SET features_en = ARRAY[
  'Complete full-event coverage',
  'Premium cinematic wedding film',
  'Bridal preparation session',
  'Henna night coverage',
  'Premium A3 album with 20 pages',
  'Premium mini family album',
  'Framed wall art print',
  'Premium engraved digital storage drive',
  'Same-day preview (10 curated photos)',
  'Dedicated concierge service'
] WHERE id = 6 OR name_en = 'ATEMA Couture';

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
/*

-- Should return 6 rows, each with a non-empty features_en array
SELECT id, name_en,
       array_length(features,    1) AS arabic_items,
       array_length(features_en, 1) AS english_items
FROM   public.packages
ORDER  BY id;

-- Inspect a specific one
SELECT name_en, features_en FROM public.packages WHERE id = 4;

*/


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-email.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Booking confirmation email (Zoho Mail SMTP).
--
-- Mirrors the wa_messages audit pattern: every send (success, skip, or
-- failure) is recorded so the admin can debug deliverability without
-- leaving the dashboard. Idempotent — safe to re-run.

create table if not exists public.email_messages (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid references public.bookings(id) on delete set null,
  to_address      text not null,
  subject         text not null,
  template        text not null,                  -- 'booking_confirmation', etc.
  status          text not null
                  check (status in ('sent','skipped','failed')),
  error           text,
  smtp_message_id text,
  created_at      timestamptz default now()
);

create index if not exists email_messages_booking_idx
  on public.email_messages (booking_id, created_at desc);
create index if not exists email_messages_status_idx
  on public.email_messages (status, created_at desc);

alter table public.email_messages enable row level security;
drop policy if exists "Admin reads email_messages" on public.email_messages;
create policy "Admin reads email_messages" on public.email_messages
  for select using (auth.role() = 'authenticated');

-- Sanity
select '— email_messages ready —' as section, count(*) as rows from public.email_messages;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-wa.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — WhatsApp Smart Lifecycle Platform
-- Schema additions for the wa-webhook, wa-receipt, and wa-reminders Edge
-- Functions. Idempotent — safe to re-run.

-- ─── 1. wa_messages: audit log for every inbound + outbound WA message ──────
create table if not exists public.wa_messages (
  id              uuid primary key default gen_random_uuid(),
  wa_message_id   text unique,
  from_phone      text not null,
  to_phone        text,
  direction       text not null check (direction in ('inbound','outbound')),
  message_type    text,                       -- text / image / document / template / sticker
  body            text,
  media_url       text,
  matched_booking uuid references public.bookings(id) on delete set null,
  extracted       jsonb,                       -- Vision-extracted receipt data
  status          text not null
                  check (status in ('received','processing','auto_confirmed',
                                    'needs_review','sent','failed','ignored')),
  notes           text,
  raw_payload     jsonb,
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);

create index if not exists wa_messages_from_phone_idx
  on public.wa_messages (from_phone, created_at desc);
create index if not exists wa_messages_status_idx
  on public.wa_messages (status, created_at desc);

-- RLS — admin-only read; service role writes via Edge Function
alter table public.wa_messages enable row level security;
drop policy if exists "Admin reads wa_messages" on public.wa_messages;
create policy "Admin reads wa_messages" on public.wa_messages
  for select using (auth.role() = 'authenticated');

-- ─── 2. wa_reminders_sent: idempotency for the lifecycle cron ───────────────
create table if not exists public.wa_reminders_sent (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  reminder_kind   text not null
                  check (reminder_kind in ('pre_72h','pre_48h','pre_24h',
                                           'post_2h','post_30d','anniversary_1y')),
  sent_at         timestamptz default now(),
  wa_message_id   text,
  unique (booking_id, reminder_kind)
);

create index if not exists wa_reminders_sent_booking_idx
  on public.wa_reminders_sent (booking_id);

alter table public.wa_reminders_sent enable row level security;
drop policy if exists "Admin reads wa_reminders_sent" on public.wa_reminders_sent;
create policy "Admin reads wa_reminders_sent" on public.wa_reminders_sent
  for select using (auth.role() = 'authenticated');

-- ─── 3. Optional: extend bookings with reminder opt-out (default: opted in) ─
alter table public.bookings
  add column if not exists wa_reminders_enabled boolean not null default true,
  add column if not exists wa_last_reminder_at  timestamptz,
  add column if not exists payment_evidence_url text,
  add column if not exists payment_received_at  timestamptz;

-- ─── 4. Sanity ─────────────────────────────────────────────────────────────
select '— wa_messages ready —' as section, count(*) as rows from public.wa_messages;
select '— wa_reminders_sent ready —' as section, count(*) as rows from public.wa_reminders_sent;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-moodboard.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Mood Board feature
--
-- A post-booking editorial "this is how we already see your day" surface that
-- Fatima composes from the admin panel and shares with the bride via a
-- private link. The page lives at /#/board/<token> and renders a curated
-- 6-image grid + a bilingual letter from the atelier.
--
-- Run AFTER:
--   database/schema.sql
--   database/migrations-2026-05.sql
--   database/migrations-2026-05-branding.sql

-- ── 1. mood_boards table ──────────────────────────────────────────────────
create table if not exists public.mood_boards (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  token        text not null unique,           -- 32 random base32 chars = 160 bits
  package_id   int  references public.packages(id),
  season       text check (season in ('spring','summer','autumn','winter')),
  image_urls   text[] not null,                -- 6 URLs in display order
  title_ar     text, title_en     text,
  caption_ar   text, caption_en   text,
  sent_at      timestamptz,                    -- when admin clicked "Send via WA"
  viewed_at    timestamptz,                    -- first time the bride opened the link
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create unique index if not exists mood_boards_booking_id_uniq on public.mood_boards(booking_id);
create index        if not exists mood_boards_token_idx       on public.mood_boards(token);

-- ── 2. updated_at trigger ────────────────────────────────────────────────
-- set_updated_at() is defined in schema.sql; reuse it.
drop trigger if exists mood_boards_updated_at on public.mood_boards;
create trigger mood_boards_updated_at
  before update on public.mood_boards
  for each row execute function set_updated_at();

-- ── 3. RLS ────────────────────────────────────────────────────────────────
alter table public.mood_boards enable row level security;

-- Public SELECT: the token IS the secret (160 bits unguessable).
drop policy if exists "Public select mood_boards" on public.mood_boards;
create policy "Public select mood_boards"
  on public.mood_boards for select
  using (true);

-- Authenticated (admin) full access.
drop policy if exists "Authenticated insert mood_boards" on public.mood_boards;
create policy "Authenticated insert mood_boards"
  on public.mood_boards for insert
  to authenticated with check (true);

drop policy if exists "Authenticated update mood_boards" on public.mood_boards;
create policy "Authenticated update mood_boards"
  on public.mood_boards for update
  to authenticated using (true);

drop policy if exists "Authenticated delete mood_boards" on public.mood_boards;
create policy "Authenticated delete mood_boards"
  on public.mood_boards for delete
  to authenticated using (true);

-- ── 4. RPC: mark a board as viewed (single-purpose anonymous write) ──────
-- The public can mark viewed_at via this SECURITY DEFINER function.
-- It only ever sets viewed_at on the row matching the supplied token, and
-- only if viewed_at is not already set — preventing replay overwrites.
create or replace function public.mark_mood_board_viewed(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mood_boards
     set viewed_at = now()
   where token = p_token
     and viewed_at is null;
end;
$$;

grant execute on function public.mark_mood_board_viewed(text) to anon, authenticated;

-- ── 5. Verify ─────────────────────────────────────────────────────────────
select '— Mood Board tables ready —' as section;
select tablename, rowsecurity from pg_tables where tablename = 'mood_boards';


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-editing-tiers.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Editing-tier separation (May 2026)
--
-- Two editing tiers, formally declared in the catalogue + contract:
--
--   1. Basic edit   (التعديل الأساسي)
--      Lighting correction + colour balance + JPG conversion from RAW.
--      Applied to the FULL `edited_photos` count in every package.
--
--   2. Editorial retouch (التعديل التحريري)
--      Advanced retouching — skin work, dodge-and-burn, blemish removal,
--      cinematic colour grade. Time-intensive (~30 min/image).
--      Offered only on HIGH-END packages in multiples of 4: Royal=4,
--      Signature=8, Couture=12. Lower tiers can purchase editorial as
--      an add-on (future) but do not receive any by default.
--
-- This separation makes the deliverable promise legally precise and
-- protects the studio from "but I thought all photos would look like the
-- editorial samples" expectation drift. The contract (Article IV.b)
-- declares both tiers explicitly.
--
-- Idempotent. Run AFTER migrations-2026-05-custom-base.sql.

begin;

-- ─── 1. Schema: add the editorial counter ────────────────────────────────────
alter table public.packages
  add column if not exists editorial_photos integer not null default 0
    check (editorial_photos >= 0 and editorial_photos % 4 = 0);
  -- DB enforces the "factor of 4" business rule. Any other value rejected.

-- ─── 2. Backfill editorial counts on the high-end tiers ──────────────────────
update public.packages set editorial_photos = 0  where id = 1;  -- Engagement
update public.packages set editorial_photos = 0  where id = 2;  -- Custom Foundation
update public.packages set editorial_photos = 0  where id = 3;  -- Classic
update public.packages set editorial_photos = 4  where id = 4;  -- Royal
update public.packages set editorial_photos = 8  where id = 5;  -- Signature
update public.packages set editorial_photos = 12 where id = 6;  -- ATEMA Couture

-- ─── 3. Rewrite features text to declare the editing tier explicitly ─────────
-- Engagement (id=1): basic only.
update public.packages set features = array[
  'ساعتان من التصوير الاحترافي',
  '٣٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  'اختيار أجمل اللقطات',
  'وحدة تخزين باسم العروسين',
  'تصميم Save the Date رقمي هدية'
] where id = 1;

-- Custom Foundation (id=2): basic only.
update public.packages set features = array[
  'ساعة واحدة من التصوير الاحترافي',
  '٢٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  'وحدة تخزين رقمية',
  'أضيفي ساعات، فيديو، ألبوم، أو ليلة الحناء حسب احتياجك'
] where id = 2;

-- Classic (id=3): basic only.
update public.packages set features = array[
  '٤ ساعات تغطية شاملة للحفل',
  'مصوّرة رئيسية + مساعدة (فريق نسائي)',
  '٣٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
  '٥ صور عائلية معدّلة',
  'وحدة تخزين بجميع الصور المعدّلة'
] where id = 3;

-- Royal (id=4): basic + 4 editorial.
update public.packages set features = array[
  '٥ ساعات تغطية شاملة للحفل',
  'مصوّرة رئيسية + مساعدة (فريق نسائي)',
  '٤٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  '٤ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
  'فيديو سينمائي قصير (٣–٥ دقائق)',
  'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
  'ميني ألبوم عائلي',
  'وحدة تخزين باسم العروسين',
  'معاينة في نفس اليوم (٥ صور مختارة)'
] where id = 4;

-- Signature (id=5): basic + 8 editorial.
update public.packages set features = array[
  '٦ ساعات تغطية شاملة للحفل',
  'مصوّرة رئيسية + مساعدة (فريق نسائي)',
  '٥٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  '٨ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
  'فيديو سينمائي كامل',
  'جلسة تصوير تحضيرات العروس',
  'ألبوم فاخر A3 بـ ١٢ صفحة',
  'ميني ألبوم عائلي',
  'وحدة تخزين منقوشة بالاسم',
  'معاينة في نفس اليوم (٥ صور مختارة)'
] where id = 5;

-- ATEMA Couture (id=6): basic + 12 editorial.
update public.packages set features = array[
  'تغطية شاملة كاملة للحفل (٨ ساعات)',
  'مصوّرة رئيسية + مساعدة (فريق نسائي)',
  '٧٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  '١٢ صورة بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
  'فيديو سينمائي فاخر — تغطية كاملة + ليلة الحناء',
  'جلسة تحضيرات العروس',
  'تغطية ليلة الحناء',
  'ألبوم فاخر A3 بـ ٢٠ صفحة',
  'ميني ألبوم فاخر',
  'لوحة جدارية فنية مؤطرة',
  'وحدة تخزين فاخرة بالاسم',
  'معاينة في نفس اليوم (١٠ صور مختارة)',
  'خدمة عملاء ومتابعة خاصة'
] where id = 6;

-- ─── 4. English features mirror ──────────────────────────────────────────────
update public.packages set features_en = array[
  '2 hours of professional photography',
  '30 photos with basic edit (light + JPG conversion)',
  'A curated selection of best frames',
  'Digital storage in the couple''s names',
  'Save-the-Date digital design — complimentary'
] where id = 1;

update public.packages set features_en = array[
  '1 hour of professional photography',
  '20 photos with basic edit (light + JPG conversion)',
  'Digital storage',
  'Add hours, video, album, or henna night as you need'
] where id = 2;

update public.packages set features_en = array[
  '4 hours of full event coverage',
  'Lead photographer + assistant (all-female team)',
  '300 photos with basic edit (light + JPG conversion)',
  'A4 album, 15 pages — premium printing',
  '5 retouched family photos',
  'Digital storage of all edited images'
] where id = 3;

update public.packages set features_en = array[
  '5 hours of full event coverage',
  'Lead photographer + assistant (all-female team)',
  '400 photos with basic edit (light + JPG conversion)',
  '4 photos with editorial retouch (advanced retouching + cinematic grade)',
  'Short cinematic video (3–5 minutes)',
  'A4 album, 15 pages — premium printing',
  'Mini family album',
  'Digital storage in the couple''s names',
  'Same-day preview (5 curated photos)'
] where id = 4;

update public.packages set features_en = array[
  '6 hours of full event coverage',
  'Lead photographer + assistant (all-female team)',
  '500 photos with basic edit (light + JPG conversion)',
  '8 photos with editorial retouch (advanced retouching + cinematic grade)',
  'Full cinematic video',
  'Bridal-prep session',
  'Premium A3 album, 12 pages',
  'Mini family album',
  'Engraved-name digital storage',
  'Same-day preview (5 curated photos)'
] where id = 5;

update public.packages set features_en = array[
  '8 hours of full event coverage',
  'Lead photographer + assistant (all-female team)',
  '700 photos with basic edit (light + JPG conversion)',
  '12 photos with editorial retouch (advanced retouching + cinematic grade)',
  'Premium cinematic video — full event + henna night',
  'Bridal-prep session',
  'Henna-night coverage',
  'Premium A3 album, 20 pages',
  'Premium mini album',
  'Framed art print',
  'Premium engraved digital storage',
  'Same-day preview (10 curated photos)',
  'Dedicated concierge service'
] where id = 6;

commit;

-- ─── 5. Verify ───────────────────────────────────────────────────────────────
select '— Editing tiers per package —' as section;
select id, name_ar, edited_photos as basic_count, editorial_photos as editorial_count
  from public.packages
 where active
 order by sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-pricing-overhaul.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Pricing structure overhaul (May 2026)
--
-- Aligns the published price list with the cost model documented in
-- docs/PROFITABILITY.md. Five rules driving these changes:
--   1. Every package with shoot duration > 2 hours now factors in the cost
--      of a second photographer (assistant) at 110 SAR/hr.
--   2. Printing (album + extras) marked up by 25% over supplier cost.
--   3. Videography priced as (shoot_hours × 450 SAR/hr × 1.50) — i.e.
--      videographer cost + 50% margin. Closes the loss vector that made
--      Royal/Signature net-negative under the previous prices
--      (see PROFITABILITY.md §4, "the videographer fee is the real margin
--      killer").
--   4. Customise tier deactivated — it overlapped Engagement at a price
--      point the studio could not sustain. Honours "keep cheap options to
--      a minimum" from the owner brief.
--   5. Owner labour at 150 SAR/hr is factored in across all tiers — the
--      P&L engine in src/services/pl/engine.ts will now show positive
--      trueProfit across the full catalogue (was negative on 5 of 6).
--
-- Idempotent. Run AFTER seed-packages-2026-05.sql.
-- Preserves booking history — existing bookings keep their FK reference
-- to whatever package_id they were created with, including the now-hidden
-- Customise tier.
--
-- Per CLAUDE.md §4.3: never edit schema or seed retroactively; add a
-- topic-scoped migration instead. This is that migration.

begin;

-- ─── 1. ENGAGEMENT (id=1) — 1,800 → 2,500 SAR ────────────────────────────────
-- 2h shoot, no assistant (=2h threshold), no album, no video.
-- Cost model: 10.8 owner-hours × 150 = 1,620 + 80 storage + 184 overhead = 1,884.
-- 2,500 price → +25% margin over fully-loaded cost. Was structurally negative.
update public.packages set
  price = 2500,
  description = 'جلسة خطوبة رومانسية بأسلوب راقٍ — مثالية لإعلان البداية.',
  features = array[
    'ساعتان من التصوير الاحترافي',
    '٣٠ صورة معدّلة بعناية',
    'اختيار أجمل اللقطات',
    'وحدة تخزين باسم العروسين',
    'تصميم Save the Date رقمي هدية'
  ]
where id = 1;

-- ─── 2. CUSTOMISE (id=2) — deactivated ───────────────────────────────────────
-- Overlapped Engagement at a non-viable 2,200 SAR price point. Bookings
-- already pointing at id=2 keep their FK; the tier just disappears from
-- the public catalogue and admin grid.
update public.packages set
  active = false,
  sort_order = 9998,
  badge = NULL,
  is_popular = false
where id = 2;

-- ─── 3. CLASSIC (id=3) — 4,200 → 5,200 SAR ───────────────────────────────────
-- 4h shoot, assistant required (>2h), A4 album 15pg, no video.
-- Cost: 20.6 owner-hr × 150 = 3,090 + assistant 4×110 = 440 + printing
--       (450 base + 5×45 extra pages = 675) × 1.25 = 844 + storage 80
--       + overhead 184 = 4,638. Price 5,200 → +12% margin.
update public.packages set
  price = 5200,
  description = 'الباقة المثالية للمناسبات الخاصة — ألبوم فاخر وذكريات تبقى، بفريق نسائي كامل.',
  features = array[
    '٤ ساعات تغطية شاملة للحفل',
    'مصوّرة رئيسية + مساعدة (فريق نسائي)',
    'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
    '٥ صور عائلية معدّلة',
    'وحدة تخزين بجميع الصور المعدّلة'
  ]
where id = 3;

-- ─── 4. ROYAL (id=4) — 6,900 → 10,500 SAR ────────────────────────────────────
-- 5h shoot, assistant, A4 album + mini, short cinematic video (5h coverage).
-- Cost: 29.5 owner-hr × 150 = 4,425 + assistant 5×110 = 550
--       + printing (675 + 200 mini) × 1.25 = 1,094 + video 5×450×1.5 = 3,375
--       + storage 80 + overhead 184 = 9,708. Price 10,500 → +8% margin.
-- Video premium is the structural fix: previous price (6,900) carried the
-- video at cost only, producing -819 true profit per PROFITABILITY.md §4.
update public.packages set
  price = 10500,
  description = 'تجربة تصوير ملكية مع فيديو سينمائي قصير وألبومين فاخرين — الأكثر طلباً.',
  features = array[
    '٥ ساعات تغطية شاملة للحفل',
    'مصوّرة رئيسية + مساعدة (فريق نسائي)',
    'فيديو سينمائي قصير (٣–٥ دقائق)',
    'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
    'ميني ألبوم عائلي',
    'وحدة تخزين باسم العروسين',
    'معاينة في نفس اليوم (٥ صور مختارة)'
  ]
where id = 4;

-- ─── 5. SIGNATURE (id=5) — 8,500 → 12,500 SAR ────────────────────────────────
-- 6h shoot, assistant, A3 album 12pg + mini, full cinematic video (6h),
-- bridal-prep session.
-- Cost: 33.9 owner-hr × 150 = 5,085 + assistant 6×110 = 660
--       + printing (700 + 200 mini) × 1.25 = 1,125 + video 6×450×1.5 = 4,050
--       + storage 80 + overhead 184 = 11,184. Price 12,500 → +12% margin.
update public.packages set
  price = 12500,
  description = 'الباقة الاحترافية الشاملة — فيديو سينمائي كامل، ألبوم A3 فاخر، وجلسة تحضيرات العروس.',
  features = array[
    '٦ ساعات تغطية شاملة للحفل',
    'مصوّرة رئيسية + مساعدة (فريق نسائي)',
    'فيديو سينمائي كامل',
    'جلسة تصوير تحضيرات العروس',
    'ألبوم فاخر A3 بـ ١٢ صفحة',
    'ميني ألبوم عائلي',
    'وحدة تخزين منقوشة بالاسم',
    'معاينة في نفس اليوم (٥ صور مختارة)'
  ]
where id = 5;

-- ─── 6. ATEMA COUTURE (id=6) — 14,000 → 19,500 SAR ───────────────────────────
-- 8h main event + 4h henna, assistant, A3 20pg + mini + framed wall art,
-- full cinematic video (12h total coverage).
-- Cost: 44 owner-hr × 150 = 6,600 + assistant 8×110 = 880
--       + printing (700 + 8×45 = 1,060 + 200 mini + 600 wall art = 1,860) × 1.25 = 2,325
--       + video 12×450×1.5 = 8,100 + storage 80 + overhead 184 = 18,169.
--       Price 19,500 → +7% margin.
update public.packages set
  price = 19500,
  description = 'تجربة الفخامة الكاملة — كل تفاصيل اليوم بتوقيع كوتور حصري، من الحناء إلى الحفل.',
  features = array[
    'تغطية شاملة كاملة للحفل (٨ ساعات)',
    'مصوّرة رئيسية + مساعدة (فريق نسائي)',
    'فيديو سينمائي فاخر — تغطية كاملة + ليلة الحناء',
    'جلسة تحضيرات العروس',
    'تغطية ليلة الحناء',
    'ألبوم فاخر A3 بـ ٢٠ صفحة',
    'ميني ألبوم فاخر',
    'لوحة جدارية فنية مؤطرة',
    'وحدة تخزين فاخرة بالاسم',
    'معاينة في نفس اليوم (١٠ صور مختارة)',
    'خدمة عملاء ومتابعة خاصة'
  ]
where id = 6;

-- ─── 7. Add-on price tune (extra hour reflects new assistant rule) ───────────
-- An extra hour now includes the assistant's hour too (the package already
-- triggered the >2h assistant rule, so each extra hour adds 110 SAR of
-- assistant time on top of the owner's labour).
-- Old: 700 SAR/extra-hour (owner labour + small margin only)
-- New: 900 SAR/extra-hour = owner 2.4×150 ≈ 360 edit + 150 onsite
--      + 110 assistant + 25% margin ≈ 900
update public.addons set price = 900
where id = 'extra-hour';

-- Video add-ons (when added to Classic) follow the 50% rule:
-- short = 5h × 450 × 1.5 = 3,375 → round to 3,400
-- full  = 7h × 450 × 1.5 = 4,725 → round to 4,800
update public.addons set price = 3400 where id = 'video-short';
update public.addons set price = 4800 where id = 'video-full';

-- Album upgrade and extra pages already match the 25% printing rule (price
-- differential between A4 base 450 and A3 base 700 = 250; × 1.25 = 313;
-- existing 800 SAR upgrade is conservative — leave as-is to preserve UX).

commit;

-- ─── 8. Verify ───────────────────────────────────────────────────────────────
select '— New active price list —' as section;
select id, name_ar, price, duration_hours, badge, is_popular, sort_order
  from public.packages
 where active
 order by sort_order;

select '— Deactivated / legacy (preserved for FK history) —' as section;
select id, name_ar, price, active
  from public.packages
 where not active
 order by id;

select '— Add-ons updated —' as section;
select id, name_ar, price
  from public.addons
 where id in ('extra-hour','video-short','video-full')
 order by sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-custom-base.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — "Design Your Package" base separation (May 2026)
--
-- Before: the "Design Your Package" tab in BookingPage reused the cheapest
-- active package (Engagement Session) as its base. This conflated two
-- distinct customer journeys:
--   • Engagement Session = a fixed, complete 2h package with curated features
--   • Design Your Package = a build-your-own flow that needs a MINIMAL,
--     flexible foundation the customer extends with add-ons.
--
-- After: a dedicated row carries `is_custom_base = true`. The Ready
-- Packages tab filters this row out; the Custom tab targets it explicitly.
-- The flag is enforced unique (only one base allowed) via a partial index.
--
-- Idempotent. Run AFTER migrations-2026-05-pricing-overhaul.sql.

begin;

-- ─── 1. Schema: add the flag + uniqueness constraint ─────────────────────────
alter table public.packages
  add column if not exists is_custom_base boolean not null default false;

create unique index if not exists packages_one_custom_base_idx
  on public.packages (is_custom_base)
  where is_custom_base = true;
  -- At most one package can be marked as the custom base. New base swaps
  -- require: UPDATE old SET is_custom_base = false; UPDATE new SET ... = true.

-- ─── 2. Reactivate id=2 (formerly "Customise") as the Custom Foundation ─────
-- 1h shoot, no assistant (under 2h threshold), no album, no video.
-- Cost: 7.4 owner-hr × 150 = 1,110 + 80 storage + 184 overhead = 1,374.
-- Price 1,800 → +31% margin. Intended as the entry point that customers
-- then build on via add-ons (extra hours, video, album, henna, etc.).
update public.packages set
  active             = true,
  is_custom_base     = true,
  name_ar            = 'الأساس المرن',
  name_en            = 'Custom Foundation',
  price              = 1800,
  duration_hours     = 1,
  edited_photos      = 20,
  album              = null,
  video              = false,
  badge              = null,
  is_popular         = false,
  sort_order         = 0,  -- sorts above everything else if ever shown in a list
  description        = 'الأساس المرن لباقتك المخصّصة — ابدئي من هنا وأضيفي ما يلائم مناسبتك.',
  features           = array[
    'ساعة واحدة من التصوير الاحترافي',
    '٢٠ صورة معدّلة',
    'وحدة تخزين رقمية',
    'أضيفي ساعات، فيديو، ألبوم، أو ليلة الحناء حسب احتياجك'
  ],
  features_en        = array[
    '1 hour of professional photography',
    '20 edited photos',
    'Digital storage',
    'Add hours, video, album, or henna night as you need'
  ]
where id = 2;

-- Belt-and-braces: make sure no other row claims is_custom_base = true.
update public.packages
   set is_custom_base = false
 where id <> 2 and is_custom_base = true;

commit;

-- ─── 3. Verify ───────────────────────────────────────────────────────────────
select '— Custom base (singleton) —' as section;
select id, name_ar, name_en, price, duration_hours, is_custom_base
  from public.packages where is_custom_base = true;

select '— Ready Packages (Custom tab base excluded) —' as section;
select id, name_ar, price, duration_hours, badge, sort_order
  from public.packages
 where active and not is_custom_base
 order by sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-included-addons.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Declare bundled add-ons per package (May 2026)
--
-- The pricing-overhaul migration already folded the cost of the bundled
-- services (assistant, video, henna, etc.) into each package's price.
-- This migration declares WHICH add-ons are bundled so:
--   1. The admin "Packages Manager" UI shows the right check-boxes pre-ticked
--      (the UI for this already exists — see PackagesManager.tsx §458).
--   2. The customer-facing booking page can hide those add-ons from the
--      personalise-your-experience list, preventing double-charge.
--
-- Mapping derived from each package's features array (already shipped):
--   Engagement       → save-date                 (gift design listed in features)
--   Custom Foundation→ — (nothing bundled; that's the point of "build your own")
--   Classic          → second-photog             (assistant required >2h)
--   Royal            → second-photog, video-short
--   Signature        → second-photog, video-full, bridal-prep, album-upgrade
--   ATEMA Couture    → second-photog, video-full, bridal-prep, album-upgrade,
--                     henna, kosha
--
-- Idempotent. Run AFTER migrations-2026-05-editing-tiers.sql.

begin;

update public.packages
   set included_addon_ids = array['save-date']
 where id = 1;  -- Engagement

update public.packages
   set included_addon_ids = array[]::text[]
 where id = 2;  -- Custom Foundation

update public.packages
   set included_addon_ids = array['second-photog']
 where id = 3;  -- Classic

update public.packages
   set included_addon_ids = array['second-photog', 'video-short']
 where id = 4;  -- Royal

update public.packages
   set included_addon_ids = array['second-photog', 'video-full', 'bridal-prep', 'album-upgrade']
 where id = 5;  -- Signature

update public.packages
   set included_addon_ids = array['second-photog', 'video-full', 'bridal-prep', 'album-upgrade', 'henna', 'kosha']
 where id = 6;  -- ATEMA Couture

commit;

-- ─── Verify ──────────────────────────────────────────────────────────────────
select id, name_ar, included_addon_ids
  from public.packages
 where active
 order by sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-journal-additions.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Journal additions (May 2026)
--
-- Two new long-form essays in the Atelier voice — Arabic-first, with
-- English translations. Owner brief: "be dreamy, be passionate, be
-- luxurious, be extra creative."
--
--   7. حارسةُ الذاكرة            On the camera as the keeper of memory
--   8. كيف غيّرت العدسةُ العالم   On photography's silent revolution of
--                                  human civilisation
--
-- UPSERT by slug — safe to re-run; admin edits via JournalManager won't
-- be clobbered as long as the slug is unchanged.

insert into public.journal_posts (
  slug, title_ar, title_en,
  excerpt_ar, excerpt_en,
  body_ar, body_en,
  cover_url, published, published_at
) values

-- ── 7. The Keeper of Memory ──────────────────────────────────────────────
(
  'keeper-of-memory',
  'حارسةُ الذاكرة',
  'The Keeper of Memory',

  'الذاكرةُ خائنةٌ بلطف — تُبقي ما لا نريد، وتنسى ما لا نطيق أن نخسره. والكاميرا، وحدها، هي التي لا تنسى.',
  'Memory is gently treacherous — it keeps what we did not want, and forgets what we could not bear to lose. Only the camera does not forget.',

  $body$في الليلة التي تسبق زفافِكِ، إذا أغمضتِ عينيكِ، حاولي أن تستحضري وجهَ جدّتِكِ كما كان حين كنتِ في الخامسة. حاولي أن تتذكّري لونَ ثوبها يومَ زارَتْكِ. حاولي أن تستعيدي صوتَها بدقّة، كما يصدر من حنجرتها لا من ذاكرتكِ.

ستجدين أنّ شيئاً يُفلتُ منكِ. الصورةُ تتمايلُ كأنّها انعكاسٌ في ماءٍ يهتزّ. تَكاد. تَكاد. ثم لا.

هذه هي الذاكرةُ البشريّة — حارسٌ مخلصٌ، لكنّه يَنام أحياناً. كلُّ ما نظنُّه «محفوظاً للأبد» يتآكلُ صامتاً، لون بعد لون، تفصيل بعد تفصيل، حتى يبقى الإحساسُ وحده — والإحساسُ، رغم جماله، لا يُريكِ وجهَ من تحبّين.

هنا يتدخّلُ الضوء. هنا تُمسكُ الكاميرا ما تعجزُ الذاكرةُ عن إمساكه. لحظةٌ صغيرةٌ — انحناءةُ رأسٍ، ابتسامةٌ في زاوية الفم، لمسةُ يدٍ على كتف — تُسلَّمُ إلى الورق، وتنامُ هناك بهدوء، بانتظار أن يستيقظَ شخصٌ ما، بعد عشرين سنة، فيراها كأنّها حدثَتْ قبل دقيقة.

في كلِّ صورةٍ نلتقطُها في ATEMA، هناك وعدٌ صامتٌ نُقطعُهُ على أنفسنا: أنّ ما حدث في هذه الثانية، لن يُسرَق منكِ. لا الزمن، ولا النسيان، ولا حتى أنتِ — في يومٍ تتعبين فيه من تذكُّر تفاصيلٍ كثيرة — ستقدرين على محو هذه الثانية. ستبقى. مطبوعةً، أو على شاشة، أو في صندوقٍ في الخزانة، تنتظرُ من سيفتحه.

أمّاهٌ سعوديّة قالت لي مرّةً، وهي تتصفّحُ ألبومَ ابنتها بعد سنواتٍ من زواجها: «الصورُ علّمَتْني شيئاً لم أكن أعرفه. علّمَتْني أنّ ابنتي كانت أجملَ ممّا تذكّرت، وأنّ يومَ زفافِها كان أطولَ ممّا عشتُهُ، وأنّني — أنا — كنتُ هناك، وكنتُ سعيدة».

هذا هو ما تفعلُهُ الصور. لا تُؤرّخُ الأحداث فقط — بل تُعيدُ إلينا أنفسَنا، بعد أن نَكون قد نسينا قليلاً من نفسنا.

في عصرٍ يَجري فيه كلُّ شيء بسرعةٍ مُذهلة، صار التصويرُ نوعاً من المقاومة. مقاومةٌ ضدّ الفقدان. ضدّ تَلاشي الوجوه. ضدّ الذاكرةِ التي تخونُ، حتى وإن أخلصت.

كلُّ امرأةٍ تأتي إلى استوديو ATEMA، تأتي لِشيءٍ أعمقَ من الصور. تأتي لِتُودِعَ لحظةً من حياتها لدى حارسةٍ موثوقة — حارسةٍ لا تكذب، ولا تُجمِّل، ولا تُسقط من الذاكرة ما تَريد العيونُ أن تتذكّرَه.

والكاميرا، بصمتٍ نبيل، تتسلّمُ الأمانة.

وتحفظُها.

إلى الأبد.$body$,

  $body$On the night before your wedding, close your eyes and try to summon your grandmother's face as it was when you were five. Try to recall the colour of the dress she wore the day she visited. Try to bring back her voice, precisely — not from your memory of it, but as it once came from her throat.

You will find that something slips. The image trembles, as a reflection trembles in water. It almost forms. It almost. Then it does not.

This is human memory — a loyal guardian, who sometimes sleeps. Everything we believe is "kept forever" is quietly being eroded, colour after colour, detail after detail, until only the feeling remains. And feeling, beautiful as it is, will not show you the face of the one you love.

This is where light intervenes. This is where the camera holds what memory cannot. A small moment — the tilt of a head, a smile in the corner of a mouth, a hand resting on a shoulder — handed gently to paper, where it sleeps quietly, waiting for someone, twenty years from now, to see it as if it happened a minute ago.

In every photograph we take at ATEMA, there is a silent promise we make to ourselves: that what occurred in this second will not be stolen from you. Not by time. Not by forgetting. Not even by you — on the day when, weary of remembering too many things, you might wish to let it go. It will stay. Printed, or on a screen, or in a box in a cupboard, waiting for whoever opens it.

A Saudi mother told me once, leafing through her daughter's album years after the wedding: "The photographs taught me something I had not known. They taught me that my daughter was more beautiful than I remembered, that her wedding day was longer than the one I lived, and that I — I — was there, and I was happy."

This is what photographs do. They do not merely record events — they return us to ourselves, after we have forgotten a little of who we were.

In an age when everything moves at dizzying speed, photography has become a kind of resistance. Resistance against loss. Against the fading of faces. Against the memory that betrays us, however faithfully it tries.

Every woman who arrives at ATEMA studio comes for something deeper than photographs. She comes to deposit a moment of her life with a trustworthy keeper — a keeper that does not lie, does not embellish, does not let fall from memory what the eye most wished to keep.

And the camera, with a noble silence, accepts the trust.

And keeps it.

Forever.$body$,

  '/photos/Untitled-2.JPG',
  true,
  '2026-05-22 09:00:00+03'
),

-- ── 8. How the Lens Changed the World ────────────────────────────────────
(
  'lens-changed-the-world',
  'كيف غيّرت العدسةُ العالم',
  'How the Lens Changed the World',

  'قبل التصوير، كان الخلودُ امتيازاً للملوك وحدَهم. ثمّ وُلِدت الكاميرا — وفجأةً، صار لكلِّ امرأةٍ في الأرض الحقُّ في أن تُرى، وأن تُحفَظ.',
  'Before photography, immortality was a privilege reserved for kings alone. Then the camera was born — and suddenly, every woman on earth held the right to be seen, and to be kept.',

  $body$في عام ١٨٣٩، نظرَ رجلٌ في باريس إلى صندوقٍ خشبيٍّ صغيرٍ فوق ثلاثِ أرجل، وقال للعالم: «انظروا، لقد أمسكتُ الضوءَ بيديّ». اسمه لويس داجير. ما لم يَكن يعرفُهُ في تلك اللحظة هو أنّه لم يَخترع آلةً فقط — بل أعادَ كتابةَ معنى أن نكون بشراً.

قبل تلك اللحظة، إذا أردتِ أن يبقى وجهُكِ بعد مماتِكِ، كان عليكِ أن تكوني ملكةً، أو زوجةَ ملك، أو ابنةَ ثريٍّ يَدفع لرسّامٍ يُمضي ستّةَ أشهرٍ يُصوِّركِ بالزيت. لوحاتٌ ثقيلةٌ، باهظةُ الثمن، تُعلَّق في قصور — بينما تذهب وجوهُ ملايين النساء، عبر القرون، إلى التراب دون أن يَعرفهنّ أحدٌ، حتى أحفادهنّ.

ثم جاءت الكاميرا. وفي ظرفِ جيلٍ واحد، أصبحَ بإمكانِ امرأةٍ في مصر، أو في حلب، أو في الجبيل، أن تَجلسَ أمام عدسةٍ وتقول: «أنا هنا. كنتُ هنا. وها هو الإثبات». لم يكن ذلك تطوّراً تقنيّاً. كان ثورةً صامتةً على الزمن نفسه.

العائلاتُ بدأَت تَملك ألبومات. الجدّاتُ صرنَ يَعرفنَ كيف بَدَت جدّاتُهنّ. الحربُ توقّفَت عن أن تكون قصّةً يَرويها المنتصرون — وصارت وجوهاً تَنظرُ إلينا من ميدانٍ، فلا نَستطيعُ بعدُ الكذبَ على أنفسنا. الموضةُ، الفنُّ، الحبُّ، الرحلاتُ، حتى الطبُّ — كلُّ ذلك انقلبَ، لأنّ بإمكاننا الآن أن نَحفظَ ما نَرى.

والأجملُ من ذلك كلِّه: التصويرُ منحَ المرأةَ صوتاً كانت تَفتقدُه. في عشرينيّاتِ القرن الماضي، في القاهرةِ وبيروت، كانت أوّلُ النساء يَحملنَ كاميراتٍ صغيرةً، يَلتقطنَ صوراً لنساءٍ أخرياتٍ — في بيوتهنّ، في حماماتهنّ، في تجمّعاتهنّ الخاصّة. هذه الصورُ، التي يَتعجَّبُ منها الباحثون اليوم، لم تَكن لتُوجد لو أنّ كلَّ المصوّرين كانوا رجالاً. كانت اللحظاتُ ستبقى خلفَ الأبواب، طيَّ السِّتر.

نحن في ATEMA، نَعرفُ أنّنا جزءٌ من تلك السلسلة. نَعرف أنّ كلَّ مرّةٍ تَجلسُ فيها امرأةٌ سعوديّةٌ أمام كاميرتي، تَحدثُ ثلاثةُ أشياءٍ في آنٍ واحد:

أوّلاً، يُحفَظُ وجهُها — لها، لأبنائها، ولحفيداتٍ سَيَأتينَ بعدها بزمنٍ لا تَتخيّلُه.

ثانياً، تُكتَبُ صفحةٌ من تاريخٍ نسائيٍّ خاصّ — تاريخٌ تَفتقدُهُ مكتباتُنا، تاريخٌ يَنبغي أن يَكون. فكلُّ صورةٍ نَلتقطُها لعروسٍ سعوديّة، اليوم، ستَكون وثيقةً يَدرسُها مؤرّخو الجمالِ والاجتماعِ بعد قرن.

ثالثاً، تَنضمُّ — دون أن تَدري ربّما — إلى قافلةٍ طويلةٍ من النساء اللواتي رَفضنَ أن يَخرجنَ من الزمن بصمت. اللواتي قُلنَ: «أنا كنتُ. ولن تُمحى».

الكاميرا، حين تَنظرُ إليها بعمق، ليست آلةً. هي ميثاقٌ. ميثاقٌ بين الإنسان والزمنِ والذاكرة. ميثاقٌ يَقول: «نَحنُ نَستحقُّ أن نَبقى». ونَحنُ في ATEMA، شَرَفُنا أن نَكون من حُرّاسِ هذا الميثاق — جيلاً بعد جيل، عروساً بعد عروس.

ذاتَ يومٍ، ستُولَدُ ابنةُ ابنتِكِ، وستَفتحُ صندوقاً قديماً في خزانةٍ، وتُخرجُ صورةً لكِ — مأخوذةً في هذه السنة، في هذه المدينة، في هذا الفستان. ستَنظرُ إليكِ، وتَقولُ بنبرةٍ هادئة: «هذه جدّتي. كانت جميلة».

هذه اللحظة، التي لم تَحدُث بعد، هي السببُ الذي من أجله نَعمل.$body$,

  $body$In 1839, a man in Paris looked into a small wooden box atop three legs, and announced to the world: "Behold — I have caught the light in my own hands." His name was Louis Daguerre. What he did not know in that moment was that he had not merely invented a device — he had rewritten what it meant to be human.

Before that moment, if you wanted your face to outlive you, you had to be a queen, or a queen's wife, or the daughter of a wealthy man who could pay a painter to spend six months rendering you in oil. Heavy canvases, ruinously expensive, hung in palaces — while the faces of millions of women, across centuries, went into the earth without anyone knowing them, not even their own granddaughters.

Then came the camera. And within a single generation, a woman in Cairo, or in Aleppo, or in Jubail, could sit before a lens and say: "I am here. I was here. And here is the proof." This was not a technical advance. It was a silent revolution against time itself.

Families began to own albums. Grandmothers came to know what their own grandmothers looked like. War ceased to be a story told by the victors — and became faces looking out from a field, until we could no longer lie to ourselves about it. Fashion, art, love, travel, even medicine — all of them transformed, because we could now keep what we saw.

And most beautiful of all: photography gave women a voice they had been missing. In the 1920s, in Cairo and Beirut, the first women carried small cameras and photographed other women — in their homes, in their bathhouses, in their private gatherings. Those photographs, which historians marvel at today, would not exist had every photographer been a man. The moments would have stayed behind closed doors, hidden in modesty.

We at ATEMA know that we are part of that chain. We know that every time a Saudi woman sits before my camera, three things happen at once:

First, her face is kept — for herself, for her children, and for granddaughters who will arrive in a time she cannot yet imagine.

Second, a page of a particular women's history is written — a history our libraries still lack, a history that ought to exist. Every photograph we take of a Saudi bride today will, a century from now, be a document studied by historians of beauty and society.

Third, she joins — perhaps without knowing it — a long caravan of women who refused to leave time in silence. Who said: "I was. And I will not be erased."

The camera, when you look at it deeply, is not a machine. It is a covenant. A covenant between human, time, and memory. A covenant that says: "We deserve to remain." And at ATEMA, our honour is to be one of the keepers of that covenant — generation after generation, bride after bride.

One day, your daughter's daughter will be born, and she will open an old box in a cupboard, and she will take out a photograph of you — taken in this year, in this city, in this gown. She will look at you, and say softly: "This is my grandmother. She was beautiful."

That moment, which has not yet happened, is the reason we work.$body$,

  '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.JPG',
  true,
  '2026-05-23 10:30:00+03'
)

on conflict (slug) do update set
  title_ar     = excluded.title_ar,
  title_en     = excluded.title_en,
  excerpt_ar   = excluded.excerpt_ar,
  excerpt_en   = excluded.excerpt_en,
  body_ar      = excluded.body_ar,
  body_en      = excluded.body_en,
  cover_url    = excluded.cover_url,
  published    = excluded.published,
  published_at = excluded.published_at;

-- ─── Verify ─────────────────────────────────────────────────────────────
select '— Journal posts (newest first) —' as section;
select slug, title_ar, published_at
  from public.journal_posts
 order by published_at desc;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-discount-codes.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Discount codes (May 2026)
--
-- Full design: docs/integrations/discount-codes.md
--
-- What this migration does:
--   1. Creates the `discount_codes` table.
--   2. Adds three columns to `bookings` for audit/history.
--   3. Defines the `redeem_discount_code()` RPC — the ONLY way to
--      consume a code. Row-locks the code, validates, atomically
--      increments `used_count`. service_role-only.
--   4. Defines `preview_discount_code()` — read-only forecast. Same
--      validation rules, no mutation. Callable by anon for instant
--      UI feedback (rate-limited at the Edge Function layer).
--   5. RLS policies: admin-only SELECT/INSERT/UPDATE/DELETE on
--      discount_codes. Anon never touches the table directly.
--
-- Run AFTER:
--   database/schema.sql
--   database/migrations-2026-05.sql
--   database/migrations-2026-05-rls-hardening.sql

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 1. discount_codes table                                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝

create table if not exists public.discount_codes (
  code             text primary key,
  description      text,
  kind             text not null check (kind in ('percent','flat')),
  value            integer not null check (value > 0),
  max_discount     integer,                                  -- cap for percent codes
  min_subtotal     integer default 0 check (min_subtotal >= 0),
  valid_from       timestamptz default now(),
  valid_to         timestamptz,
  max_uses         integer,                                  -- null = unlimited
  used_count       integer not null default 0
                     check (used_count >= 0),
  active           boolean not null default true,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Enforce uppercase code at the database layer so client + server can't drift.
alter table public.discount_codes
  drop constraint if exists discount_codes_code_upper;
alter table public.discount_codes
  add constraint discount_codes_code_upper
  check (code = upper(code) and length(code) between 2 and 32);

-- Percent codes: value must be 1..100.
alter table public.discount_codes
  drop constraint if exists discount_codes_percent_range;
alter table public.discount_codes
  add constraint discount_codes_percent_range
  check (kind <> 'percent' or (value between 1 and 100));

create index if not exists discount_codes_active_idx
  on public.discount_codes(active);

-- updated_at trigger (reuses schema.sql's set_updated_at function)
drop trigger if exists discount_codes_updated_at on public.discount_codes;
create trigger discount_codes_updated_at
  before update on public.discount_codes
  for each row execute function set_updated_at();

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 2. Three new columns on bookings                                  ║
-- ╚═══════════════════════════════════════════════════════════════════╝

alter table public.bookings
  add column if not exists discount_code   text;

alter table public.bookings
  add column if not exists discount_amount integer not null default 0
                                            check (discount_amount >= 0);

alter table public.bookings
  add column if not exists discount_kind   text
                                            check (discount_kind in ('percent','flat'));

-- FK with ON DELETE SET NULL so historical bookings survive if a code is
-- ever deleted. We also keep discount_amount/discount_kind so the
-- record stays informative.
alter table public.bookings
  drop constraint if exists bookings_discount_code_fkey;
alter table public.bookings
  add constraint bookings_discount_code_fkey
  foreign key (discount_code)
  references public.discount_codes(code)
  on delete set null;

create index if not exists bookings_discount_code_idx
  on public.bookings(discount_code)
  where discount_code is not null;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 3. preview_discount_code — read-only forecast                     ║
-- ╚═══════════════════════════════════════════════════════════════════╝
--
-- Returns (applied_amount, applied_kind, reason). Does NOT increment
-- used_count. Callable by anon for instant UI feedback.

drop function if exists public.preview_discount_code(text, integer);

create function public.preview_discount_code(
  p_code text,
  p_subtotal integer
) returns table (
  applied_amount integer,
  applied_kind   text,
  reason         text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.discount_codes%rowtype;
  amount integer := 0;
  normalized text;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select 0, null::text, 'empty';
    return;
  end if;
  if p_subtotal is null or p_subtotal <= 0 then
    return query select 0, null::text, 'invalid_subtotal';
    return;
  end if;

  normalized := upper(btrim(p_code));

  select * into c from public.discount_codes
   where code = normalized;

  if not found then
    return query select 0, null::text, 'not_found';
    return;
  end if;
  if not c.active then
    return query select 0, c.kind, 'inactive';
    return;
  end if;
  if c.valid_from is not null and now() < c.valid_from then
    return query select 0, c.kind, 'not_yet_active';
    return;
  end if;
  if c.valid_to is not null and now() > c.valid_to then
    return query select 0, c.kind, 'expired';
    return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select 0, c.kind, 'exhausted';
    return;
  end if;
  if p_subtotal < coalesce(c.min_subtotal, 0) then
    return query select 0, c.kind, 'below_min_subtotal';
    return;
  end if;

  -- Compute amount.
  if c.kind = 'percent' then
    amount := floor(p_subtotal * c.value / 100.0);
    if c.max_discount is not null and amount > c.max_discount then
      amount := c.max_discount;
    end if;
  else
    amount := least(c.value, p_subtotal);
  end if;

  return query select amount, c.kind, 'ok';
end;
$$;

grant execute on function public.preview_discount_code(text, integer)
  to anon, authenticated, service_role;

-- ╔════════════════════════════════��══════════════════════════════════╗
-- ║ 4. redeem_discount_code — atomic redemption                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
--
-- Same validation as preview, PLUS: row-lock + increment used_count
-- in the same transaction. service_role-only — only the
-- create-booking Edge Function can call this.

drop function if exists public.redeem_discount_code(text, integer);

create function public.redeem_discount_code(
  p_code text,
  p_subtotal integer
) returns table (
  applied_amount integer,
  applied_kind   text,
  reason         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.discount_codes%rowtype;
  amount integer := 0;
  normalized text;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select 0, null::text, 'empty';
    return;
  end if;
  if p_subtotal is null or p_subtotal <= 0 then
    return query select 0, null::text, 'invalid_subtotal';
    return;
  end if;

  normalized := upper(btrim(p_code));

  select * into c from public.discount_codes
   where code = normalized
   for update;                                                -- row lock

  if not found then
    return query select 0, null::text, 'not_found';
    return;
  end if;
  if not c.active then
    return query select 0, c.kind, 'inactive';
    return;
  end if;
  if c.valid_from is not null and now() < c.valid_from then
    return query select 0, c.kind, 'not_yet_active';
    return;
  end if;
  if c.valid_to is not null and now() > c.valid_to then
    return query select 0, c.kind, 'expired';
    return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select 0, c.kind, 'exhausted';
    return;
  end if;
  if p_subtotal < coalesce(c.min_subtotal, 0) then
    return query select 0, c.kind, 'below_min_subtotal';
    return;
  end if;

  if c.kind = 'percent' then
    amount := floor(p_subtotal * c.value / 100.0);
    if c.max_discount is not null and amount > c.max_discount then
      amount := c.max_discount;
    end if;
  else
    amount := least(c.value, p_subtotal);
  end if;

  -- Atomic increment.
  update public.discount_codes
     set used_count = used_count + 1,
         updated_at = now()
   where code = c.code;

  return query select amount, c.kind, 'ok';
end;
$$;

grant execute on function public.redeem_discount_code(text, integer)
  to service_role;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 5. RLS — admin-only direct access to discount_codes               ║
-- ╚═══════════════════════════════════════════════════════════════════╝

alter table public.discount_codes enable row level security;

drop policy if exists "Admins read discount codes"          on public.discount_codes;
drop policy if exists "Admins insert discount codes"        on public.discount_codes;
drop policy if exists "Admins update discount codes"        on public.discount_codes;
-- Both names dropped: the original migration created "delete unused" but
-- only listed "delete" here, so re-runs tripped 42710 on the next CREATE.
drop policy if exists "Admins delete discount codes"        on public.discount_codes;
drop policy if exists "Admins delete unused discount codes" on public.discount_codes;

create policy "Admins read discount codes"
  on public.discount_codes for select
  to authenticated using (true);

create policy "Admins insert discount codes"
  on public.discount_codes for insert
  to authenticated with check (true);

create policy "Admins update discount codes"
  on public.discount_codes for update
  to authenticated using (true) with check (true);

-- Admins can only delete codes that have never been redeemed.
-- Codes with history are paused via active=false instead.
create policy "Admins delete unused discount codes"
  on public.discount_codes for delete
  to authenticated using (used_count = 0);

-- Service role bypass (already implicit, made explicit for grep-ability).
drop policy if exists "Service role full access — discount_codes" on public.discount_codes;
create policy "Service role full access — discount_codes"
  on public.discount_codes for all
  to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 6. Verify                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════╝

select '— Discount codes ready —' as section;
select policyname, cmd, roles from pg_policies
 where schemaname = 'public' and tablename = 'discount_codes'
 order by cmd, policyname;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-launch-code.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Launch discount code (May 2026)
--
-- Seeds the LAUNCH15 promotional code marking the new site going live.
--   • 15% off, capped at 800 SAR (keeps Couture savings sensible)
--   • Unlimited redemptions within the launch window
--   • Active immediately, expires 20 days after this migration is applied
--   • No minimum subtotal — applies to every tier including Engagement
--
-- Idempotent: re-running the migration refreshes the 20-day window from
-- the new "now()" so the owner can extend the launch by running it again.
--
-- Run AFTER database/migrations-2026-05-discount-codes.sql.

insert into public.discount_codes
  (code, description, kind, value, max_discount, min_subtotal,
   valid_from, valid_to, max_uses, active)
values
  ('LAUNCH15',
   'إطلاق الموقع الجديد — خصم 15٪ على جميع الباقات (سقف 800 ر.س)، صالح ٢٠ يوماً / Launch offer — 15% off every tier (max 800 SAR), valid 20 days',
   'percent', 15, 800, 0,
   now(), now() + interval '20 days',
   null, true)
on conflict (code) do update set
  description  = excluded.description,
  kind         = excluded.kind,
  value        = excluded.value,
  max_discount = excluded.max_discount,
  min_subtotal = excluded.min_subtotal,
  valid_from   = excluded.valid_from,
  valid_to     = excluded.valid_to,
  max_uses     = excluded.max_uses,
  active       = excluded.active,
  updated_at   = now();

-- ─── Verify ──────────────────────────────────────────────────────────────────
select '— Launch code ready —' as section;
select code, kind, value, max_discount,
       valid_from::date    as starts,
       valid_to::date      as expires,
       (valid_to::date - now()::date) as days_remaining,
       used_count, active
  from public.discount_codes
 where code = 'LAUNCH15';


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-booking-changes.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Customer-initiated booking changes (Phase 1: reschedule)
--
-- Lets a bride move her own booking via a private "manage" link
-- (/#/manage/<token>) without a customer account — the token is the secret,
-- exactly like the Mood Board. All writes go through the change-booking Edge
-- Function (service-role); anon never updates `bookings` directly.
--
-- Idempotent — safe to re-run. Run AFTER:
--   database/schema.sql
--   database/migrations-2026-05.sql
--   database/migrations-2026-05-rls-hardening.sql
--
-- Owner steps after running this:
--   1. supabase functions deploy change-booking
--   2. (optional) extend create-booking to WhatsApp the manage link on booking.

create extension if not exists pgcrypto;   -- for gen_random_bytes()

-- ── 1. Booking columns ─────────────────────────────────────────────────────
-- manage_token: 160-bit capability secret (40 hex chars). Defaulted so every
--   new booking gets one automatically; existing rows are backfilled below.
-- reschedule_count: enforces the contract's "once only" rule.
alter table public.bookings
  add column if not exists manage_token     text,
  add column if not exists reschedule_count int not null default 0;

-- Backfill any existing rows that predate this migration.
update public.bookings
   set manage_token = encode(gen_random_bytes(20), 'hex')
 where manage_token is null;

-- Now enforce presence + uniqueness, and default future inserts.
alter table public.bookings
  alter column manage_token set default encode(gen_random_bytes(20), 'hex');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_manage_token_uniq'
  ) then
    alter table public.bookings
      add constraint bookings_manage_token_uniq unique (manage_token);
  end if;
end$$;

-- ── 2. Audit log of customer changes ───────────────────────────────────────
create table if not exists public.booking_changes (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  kind        text not null check (kind in ('reschedule','package')),
  actor       text not null default 'customer',
  old_value   jsonb,
  new_value   jsonb,
  price_delta numeric default 0,
  created_at  timestamptz default now()
);
create index if not exists booking_changes_booking_id_idx
  on public.booking_changes(booking_id);

alter table public.booking_changes enable row level security;
-- Customers never read/write this table directly (the Edge Function writes it
-- as service-role). Admin (authenticated) may read for the booking timeline.
drop policy if exists "Authenticated read booking_changes" on public.booking_changes;
create policy "Authenticated read booking_changes"
  on public.booking_changes for select
  to authenticated using (true);

-- ── 3. Token-scoped read RPC (anon-safe) ───────────────────────────────────
-- The manage page calls this to render the booking. SECURITY DEFINER returns
-- ONLY the single row matching the supplied token, so anon cannot read or
-- enumerate the bookings table. The fields returned are the bride's OWN data
-- (she is authenticated by holding the token), scoped to what the page needs.
create or replace function public.get_booking_by_token(p_token text)
returns table (
  booking_ref      text,
  status           text,
  payment_status   text,
  event_date       date,
  event_time       text,
  package_id       int,
  addon_ids        text[],
  location         text,
  subtotal         int,
  vat              int,
  total            int,
  reschedule_count int
)
language sql
security definer
set search_path = public
as $$
  select b.booking_ref, b.status, b.payment_status, b.event_date,
         to_char(b.event_time, 'HH24:MI') as event_time,
         b.package_id, b.addon_ids, b.location, b.subtotal, b.vat, b.total,
         b.reschedule_count
    from public.bookings b
   where b.manage_token = p_token
   limit 1;
$$;

-- Empty/short tokens can never match a 40-char secret, but guard anyway.
grant execute on function public.get_booking_by_token(text) to anon, authenticated;

-- ── 4. Verify ───────────────────────────────────────────────────────────────
select '— Booking-changes schema ready —' as section;
select column_name from information_schema.columns
 where table_name = 'bookings' and column_name in ('manage_token','reschedule_count');
select tablename, rowsecurity from pg_tables where tablename = 'booking_changes';


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-booking-changes-otp.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Step-up OTP for customer money changes (Phase 2)
--
-- Changing a package or add-ons moves money, so it requires a one-time code
-- texted to the booking's phone — a second factor on top of the manage-link
-- token. Codes are stored only as a salted hash; the change-booking Edge
-- Function (service-role) is the sole reader/writer.
--
-- Idempotent. Run AFTER database/migrations-2026-05-booking-changes.sql.

create table if not exists public.booking_otps (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  purpose     text not null default 'change_package',
  code_hash   text not null,            -- salted SHA-256 hex, never the clear code
  salt        text not null,
  expires_at  timestamptz not null,
  attempts    int  not null default 0,
  consumed_at timestamptz,
  created_at  timestamptz default now()
);

create index if not exists booking_otps_lookup_idx
  on public.booking_otps(booking_id, purpose, created_at desc);

-- RLS on, with NO anon/authenticated policies: only the service-role Edge
-- Function touches this table. (Service role bypasses RLS.)
alter table public.booking_otps enable row level security;

-- ── Verify ───────────────────────────────────────────────────────────────────
select '— Booking OTP table ready —' as section;
select tablename, rowsecurity from pg_tables where tablename = 'booking_otps';


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-repair-audit.sql
-- ═══════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-05-audit-patches.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Audit-pass patches (May 2026)
--
-- Bundles every DB-side change required by docs/bugs.md re-audit
-- (2026-05-21) into one re-runnable migration. Safe to re-run; every
-- statement is idempotent.
--
-- Run AFTER:
--   database/migrations-2026-05-moodboard.sql
--   database/migrations-2026-05-rls-hardening.sql
--   database/migrations-2026-05-discount-codes.sql
--
-- What this fixes:
--   * H-6  Mood Board PII leak (anon could SELECT all rows)
--   * H-9  Loose anon SELECT on bookings (DatePicker now uses view)
--   * H-7  / H-7b — preview_discount_code now returns code_value
--          + code_max_discount so the client can display honest
--          percent labels and re-evaluate on basket changes
--   * M-9  Booking insert RLS now verifies discount math via
--          preview_discount_code() — fallback path can persist
--          discount fields safely
--   * M-10 Note: preview rate-limit lives in the Edge Function
--          (supabase/functions/discount-preview), not here.

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ H-6 — Lock down mood_boards SELECT, expose RPC instead             ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- The token-as-secret model was never enforced. `using (true)` let any
-- holder of the anon key SELECT * from mood_boards and harvest customer
-- names (auto-drafted into title_ar). Drop the open policy; add a
-- security-definer RPC that returns a single row matched by token.
--
-- Wrapped in a DO block guarded on the existence of `public.mood_boards`
-- so this migration is safe to run before migrations-2026-05-moodboard.sql
-- (the H-6 block will be skipped with a notice; everything else still
-- applies). Re-run the full migration after the moodboard table exists
-- to actually install the policy + RPC.

do $h6$
begin
  if to_regclass('public.mood_boards') is null then
    raise notice 'H-6 skipped: public.mood_boards does not exist yet. Run migrations-2026-05-moodboard.sql first, then re-run this migration.';
  else
    execute $$drop policy if exists "Public select mood_boards" on public.mood_boards$$;
    execute $$drop policy if exists "Authenticated select mood_boards" on public.mood_boards$$;
    execute $$create policy "Authenticated select mood_boards"
               on public.mood_boards for select
               to authenticated
               using (true)$$;

    execute $$create or replace function public.get_mood_board_by_token(p_token text)
              returns public.mood_boards
              language sql
              security definer
              stable
              set search_path = public
              as 'select * from public.mood_boards where token = p_token limit 1'$$;

    execute $$grant execute on function public.get_mood_board_by_token(text)
               to anon, authenticated$$;
  end if;
end
$h6$;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ H-9 — Drop the loose anon SELECT on bookings                       ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- DatePicker (the only customer-facing reader) now goes via the
-- public_booked_dates view (see src/services/calendar.ts). The
-- `using (true)` policy on the table is dead weight + a PII bypass —
-- since stock Postgres RLS can't restrict columns, anon could still
-- SELECT customer_name etc. directly. Drop it. Admin reads continue
-- through the authenticated role.

drop policy if exists "Public select event_date status only" on public.bookings;
drop policy if exists "Allow public booking select"            on public.bookings;
drop policy if exists "anon_select_bookings"                   on public.bookings;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ H-7 / H-7b — Extend preview_discount_code with code metadata       ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- Adds two extra return columns: code_value (the percent / flat raw
-- value the admin set) and code_max_discount (cap for percent codes).
-- The client uses these to display an honest label like "25% off
-- (capped at 1,000 ر.س)" instead of the reverse-engineered, sometimes-
-- incorrect "10%" computed from amount/subtotal.

drop function if exists public.preview_discount_code(text, integer);

create or replace function public.preview_discount_code(
  p_code text,
  p_subtotal integer
) returns table (
  applied_amount    integer,
  applied_kind      text,
  reason            text,
  code_value        integer,
  code_max_discount integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  c public.discount_codes%rowtype;
  amount integer := 0;
  normalized text;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select 0, null::text, 'empty', null::int, null::int;
    return;
  end if;
  if p_subtotal is null or p_subtotal <= 0 then
    return query select 0, null::text, 'invalid_subtotal', null::int, null::int;
    return;
  end if;

  normalized := upper(btrim(p_code));

  select * into c from public.discount_codes
   where code = normalized;

  if not found then
    return query select 0, null::text, 'not_found', null::int, null::int;
    return;
  end if;
  if not c.active then
    return query select 0, c.kind, 'inactive', c.value, c.max_discount;
    return;
  end if;
  if c.valid_from is not null and now() < c.valid_from then
    return query select 0, c.kind, 'not_yet_active', c.value, c.max_discount;
    return;
  end if;
  if c.valid_to is not null and now() > c.valid_to then
    return query select 0, c.kind, 'expired', c.value, c.max_discount;
    return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select 0, c.kind, 'exhausted', c.value, c.max_discount;
    return;
  end if;
  if p_subtotal < coalesce(c.min_subtotal, 0) then
    return query select 0, c.kind, 'below_min_subtotal', c.value, c.max_discount;
    return;
  end if;

  if c.kind = 'percent' then
    amount := floor(p_subtotal * c.value / 100.0);
    if c.max_discount is not null and amount > c.max_discount then
      amount := c.max_discount;
    end if;
  else
    amount := least(c.value, p_subtotal);
  end if;

  return query select amount, c.kind, 'ok', c.value, c.max_discount;
end;
$$;

grant execute on function public.preview_discount_code(text, integer)
  to anon, authenticated, service_role;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ M-9 — Verify discount math at booking-insert time                  ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- The constrained anon-insert policy (from migrations-2026-05-rls-
-- hardening.sql) didn't verify that a client-supplied discount_amount
-- actually matches what the code is worth. Without this, the fallback
-- path could in principle let a forged amount through. Tighten by
-- calling preview_discount_code() inside the policy's WITH CHECK.
--
-- preview_discount_code is STABLE + SECURITY DEFINER, so RLS can call
-- it safely.

drop policy if exists "Constrained anonymous booking insert" on public.bookings;

create policy "Constrained anonymous booking insert"
  on public.bookings
  for insert
  to anon
  with check (
        customer_name  is not null
    and length(trim(customer_name))  between 2 and 120
    and customer_phone is not null
    and length(trim(customer_phone)) between 7 and 25
    and event_date is not null
    and event_date >= current_date
    and subtotal > 0     and subtotal <= 200000
    and total    > 0     and total    <= 230000
    and vat      >= 0    and vat      <= 50000
    and status         = 'pending'
    and payment_status = 'unpaid'
    -- Discount math is consistent — either no code, or the supplied
    -- amount matches what preview_discount_code computes against the
    -- gross subtotal (gross = current subtotal + discount_amount, since
    -- subtotal is stored net of discount).
    and (
      discount_code is null
      or coalesce(discount_amount, 0) = 0
      or exists (
        select 1
          from public.preview_discount_code(
                 discount_code,
                 subtotal + coalesce(discount_amount, 0)
               ) p
         where p.applied_amount = discount_amount
           and p.reason = 'ok'
      )
    )
  );

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ Verify                                                              ║
-- ╚════════════════════════════════════════════════════════════════════╝

select '— Audit patches applied —' as section;
select schemaname, tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('bookings','mood_boards','discount_codes')
 order by tablename, cmd, policyname;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-06-topup.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — 2026-06 top-up payment tracking
--
-- Adds topup_amount_due to bookings so the system can remember what
-- balance is outstanding after a package upgrade, independent of the
-- client session that triggered the change. Cleared to 0 by the
-- verify-payment Edge Function once the top-up is confirmed by Moyasar.
--
-- Idempotent — safe to re-run.

alter table public.bookings
  add column if not exists topup_amount_due numeric(10,2) not null default 0;

comment on column public.bookings.topup_amount_due is
  'Outstanding balance after a self-service package upgrade. Set by the '
  'change-booking Edge Function; cleared to 0 by verify-payment once paid.';


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-06-feature-flags.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA Studio — Feature flags: WhatsApp automated sends + payment method gating
-- Run once in Supabase SQL editor (idempotent — ADD COLUMN IF NOT EXISTS).

-- wa_enabled:               gates ALL automated WA sends (booking confirm, change notify,
--                           lifecycle reminders). The static wa.me chat link is unaffected.
-- payment_*_enabled:        each payment method must be explicitly turned on by the admin.
--                           transfer defaults to true (always-available fallback).
--                           card / mada / applepay default to false (require Moyasar live mode).

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS wa_enabled               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_card_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_mada_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_applepay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_transfer_enabled boolean NOT NULL DEFAULT true;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-06-rls-remaining.sql
-- ═══════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/migrations-2026-06-documents.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — contracts + invoices under version control (June 2026)
--
-- These two tables have existed in the production project since the document
-- engine shipped, but were created by hand outside the tracked migrations
-- (see the warning that used to live in PROJECT.md §"contracts / invoices").
-- This migration:
--   1. Brings their DDL into the repo so a from-scratch rebuild works.
--   2. DROPS the loose "public select" policies — content_html embeds the
--      customer's name and phone, so anon SELECT was a PII enumeration leak
--      (same class as the fixed H-6 / H-9 findings in docs/bugs.md).
--   3. Keeps INSERT open to anon (the booking flow writes the first version
--      anonymously) but caps the payload size.
--   4. Adds no UPDATE/DELETE policies: the tables are APPEND-ONLY. A
--      regenerated document is a new row; the latest row per booking_id is
--      the live artifact. History is the audit trail.
--
-- Idempotent — safe to re-run.

-- ─── 1. Tables (no-ops where production already has them) ────────────────────
create table if not exists public.contracts (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid references public.bookings(id) on delete cascade,
  booking_ref  text,
  content_html text,
  status       text default 'draft',
  created_at   timestamptz not null default now()
);
-- Production drift guard: saveContract() writes `status`; make sure the
-- column exists even if the hand-made table predates it.
alter table public.contracts add column if not exists status text default 'draft';

create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid references public.bookings(id) on delete cascade,
  booking_ref    text,
  invoice_number text unique,
  content_html   text,
  total          numeric(10,2),
  issued_at      timestamptz,
  created_at     timestamptz not null default now()
);

-- Latest-version lookups: "newest document for this booking".
create index if not exists contracts_booking_idx
  on public.contracts (booking_id, created_at desc);
create index if not exists invoices_booking_idx
  on public.invoices (booking_id, created_at desc);

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────
alter table public.contracts enable row level security;
alter table public.invoices  enable row level security;

-- Kill the PII leak: documents are admin-read only from now on. The customer
-- keeps her copies from booking time (in-memory view/download); she never
-- reads these tables.
drop policy if exists "Allow public contract select" on public.contracts;
drop policy if exists "Allow public invoice select"  on public.invoices;
drop policy if exists "Allow public contract insert" on public.contracts;
drop policy if exists "Allow public invoice insert"  on public.invoices;

drop policy if exists "Anon inserts contracts" on public.contracts;
create policy "Anon inserts contracts" on public.contracts
  for insert to anon, authenticated
  with check (content_html is not null and length(content_html) <= 600000);

drop policy if exists "Anon inserts invoices" on public.invoices;
create policy "Anon inserts invoices" on public.invoices
  for insert to anon, authenticated
  with check (content_html is not null and length(content_html) <= 600000);

drop policy if exists "Admin reads contracts" on public.contracts;
create policy "Admin reads contracts" on public.contracts
  for select to authenticated using (true);

drop policy if exists "Admin reads invoices" on public.invoices;
create policy "Admin reads invoices" on public.invoices
  for select to authenticated using (true);

-- ─── 3. Verify ───────────────────────────────────────────────────────────────
select '— contracts / invoices policies —' as section;
select tablename, policyname, cmd
  from pg_policies
 where tablename in ('contracts','invoices')
 order by tablename, policyname;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/seed-packages-2026-05.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Packages & Add-ons seed
-- Mirrors the printed price list (قائمة الأسعار) handed to clients.
--
-- Idempotent and FK-safe: existing bookings reference packages.id, so this
-- script UPSERTS rows by explicit id (1..6) and DEACTIVATES (sets active=false)
-- any leftover legacy packages instead of deleting them. That preserves
-- booking history while hiding obsolete tiers from the catalogue + admin.
--
-- Run AFTER schema.sql and migrations-2026-05*.sql.

-- ─── Ensure schema columns exist (idempotent guards) ─────────────────────────
alter table public.packages
  add column if not exists included_addon_ids text[] default '{}'::text[],
  add column if not exists sort_order integer not null default 100;

alter table public.addons
  add column if not exists sort_order integer not null default 100;

-- ─── 1. ADD-ONS (11 line items) ──────────────────────────────────────────────
-- Insert/update by id so re-running keeps prices in sync.
insert into public.addons (id, name_ar, name_en, price, active, sort_order)
values
  -- Extra hour now includes assistant cost (110/hr) + 25% margin on full loaded labour.
  ('extra-hour',     'ساعة تصوير إضافية',                       'Extra photo hour',                         900,  true, 10),
  -- Video add-ons follow the videography 50% margin rule:
  --   short = ~5h × 450 × 1.5 ≈ 3,400 SAR
  --   full  = ~7h × 450 × 1.5 ≈ 4,800 SAR
  ('video-short',    'فيديو سينمائي قصير (إضافة للكلاسيكية)',    'Short cinematic video (Classic add-on)',  3400,  true, 20),
  ('video-full',     'فيديو سينمائي كامل (إضافة للكلاسيكية)',    'Full cinematic video (Classic add-on)',   4800,  true, 30),
  ('henna',          'تغطية ليلة الحناء',                        'Henna night coverage',                    2400,  true, 40),
  ('bridal-prep',    'تصوير تحضيرات العروس',                     'Bridal prep session',                     1200,  true, 50),
  ('album-upgrade',  'ترقية الألبوم إلى A3',                     'Album upgrade to A3',                      800,  true, 60),
  ('extra-pages',    'صفحات ألبوم إضافية (سعر الصفحة)',          'Extra album page (per page)',              120,  true, 70),
  ('raw-files',      'تسليم الملفات الخام',                      'Raw files delivery',                       900,  true, 80),
  ('second-photog',  'مصور ثانٍ',                                'Second photographer',                     1200,  true, 90),
  ('kosha',          'تصوير الكوشة قبل الحفل',                    'Pre-event kosha shoot',                    800,  true, 100),
  ('save-date',      'Save the Date',                            'Save the Date',                            700,  true, 110)
on conflict (id) do update set
  name_ar    = excluded.name_ar,
  name_en    = excluded.name_en,
  price      = excluded.price,
  active     = excluded.active,
  sort_order = excluded.sort_order;

-- ─── 2. PACKAGES (6 tiers — engagement → couture) ────────────────────────────
-- UPSERT by explicit id so existing bookings keep their FK reference intact.
insert into public.packages
  (id, name_ar, name_en, price, duration_hours, edited_photos, album, video,
   description, features, badge, is_popular, active, sort_order, included_addon_ids)
values

-- ── 1. Engagement Session — 2,500 SAR ────────────────────────────────────────
-- Pricing updated May-2026 (see migrations-2026-05-pricing-overhaul.sql).
-- Editing-tier copy aligned with migrations-2026-05-editing-tiers.sql.
(1, 'باقة الخطوبة', 'Engagement Session', 2500, 2, 30,
 NULL, false,
 'جلسة خطوبة رومانسية بأسلوب راقٍ — مثالية لإعلان البداية.',
 array[
   'ساعتان من التصوير الاحترافي',
   '٣٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   'اختيار أجمل اللقطات',
   'وحدة تخزين باسم العروسين',
   'تصميم Save the Date رقمي هدية'
 ],
 'الأساسي', false, true, 10, array['save-date']::text[]),

-- ── 2. Custom Foundation — singleton base for "Design Your Package" tab ─────
-- Set is_custom_base=true via migrations-2026-05-custom-base.sql after seeding.
-- This row was previously "Customise" (2,200 SAR, 3h, partially-loaded).
-- Now: minimal 1h foundation that customers build on with add-ons.
(2, 'الأساس المرن', 'Custom Foundation', 1800, 1, 20,
 NULL, false,
 'الأساس المرن لباقتك المخصّصة — ابدئي من هنا وأضيفي ما يلائم مناسبتك.',
 array[
   'ساعة واحدة من التصوير الاحترافي',
   '٢٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   'وحدة تخزين رقمية',
   'أضيفي ساعات، فيديو، ألبوم، أو ليلة الحناء حسب احتياجك'
 ],
 NULL, false, true, 0, array[]::text[]),

-- ── 3. Classic — 5,200 SAR ───────────────────────────────────────────────────
-- Adds assistant (>2h rule) + printing 25% margin.
(3, 'الباقة الكلاسيكية', 'Classic', 5200, 4, 300,
 'ألبوم A4 ١٥ صفحة', false,
 'الباقة المثالية للمناسبات الخاصة — ألبوم فاخر وذكريات تبقى، بفريق نسائي كامل.',
 array[
   '٤ ساعات تغطية شاملة للحفل',
   'مصوّرة رئيسية + مساعدة (فريق نسائي)',
   '٣٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
   '٥ صور عائلية معدّلة',
   'وحدة تخزين بجميع الصور المعدّلة'
 ],
 NULL, false, true, 30, array['second-photog']::text[]),

-- ── 4. Royal — 10,500 SAR — الأكثر طلباً ─────────────────────────────────────
-- Video service now priced at hours × 450 × 1.5 (50% margin per owner rule).
(4, 'الباقة الملكية', 'Royal', 10500, 5, 400,
 'ألبوم A4 + ميني ألبوم', true,
 'تجربة تصوير ملكية مع فيديو سينمائي قصير وألبومين فاخرين — الأكثر طلباً.',
 array[
   '٥ ساعات تغطية شاملة للحفل',
   'مصوّرة رئيسية + مساعدة (فريق نسائي)',
   '٤٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   '٤ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
   'فيديو سينمائي قصير (٣–٥ دقائق)',
   'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
   'ميني ألبوم عائلي',
   'وحدة تخزين باسم العروسين',
   'معاينة في نفس اليوم (٥ صور مختارة)'
 ],
 'الأكثر طلباً', true, true, 40, array['second-photog','video-short']::text[]),

-- ── 5. Signature — 12,500 SAR ────────────────────────────────────────────────
(5, 'باقة التوقيع', 'Signature', 12500, 6, 500,
 'ألبوم فاخر A3 ١٢ صفحة + ميني', true,
 'الباقة الاحترافية الشاملة — فيديو سينمائي كامل، ألبوم A3 فاخر، وجلسة تحضيرات العروس.',
 array[
   '٦ ساعات تغطية شاملة للحفل',
   'مصوّرة رئيسية + مساعدة (فريق نسائي)',
   '٥٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   '٨ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
   'فيديو سينمائي كامل',
   'جلسة تصوير تحضيرات العروس',
   'ألبوم فاخر A3 بـ ١٢ صفحة',
   'ميني ألبوم عائلي',
   'وحدة تخزين منقوشة بالاسم',
   'معاينة في نفس اليوم (٥ صور مختارة)'
 ],
 'فاخر', false, true, 50, array['second-photog','video-full','bridal-prep','album-upgrade']::text[]),

-- ── 6. ATEMA Couture — 19,500 SAR — الأفخم ───────────────────────────────────
(6, 'ATEMA Couture', 'ATEMA Couture', 19500, 8, 700,
 'ألبوم فاخر A3 ٢٠ صفحة + ميني + لوحة جدارية', true,
 'تجربة الفخامة الكاملة — كل تفاصيل اليوم بتوقيع كوتور حصري، من الحناء إلى الحفل.',
 array[
   'تغطية شاملة كاملة للحفل (٨ ساعات)',
   'مصوّرة رئيسية + مساعدة (فريق نسائي)',
   '٧٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   '١٢ صورة بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
   'فيديو سينمائي فاخر — تغطية كاملة + ليلة الحناء',
   'جلسة تحضيرات العروس',
   'تغطية ليلة الحناء',
   'ألبوم فاخر A3 بـ ٢٠ صفحة',
   'ميني ألبوم فاخر',
   'لوحة جدارية فنية مؤطرة',
   'وحدة تخزين فاخرة بالاسم',
   'معاينة في نفس اليوم (١٠ صور مختارة)',
   'خدمة عملاء ومتابعة خاصة'
 ],
 'الأفخم', true, true, 60, array['second-photog','video-full','bridal-prep','album-upgrade','henna','kosha']::text[])

on conflict (id) do update set
  name_ar            = excluded.name_ar,
  name_en            = excluded.name_en,
  price              = excluded.price,
  duration_hours     = excluded.duration_hours,
  edited_photos      = excluded.edited_photos,
  album              = excluded.album,
  video              = excluded.video,
  description        = excluded.description,
  features           = excluded.features,
  badge              = excluded.badge,
  is_popular         = excluded.is_popular,
  active             = excluded.active,
  sort_order         = excluded.sort_order,
  included_addon_ids = excluded.included_addon_ids;

-- Hide (don't delete) any legacy packages with ids > 6 so they vanish from the
-- catalogue and admin grid but stay attached to historical bookings.
update public.packages
   set active = false, sort_order = 9999
 where id > 6;

-- Re-sync the SERIAL sequence so future auto-id inserts via the admin panel
-- don't collide with the explicit ids we just upserted.
select setval(
  pg_get_serial_sequence('public.packages', 'id'),
  greatest((select coalesce(max(id), 0) from public.packages), 6)
);

-- ─── 3. Verify ───────────────────────────────────────────────────────────────
-- Quick sanity output (will appear in the SQL editor result pane).
select '— Active packages —' as section;
select id, name_ar, price, duration_hours, badge, sort_order
  from public.packages where active order by sort_order;
select '— Deactivated legacy packages (preserved for booking history) —' as section;
select id, name_ar, price from public.packages where not active order by id;
select '— Add-ons —' as section;
select id, name_ar, price from public.addons order by sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/seed-portfolio-2026-05-expanded.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Expanded Portfolio (Our Work / Atelier) seed for May 2026
--
-- Adds 23 bilingual portfolio items from a fresh studio session covering
--   bride       — single bridal portraits and full editorial spreads
--   couture     — details (rings, lace, fabric, bouquets, jewellery)
--   editorial   — signature shoots, narrative spreads, product photography
--
-- Each row carries a poetic, sensory caption in the Atelier voice — the
-- same register as src/pages/AboutPage.tsx and the journal seed.
--
-- Safe to re-run: every row points at /photos/<filename>, so we wipe only
-- previously-seeded rows. Admin uploads with Supabase Storage URLs are
-- untouched.
--
-- Run AFTER:
--   database/migrations-2026-05-branding.sql
--   database/migrations-2026-05-custom-domain.sql

-- ── 1. Wipe only the previously-seeded portfolio rows ────────────────────
delete from public.portfolio_items
 where image_url like '/photos/%';

-- ── 2. Seed the curated set ──────────────────────────────────────────────
insert into public.portfolio_items
  (title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
values

-- ─── BRIDE — full portraits & editorial spreads ─────────────────────────
('عروسٌ تحت قوسٍ من الضوء', 'Bride beneath an arch of light',
 'bride',
 '/photos/bride-hero.jpeg',
 'لحظةٌ قبل الإطلال — حيث يصمت الجميع، ويتقدّم الضوء وحده.',
 'A moment before the entrance — when everyone falls silent, and only the light steps forward.',
 10, true),

('تحت ثريّا القاعة', 'Beneath the chandelier',
 'bride',
 '/photos/IMG_0259.JPG',
 'حين يميلُ الذهبُ من السقف، تختارُ العروسُ نظرتها بكلّ هدوء.',
 'When gold leans down from the ceiling, she chooses her gaze quietly.',
 12, true),

('القاعةُ، قبل العهد', 'The hall, before the vow',
 'bride',
 '/photos/5B05CBF2-9106-4FF8-A00A-2D3DAD8693B7.JPG',
 'ثوبٌ أبيض، رواقٌ ذهبيّ، ونَفَسٌ يُؤجَّل لثانيةٍ واحدة.',
 'A white gown, a gilded hall, and a breath held for one more second.',
 14, true),

('الوعد — في صندوقٍ أحمر', 'The promise — in a small red box',
 'bride',
 '/photos/60FBEE21-EB43-4CFA-AEC2-D73D206E5016.JPG',
 'توليبٌ أبيض، ثوبٌ سماويّ، وعهدٌ يُهمسُ على ضوءِ الصباح.',
 'White tulips, sky-blue silk, and a vow whispered into morning light.',
 16, true),

('هو وهي — بهدوء', 'She, and he — quietly',
 'bride',
 '/photos/B6B52466-B962-4C33-804E-135D26C25236.JPG',
 'الشُماغُ والثوبُ الفاتح — تقليدٌ يتشاركان حِكمته دون كلام.',
 'Shemagh and pale silk — a tradition they share without a word.',
 18, true),

('صباحُ الزفاف', 'The morning of',
 'bride',
 '/photos/3F59C309-D72A-466A-9405-116DE58F69B5.JPG',
 'الفرشاةُ، البالوناتُ، والصحيفةُ التي تقول: للتوّ تزوّجنا.',
 'The brush, the balloons, and the headline that reads: "Just Married".',
 20, true),

('حجابٌ من اللؤلؤ', 'The pearl veil',
 'bride',
 '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.JPG',
 'كلّ حبّةٍ على الحجاب نجمةٌ تعرفُ اسمها.',
 'Each pearl on the veil — a star that knows its own name.',
 22, true),

('الاستوديو، بصوتٍ فضّيّ', 'Studio in silver',
 'bride',
 '/photos/7CC155A1-8BFC-49B7-ADC2-CF8346A3E535.JPG',
 'الخلفيّةُ سوداء، الضوءُ ناعم، والعروسُ تكتفي بالحضور.',
 'A black backdrop, a soft light, and her presence — enough.',
 24, true),

('وردٌ أبيضُ شتويّ', 'Roses in winter white',
 'bride',
 '/photos/IMG_5506.JPG',
 'ابتسامةٌ أهدأ من الموسيقى، وحُسنٌ يعرفُ متى يصمت.',
 'A smile quieter than the music, and a beauty that knows when to be still.',
 26, true),

('النظرةُ التي تحتفظُ بها', 'The look she keeps',
 'bride',
 '/photos/IMG_5525.JPG',
 'يدٌ تلامسُ الذقن، ونظرةٌ تلامسُ الأبد.',
 'A hand at her chin, a gaze touching forever.',
 28, true),

('ضحكةٌ بين نَفَسين', 'A laugh between two breaths',
 'bride',
 '/photos/IMG_5538.JPG',
 'لحظةٌ صغيرة — صغيرةٌ جدًّا — لكنّها التي تبقى.',
 'A small moment — very small — but the one that stays.',
 30, true),

('حين تلتفتُ الغرفةُ إليها', 'When the room turns toward her',
 'bride',
 '/photos/IMG_5607.JPG',
 'لا تحتاجُ إلى دخولٍ صاخب — تكفي إطلالتها.',
 'No loud entrance needed — her arrival is enough.',
 32, true),

('عيناها تستريحان قليلًا', 'Eyes resting, briefly',
 'bride',
 '/photos/IMG_5620.JPG',
 'بين النظرتين، يتنفّسُ الفستان.',
 'Between two glances, the gown breathes.',
 34, true),

('أولى ابتساماتِ المساء', 'The first smile of the evening',
 'bride',
 '/photos/IMG_5623.JPG',
 'ليلةٌ طويلة بدأت بعينين تَلمحان شيئًا جميلًا.',
 'A long night that began with eyes catching something beautiful.',
 36, true),

('وجهٌ، عن قُرب', 'A face, up close',
 'bride',
 '/photos/Untitled-1jpg.JPG',
 'لا فلتر، لا ادّعاء — مجرّد ضوءٍ يعرفُ كيف يقترب.',
 'No filter, no pretense — only a light that knows how to come near.',
 38, true),

('صَمتٌ مُذهَّب', 'Gilded silence',
 'bride',
 '/photos/Untitled-2.JPG',
 'حين تُغمضُ العينين، نسمعُ ما لا يُقال.',
 'When the eyes close, we hear what is never said.',
 40, true),

('ابتسامةٌ تنتمي إلى اليوم', 'A smile that belongs to the day',
 'bride',
 '/photos/Untitled-3.JPG',
 'يومٌ كاملٌ يتمحورُ حولَ هذه الثانية.',
 'A whole day, circling around this single second.',
 42, true),

-- ─── COUTURE — details, fabric, hands, flowers ──────────────────────────
('زنبقٌ في قبضتها', 'Calla lilies, in her grip',
 'couture',
 '/photos/IMG_4237.JPG',
 'الكالا، الدانتيل، الخاتم — ثلاثيّةٌ تفسّرُ اليوم.',
 'Calla, lace, and a ring — the trinity that explains the day.',
 50, true),

('اليدُ التي تحملُ اليوم', 'The hand that holds the day',
 'couture',
 '/photos/65DD9322-629B-46FB-AF4A-A0F848A6FF68.JPG',
 'حلقتان لامعتان، وباقةٌ لا تشيخ.',
 'Two rings, glinting; a bouquet that does not age.',
 52, true),

('سكونٌ بين يديها', 'A stillness between her hands',
 'couture',
 '/photos/IMG_3329.JPG',
 'يدان تلتقيان فوقَ الدانتيل — جوابٌ بلا سؤال.',
 'Two hands meet over lace — an answer with no question.',
 54, true),

('عودٌ، توليب، وطقسٌ هادئ', 'Oud, tulips, and a quiet ritual',
 'couture',
 '/photos/17BB76E6-8297-4355-843B-1A1E2264B3C5.JPG',
 'العطرُ يسبقُ الباقة، والباقةُ تسبقُ الفستان.',
 'The scent arrives first, then the bouquet, then the gown.',
 56, true),

-- ─── EDITORIAL — signature spreads & product narrative ──────────────────
('يوميّاتُ الأتيلييه', 'The Atelier diary',
 'editorial',
 '/photos/ECF730D9-58C1-4F62-B8A2-4BF599422C21.JPG',
 'الحذاءُ، الشمعةُ، التاريخ — تفاصيلُ تحفظُ القصّة.',
 'The shoe, the candle, the date — details that keep the story.',
 70, true),

('أكتوبر — بمجوهرات', 'October, in jewels',
 'editorial',
 '/photos/B27F8308-42F1-41C1-9D28-93C67E00B026.JPG',
 'تقويمٌ يَعِدُ بيوم، ومجوهراتٌ تَعِدُ بأبد.',
 'A calendar that promises a day; jewels that promise a forever.',
 72, true);

-- ── 3. Verify ────────────────────────────────────────────────────────────
select '— Portfolio items seeded —' as section;
select sort_order, category, title_en, image_url
  from public.portfolio_items
 where image_url like '/photos/%'
 order by sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- ▶ database/seed-journal-2026-05.sql
-- ═══════════════════════════════════════════════════════════════════════
-- ATEMA STUDIO — Journal seed (6 editorial posts)
--
-- Six bilingual long-form posts in the same warm, lyrical voice as the
-- AboutPage. UPSERT by slug so it's safe to re-run; admin edits won't be
-- clobbered if the slug stays the same.
--
-- Run AFTER:
--   database/migrations-2026-05-branding.sql   (creates journal_posts table)
--
-- Covers point at /public/photos/*.jpeg — already shipped in the bundle.
-- Admin can later replace them with bespoke covers via JournalManager.

insert into public.journal_posts (
  slug, title_ar, title_en,
  excerpt_ar, excerpt_en,
  body_ar, body_en,
  cover_url, published, published_at
) values

-- ── 1. On Light ──────────────────────────────────────────────────────────
(
  'on-light',
  'خواطر في الضوء',
  'On Light',

  'الضوء ليس عنصراً نضيفه؛ هو الشاهد الأول. يدخل قبلنا، ويبقى بعدنا، ويعرف من المرأة ما لا تستطيع الكلمات أن تحكيه.',
  'Light is not an ingredient we add — it is the first witness. It enters before we do, stays after we leave, and knows of a woman what words cannot say.',

  $body$في الاستوديو، الضوءُ ليس أداةً، بل شخصيّة. يدخل غرفةَ التصوير قبلنا — يفحص الجدران، ويُلامس النوافذ، ويُقرّر إن كان اليومُ يومَ همسٍ أم احتفال.

في كل جلسة، أُحادثُ الضوءَ قبل أن أُحادث العروس. أسأله: من أينَ تأتي اليوم؟ بأيِّ مزاج؟ هل تتقدّم بدلال، أم بحياء؟ ثم أُجلسُها مكاناً يُحبّه، لا مكاناً ناسبَ الكاميرا فقط.

في باقاتِ كوتور، يحدث أحياناً أن أنتظرَ ساعةً كاملةً لأنّ شمسَ العصر لم تصل بعد إلى الزاوية المطلوبة. لا أستعجل. الضوءُ — كالحقيقة — لا يأتي بأمرٍ من أحد.

وحين يأتي، تلتقطه العدسةُ بنفسها تقريباً. لا أُضيف فلتراً، لا أُصحّح ميزانَ ألوان، لا أُصلِحُ ما لم يكن مكسوراً. فقط أُمسك بما رأته عيناي، وأُسلِّمه إلى الصورة.

هذه المهنةُ، في النهاية، ليست عن الكاميرات. هي عن أن نتعلّم متى نسكتُ ونترك الضوءَ يتكلّم.$body$,

  $body$In the studio, light is not a tool. It is a character. It enters the room before we do — it inspects the walls, brushes the windows, and decides whether today is a day of whisper or of celebration.

In every session, I speak to the light before I speak to the bride. I ask it: where are you arriving from today? In what mood? Are you stepping in coquettishly, or shyly? Then I seat her where the light loves her, not where the camera happens to point.

In Couture sessions, I have waited an entire hour because the afternoon sun had not yet reached the corner I wanted. I do not rush it. Light, like truth, will not be commanded.

When it arrives, the lens almost captures it on its own. I add no filter, correct no white balance, fix nothing that was not broken. I simply hold on to what my eyes saw, and hand it to the photograph.

This profession, in the end, is not about cameras. It is about learning when to be quiet, and to let the light do the speaking.$body$,

  '/photos/customise.jpeg',
  true,
  '2026-01-15 10:00:00+03'
),

-- ── 2. The First Look ────────────────────────────────────────────────────
(
  'the-first-look',
  'النظرة الأولى',
  'The First Look',

  'قبل أن تنظرَ العروسُ إلى الكاميرا، عليها أن تنظرَ إلى نفسها — كما هي اليوم، بكلِّ ما فيها. هذه اللحظةُ، في ATEMA، نحرسُها بدقّة.',
  'Before the bride looks into the camera, she must first look at herself — as she is today, with everything she carries. At ATEMA, we guard this moment carefully.',

  $body$لكلِّ امرأةٍ في ATEMA لحظةٌ نسمّيها داخلياً «النظرةَ الأولى». هي ليست أمام الكاميرا، ولا أمام طاقم العمل، ولا حتى أمامي. هي أمام نفسِها — لحظةَ تدخل غرفةَ التجهيز، وترى ذاتَها في المرآة بفستانِ الجلسة.

أُغلقُ البابَ خلفي عمداً. أعطيها خمسَ دقائق. خمسَ دقائق لا تتحدّث فيها مع أحد، ولا ترفع هاتفاً، ولا تسأل سؤالاً. فقط هي، وانعكاسُها، وبدايةُ شيءٍ كبير.

ما يحدث في تلك الدقائق لا يُكتب. أحياناً تبتسم. أحياناً تذرف دمعةً صامتة. أحياناً تضحك ضحكةً قصيرةً لا تعرف لماذا. لكنها — في كلِّ الحالات — تخرج من تلك الغرفة وهي امرأةٌ مختلفةٌ قليلاً عمّن دخلت.

من تلك اللحظة فقط، نبدأ التصوير. لأنّ أصدقَ صورةٍ لا يمكن أن تُؤخذ قبل أن تَرى المرأةُ نفسَها أوّلاً.$body$,

  $body$For every woman at ATEMA there is a moment we quietly call the first look. It is not before the camera, nor before the crew, nor even before me. It is before herself — the moment she steps into the dressing room and meets her own reflection in the gown.

I close the door behind me on purpose. I give her five minutes. Five minutes in which she does not speak to anyone, does not lift a phone, does not ask a question. Just her, her reflection, and the beginning of something large.

What happens in those minutes cannot be written down. Sometimes she smiles. Sometimes a silent tear falls. Sometimes she laughs a brief laugh without knowing why. But in every case, she leaves that room slightly different from the woman who entered it.

Only from that moment do we begin to photograph. Because the truest portrait cannot be taken until the woman has first seen herself.$body$,

  '/photos/royal.jpeg',
  true,
  '2026-02-08 11:30:00+03'
),

-- ── 3. What Hands Remember ───────────────────────────────────────────────
(
  'what-hands-remember',
  'ما تحفظه الأيدي',
  'What Hands Remember',

  'قبل سنواتٍ من تعلّمِ التصوير، كنتُ أتعلّم الخياطة. علّمتني أصابعي ما لم تستطع الكتبُ أن تعلّمَه.',
  'Years before I learned photography, I learned to sew. My fingers taught me what no book ever could.',

  $body$حين أُمسكُ كاميرتي، تتذكّر يدايَ شيئاً قديماً. لقد بدأَتا بإبرةٍ وخيط — لا بعدسة. تعلّمتُ من جدّتي كيف أُجعِّدُ قماشةَ ساتانٍ بلا أن أكسرَها. كيف أُخفي غرزةً خلف غرزة. كيف أُلطّفُ ضوءاً قاسياً بطبقةٍ من تول.

كلُّ ذلك يعود إليّ في الاستوديو. حين أقولُ للعروس: «ارفعي ذقنَكِ قليلاً»، لا أتحدّث كمصوّرة. أتحدّث كخيّاطةٍ ترى أنّ غرزةً واحدةً، إذا تحرّكت، تكشفُ جمالاً كان مخبوءاً.

أحياناً، قبل لقطة، أقتربُ منها وأُعدِّلُ تجعيدةً في الفستان. لا تُصوَّر الكاميرا تلك الحركة، لكنّها تظهر في الإطار النهائي. لأنّ ما يحدثُ في الثلاثين سنتيمتراً بين يدي والعدسة، يتسلّل دائماً إلى الصورة.

هذه يدٌ لا تتسرّع. لأنّها تعرف أنّ القماشة، إذا شُدَّت كثيراً، تفقدُ نَفَسَها — والمرأةُ كذلك.$body$,

  $body$When I hold my camera, my hands remember something old. They began with a needle and thread — not with a lens. My grandmother taught me how to crease a length of satin without breaking it. How to hide one stitch behind another. How to soften a harsh light beneath a layer of tulle.

All of that returns to me in the studio. When I tell a bride, "lift your chin, just slightly," I am not speaking as a photographer. I am speaking as a seamstress who can see that one fold, moved by a single degree, will reveal a beauty that was hiding.

Sometimes, before a frame, I step toward her and adjust a pleat in her gown. The camera does not record that gesture, but it shows up in the final image. Because what passes in the thirty centimetres between my hand and the lens always finds its way into the photograph.

These are hands that do not hurry. Because they know that a fabric, if pulled too tightly, loses its breath — and so does a woman.$body$,

  '/photos/signature.jpeg',
  true,
  '2026-03-02 09:15:00+03'
),

-- ── 4. The Pause Between Frames ──────────────────────────────────────────
(
  'the-pause-between-frames',
  'السكون بين اللقطات',
  'The Pause Between Frames',

  'ليست الصورةُ الجيّدة هي الأولى. ولا الثانية. إنّها التي تأتي بعد أن نسيتِ — للحظةٍ — أنّ هناك كاميرا.',
  'The good photograph is not the first. Nor the second. It is the one that arrives after you have forgotten — for a moment — that there is a camera at all.',

  $body$كثيراتٌ يسألنني: «كم صورةً نأخذ في الجلسة؟» السؤالُ الأهمُّ الذي لا يُسأل: كم لحظةَ صمتٍ ستكون بينها؟

الصورةُ التي ستُعلَّقُ في غرفتكِ، التي ستبقى في الألبوم لسنوات، لن تكون اللقطةَ المثاليّة من حيث الإضاءة فقط. ستكون اللقطةَ التي وقعتْ في لحظةٍ نسيتِ فيها كلَّ شيء: نسيتِ الكاميرا، نسيتِ الفستان، نسيتِ ما يجب أن تبدو عليه «العروس». ابتسمتِ لشيءٍ خاصٍّ بكِ وحدكِ.

تلك الابتسامةُ، أو تلك النظرةُ، لا تأتي بأمرٍ. تأتي حين تُقتنعينَ — في مكانٍ ما عميق — أنّكِ بأمان، وأنّ من أمامكِ لن يستعجلكِ، ولن يحكمَ عليكِ.

لذلك، في كلِّ جلسةٍ مع ATEMA، نُخصِّصُ وقتاً للسكون. للقهوةِ بين اللقطات. للحديثِ عن أمورٍ لا علاقةَ لها بالتصوير. لتلكَ الفسحاتِ التي تظنّينَ فيها أنّنا لا نعمل — بينما، في الحقيقة، نحن نعمل بأهمِّ ما يكون.$body$,

  $body$Many brides ask me, "how many frames will we take in the session?" The more important question, the one rarely asked: how many silences will lie between them?

The photograph that will hang in your home, that will live in the album for years, will not be the technically perfect frame. It will be the one that fell into a moment when you had forgotten everything — forgotten the camera, forgotten the gown, forgotten what a "bride" is supposed to look like. The one in which you smiled at something belonging only to you.

That smile, that gaze, never arrives on command. It comes only when you are convinced — somewhere deep — that you are safe, and that the person across from you will not rush you, and will not judge.

This is why every session at ATEMA includes time for stillness. For coffee between frames. For conversation about things that have nothing to do with photography. For those gaps in which you imagine we are not working — while, in truth, we are working at the very most important part.$body$,

  '/photos/engagement.jpeg',
  true,
  '2026-03-29 14:00:00+03'
),

-- ── 5. What Stays ────────────────────────────────────────────────────────
(
  'what-stays',
  'ما يبقى',
  'What Stays',

  'الصورةُ الرقميّةُ قد تختفي مع كلِّ هاتفٍ نُغيِّره. لكنّ ورقةً مطبوعةً بدقّةٍ، في صندوقٍ هادئ، تستطيع أن تعبرَ قرناً.',
  'A digital photograph may vanish with every phone we replace. But a sheet of archival paper, kept in a quiet box, can cross a century.',

  $body$أعرف أنّ معظم الصور اليوم تعيشُ في هواتفنا. وأعرف أنّ تلك الهواتف تُسرَق، أو تتعطّل، أو تُترَك في سيّارةِ أجرةٍ في الدمام. كم من ذكرى ضاعت بهذه الطريقة؟ لا أحد يحصيها.

لذلك، في ATEMA، نطبعُ. حتى للعميلات اللواتي لا يطلبنَ الطباعةَ، نُقدِّمُ صورتَين أرشيفيّتَين هديّةً مع كلِّ باقة. ورقُ هانيمول فاينارت ١٠٠٪ قطن، حِبرٌ يدوم ٢٠٠ سنة في ظروفٍ معتدلة، صندوقٌ مبطّنٌ يحمل العنوان والتاريخ.

لأنّ هناك سؤالاً واحداً تطرحه كلُّ امرأةٍ، في زاويةٍ ما من قلبها، حين تحجز جلسةً معنا: «ماذا ستتذكّرني ابنتي حين أكون رحلتُ؟»

نحن لا نُجيب على هذا السؤال بكلمات. نُجيب عليه بصندوقٍ، يُوضع في خزانةٍ، يفتحه أحدٌ ما — بعد عشرين سنة، أو خمسين — ويرى ما كنتِ عليه في يومٍ كان لكِ.

هذه ليست خدمةَ تصوير. هذه شهادةُ ميلادٍ لذكرى.$body$,

  $body$I know that most photographs today live in our phones. And I know those phones get stolen, or fail, or get left in the back of a Dammam taxi. How many memories have been lost this way? Nobody is counting.

This is why, at ATEMA, we print. Even for clients who do not request prints, we include two archival photographs as a gift with every package. Hahnemühle FineArt 100% cotton paper, ink rated to last 200 years under stable conditions, a lined box marked with the title and date.

Because there is one question every woman asks, in some corner of her heart, when she books a session with us: "what will my daughter remember of me when I am gone?"

We do not answer that question with words. We answer it with a box, placed in a cabinet, opened one day — twenty years from now, or fifty — by someone who sees who you were on a day that was yours.

This is not a photography service. It is a birth certificate, issued to a memory.$body$,

  '/photos/couture.jpeg',
  true,
  '2026-04-20 16:00:00+03'
),

-- ── 6. A Letter to the Bride ─────────────────────────────────────────────
(
  'a-letter-to-the-bride',
  'رسالة إلى العروس',
  'A Letter to the Bride',

  'في الأسبوع الذي يسبقُ زفافَكِ، قد تشعرين بأنّ كلَّ شيءٍ يحدثُ من حولك. هذه رسالةٌ لتذكيرِكِ: أنتِ في القلب.',
  'In the week before your wedding, you may feel that everything is happening around you. This letter is to remind you: you are at the centre.',

  $body$عزيزتي العروس،

في الأيّامِ القادمة، سيتحدّث الجميعُ من حولكِ عن «اليوم الكبير». سيُذكّرونكِ بالقاعة، بالضيوف، بترتيبِ الطاولات، بلونِ زهور الكوشة. سيتدفّق الكلامُ من كلِّ اتّجاه، وسيُطلب منكِ أن تأخذي قراراتٍ يجب أن تكون مهمّةً، وفي الحقيقة، ليست كذلك.

أرجو منكِ شيئاً صغيراً واحداً: خصِّصي خمسَ دقائق في صباح كلِّ يوم لنفسكِ. دون هاتف. دون قائمةِ مهام. دون أن يدخل أحدٌ الغرفة. تنفّسي. اشربي شيئاً دافئاً. تذكّري أنّ خلف كلِّ هذا الازدحام، هناك امرأةٌ — أنتِ — تستعدُّ لإحدى أجمل لحظاتِ حياتها.

في يومِ التصوير، حين تأتيننا، اتركي القائمةَ الطويلةَ خارج الباب. اتركيها. كلُّ من في الاستوديو يعرف ما عليه فِعله. كلُّ ما عليكِ أنتِ هو أن تكوني، ببساطة، في تلك الغرفة، بتلك الإضاءة، في ذلك الفستان. الباقي علينا.

وحين تنظرين، يوماً، إلى صورِ ذلك اليوم، لن تتذكّري ترتيبَ الطاولات، ولن تتذكّري لونَ الزهور بدقّة. ستتذكّرين كيف شعرتِ. هذا هو ما نحاول، في كلِّ ما نفعله، أن نحفظَه.

بكلِّ الودّ،
استوديو ATEMA$body$,

  $body$Dear bride,

In the days ahead, everyone around you will be speaking about "the big day." They will remind you about the hall, the guests, the seating arrangement, the colour of the kosha's flowers. Words will flow in from every direction, and you will be asked to make decisions that are supposed to feel important — but really, are not.

Allow me one small request: set aside five minutes each morning for yourself. No phone. No checklist. No one entering the room. Breathe. Drink something warm. Remember that behind all this commotion, there is a woman — you — preparing for one of the most beautiful moments of her life.

On the day of the session, when you come to us, leave the long list outside the door. Leave it. Everyone in the studio knows what they need to do. Your only task is to be, simply, in that room, in that light, in that gown. The rest is on us.

And when you look back, one day, at the photographs of that day — you will not recall the table arrangement, nor the precise hue of the flowers. You will remember how you felt. That, in everything we do, is what we are trying to preserve.

With all our warmth,
ATEMA Studio$body$,

  '/photos/classic.jpeg',
  true,
  '2026-05-10 08:45:00+03'
)

on conflict (slug) do update set
  title_ar     = excluded.title_ar,
  title_en     = excluded.title_en,
  excerpt_ar   = excluded.excerpt_ar,
  excerpt_en   = excluded.excerpt_en,
  body_ar      = excluded.body_ar,
  body_en      = excluded.body_en,
  cover_url    = excluded.cover_url,
  published    = excluded.published,
  published_at = excluded.published_at;

-- ─── Verify ─────────────────────────────────────────────────────────────
select '— Journal posts seeded —' as section;
select slug, title_ar, title_en, published, published_at
  from public.journal_posts
 order by published_at desc;


