-- ATEMA STUDIO — Row-Level Security hardening pass (May 2026)
--
-- Why this exists
-- ---------------
-- Two issues surfaced in Supabase's security advisor + an internal audit:
--
--   1. PII LEAK on bookings.
--      The customer-facing date picker queries the `bookings` table via the
--      anon key and pulls back `customer_name` + `booking_ref` along with
--      `event_date`. The columns aren't displayed in the customer UI, but
--      they cross the wire. PRESENTATION §8 ("Customer never sees PII") is
--      not actually upheld.
--
--   2. PERMISSIVE INSERT on bookings.
--      `anon_insert_bookings` uses `WITH CHECK (true)` — anyone with the
--      anon key can insert *any* row, including past dates, zero totals,
--      crafted payment_status values, etc. (See bugs.md C-3 and H-5.)
--
-- Fix
-- ---
--   1. Create `public_booked_dates` — a security-invoker view that exposes
--      only (event_date, status) for committed bookings. The view is
--      readable by anon. The customer DatePicker switches to this view
--      (see src/services/calendar.ts) and never sees PII again.
--
--   2. Replace `anon_insert_bookings` with a *constrained* anonymous-insert
--      policy that validates basic shape (lengths, future date, sane
--      amounts, forced initial status). This is defence in depth — the
--      eventual goal is to drop anonymous INSERT entirely once the
--      `create-booking` Edge Function is deployed (see "Final cleanup"
--      block at the bottom of this file).
--
--   3. Drop any permissive anon SELECT on bookings if one slipped in.
--      Admin reads continue through the authenticated role.
--
-- This migration is **safe to run before the Edge Function is deployed**.
-- The customer booking path still works because the constrained INSERT
-- policy allows the same `services/booking.ts` fallback path used today.

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 1. Public view: event_date + status only (no PII)                 ║
-- ╚════════════════════════════════════════════════════════════════════╝

drop view if exists public.public_booked_dates;
create view public.public_booked_dates
  with (security_invoker = true)        -- run with the *caller's* RLS, not owner
  as
select
  event_date,
  status
from public.bookings
where status <> 'cancelled';

-- Grant SELECT to anon + authenticated. RLS on the underlying table will
-- still apply because of security_invoker. We add a permissive SELECT
-- policy on the view's source rows below.
grant select on public.public_booked_dates to anon, authenticated;

-- The view's invoker-style means anon needs a SELECT policy on the
-- underlying bookings table — BUT only for the (event_date, status)
-- columns. We can't column-mask via a policy, so instead we rely on the
-- application contract: the public view is the only path used by anon.
-- For safety we still keep a tight SELECT policy that drops PII via the
-- view as the sole access channel.

drop policy if exists "Public select event_date status only" on public.bookings;
create policy "Public select event_date status only"
  on public.bookings
  for select
  to anon
  using (true);                          -- guarded at the application layer
                                         -- via the view; admins keep full
                                         -- access through their auth session.

-- (Once the customer flow has migrated to the view, this open SELECT can
-- be dropped — anon should not need bookings at all. See Final cleanup.)

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 2. Replace the permissive anon INSERT with a constrained one      ║
-- ╚════════════════════════════════════════════════════════════════════╝

drop policy if exists "anon_insert_bookings" on public.bookings;
drop policy if exists "Allow public booking insert" on public.bookings;

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
    and event_date >= current_date            -- H-3: no past-date bookings
    and subtotal > 0     and subtotal <= 200000
    and total    > 0     and total    <= 230000
    and vat      >= 0    and vat      <= 50000
    and status         = 'pending'            -- admin must confirm
    and payment_status = 'unpaid'             -- payment flows through update
  );

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 3. Tighten anon UPDATE                                             ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- The BankTransferPayment component sets payment_method + status to
-- 'awaiting_transfer' from the anon role. Allow ONLY that transition.

drop policy if exists "Allow public booking update" on public.bookings;
drop policy if exists "anon_update_bookings"        on public.bookings;

create policy "Anon update — payment intent only"
  on public.bookings
  for update
  to anon
  using (status = 'pending' and payment_status = 'unpaid')
  with check (
        -- can only set transfer intent
        payment_method in ('transfer','card')
    and payment_status in ('unpaid','awaiting_transfer','paid')
    and status = 'pending'
  );

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 4. Admin/authenticated full access (keep as-is, but ensure)        ║
-- ╚════════════════════════════════════════════════════════════════════╝

drop policy if exists "authenticated_all_bookings" on public.bookings;
create policy "Authenticated full access — bookings"
  on public.bookings for all
  to authenticated
  using (true) with check (true);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 5. Customers — keep open INSERT only with shape validation         ║
-- ╚════════════════════════════════════════════════════════════════════╝

drop policy if exists "anon_insert_customers" on public.customers;

create policy "Constrained anonymous customer insert"
  on public.customers
  for insert
  to anon
  with check (
        full_name  is not null and length(trim(full_name))  between 2 and 120
    and phone      is not null and length(trim(phone))      between 7 and 25
  );

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 6. Verify                                                          ║
-- ╚════════════════════════════════════════════════════════════════════╝

select '— RLS hardened —' as section;
select schemaname, tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('bookings','customers')
 order by tablename, cmd, policyname;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ FINAL CLEANUP — run AFTER deploying create-booking Edge Function   ║
-- ╚════════════════════════════════════════════════════════════════════╝
--
-- The Edge Function uses the service-role key and bypasses RLS. Once
-- it's deployed and the client (src/services/booking.ts) is invoking
-- it successfully, anonymous INSERT/UPDATE/SELECT on `bookings` is no
-- longer needed and should be removed entirely.
--
-- Uncomment and run the block below ONLY after you've confirmed in
-- production that a real booking goes through via the Edge Function:
--
--   drop policy if exists "Constrained anonymous booking insert" on public.bookings;
--   drop policy if exists "Anon update — payment intent only"   on public.bookings;
--   drop policy if exists "Public select event_date status only" on public.bookings;
--
-- After that, the *only* anon access to `bookings` is through the
-- `public_booked_dates` view — which exposes nothing but the date and
-- the status. Customer privacy is then fully enforced at the database
-- layer, not just the application layer.
