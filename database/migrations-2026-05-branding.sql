-- ATEMA STUDIO — Branding / Editorial Phase migration (May 2026)
-- Adds: app_settings.theme · portfolio_items · journal_posts
--       + Storage buckets `portfolio` and `journal` with public read.

-- ─────────────────────────────────────────────────────────────────────
-- 1) Theme column on app_settings
-- ─────────────────────────────────────────────────────────────────────
alter table public.app_settings
  add column if not exists theme text not null default 'noir'
  check (theme in ('noir', 'ivory'));

-- ─────────────────────────────────────────────────────────────────────
-- 2) Portfolio items
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  title_ar    text not null,
  title_en    text not null,
  category    text not null check (category in ('bride','family','maternity','couture','editorial')),
  image_url   text not null,
  caption_ar  text,
  caption_en  text,
  sort_order  integer not null default 100,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists portfolio_items_published_sort_idx
  on public.portfolio_items (published, sort_order, created_at desc);

alter table public.portfolio_items enable row level security;

-- Public can read only published rows
drop policy if exists "portfolio_public_read" on public.portfolio_items;
create policy "portfolio_public_read"
  on public.portfolio_items
  for select to anon, authenticated
  using (published = true);

-- Admins (authenticated) can do everything. Tighten further later via custom claims if needed.
drop policy if exists "portfolio_admin_all" on public.portfolio_items;
create policy "portfolio_admin_all"
  on public.portfolio_items
  for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────
-- 3) Journal posts
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.journal_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title_ar      text not null,
  title_en      text not null,
  excerpt_ar    text not null default '',
  excerpt_en    text not null default '',
  body_ar       text not null default '',
  body_en       text not null default '',
  cover_url     text not null default '',
  published     boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists journal_posts_published_idx
  on public.journal_posts (published, published_at desc nulls last);

create index if not exists journal_posts_slug_idx
  on public.journal_posts (slug);

alter table public.journal_posts enable row level security;

drop policy if exists "journal_public_read" on public.journal_posts;
create policy "journal_public_read"
  on public.journal_posts
  for select to anon, authenticated
  using (published = true);

drop policy if exists "journal_admin_all" on public.journal_posts;
create policy "journal_admin_all"
  on public.journal_posts
  for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────
-- 4) Storage buckets
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('journal', 'journal', true)
on conflict (id) do update set public = true;

-- Storage policies
-- Public read for both buckets (already public, but explicit policies for clarity).
drop policy if exists "portfolio_storage_public_read" on storage.objects;
create policy "portfolio_storage_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "journal_storage_public_read" on storage.objects;
create policy "journal_storage_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'journal');

-- Admin (authenticated) write access for both.
drop policy if exists "portfolio_storage_admin_write" on storage.objects;
create policy "portfolio_storage_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio');

drop policy if exists "portfolio_storage_admin_update" on storage.objects;
create policy "portfolio_storage_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio') with check (bucket_id = 'portfolio');

drop policy if exists "portfolio_storage_admin_delete" on storage.objects;
create policy "portfolio_storage_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "journal_storage_admin_write" on storage.objects;
create policy "journal_storage_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'journal');

drop policy if exists "journal_storage_admin_update" on storage.objects;
create policy "journal_storage_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'journal') with check (bucket_id = 'journal');

drop policy if exists "journal_storage_admin_delete" on storage.objects;
create policy "journal_storage_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'journal');
