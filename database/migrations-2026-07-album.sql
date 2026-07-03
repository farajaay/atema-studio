-- ATEMA STUDIO — Post-event Album Selection (Phase 1)
--
-- The bride, after her event, opens a private link (/#/album/<token>) and
-- chooses one album COVER STYLE from a curated palette. The studio releases
-- the link manually and sees the choice in the admin booking modal.
--
-- Plan: docs/plans/album-selection.md. Mirrors the Mood Board capability-token
-- model (migrations-2026-05-moodboard.sql): token = secret, SECURITY DEFINER
-- RPCs for the anon read + the single anon write, no PII exposure.
--
-- Idempotent. Run AS service_role (Supabase SQL editor).

-- ── 1. album_designs — the curated cover palette (admin-managed) ──────────
create table if not exists public.album_designs (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,                 -- maker code: F334 / NERO / E643
  material     text not null check (material in ('fabric','leather')),
  texture      text not null default 'plain'
               check (texture in ('plain','linen','croc')),
  name_ar      text not null,
  name_en      text not null,
  blurb_ar     text,
  blurb_en     text,
  swatch_hex   text not null,                         -- rendered chip colour
  preview_url  text,                                  -- optional real photo later
  active       boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists album_designs_active_idx on public.album_designs(active, sort_order);

drop trigger if exists album_designs_updated_at on public.album_designs;
create trigger album_designs_updated_at
  before update on public.album_designs
  for each row execute function set_updated_at();

-- ── 2. bookings — album selection columns ────────────────────────────────
alter table public.bookings
  add column if not exists album_token       text,
  add column if not exists album_design_id   uuid references public.album_designs(id),
  add column if not exists album_note         text,
  add column if not exists album_selected_at  timestamptz,
  add column if not exists album_released_at  timestamptz;

-- Backfill a 160-bit token onto every existing booking + default for new rows.
update public.bookings
   set album_token = encode(gen_random_bytes(20), 'hex')
 where album_token is null;

alter table public.bookings
  alter column album_token set default encode(gen_random_bytes(20), 'hex');

create unique index if not exists bookings_album_token_uniq
  on public.bookings(album_token);

-- ── 3. RLS ────────────────────────────────────────────────────────────────
alter table public.album_designs enable row level security;

-- Palette is public (no PII) — anon may read ACTIVE designs only.
drop policy if exists "Public read active album_designs" on public.album_designs;
create policy "Public read active album_designs"
  on public.album_designs for select
  using (active = true);

-- Admin (authenticated) full access — including inactive rows.
drop policy if exists "Authenticated all album_designs" on public.album_designs;
create policy "Authenticated all album_designs"
  on public.album_designs for all
  to authenticated using (true) with check (true);

-- ── 4. RPC: read a booking's album state by token (anon-safe, no PII) ─────
-- Returns ONLY album status — never customer name/phone/email. The palette
-- itself is fetched separately from album_designs (public select above).
--   status: 'not_ready'  → event hasn't passed and studio hasn't released
--           'ready'      → open for selection, nothing chosen yet
--           'selected'   → a design is locked in
create or replace function public.get_album_selection_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  b  public.bookings%rowtype;
  is_open boolean;
begin
  select * into b from public.bookings where album_token = p_token;
  if not found then
    return json_build_object('status', 'not_found');
  end if;

  is_open := b.album_released_at is not null or b.event_date < current_date;

  if b.album_selected_at is not null then
    return json_build_object(
      'status', 'selected',
      'chosen_design_id', b.album_design_id,
      'note', b.album_note,
      'selected_at', b.album_selected_at
    );
  end if;

  if not is_open then
    return json_build_object('status', 'not_ready', 'event_date', b.event_date);
  end if;

  return json_build_object('status', 'ready', 'event_date', b.event_date);
end;
$$;

grant execute on function public.get_album_selection_by_token(text) to anon, authenticated;

-- ── 5. RPC: record the bride's choice (single-purpose anon write) ─────────
-- Enforces the time-gate and the "final once confirmed" rule server-side, and
-- validates the design is active. Touches only this row's album columns.
--   returns: 'ok' | 'not_found' | 'not_ready' | 'locked' | 'invalid_design'
create or replace function public.select_album_design(
  p_token text, p_design_id uuid, p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  b       public.bookings%rowtype;
  is_open boolean;
begin
  select * into b from public.bookings where album_token = p_token;
  if not found then return 'not_found'; end if;

  -- Final once confirmed — no change window (plan §0).
  if b.album_selected_at is not null then return 'locked'; end if;

  is_open := b.album_released_at is not null or b.event_date < current_date;
  if not is_open then return 'not_ready'; end if;

  if not exists (select 1 from public.album_designs d where d.id = p_design_id and d.active) then
    return 'invalid_design';
  end if;

  update public.bookings
     set album_design_id  = p_design_id,
         album_note        = nullif(left(coalesce(p_note, ''), 500), ''),
         album_selected_at = now()
   where album_token = p_token;

  return 'ok';
end;
$$;

grant execute on function public.select_album_design(text, uuid, text) to anon, authenticated;

-- ── 6. Seed the palette — the studio's real cover skins ──────────────────
-- Two families: fabric/linen (F-series) and croc leather (E-series + NERO).
-- swatch_hex approximates the physical swatch for on-screen chips; replace
-- with real preview_url photos later. UPSERT by code so re-runs stay in sync.
insert into public.album_designs
  (code, material, texture, name_ar, name_en, blurb_ar, blurb_en, swatch_hex, sort_order)
values
  -- Fabric / linen
  ('F334','fabric','linen','برتقالي','Coral Orange','كتّان بلون دافئ حيوي.','Warm, spirited linen.','#C85A2B',10),
  ('F335','fabric','linen','خردلي ذهبي','Golden Mustard','ذهبٌ هادئ بلمسة كلاسيكية.','A quiet, classic gold.','#C79A3A',20),
  ('F336','fabric','linen','رمادي حجري','Stone Grey','حياد أنيق يناسب كل شيء.','Elegant neutral that suits everything.','#A9A49A',30),
  ('F338','fabric','linen','كستنائي','Chestnut','بنيٌّ ترابي عميق.','Deep, earthy brown.','#9C5A34',40),
  ('F341','fabric','linen','فحمي','Charcoal','أسودٌ مُطفأ رصين.','A restrained, matte black.','#3B3A3E',50),
  ('F350','fabric','linen','زمرّدي','Emerald','أخضرُ ملكيّ غنيّ.','Rich, regal green.','#1E7F5C',60),
  ('F355','fabric','linen','كحلي','Navy','أزرقُ ليليّ كلاسيكي.','Classic midnight blue.','#232842',70),
  ('F356','fabric','linen','أزرق ملكي','Royal Blue','أزرقٌ نابض بالحياة.','A vivid, living blue.','#2C468A',80),
  ('F357','fabric','linen','أزرق بودري','Powder Blue','أزرقٌ فاتح ناعم.','Soft, powdery blue.','#92A6C2',90),
  ('F358','fabric','linen','أزرق فولاذي','Slate Blue','رماديٌّ مائل للأزرق.','Muted blue-grey.','#566A7C',100),
  -- Leather (croc-embossed)
  ('NERO','leather','croc','أسود نيرو','Nero Black','جلدٌ أسود مُنقوش فاخر.','Luxe embossed black leather.','#1A1A1A',110),
  ('E639','leather','croc','أوكر','Ochre','جلدٌ ذهبيّ محروق.','Burnished golden leather.','#C4922E',120),
  ('E640','leather','croc','جَمَلي','Camel','بيجٌ دافئ راقٍ.','Warm, refined camel.','#B08A57',130),
  ('E641','leather','croc','طينيّ محروق','Terracotta','برتقاليٌّ ترابي غنيّ.','Rich earthen terracotta.','#A64B2C',140),
  ('E643','leather','croc','خمري','Burgundy','أحمرُ نبيذيّ عميق.','Deep wine red.','#6C2130',150),
  ('E644','leather','croc','ماهوجني','Mahogany','بنيٌّ محمرّ داكن.','Dark reddish mahogany.','#3D1D1F',160),
  ('E651','leather','croc','كحلي داكن','Midnight Navy','أزرقٌ ليليّ عميق.','Deep midnight navy.','#22304E',170),
  ('E654','leather','croc','أخضر غابي','Forest Green','أخضرُ داكن غنيّ.','Rich, deep forest green.','#21382D',180)
on conflict (code) do update set
  material   = excluded.material,
  texture    = excluded.texture,
  name_ar    = excluded.name_ar,
  name_en    = excluded.name_en,
  blurb_ar   = excluded.blurb_ar,
  blurb_en   = excluded.blurb_en,
  swatch_hex = excluded.swatch_hex,
  sort_order = excluded.sort_order;

-- ── 7. Verify ─────────────────────────────────────────────────────────────
select '— Album palette seeded —' as section;
select material, count(*) from public.album_designs group by material order by material;
select code, material, name_en, swatch_hex from public.album_designs order by sort_order;
