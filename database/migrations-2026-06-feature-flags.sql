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
