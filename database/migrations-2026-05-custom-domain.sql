-- ATEMA STUDIO — Custom-domain path migration.
-- Run ONCE after switching from farajaay.github.io/atema-studio/ to
-- the custom domain atemastudio.xyz.
--
-- The cutover changes the site's BASE_URL from "/atema-studio/" to "/".
-- Any cover_url / image_url rows that were seeded against the old base
-- need to be rewritten so the assets resolve under the new root.

-- ─── Journal posts ──────────────────────────────────────────────────────
update public.journal_posts
   set cover_url = replace(cover_url, '/atema-studio/photos/', '/photos/')
 where cover_url like '/atema-studio/photos/%';

-- ─── Portfolio items ────────────────────────────────────────────────────
update public.portfolio_items
   set image_url = replace(image_url, '/atema-studio/photos/', '/photos/')
 where image_url like '/atema-studio/photos/%';

-- ─── Verify ─────────────────────────────────────────────────────────────
select '— Journal covers —' as section;
select slug, cover_url from public.journal_posts order by published_at desc;
select '— Portfolio covers —' as section;
select id, image_url from public.portfolio_items order by sort_order;
