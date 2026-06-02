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
