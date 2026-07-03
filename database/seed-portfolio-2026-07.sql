-- ATEMA STUDIO — Portfolio additions (July 2026)
--
-- Adds 7 couture bridal editorials (owner upload, optimised into
-- public/photos/ as IMG_2536/2561/2626/2637/2646/3688/3715). These enter
-- the portfolio_items pool, which powers BOTH the public portfolio grid
-- AND the Mood Board composer (it auto-selects from portfolio_items).
--
-- IMPORTANT — this seed is ADDITIVE and IDEMPOTENT by design:
--   • It does NOT run the `delete ... where image_url like '/photos/%'`
--     that seed-portfolio-2026-05-expanded.sql uses, so it never wipes the
--     existing catalogue.
--   • Each row is guarded by `not exists (… image_url …)`, so re-running is
--     a no-op and it can't create duplicates or clobber a row whose caption
--     was later edited live in the admin panel.
--
-- Safe to run any time in the Supabase SQL editor. (The migrations workflow
-- is currently disabled at the owner's request, so apply this manually.)

insert into public.portfolio_items
  (title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
select v.title_ar, v.title_en, v.category, v.image_url, v.caption_ar, v.caption_en, v.sort_order, v.published
from (values
  ('وشاحٌ من ضوء', 'A veil of light',
   'editorial', '/photos/IMG_2536.JPG',
   'البشرةُ تلتقطُ الصباح، والدانتيل يذوبُ في الضوء كأنه غيمة.',
   'Skin catches the morning, and the lace dissolves into light like a passing cloud.',
   122, true),

  ('الفستانُ تحت القوس', 'The gown beneath the arch',
   'couture', '/photos/IMG_2561.JPG',
   'كلُّ زهرةٍ مطرّزةٍ بخيطٍ من صبر — تفصيلٌ لا يُرى إلا عن قرب.',
   'Every embroidered flower stitched with a thread of patience — a detail seen only up close.',
   124, true),

  ('ابتسامةٌ قبل الموعد', 'A smile before the hour',
   'bride', '/photos/IMG_2626.JPG',
   'قبل أن يبدأ المساء، لحظةٌ من فرحٍ خالصٍ لا تُمثَّل.',
   'Before the evening begins, a moment of pure, unrehearsed joy.',
   126, true),

  ('الملمح الجانبي', 'The profile',
   'couture', '/photos/IMG_2637.JPG',
   'رأسٌ مرفوعٌ بثقةٍ هادئة، وخصلةٌ تنسابُ كخطٍّ من حرير.',
   'A head held with quiet confidence, a curl falling like a line of silk.',
   128, true),

  ('الرموشُ حين تهدأ', 'When the lashes rest',
   'editorial', '/photos/IMG_2646.JPG',
   'الكحلُ، والقرطُ الماسيّ، والخدُّ المُضاء — لغةُ الوجهِ في سكونها.',
   'Kohl, a diamond drop, an illuminated cheek — the language of the face in its stillness.',
   130, true),

  ('لمسةُ الماس', 'The touch of diamond',
   'editorial', '/photos/IMG_3688.JPG',
   'أناملُ تُلامسُ القرط، كأنها تتحقّقُ من أنّ الحلمَ حقيقي.',
   'Fingertips brush the earring, as if making sure the dream is real.',
   132, true),

  ('النظرةُ الأخيرة قبل الإطلال', 'The last look before the entrance',
   'bride', '/photos/IMG_3715.JPG',
   'يدٌ على القلب، ونظرةٌ ثابتة — استعدادٌ صامتٌ للحظةٍ لا تتكرّر.',
   'A hand at the heart, a steady gaze — a silent readiness for a moment that comes only once.',
   134, true)
) as v(title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
where not exists (
  select 1 from public.portfolio_items p where p.image_url = v.image_url
);

-- ─── Verify ─────────────────────────────────────────────────────────────
select '— July 2026 portfolio additions —' as section;
select sort_order, category, title_en, image_url
  from public.portfolio_items
 where image_url in (
   '/photos/IMG_2536.JPG','/photos/IMG_2561.JPG','/photos/IMG_2626.JPG',
   '/photos/IMG_2637.JPG','/photos/IMG_2646.JPG','/photos/IMG_3688.JPG',
   '/photos/IMG_3715.JPG')
 order by sort_order;
