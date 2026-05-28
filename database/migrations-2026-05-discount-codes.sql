-- ATEMA STUDIO — Discount codes (May 2026)
--
-- Full design: docs/integrations/discount-codes.md
--
-- What this migration does:
--   1. Creates the `discount_codes` table.
--   2. Adds three columns to `bookings` for audit/history.
--   3. Defines the `redeem_discount_code()` RPC — the ONLY way to
--      consume a code. Row-locks the code, validates, atomically
--      increments `used_count`. service_role-only.
--   4. Defines `preview_discount_code()` — read-only forecast. Same
--      validation rules, no mutation. Callable by anon for instant
--      UI feedback (rate-limited at the Edge Function layer).
--   5. RLS policies: admin-only SELECT/INSERT/UPDATE/DELETE on
--      discount_codes. Anon never touches the table directly.
--
-- Run AFTER:
--   database/schema.sql
--   database/migrations-2026-05.sql
--   database/migrations-2026-05-rls-hardening.sql

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 1. discount_codes table                                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝

create table if not exists public.discount_codes (
  code             text primary key,
  description      text,
  kind             text not null check (kind in ('percent','flat')),
  value            integer not null check (value > 0),
  max_discount     integer,                                  -- cap for percent codes
  min_subtotal     integer default 0 check (min_subtotal >= 0),
  valid_from       timestamptz default now(),
  valid_to         timestamptz,
  max_uses         integer,                                  -- null = unlimited
  used_count       integer not null default 0
                     check (used_count >= 0),
  active           boolean not null default true,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Enforce uppercase code at the database layer so client + server can't drift.
alter table public.discount_codes
  drop constraint if exists discount_codes_code_upper;
alter table public.discount_codes
  add constraint discount_codes_code_upper
  check (code = upper(code) and length(code) between 2 and 32);

-- Percent codes: value must be 1..100.
alter table public.discount_codes
  drop constraint if exists discount_codes_percent_range;
alter table public.discount_codes
  add constraint discount_codes_percent_range
  check (kind <> 'percent' or (value between 1 and 100));

create index if not exists discount_codes_active_idx
  on public.discount_codes(active);

-- updated_at trigger (reuses schema.sql's set_updated_at function)
drop trigger if exists discount_codes_updated_at on public.discount_codes;
create trigger discount_codes_updated_at
  before update on public.discount_codes
  for each row execute function set_updated_at();

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 2. Three new columns on bookings                                  ║
-- ╚═══════════════════════════════════════════════════════════════════╝

alter table public.bookings
  add column if not exists discount_code   text;

alter table public.bookings
  add column if not exists discount_amount integer not null default 0
                                            check (discount_amount >= 0);

alter table public.bookings
  add column if not exists discount_kind   text
                                            check (discount_kind in ('percent','flat'));

-- FK with ON DELETE SET NULL so historical bookings survive if a code is
-- ever deleted. We also keep discount_amount/discount_kind so the
-- record stays informative.
alter table public.bookings
  drop constraint if exists bookings_discount_code_fkey;
alter table public.bookings
  add constraint bookings_discount_code_fkey
  foreign key (discount_code)
  references public.discount_codes(code)
  on delete set null;

create index if not exists bookings_discount_code_idx
  on public.bookings(discount_code)
  where discount_code is not null;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 3. preview_discount_code — read-only forecast                     ║
-- ╚═══════════════════════════════════════════════════════════════════╝
--
-- Returns (applied_amount, applied_kind, reason). Does NOT increment
-- used_count. Callable by anon for instant UI feedback.

drop function if exists public.preview_discount_code(text, integer);

create function public.preview_discount_code(
  p_code text,
  p_subtotal integer
) returns table (
  applied_amount integer,
  applied_kind   text,
  reason         text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.discount_codes%rowtype;
  amount integer := 0;
  normalized text;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select 0, null::text, 'empty';
    return;
  end if;
  if p_subtotal is null or p_subtotal <= 0 then
    return query select 0, null::text, 'invalid_subtotal';
    return;
  end if;

  normalized := upper(btrim(p_code));

  select * into c from public.discount_codes
   where code = normalized;

  if not found then
    return query select 0, null::text, 'not_found';
    return;
  end if;
  if not c.active then
    return query select 0, c.kind, 'inactive';
    return;
  end if;
  if c.valid_from is not null and now() < c.valid_from then
    return query select 0, c.kind, 'not_yet_active';
    return;
  end if;
  if c.valid_to is not null and now() > c.valid_to then
    return query select 0, c.kind, 'expired';
    return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select 0, c.kind, 'exhausted';
    return;
  end if;
  if p_subtotal < coalesce(c.min_subtotal, 0) then
    return query select 0, c.kind, 'below_min_subtotal';
    return;
  end if;

  -- Compute amount.
  if c.kind = 'percent' then
    amount := floor(p_subtotal * c.value / 100.0);
    if c.max_discount is not null and amount > c.max_discount then
      amount := c.max_discount;
    end if;
  else
    amount := least(c.value, p_subtotal);
  end if;

  return query select amount, c.kind, 'ok';
end;
$$;

grant execute on function public.preview_discount_code(text, integer)
  to anon, authenticated, service_role;

-- ╔════════════════════════════════��══════════════════════════════════╗
-- ║ 4. redeem_discount_code — atomic redemption                       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
--
-- Same validation as preview, PLUS: row-lock + increment used_count
-- in the same transaction. service_role-only — only the
-- create-booking Edge Function can call this.

drop function if exists public.redeem_discount_code(text, integer);

create function public.redeem_discount_code(
  p_code text,
  p_subtotal integer
) returns table (
  applied_amount integer,
  applied_kind   text,
  reason         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.discount_codes%rowtype;
  amount integer := 0;
  normalized text;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select 0, null::text, 'empty';
    return;
  end if;
  if p_subtotal is null or p_subtotal <= 0 then
    return query select 0, null::text, 'invalid_subtotal';
    return;
  end if;

  normalized := upper(btrim(p_code));

  select * into c from public.discount_codes
   where code = normalized
   for update;                                                -- row lock

  if not found then
    return query select 0, null::text, 'not_found';
    return;
  end if;
  if not c.active then
    return query select 0, c.kind, 'inactive';
    return;
  end if;
  if c.valid_from is not null and now() < c.valid_from then
    return query select 0, c.kind, 'not_yet_active';
    return;
  end if;
  if c.valid_to is not null and now() > c.valid_to then
    return query select 0, c.kind, 'expired';
    return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select 0, c.kind, 'exhausted';
    return;
  end if;
  if p_subtotal < coalesce(c.min_subtotal, 0) then
    return query select 0, c.kind, 'below_min_subtotal';
    return;
  end if;

  if c.kind = 'percent' then
    amount := floor(p_subtotal * c.value / 100.0);
    if c.max_discount is not null and amount > c.max_discount then
      amount := c.max_discount;
    end if;
  else
    amount := least(c.value, p_subtotal);
  end if;

  -- Atomic increment.
  update public.discount_codes
     set used_count = used_count + 1,
         updated_at = now()
   where code = c.code;

  return query select amount, c.kind, 'ok';
end;
$$;

grant execute on function public.redeem_discount_code(text, integer)
  to service_role;

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 5. RLS — admin-only direct access to discount_codes               ║
-- ╚═══════════════════════════════════════════════════════════════════╝

alter table public.discount_codes enable row level security;

drop policy if exists "Admins read discount codes"          on public.discount_codes;
drop policy if exists "Admins insert discount codes"        on public.discount_codes;
drop policy if exists "Admins update discount codes"        on public.discount_codes;
-- Both names dropped: the original migration created "delete unused" but
-- only listed "delete" here, so re-runs tripped 42710 on the next CREATE.
drop policy if exists "Admins delete discount codes"        on public.discount_codes;
drop policy if exists "Admins delete unused discount codes" on public.discount_codes;

create policy "Admins read discount codes"
  on public.discount_codes for select
  to authenticated using (true);

create policy "Admins insert discount codes"
  on public.discount_codes for insert
  to authenticated with check (true);

create policy "Admins update discount codes"
  on public.discount_codes for update
  to authenticated using (true) with check (true);

-- Admins can only delete codes that have never been redeemed.
-- Codes with history are paused via active=false instead.
create policy "Admins delete unused discount codes"
  on public.discount_codes for delete
  to authenticated using (used_count = 0);

-- Service role bypass (already implicit, made explicit for grep-ability).
drop policy if exists "Service role full access — discount_codes" on public.discount_codes;
create policy "Service role full access — discount_codes"
  on public.discount_codes for all
  to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ 6. Verify                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════╝

select '— Discount codes ready —' as section;
select policyname, cmd, roles from pg_policies
 where schemaname = 'public' and tablename = 'discount_codes'
 order by cmd, policyname;
