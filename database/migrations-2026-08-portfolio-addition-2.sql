-- ATEMA STUDIO — Portfolio addition #2 (August 2026)
--
-- Five more frames from the same bridal session as
-- migrations-2026-08-portfolio-addition.sql. From the wider upload batch,
-- 4 files were skipped as duplicates (2 exact re-uploads of already-seeded
-- photos, 1 exact re-upload of an already-processed film clip, 1 near-
-- duplicate burst frame of another shot in the same batch), and 2 more were
-- skipped as lower-resolution social re-exports (1080x1080, already
-- re-compressed) of a pose already covered at full camera resolution — see
-- session notes. Only the five distinct, full-resolution frames are seeded.
--
-- SAFE + IDEMPOTENT: guarded by NOT EXISTS on image_url, so re-running
-- this file is a no-op after the first apply.

insert into public.portfolio_items
  (title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
select * from (values
  ('عباءةٌ من الحرير الدافئ', 'A drape of warm silk',
   'bride',
   '/photos/bridal-portrait-drape.optimised.jpg',
   'الفستان ينسدل كالضوء، والوقفة وحدها تكفي لتروي حكاية الأناقة.',
   'The gown falls like light, and the stance alone is enough to tell the story of elegance.',
   78, true),

  ('ابتسامةٌ تحت الألماس', 'A smile beneath the diamonds',
   'bride',
   '/photos/bridal-portrait-smile.optimised.jpg',
   'لمسةٌ من الرضا في الملامح، وقرطٌ يلمعُ كأنه يشاركها الفرحة.',
   'A trace of quiet joy in her expression, an earring catching the light as if sharing in it.',
   80, true),

  ('قبلةٌ للباقة', 'A kiss for the bouquet',
   'bride',
   '/photos/bridal-portrait-bouquet-kiss.optimised.jpg',
   'أناملها تقتربُ من الزهر، وعيناها تُغمضان على لحظةٍ لا تُنسى.',
   'Her fingertips drift toward the bloom, eyes closing on a moment she means to keep.',
   82, true),

  ('همسةٌ بين الزهور', 'A hush among the flowers',
   'bride',
   '/photos/bridal-portrait-bouquet-hush.optimised.jpg',
   'سكونٌ رقيق، وخاتمٌ ماسيّ يلمعُ عند شفتيها كوعدٍ صامت.',
   'A tender stillness, a diamond ring catching the light near her lips like a silent promise.',
   84, true),

  ('نظرةٌ فوق الباقة البيضاء', 'A glance above the white bouquet',
   'bride',
   '/photos/bridal-portrait-bouquet-glance.optimised.jpg',
   'تنظرُ إلى الكاميرا بثقةٍ هادئة، والفاوانيا البيضاء تحيط بها كإطارٍ من الحرير.',
   'She meets the camera with quiet confidence, white peonies framing her like a border of silk.',
   86, true)
) as new_rows(title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
where not exists (
  select 1 from public.portfolio_items existing
   where existing.image_url = new_rows.image_url
);

-- ── Verify ─────────────────────────────────────────────────────────────
select '— August 2026 portfolio addition #2 —' as section;
select sort_order, category, title_en, image_url
  from public.portfolio_items
 where image_url in (
   '/photos/bridal-portrait-drape.optimised.jpg',
   '/photos/bridal-portrait-smile.optimised.jpg',
   '/photos/bridal-portrait-bouquet-kiss.optimised.jpg',
   '/photos/bridal-portrait-bouquet-hush.optimised.jpg',
   '/photos/bridal-portrait-bouquet-glance.optimised.jpg')
 order by sort_order;
