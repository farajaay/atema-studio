-- ATEMA STUDIO — Album example mockups (July 2026).
--
-- The owner produced photographic mockup sheets for every cover skin:
-- a finished square album per code, and the luxury presentation box per
-- code. They were cut into per-code tiles under public/photos/album/:
--   <CODE>-album.jpg/.webp   the finished album, marble backdrop
--   <CODE>-box.jpg/.webp     the presentation box with album + USB
--
-- This migration points the palette at them. The customer selection page
-- (/#/album/<token>) renders example_url (and box_url) when a cover is
-- picked; when absent (admin-added custom colours) it falls back to the
-- CSS-composed book mock (src/components/AlbumCoverExample.tsx).
--
-- Idempotent — safe to re-run. Run after migrations-2026-07-album.sql.

alter table public.album_designs add column if not exists example_url text;
alter table public.album_designs add column if not exists box_url     text;

update public.album_designs set
  example_url = '/photos/album/' || code || '-album.jpg',
  box_url     = '/photos/album/' || code || '-box.jpg'
where code in ('NERO','E639','E640','E641','E643','E644','E651','E654',
               'F334','F335','F336','F338','F341','F350','F355','F356','F357','F358');
