-- ATEMA STUDIO — Portfolio refresh (July 2026)
--
-- Owner uploaded 7 couture bridal editorials (optimised into public/photos/
-- as IMG_2536/2561/2626/2637/2646/3688/3715).
--
-- The portfolio grid was repeating the six PACKAGE-CARD hero photos
-- (B6B52466, Untitled-3, IMG_5620, IMG_5607, IMG_5525, IMG_5623) — so the
-- same images showed on both the /book cards and the /portfolio gallery.
-- This file SWAPS those six duplicated portfolio rows to six of the new
-- photos (keeping each row's grid position / sort_order), then adds the
-- 7th new photo as a fresh item. Net effect: the gallery is refreshed and
-- no longer duplicates the package cards; the six old files stay in the
-- repo and remain the package-card heroes.
--
-- SAFE + IDEMPOTENT:
--   • Each UPDATE is keyed on the OLD image_url, so a second run is a no-op
--     (the old URL no longer exists after the first run).
--   • It only touches those six specific rows plus one guarded INSERT —
--     it does NOT delete/rebuild the table, so it can't disturb any other
--     portfolio row or an admin-uploaded item (those use Storage URLs).
--
-- Apply manually in the Supabase SQL editor (the migrations workflow is
-- disabled at the owner's request).

-- ── 1. Swap the six cross-page duplicates for new photos ────────────────

update public.portfolio_items set
  image_url = '/photos/IMG_2536.JPG', category = 'editorial',
  title_ar = 'وشاحٌ من ضوء', title_en = 'A veil of light',
  caption_ar = 'البشرةُ تلتقطُ الصباح، والدانتيل يذوبُ في الضوء كأنه غيمة.',
  caption_en = 'Skin catches the morning, and the lace dissolves into light like a passing cloud.'
where image_url = '/photos/B6B52466-B962-4C33-804E-135D26C25236.JPG';

update public.portfolio_items set
  image_url = '/photos/IMG_2561.JPG', category = 'couture',
  title_ar = 'الفستانُ تحت القوس', title_en = 'The gown beneath the arch',
  caption_ar = 'كلُّ زهرةٍ مطرّزةٍ بخيطٍ من صبر — تفصيلٌ لا يُرى إلا عن قرب.',
  caption_en = 'Every embroidered flower stitched with a thread of patience — a detail seen only up close.'
where image_url = '/photos/IMG_5623.JPG';

update public.portfolio_items set
  image_url = '/photos/IMG_2626.JPG', category = 'bride',
  title_ar = 'ابتسامةٌ قبل الموعد', title_en = 'A smile before the hour',
  caption_ar = 'قبل أن يبدأ المساء، لحظةٌ من فرحٍ خالصٍ لا تُمثَّل.',
  caption_en = 'Before the evening begins, a moment of pure, unrehearsed joy.'
where image_url = '/photos/Untitled-3.JPG';

update public.portfolio_items set
  image_url = '/photos/IMG_2637.JPG', category = 'couture',
  title_ar = 'الملمح الجانبي', title_en = 'The profile',
  caption_ar = 'رأسٌ مرفوعٌ بثقةٍ هادئة، وخصلةٌ تنسابُ كخطٍّ من حرير.',
  caption_en = 'A head held with quiet confidence, a curl falling like a line of silk.'
where image_url = '/photos/IMG_5607.JPG';

update public.portfolio_items set
  image_url = '/photos/IMG_2646.JPG', category = 'editorial',
  title_ar = 'الرموشُ حين تهدأ', title_en = 'When the lashes rest',
  caption_ar = 'الكحلُ، والقرطُ الماسيّ، والخدُّ المُضاء — لغةُ الوجهِ في سكونها.',
  caption_en = 'Kohl, a diamond drop, an illuminated cheek — the language of the face in its stillness.'
where image_url = '/photos/IMG_5620.JPG';

update public.portfolio_items set
  image_url = '/photos/IMG_3688.JPG', category = 'editorial',
  title_ar = 'لمسةُ الماس', title_en = 'The touch of diamond',
  caption_ar = 'أناملُ تُلامسُ القرط، كأنها تتحقّقُ من أنّ الحلمَ حقيقي.',
  caption_en = 'Fingertips brush the earring, as if making sure the dream is real.'
where image_url = '/photos/IMG_5525.JPG';

-- ── 2. Add the 7th new photo as a fresh portfolio item ──────────────────

insert into public.portfolio_items
  (title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
select v.title_ar, v.title_en, v.category, v.image_url, v.caption_ar, v.caption_en, v.sort_order, v.published
from (values
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
select '— July 2026 portfolio refresh —' as section;
select sort_order, category, title_en, image_url
  from public.portfolio_items
 where image_url in (
   '/photos/IMG_2536.JPG','/photos/IMG_2561.JPG','/photos/IMG_2626.JPG',
   '/photos/IMG_2637.JPG','/photos/IMG_2646.JPG','/photos/IMG_3688.JPG',
   '/photos/IMG_3715.JPG')
 order by sort_order;
