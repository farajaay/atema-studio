-- ATEMA STUDIO — WhatsApp Smart Lifecycle Platform
-- Schema additions for the wa-webhook, wa-receipt, and wa-reminders Edge
-- Functions. Idempotent — safe to re-run.

-- ─── 1. wa_messages: audit log for every inbound + outbound WA message ──────
create table if not exists public.wa_messages (
  id              uuid primary key default gen_random_uuid(),
  wa_message_id   text unique,
  from_phone      text not null,
  to_phone        text,
  direction       text not null check (direction in ('inbound','outbound')),
  message_type    text,                       -- text / image / document / template / sticker
  body            text,
  media_url       text,
  matched_booking uuid references public.bookings(id) on delete set null,
  extracted       jsonb,                       -- Vision-extracted receipt data
  status          text not null
                  check (status in ('received','processing','auto_confirmed',
                                    'needs_review','sent','failed','ignored')),
  notes           text,
  raw_payload     jsonb,
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);

create index if not exists wa_messages_from_phone_idx
  on public.wa_messages (from_phone, created_at desc);
create index if not exists wa_messages_status_idx
  on public.wa_messages (status, created_at desc);

-- RLS — admin-only read; service role writes via Edge Function
alter table public.wa_messages enable row level security;
drop policy if exists "Admin reads wa_messages" on public.wa_messages;
create policy "Admin reads wa_messages" on public.wa_messages
  for select using (auth.role() = 'authenticated');

-- ─── 2. wa_reminders_sent: idempotency for the lifecycle cron ───────────────
create table if not exists public.wa_reminders_sent (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  reminder_kind   text not null
                  check (reminder_kind in ('pre_72h','pre_48h','pre_24h',
                                           'post_2h','post_30d','anniversary_1y')),
  sent_at         timestamptz default now(),
  wa_message_id   text,
  unique (booking_id, reminder_kind)
);

create index if not exists wa_reminders_sent_booking_idx
  on public.wa_reminders_sent (booking_id);

alter table public.wa_reminders_sent enable row level security;
drop policy if exists "Admin reads wa_reminders_sent" on public.wa_reminders_sent;
create policy "Admin reads wa_reminders_sent" on public.wa_reminders_sent
  for select using (auth.role() = 'authenticated');

-- ─── 3. Optional: extend bookings with reminder opt-out (default: opted in) ─
alter table public.bookings
  add column if not exists wa_reminders_enabled boolean not null default true,
  add column if not exists wa_last_reminder_at  timestamptz,
  add column if not exists payment_evidence_url text,
  add column if not exists payment_received_at  timestamptz;

-- ─── 4. Sanity ─────────────────────────────────────────────────────────────
select '— wa_messages ready —' as section, count(*) as rows from public.wa_messages;
select '— wa_reminders_sent ready —' as section, count(*) as rows from public.wa_reminders_sent;
