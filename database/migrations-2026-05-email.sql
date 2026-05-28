-- ATEMA STUDIO — Booking confirmation email (Zoho Mail SMTP).
--
-- Mirrors the wa_messages audit pattern: every send (success, skip, or
-- failure) is recorded so the admin can debug deliverability without
-- leaving the dashboard. Idempotent — safe to re-run.

create table if not exists public.email_messages (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid references public.bookings(id) on delete set null,
  to_address      text not null,
  subject         text not null,
  template        text not null,                  -- 'booking_confirmation', etc.
  status          text not null
                  check (status in ('sent','skipped','failed')),
  error           text,
  smtp_message_id text,
  created_at      timestamptz default now()
);

create index if not exists email_messages_booking_idx
  on public.email_messages (booking_id, created_at desc);
create index if not exists email_messages_status_idx
  on public.email_messages (status, created_at desc);

alter table public.email_messages enable row level security;
drop policy if exists "Admin reads email_messages" on public.email_messages;
create policy "Admin reads email_messages" on public.email_messages
  for select using (auth.role() = 'authenticated');

-- Sanity
select '— email_messages ready —' as section, count(*) as rows from public.email_messages;
