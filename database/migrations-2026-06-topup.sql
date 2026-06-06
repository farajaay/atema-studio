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
