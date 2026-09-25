-- ATEMA STUDIO — 2026-09 «عربون مدفوع» payment state
--
-- Until now `payment_status = 'paid'` silently meant "the 50% deposit
-- arrived". The admin dropdown offered only unpaid / paid / refunded, so a
-- deposit-only booking had to be marked «مدفوع», and the dashboard's
-- «الإيرادات المحصلة» card then counted the booking's FULL total as cash in
-- hand — overstating collections by roughly half on every such booking.
--
-- This adds a fifth state:
--   deposit_paid  — deposit received, balance still owed   (عربون مدفوع)
--   paid          — paid in full                           (مدفوع بالكامل)
--
-- Existing 'paid' rows are deliberately NOT rewritten: some really are paid
-- in full and a blanket rewrite would be wrong for those. The owner re-marks
-- the deposit-only ones by hand from the booking modal.
--
-- The policy (collected / outstanding / next state) lives in
-- supabase/functions/_shared/payments.ts. The Edge Functions that set a
-- payment state fall back to 'paid' if this migration hasn't run yet, so
-- apply order doesn't matter.
--
-- Idempotent — safe to re-run.

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in ('unpaid','awaiting_transfer','deposit_paid','paid','refunded'));

-- Verification: distribution of payment states.
select payment_status, count(*) as rows
from   public.bookings
group  by payment_status
order  by payment_status;
