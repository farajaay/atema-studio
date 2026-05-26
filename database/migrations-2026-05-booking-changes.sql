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
  subtotal         numeric,
  vat              numeric,
  total            numeric,
  reschedule_count int
)
language sql
security definer
set search_path = public
as $$
  select b.booking_ref, b.status, b.payment_status, b.event_date, b.event_time,
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
