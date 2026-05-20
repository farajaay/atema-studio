-- ATEMA STUDIO — Mood Board feature
--
-- A post-booking editorial "this is how we already see your day" surface that
-- Fatima composes from the admin panel and shares with the bride via a
-- private link. The page lives at /#/board/<token> and renders a curated
-- 6-image grid + a bilingual letter from the atelier.
--
-- Run AFTER:
--   database/schema.sql
--   database/migrations-2026-05.sql
--   database/migrations-2026-05-branding.sql

-- ── 1. mood_boards table ──────────────────────────────────────────────────
create table if not exists public.mood_boards (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  token        text not null unique,           -- 32 random base32 chars = 160 bits
  package_id   int  references public.packages(id),
  season       text check (season in ('spring','summer','autumn','winter')),
  image_urls   text[] not null,                -- 6 URLs in display order
  title_ar     text, title_en     text,
  caption_ar   text, caption_en   text,
  sent_at      timestamptz,                    -- when admin clicked "Send via WA"
  viewed_at    timestamptz,                    -- first time the bride opened the link
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create unique index if not exists mood_boards_booking_id_uniq on public.mood_boards(booking_id);
create index        if not exists mood_boards_token_idx       on public.mood_boards(token);

-- ── 2. updated_at trigger ────────────────────────────────────────────────
-- set_updated_at() is defined in schema.sql; reuse it.
drop trigger if exists mood_boards_updated_at on public.mood_boards;
create trigger mood_boards_updated_at
  before update on public.mood_boards
  for each row execute function set_updated_at();

-- ── 3. RLS ────────────────────────────────────────────────────────────────
alter table public.mood_boards enable row level security;

-- Public SELECT: the token IS the secret (160 bits unguessable).
drop policy if exists "Public select mood_boards" on public.mood_boards;
create policy "Public select mood_boards"
  on public.mood_boards for select
  using (true);

-- Authenticated (admin) full access.
drop policy if exists "Authenticated insert mood_boards" on public.mood_boards;
create policy "Authenticated insert mood_boards"
  on public.mood_boards for insert
  to authenticated with check (true);

drop policy if exists "Authenticated update mood_boards" on public.mood_boards;
create policy "Authenticated update mood_boards"
  on public.mood_boards for update
  to authenticated using (true);

drop policy if exists "Authenticated delete mood_boards" on public.mood_boards;
create policy "Authenticated delete mood_boards"
  on public.mood_boards for delete
  to authenticated using (true);

-- ── 4. RPC: mark a board as viewed (single-purpose anonymous write) ──────
-- The public can mark viewed_at via this SECURITY DEFINER function.
-- It only ever sets viewed_at on the row matching the supplied token, and
-- only if viewed_at is not already set — preventing replay overwrites.
create or replace function public.mark_mood_board_viewed(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mood_boards
     set viewed_at = now()
   where token = p_token
     and viewed_at is null;
end;
$$;

grant execute on function public.mark_mood_board_viewed(text) to anon, authenticated;

-- ── 5. Verify ─────────────────────────────────────────────────────────────
select '— Mood Board tables ready —' as section;
select tablename, rowsecurity from pg_tables where tablename = 'mood_boards';
