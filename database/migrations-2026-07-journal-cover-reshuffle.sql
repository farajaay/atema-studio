-- ATEMA STUDIO - Journal cover reshuffle (July 2026)
--
-- Refreshes the seeded journal covers to the optimized editorial photo set.
-- The WHERE guard protects any cover later uploaded through JournalManager
-- because those Supabase Storage URLs do not live under /photos/.

with reshuffle(slug, cover_url) as (
  values
    ('on-light', '/photos/IMG_2646.optimised.jpg'),
    ('the-first-look', '/photos/IMG_2536.optimised.jpg'),
    ('what-hands-remember', '/photos/IMG_3329.optimised.jpg'),
    ('the-pause-between-frames', '/photos/bride-hero.optimised.jpg'),
    ('what-stays', '/photos/signature.optimised.jpg'),
    ('a-letter-to-the-bride', '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.optimised.jpg'),
    ('keeper-of-memory', '/photos/17BB76E6-8297-4355-843B-1A1E2264B3C5.optimised.jpg'),
    ('lens-changed-the-world', '/photos/ECF730D9-58C1-4F62-B8A2-4BF599422C21.optimised.jpg')
)
update public.journal_posts as post
   set cover_url = reshuffle.cover_url
  from reshuffle
 where post.slug = reshuffle.slug
   and (post.cover_url = '' or post.cover_url like '/photos/%');

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
