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
