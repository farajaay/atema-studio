-- ATEMA STUDIO — Audit-pass patches (May 2026)
--
-- Bundles every DB-side change required by docs/bugs.md re-audit
-- (2026-05-21) into one re-runnable migration. Safe to re-run; every
-- statement is idempotent.
--
-- Run AFTER:
--   database/migrations-2026-05-moodboard.sql
--   database/migrations-2026-05-rls-hardening.sql
--   database/migrations-2026-05-discount-codes.sql
--
-- What this fixes:
--   * H-6  Mood Board PII leak (anon could SELECT all rows)
--   * H-9  Loose anon SELECT on bookings (DatePicker now uses view)
--   * H-7  / H-7b — preview_discount_code now returns code_value
--          + code_max_discount so the client can display honest
--          percent labels and re-evaluate on basket changes
--   * M-9  Booking insert RLS now verifies discount math via
--          preview_discount_code() — fallback path can persist
--          discount fields safely
--   * M-10 Note: preview rate-limit lives in the Edge Function
--          (supabase/functions/discount-preview), not here.

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ H-6 — Lock down mood_boards SELECT, expose RPC instead             ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- The token-as-secret model was never enforced. `using (true)` let any
-- holder of the anon key SELECT * from mood_boards and harvest customer
-- names (auto-drafted into title_ar). Drop the open policy; add a
-- security-definer RPC that returns a single row matched by token.

drop policy if exists "Public select mood_boards" on public.mood_boards;

-- Admin (authenticated) keeps direct SELECT; everyone else uses the RPC.
drop policy if exists "Authenticated select mood_boards" on public.mood_boards;
create policy "Authenticated select mood_boards"
  on public.mood_boards for select
  to authenticated
  using (true);

create or replace function public.get_mood_board_by_token(p_token text)
returns public.mood_boards
language sql
security definer
stable
set search_path = public
as $$
  select * from public.mood_boards where token = p_token limit 1;
$$;

grant execute on function public.get_mood_board_by_token(text)
  to anon, authenticated;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ H-9 — Drop the loose anon SELECT on bookings                       ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- DatePicker (the only customer-facing reader) now goes via the
-- public_booked_dates view (see src/services/calendar.ts). The
-- `using (true)` policy on the table is dead weight + a PII bypass —
-- since stock Postgres RLS can't restrict columns, anon could still
-- SELECT customer_name etc. directly. Drop it. Admin reads continue
-- through the authenticated role.

drop policy if exists "Public select event_date status only" on public.bookings;
drop policy if exists "Allow public booking select"            on public.bookings;
drop policy if exists "anon_select_bookings"                   on public.bookings;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ H-7 / H-7b — Extend preview_discount_code with code metadata       ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- Adds two extra return columns: code_value (the percent / flat raw
-- value the admin set) and code_max_discount (cap for percent codes).
-- The client uses these to display an honest label like "25% off
-- (capped at 1,000 ر.س)" instead of the reverse-engineered, sometimes-
-- incorrect "10%" computed from amount/subtotal.

drop function if exists public.preview_discount_code(text, integer);

create or replace function public.preview_discount_code(
  p_code text,
  p_subtotal integer
) returns table (
  applied_amount    integer,
  applied_kind      text,
  reason            text,
  code_value        integer,
  code_max_discount integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  c public.discount_codes%rowtype;
  amount integer := 0;
  normalized text;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select 0, null::text, 'empty', null::int, null::int;
    return;
  end if;
  if p_subtotal is null or p_subtotal <= 0 then
    return query select 0, null::text, 'invalid_subtotal', null::int, null::int;
    return;
  end if;

  normalized := upper(btrim(p_code));

  select * into c from public.discount_codes
   where code = normalized;

  if not found then
    return query select 0, null::text, 'not_found', null::int, null::int;
    return;
  end if;
  if not c.active then
    return query select 0, c.kind, 'inactive', c.value, c.max_discount;
    return;
  end if;
  if c.valid_from is not null and now() < c.valid_from then
    return query select 0, c.kind, 'not_yet_active', c.value, c.max_discount;
    return;
  end if;
  if c.valid_to is not null and now() > c.valid_to then
    return query select 0, c.kind, 'expired', c.value, c.max_discount;
    return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select 0, c.kind, 'exhausted', c.value, c.max_discount;
    return;
  end if;
  if p_subtotal < coalesce(c.min_subtotal, 0) then
    return query select 0, c.kind, 'below_min_subtotal', c.value, c.max_discount;
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

  return query select amount, c.kind, 'ok', c.value, c.max_discount;
end;
$$;

grant execute on function public.preview_discount_code(text, integer)
  to anon, authenticated, service_role;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ M-9 — Verify discount math at booking-insert time                  ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- The constrained anon-insert policy (from migrations-2026-05-rls-
-- hardening.sql) didn't verify that a client-supplied discount_amount
-- actually matches what the code is worth. Without this, the fallback
-- path could in principle let a forged amount through. Tighten by
-- calling preview_discount_code() inside the policy's WITH CHECK.
--
-- preview_discount_code is STABLE + SECURITY DEFINER, so RLS can call
-- it safely.

drop policy if exists "Constrained anonymous booking insert" on public.bookings;

create policy "Constrained anonymous booking insert"
  on public.bookings
  for insert
  to anon
  with check (
        customer_name  is not null
    and length(trim(customer_name))  between 2 and 120
    and customer_phone is not null
    and length(trim(customer_phone)) between 7 and 25
    and event_date is not null
    and event_date >= current_date
    and subtotal > 0     and subtotal <= 200000
    and total    > 0     and total    <= 230000
    and vat      >= 0    and vat      <= 50000
    and status         = 'pending'
    and payment_status = 'unpaid'
    -- Discount math is consistent — either no code, or the supplied
    -- amount matches what preview_discount_code computes against the
    -- gross subtotal (gross = current subtotal + discount_amount, since
    -- subtotal is stored net of discount).
    and (
      discount_code is null
      or coalesce(discount_amount, 0) = 0
      or exists (
        select 1
          from public.preview_discount_code(
                 discount_code,
                 subtotal + coalesce(discount_amount, 0)
               ) p
         where p.applied_amount = discount_amount
           and p.reason = 'ok'
      )
    )
  );

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ Verify                                                              ║
-- ╚════════════════════════════════════════════════════════════════════╝

select '— Audit patches applied —' as section;
select schemaname, tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('bookings','mood_boards','discount_codes')
 order by tablename, cmd, policyname;
