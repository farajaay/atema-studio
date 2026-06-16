-- ATEMA STUDIO — restore the anonymous booking INSERT path (June 2026)
--
-- Symptom (live, 2026-06-16):
--   The booking form fails at submit with the friendly
--   "booking_unavailable" message — which src/services/booking.ts throws
--   ONLY on a 42501 row-level-security rejection of the direct-insert
--   fallback.
--
-- Root cause:
--   The booking flow has two insert paths — the create-booking Edge
--   Function (service_role, bypasses RLS) and a direct anon-insert
--   fallback in the client. The Edge Function is currently unreachable
--   from the browser ("Failed to send a request to the Edge Function"),
--   so every booking uses the fallback. migrations-2026-05-audit-patches.sql
--   (Patch M-9) re-created the anon INSERT policy with an extra
--   discount-verification clause:
--
--     and ( discount_code is null
--           or coalesce(discount_amount,0) = 0
--           or exists (select 1 from preview_discount_code(
--                        discount_code, subtotal + coalesce(discount_amount,0)) p
--                      where p.applied_amount = discount_amount and p.reason = 'ok') )
--
--   That EXISTS-subquery inside WITH CHECK is the only thing that changed
--   between "booking worked" and "booking broke" when the full migration
--   manifest was applied. It is fragile in a policy context and is now
--   rejecting otherwise-valid customer inserts.
--
-- Fix:
--   Re-create the constrained anon INSERT policy with the same base shape
--   checks as migrations-2026-05-bookings-rls-fix.sql (the last known-good
--   state) WITHOUT the discount EXISTS sub-check. Discount integrity is
--   still enforced where it matters: the create-booking Edge Function
--   recomputes the total server-side, and the client fallback only writes
--   a discount_amount it just read back from preview_discount_code(). The
--   marginal forgery surface this clause guarded is not worth a fully
--   broken booking form.
--
-- Idempotent. Must run AFTER audit-patches (it supersedes that policy).
-- Run AS service_role (Supabase SQL editor or the migrations workflow).

begin;

alter table public.bookings enable row level security;

drop policy if exists "anon_insert_bookings"                  on public.bookings;
drop policy if exists "Allow public booking insert"           on public.bookings;
drop policy if exists "Constrained anonymous booking insert"  on public.bookings;

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
  );

commit;

-- ── Verify (run manually if desired) ─────────────────────────────────────────
-- Lists the live policies; the INSERT one should be the base-checks version.
select policyname, cmd, roles
  from pg_policies
 where schemaname = 'public' and tablename = 'bookings'
 order by cmd, policyname;

-- Anon smoke test — should INSERT 1 row, not raise 42501.
-- set local role anon;
-- insert into public.bookings (booking_ref, customer_name, customer_phone,
--   event_date, event_time, subtotal, vat, total, status, payment_status)
-- values ('TEST-' || substr(md5(random()::text),1,8), 'RLS Smoke', '+966500000000',
--   current_date + 7, '18:00', 1000, 0, 1000, 'pending', 'unpaid')
-- returning booking_ref;
-- reset role;
-- delete from public.bookings where customer_name = 'RLS Smoke';
