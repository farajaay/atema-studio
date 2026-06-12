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
