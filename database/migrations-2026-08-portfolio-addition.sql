-- ATEMA STUDIO — Portfolio addition (August 2026)
--
-- Adds 2 new bridal portraits from a fresh studio session: an off-shoulder
-- ivory gown, diamond drop earrings, and a hand-tied bouquet of white
-- peonies and ranunculus. A third frame from the same set was a near
-- duplicate of one already kept (same pose, same beat) and was skipped —
-- see the session notes; only the two visually distinct frames are seeded.
--
-- SAFE + IDEMPOTENT: guarded by NOT EXISTS on image_url, so re-running
-- this file is a no-op after the first apply.

insert into public.portfolio_items
  (title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
select * from (values
  ('نظرةٌ فوق باقةٍ من الفاوانيا', 'A gaze above the peonies',
   'bride',
   '/photos/bridal-portrait-gaze.optimised.jpg',
   'الماسُ يلمعُ عند الذقن، والباقةُ البيضاءُ تحملُ عبق اللحظة قبل أن تُقال.',
   'Diamonds catch the light at her chin, and a white bouquet holds the scent of a moment not yet spoken.',
   74, true),

  ('سكونٌ بين الحرير والزهر', 'Stillness between silk and bloom',
   'bride',
   '/photos/bridal-portrait-repose.optimised.jpg',
   'كتفٌ عاجيّ، وأناملُ ترتاحُ قرب الجبين — جمالٌ لا يستعجل أحدا.',
   'An ivory shoulder, fingertips resting near the brow — a beauty that hurries for no one.',
   76, true)
) as new_rows(title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
where not exists (
  select 1 from public.portfolio_items existing
   where existing.image_url = new_rows.image_url
);

-- ── Verify ─────────────────────────────────────────────────────────────
select '— August 2026 portfolio addition —' as section;
select sort_order, category, title_en, image_url
  from public.portfolio_items
 where image_url in ('/photos/bridal-portrait-gaze.optimised.jpg', '/photos/bridal-portrait-repose.optimised.jpg')
 order by sort_order;
