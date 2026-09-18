-- ATEMA STUDIO — 2026-09 «بدون طباعة» option on the mid-tier packages
--
-- Some brides want the coverage but not the printed album: the studio keeps
-- the shoot, the editing and the full digital delivery, and drops the print
-- run. Until now the only way to express that was a bespoke price agreed off
-- the record, which the contract, the invoice and the workflow ladder never
-- heard about — so the bride kept receiving «تسليم الألبوم المطبوع» reminders
-- for an album nobody was printing.
--
-- Modelled as TWO COLUMNS ON THE PACKAGE, not as a negative add-on and not as
-- duplicate rows:
--   · a negative-price add-on would surface on باقة الخطوبة (which has no
--     album at all), and _shared/pricing.ts's sumActiveAddons / clampDiscount
--     are written around non-negative money;
--   · a duplicate "الكلاسيكية — بدون طباعة" row would double the catalogue and
--     break every place that infers the album ladder from packages.album.
--
-- The discount is a FIXED RIYAL AMOUNT per package (owner's decision —
-- clearer to the bride and exact in the P&L) rather than a percentage. The
-- owner edits it in the admin panel; the value below is only a starting point.
--
-- Enabled for الكلاسيكية (id 3) + الملكية (id 4) only. باقة التوقيع and
-- ATEMA Couture are NOT eligible: the A3 album and the wall piece are the
-- identity of those tiers, not an accessory (owner's decision, Sept 2026).
--
-- The authoritative arithmetic lives in supabase/functions/_shared/pricing.ts
-- (grossForPackage) — the client price is display-only, as always.
--
-- Run AFTER:
--   database/schema.sql
--   database/seed-packages-2026-05.sql   (so ids 3/4 exist)
--
-- Idempotent — safe to re-run.

-- ── 1. packages — the offer ──────────────────────────────────────────────
-- no_print_enabled  : does this tier offer the choice at all
-- no_print_discount : riyals taken off `price` when she picks it (gross,
--                     pre-VAT — VAT is recomputed on the net subtotal)
alter table public.packages
  add column if not exists no_print_enabled  boolean not null default false,
  add column if not exists no_print_discount integer not null default 0;

-- A discount can never be negative, and an ENABLED option must actually cost
-- something and never reach or exceed the package price (a 0 SAR "option" is
-- a mystery to the bride; a discount >= price is a free or negative booking).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'packages_no_print_discount_check'
  ) then
    alter table public.packages
      add constraint packages_no_print_discount_check
      check (
        no_print_discount >= 0
        and (
          not no_print_enabled
          or (no_print_discount > 0 and no_print_discount < price)
        )
      );
  end if;
end$$;

-- ── 2. bookings — what she chose ─────────────────────────────────────────
-- Read by the contract renderer (skip the printing articles), the invoice
-- line description, the workflow ladder (skip album_selection +
-- album_delivery) and the album-cover link (never released for a no-print
-- booking). Written ONLY by the create-booking / change-booking Edge
-- Functions as service role — anon never sets it.
alter table public.bookings
  add column if not exists no_print boolean not null default false;

-- ── 3. Turn the option on for the two mid tiers ──────────────────────────
-- Starting amounts, not law: الكلاسيكية 5,500 → 4,800 · الملكية 11,200 →
-- 10,000. Guarded by `no_print_discount = 0` so a re-run can never clobber a
-- number the owner has since tuned in the admin panel — the same "live data
-- wins" posture as scripts/export-catalogue.mjs.
update public.packages
   set no_print_enabled  = true,
       no_print_discount = case id when 3 then 700 when 4 then 1200 end
 where id in (3, 4)
   and album is not null          -- sanity: a tier with no album can't drop one
   and no_print_discount = 0;

-- ── 4. Seal the album-cover link for a no-print booking ──────────────────
-- Both album RPCs open the selection page automatically once the event date
-- has passed (`b.event_date < current_date`) — meaning a bride who paid the
-- «بدون طباعة» price would still be invited to choose a cover for an album
-- nobody is printing, and could lock a choice the studio never agreed to
-- supply. The guard belongs HERE, in the SECURITY DEFINER function, not in
-- the page: the token is the only credential, and the page is not the thing
-- being trusted.
--
-- Bodies are copied verbatim from migrations-2026-07-album.sql with one
-- added clause each — `create or replace` keeps this idempotent.

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

  -- No printed album was sold → the page says so and offers nothing.
  if coalesce(b.no_print, false) then
    return json_build_object('status', 'no_print', 'event_date', b.event_date);
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

  -- Nothing to choose a cover for.
  if coalesce(b.no_print, false) then return 'no_print'; end if;

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

-- ── 5. Report ────────────────────────────────────────────────────────────
-- The migration runner prints result sets (see the 2026-09 runner fix), so
-- this lands in the Actions log as the confirmation of what is now on offer.
select id,
       name_ar,
       price,
       no_print_enabled,
       no_print_discount,
       price - no_print_discount as price_without_printing
  from public.packages
 where no_print_enabled
 order by sort_order, id;
