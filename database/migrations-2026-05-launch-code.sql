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
