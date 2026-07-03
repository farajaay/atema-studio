-- ATEMA STUDIO - Gallery image refresh (July 2026)
--
-- The public Portfolio and Journal pages read Supabase rows, not the
-- filesystem. This migration repoints the seeded rows at the stronger July
-- optimized photo pool. It only touches rows whose current media lives under
-- /photos/, leaving admin uploads in Supabase Storage untouched.

with portfolio_refresh(sort_order, category, image_url, legacy_urls) as (
  values
    (10, 'bride',     '/photos/IMG_3866 copy.optimised.jpg', array['/photos/bride-hero.jpeg', '/photos/bride-hero.optimised.jpg']),
    (12, 'bride',     '/photos/IMG_3864 copy.optimised.jpg', array['/photos/IMG_0259.JPG', '/photos/IMG_0259.optimised.jpg']),
    (14, 'bride',     '/photos/IMG_3812 copy.optimised.jpg', array['/photos/5B05CBF2-9106-4FF8-A00A-2D3DAD8693B7.JPG', '/photos/5B05CBF2-9106-4FF8-A00A-2D3DAD8693B7.optimised.jpg']),
    (16, 'bride',     '/photos/IMG_3802 copy.optimised.jpg', array['/photos/60FBEE21-EB43-4CFA-AEC2-D73D206E5016.JPG', '/photos/60FBEE21-EB43-4CFA-AEC2-D73D206E5016.optimised.jpg']),
    (18, 'bride',     '/photos/IMG_3835 copy.optimised.jpg', array['/photos/B6B52466-B962-4C33-804E-135D26C25236.JPG', '/photos/B6B52466-B962-4C33-804E-135D26C25236.optimised.jpg', '/photos/IMG_2536.optimised.jpg']),
    (20, 'bride',     '/photos/IMG_3534 copy.optimised.jpg', array['/photos/engagement.jpeg', '/photos/engagement.optimised.jpg', '/photos/3F59C309-D72A-466A-9405-116DE58F69B5.JPG', '/photos/3F59C309-D72A-466A-9405-116DE58F69B5.optimised.jpg']),
    (22, 'bride',     '/photos/IMG_3688 copy1.optimised.jpg', array['/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.JPG', '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.optimised.jpg']),
    (24, 'bride',     '/photos/IMG_3597 copy.optimised.jpg', array['/photos/7CC155A1-8BFC-49B7-ADC2-CF8346A3E535.JPG', '/photos/7CC155A1-8BFC-49B7-ADC2-CF8346A3E535.optimised.jpg']),
    (26, 'bride',     '/photos/IMG_3514 copy.optimised.jpg', array['/photos/IMG_5506.JPG', '/photos/IMG_5506.optimised.jpg']),
    (28, 'bride',     '/photos/IMG_3678 copy.optimised.jpg', array['/photos/IMG_5525.JPG', '/photos/IMG_5525.optimised.jpg', '/photos/IMG_3688.optimised.jpg']),
    (30, 'bride',     '/photos/IMG_3515 copy.optimised.jpg', array['/photos/IMG_5538.JPG', '/photos/IMG_5538.optimised.jpg']),
    (32, 'bride',     '/photos/IMG_2637.optimised.jpg', array['/photos/IMG_5607.JPG', '/photos/IMG_5607.optimised.jpg', '/photos/IMG_2637.optimised.jpg']),
    (34, 'bride',     '/photos/IMG_3715 copy1.optimised.jpg', array['/photos/IMG_5620.JPG', '/photos/IMG_5620.optimised.jpg', '/photos/IMG_2646.optimised.jpg']),
    (36, 'bride',     '/photos/IMG_2591.optimised.jpg', array['/photos/IMG_5623.JPG', '/photos/IMG_5623.optimised.jpg', '/photos/IMG_2561.optimised.jpg']),
    (38, 'bride',     '/photos/IMG_2526.optimised.jpg', array['/photos/Untitled-1jpg.JPG', '/photos/Untitled-1jpg.optimised.jpg']),
    (40, 'bride',     '/photos/IMG_2561.optimised.jpg', array['/photos/signature.jpeg', '/photos/signature.optimised.jpg', '/photos/Untitled-2.JPG', '/photos/Untitled-2.optimised.jpg']),
    (42, 'bride',     '/photos/IMG_2626.optimised.jpg', array['/photos/Untitled-3.JPG', '/photos/Untitled-3.optimised.jpg', '/photos/IMG_2626.optimised.jpg']),
    (50, 'couture',   '/photos/IMG_4237.optimised.jpg', array['/photos/royal.jpeg', '/photos/royal.optimised.jpg', '/photos/IMG_4237.JPG', '/photos/IMG_4237.optimised.jpg']),
    (52, 'couture',   '/photos/IMG_2592.optimised.jpg', array['/photos/65DD9322-629B-46FB-AF4A-A0F848A6FF68.JPG', '/photos/65DD9322-629B-46FB-AF4A-A0F848A6FF68.optimised.jpg']),
    (54, 'couture',   '/photos/IMG_3329.optimised.jpg', array['/photos/IMG_3329.JPG', '/photos/IMG_3329.optimised.jpg']),
    (56, 'couture',   '/photos/17BB76E6-8297-4355-843B-1A1E2264B3C5.optimised.jpg', array['/photos/17BB76E6-8297-4355-843B-1A1E2264B3C5.JPG', '/photos/17BB76E6-8297-4355-843B-1A1E2264B3C5.optimised.jpg']),
    (70, 'editorial', '/photos/photo-output-1.optimised.jpg', array['/photos/customise.jpeg', '/photos/customise.optimised.jpg', '/photos/ECF730D9-58C1-4F62-B8A2-4BF599422C21.JPG', '/photos/ECF730D9-58C1-4F62-B8A2-4BF599422C21.optimised.jpg']),
    (72, 'editorial', '/photos/photo-output-2.optimised.jpg', array['/photos/B27F8308-42F1-41C1-9D28-93C67E00B026.JPG', '/photos/B27F8308-42F1-41C1-9D28-93C67E00B026.optimised.jpg'])
)
update public.portfolio_items as item
   set image_url = refresh.image_url,
       category = refresh.category
  from portfolio_refresh as refresh
 where item.sort_order = refresh.sort_order
   and item.image_url = any(refresh.legacy_urls);

with journal_refresh(slug, cover_url, legacy_urls) as (
  values
    ('on-light', '/photos/IMG_3534 copy.optimised.jpg', array['/photos/customise.jpeg', '/photos/customise.optimised.jpg', '/photos/IMG_2646.optimised.jpg']),
    ('the-first-look', '/photos/IMG_3866 copy.optimised.jpg', array['/photos/royal.jpeg', '/photos/royal.optimised.jpg', '/photos/IMG_2536.optimised.jpg']),
    ('what-hands-remember', '/photos/IMG_3567 copy.optimised.jpg', array['/photos/signature.jpeg', '/photos/signature.optimised.jpg', '/photos/IMG_3329.optimised.jpg']),
    ('the-pause-between-frames', '/photos/IMG_3715 copy1.optimised.jpg', array['/photos/engagement.jpeg', '/photos/engagement.optimised.jpg', '/photos/bride-hero.optimised.jpg']),
    ('what-stays', '/photos/signature.optimised.jpg', array['/photos/couture.jpeg', '/photos/couture.optimised.jpg', '/photos/signature.optimised.jpg']),
    ('a-letter-to-the-bride', '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.optimised.jpg', array['/photos/classic.jpeg', '/photos/classic.optimised.jpg', '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.optimised.jpg']),
    ('keeper-of-memory', '/photos/ECF730D9-58C1-4F62-B8A2-4BF599422C21.optimised.jpg', array['/photos/Untitled-2.JPG', '/photos/Untitled-2.optimised.jpg', '/photos/17BB76E6-8297-4355-843B-1A1E2264B3C5.optimised.jpg']),
    ('lens-changed-the-world', '/photos/photo-output-2.optimised.jpg', array['/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.JPG', '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.optimised.jpg', '/photos/ECF730D9-58C1-4F62-B8A2-4BF599422C21.optimised.jpg'])
)
update public.journal_posts as post
   set cover_url = refresh.cover_url
  from journal_refresh as refresh
 where post.slug = refresh.slug
   and (post.cover_url = '' or post.cover_url = any(refresh.legacy_urls));

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
