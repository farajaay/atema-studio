-- ATEMA STUDIO — 2026-08 installment plans (خطة التقسيط)
--
-- Admin-assigned split-payment plans: the booking total divided over 3, 4 or
-- 5 دفعات, attached per-booking from the admin dashboard (not a package
-- setting). The 50% deposit stays what it is — it becomes installment seq 1;
-- the remaining balance spreads across the rest, last due = event − 1 day
-- (contract المادة الثانية). Amount/date math lives in
-- supabase/functions/_shared/installments.ts (pure, unit-tested — the single
-- source for the admin card, the manage page and the reminders cron).
--
-- installment_notifications mirrors wa_reminders_sent / workflow_notifications:
-- an idempotence guard so each reminder fires exactly once per
-- (booking, seq, kind).
--
-- Run AFTER:
--   database/schema.sql
--   database/migrations-2026-05-booking-changes.sql   (manage_token)
--
-- Idempotent — safe to re-run.

-- ── 1. Plan marker on bookings ───────────────────────────────────────────
-- Null = no plan (the default 50/50 story). 3/4/5 = an active plan whose
-- rows live in booking_installments. Kept on the booking row so the admin
-- list can chip it without joining.
alter table public.bookings
  add column if not exists installment_plan smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_installment_plan_check'
  ) then
    alter table public.bookings
      add constraint bookings_installment_plan_check
      check (installment_plan is null or installment_plan in (3, 4, 5));
  end if;
end$$;

-- ── 2. booking_installments ──────────────────────────────────────────────
-- One row per planned دفعة. `amount` is the planned share; `paid_amount` +
-- `paid_at` + `note` record what actually arrived (transfer-only studio —
-- the admin verifies the receipt, then records here). Uneven settlements
-- are fine: paid_amount may differ from amount, progress sums what was paid.
create table if not exists public.booking_installments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  seq         smallint not null check (seq between 1 and 5),
  amount      integer  not null check (amount >= 0),
  due_date    date     not null,
  paid_amount integer  check (paid_amount >= 0),
  paid_at     timestamptz,
  note        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create unique index if not exists booking_installments_booking_seq_uniq
  on public.booking_installments (booking_id, seq);

-- The reminders cron scans "unpaid and due soon" — partial index keeps that
-- cheap as history accumulates.
create index if not exists booking_installments_unpaid_due_idx
  on public.booking_installments (due_date) where paid_at is null;

-- updated_at trigger — set_updated_at() is defined in schema.sql; reuse it.
drop trigger if exists booking_installments_updated_at on public.booking_installments;
create trigger booking_installments_updated_at
  before update on public.booking_installments
  for each row execute function set_updated_at();

alter table public.booking_installments enable row level security;

-- Admin-only surface (the «خطة التقسيط» card in the booking modal). No anon
-- table access of any kind — the bride reads through the token RPC below,
-- and the cron reads as service role, which bypasses RLS.
drop policy if exists "Admin selects installments" on public.booking_installments;
create policy "Admin selects installments" on public.booking_installments
  for select to authenticated using (true);

drop policy if exists "Admin inserts installments" on public.booking_installments;
create policy "Admin inserts installments" on public.booking_installments
  for insert to authenticated with check (true);

drop policy if exists "Admin updates installments" on public.booking_installments;
create policy "Admin updates installments" on public.booking_installments
  for update to authenticated using (true);

drop policy if exists "Admin deletes installments" on public.booking_installments;
create policy "Admin deletes installments" on public.booking_installments
  for delete to authenticated using (true);

-- ── 3. installment_notifications (reminder dedupe guard) ─────────────────
-- kind: 'due' / 'overdue' → lines in the owner's daily workflow digest;
--       'bride_upcoming'  → the customer email ~3 days before the due date.
create table if not exists public.installment_notifications (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  seq         smallint not null,
  kind        text not null check (kind in ('due', 'overdue', 'bride_upcoming')),
  sent_at     timestamptz default now()
);

create unique index if not exists installment_notifications_uniq
  on public.installment_notifications (booking_id, seq, kind);

alter table public.installment_notifications enable row level security;

-- Read-only for the admin (debugging "did the email fire?"); writes are
-- service-role only, from the workflow-reminders cron.
drop policy if exists "Admin reads installment notifications" on public.installment_notifications;
create policy "Admin reads installment notifications" on public.installment_notifications
  for select to authenticated using (true);

-- ── 4. Token-scoped read RPC (anon-safe) ─────────────────────────────────
-- The manage page renders the bride's own schedule through this. SECURITY
-- DEFINER returns ONLY the rows of the single booking matching the supplied
-- manage_token — anon cannot read or enumerate booking_installments. Same
-- capability-link model as get_booking_by_token.
create or replace function public.get_installments_by_token(p_token text)
returns table (
  seq         smallint,
  amount      integer,
  due_date    date,
  paid_amount integer,
  paid_at     timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.seq, i.amount, i.due_date, i.paid_amount, i.paid_at
    from public.booking_installments i
    join public.bookings b on b.id = i.booking_id
   where b.manage_token = p_token
   order by i.seq;
$$;

grant execute on function public.get_installments_by_token(text) to anon, authenticated;

-- ── 5. Verify ────────────────────────────────────────────────────────────
select '— installment tables ready —' as section,
  (select count(*) from public.booking_installments)      as installments,
  (select count(*) from public.installment_notifications) as notifications;
select column_name from information_schema.columns
 where table_name = 'bookings' and column_name = 'installment_plan';
