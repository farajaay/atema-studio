-- ATEMA STUDIO - Gallery image refresh (July 2026)
--
-- The public Portfolio and Journal pages read Supabase rows, not the
-- filesystem. This migration repoints the seeded rows at the stronger July
-- optimized photo pool. It only touches rows whose current media lives under
-- /photos/, leaving admin uploads in Supabase Storage untouched.

with portfolio_refresh(sort_order, category, image_url) as (
  values
    (10, 'bride',     '/photos/IMG_3866 copy.optimised.jpg'),
    (12, 'bride',     '/photos/IMG_3864 copy.optimised.jpg'),
    (14, 'bride',     '/photos/IMG_3812 copy.optimised.jpg'),
    (16, 'bride',     '/photos/IMG_3802 copy.optimised.jpg'),
    (18, 'bride',     '/photos/IMG_3835 copy.optimised.jpg'),
    (20, 'bride',     '/photos/IMG_3534 copy.optimised.jpg'),
    (22, 'bride',     '/photos/IMG_3688 copy1.optimised.jpg'),
    (24, 'bride',     '/photos/IMG_3597 copy.optimised.jpg'),
    (26, 'bride',     '/photos/IMG_3514 copy.optimised.jpg'),
    (28, 'bride',     '/photos/IMG_3678 copy.optimised.jpg'),
    (30, 'bride',     '/photos/IMG_3515 copy.optimised.jpg'),
    (32, 'bride',     '/photos/IMG_2637.optimised.jpg'),
    (34, 'bride',     '/photos/IMG_3715 copy1.optimised.jpg'),
    (36, 'bride',     '/photos/IMG_2591.optimised.jpg'),
    (38, 'bride',     '/photos/IMG_2526.optimised.jpg'),
    (40, 'bride',     '/photos/IMG_2561.optimised.jpg'),
    (42, 'bride',     '/photos/IMG_2626.optimised.jpg'),
    (50, 'couture',   '/photos/IMG_4237.optimised.jpg'),
    (52, 'couture',   '/photos/IMG_2592.optimised.jpg'),
    (54, 'couture',   '/photos/IMG_3329.optimised.jpg'),
    (56, 'couture',   '/photos/17BB76E6-8297-4355-843B-1A1E2264B3C5.optimised.jpg'),
    (70, 'editorial', '/photos/photo-output-1.optimised.jpg'),
    (72, 'editorial', '/photos/photo-output-2.optimised.jpg')
)
update public.portfolio_items as item
   set image_url = refresh.image_url,
       category = refresh.category
  from portfolio_refresh as refresh
 where item.sort_order = refresh.sort_order
   and item.image_url like '/photos/%';

with journal_refresh(slug, cover_url) as (
  values
    ('on-light', '/photos/IMG_3534 copy.optimised.jpg'),
    ('the-first-look', '/photos/IMG_3866 copy.optimised.jpg'),
    ('what-hands-remember', '/photos/IMG_3567 copy.optimised.jpg'),
    ('the-pause-between-frames', '/photos/IMG_3715 copy1.optimised.jpg'),
    ('what-stays', '/photos/signature.optimised.jpg'),
    ('a-letter-to-the-bride', '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.optimised.jpg'),
    ('keeper-of-memory', '/photos/ECF730D9-58C1-4F62-B8A2-4BF599422C21.optimised.jpg'),
    ('lens-changed-the-world', '/photos/photo-output-2.optimised.jpg')
)
update public.journal_posts as post
   set cover_url = refresh.cover_url
  from journal_refresh as refresh
 where post.slug = refresh.slug
   and (post.cover_url = '' or post.cover_url like '/photos/%');

select sort_order, category, title_en, image_url
  from public.portfolio_items
 where image_url like '/photos/%'
 order by sort_order;

select slug, cover_url
  from public.journal_posts
 where slug in (
   'on-light',
   'the-first-look',
   'what-hands-remember',
   'the-pause-between-frames',
   'what-stays',
   'a-letter-to-the-bride',
   'keeper-of-memory',
   'lens-changed-the-world'
 )
 order by published_at desc;
