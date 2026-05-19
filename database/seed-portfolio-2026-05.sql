-- ATEMA STUDIO — Portfolio (Our Work / Atelier) seed
--
-- Features the new bride hero (bride-hero.jpeg / .webp) as the lead image
-- and uses the existing mood photography to populate the other categories
-- so the gallery feels curated from day one.
--
-- Safe to re-run: every row has a stable image_url, so we use ON CONFLICT
-- on a synthetic uniqueness key via DELETE-then-INSERT scoped to the
-- "seeded" set. Admin-added items (with their own UUIDs and URLs) are
-- untouched.
--
-- Run AFTER:
--   database/migrations-2026-05-branding.sql
--   database/migrations-2026-05-custom-domain.sql

-- ── 1. Wipe only the previously-seeded portfolio rows ─────────────────────
--    (Rows that point at /photos/<filename> from /public/photos/.)
--    Admin uploads go to Supabase Storage and have https://... image_urls,
--    so they're not touched.
delete from public.portfolio_items
 where image_url like '/photos/%';

-- ── 2. Seed the curated set ───────────────────────────────────────────────
insert into public.portfolio_items
  (title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
values

-- ─── BRIDE ──────────────────────────────────────────────────────────────
('عروسٌ تحت قوسٍ من الضوء', 'Bride beneath an arch of light',
 'bride',
 '/photos/bride-hero.jpeg',
 'لحظةٌ قبل الإطلال — حيث يصمت الجميع، ويتقدّم الضوء وحده.',
 'A moment before the entrance — when everyone falls silent, and only the light steps forward.',
 10, true),

('الفستان الذي يحفظ سرّها', 'The gown that keeps her secret',
 'bride',
 '/photos/engagement.jpeg',
 'تفاصيل الدانتيل تحكي قصّةً لم تُروَ بعد.',
 'A lace, telling a story not yet told.',
 20, true),

-- ─── COUTURE ──────────────────────────────────────────────────────────────
('كوتور — تجربةٌ كاملة', 'Couture — the full experience',
 'couture',
 '/photos/couture.jpeg',
 'الصندوقُ، الورقُ، الذكرى — كلُّها مصمّمةٌ باليد.',
 'The box, the paper, the memory — all of it shaped by hand.',
 30, true),

('باقة التوقيع', 'Signature',
 'couture',
 '/photos/signature.jpeg',
 'حين تستحقّ اللحظةُ خاتمها الخاص.',
 'When a moment deserves its own seal.',
 40, true),

('الباقة الملكية', 'Royal',
 'couture',
 '/photos/royal.jpeg',
 'فخامةٌ هادئة، لا تستعرض، بل تُهمس.',
 'A quiet kind of opulence — never showy, always whispered.',
 50, true),

-- ─── EDITORIAL ────────────────────────────────────────────────────────────
('كلاسيكيّة', 'Classic',
 'editorial',
 '/photos/classic.jpeg',
 'البساطةُ، حين تُؤدّى ببراعة، تصبحُ فخامة.',
 'Simplicity, performed well, becomes elegance.',
 60, true),

('مُخصَّصة', 'Customise',
 'editorial',
 '/photos/customise.jpeg',
 'كلّ صورةٍ، تُصاغُ على مقاسِ من تحملها.',
 'Each frame, cut to the measure of the woman who carries it.',
 70, true);

-- ── 3. Verify ─────────────────────────────────────────────────────────────
select '— Portfolio items seeded —' as section;
select sort_order, category, title_ar, title_en, image_url, published
  from public.portfolio_items
 order by sort_order;
