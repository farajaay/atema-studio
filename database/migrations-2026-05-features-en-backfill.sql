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
