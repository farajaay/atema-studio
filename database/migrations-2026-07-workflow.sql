-- ATEMA STUDIO — 2026-07 booking workflow tracking
--
-- One row per (booking, workflow step). The step ladder + target-date math
-- live in supabase/functions/_shared/workflow.ts (pure, unit-tested — the
-- single source of truth for the admin timeline AND the workflow-reminders
-- cron). This table stores the owner's confirmations: has the step started,
-- is it done, was it skipped — plus the computed target/deadline dates so
-- the cron can query lateness without re-deriving everything.
--
-- workflow_notifications mirrors wa_reminders_sent: an idempotence guard so
-- each "confirm this step" owner email fires exactly once per (booking,
-- step, kind).
--
-- Run AFTER:
--   database/schema.sql
--   database/migrations-2026-05.sql
--
-- Idempotent — safe to re-run.

-- ── 1. booking_workflow_steps ────────────────────────────────────────────
create table if not exists public.booking_workflow_steps (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  step_key      text not null
                check (step_key in ('final_payment','event','editing','gallery',
                                    'video','review','album_selection','album_delivery')),
  status        text not null default 'pending'
                check (status in ('pending','in_progress','done','skipped')),
  target_date   date not null,                 -- when the step should start/happen
  deadline_date date not null,                 -- contract deadline; past this = delayed
  started_at    timestamptz,                   -- owner confirmed "this step has started"
  completed_at  timestamptz,                   -- owner confirmed "this step is done"
  note          text,                          -- optional owner note (e.g. delay reason)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create unique index if not exists booking_workflow_steps_booking_step_uniq
  on public.booking_workflow_steps (booking_id, step_key);
create index if not exists booking_workflow_steps_due_idx
  on public.booking_workflow_steps (status, target_date);

-- updated_at trigger — set_updated_at() is defined in schema.sql; reuse it.
drop trigger if exists booking_workflow_steps_updated_at on public.booking_workflow_steps;
create trigger booking_workflow_steps_updated_at
  before update on public.booking_workflow_steps
  for each row execute function set_updated_at();

alter table public.booking_workflow_steps enable row level security;

-- Admin-only surface (the workflow tab in the booking modal). No anon access
-- of any kind — the cron writes as service role, which bypasses RLS.
drop policy if exists "Admin selects workflow steps" on public.booking_workflow_steps;
create policy "Admin selects workflow steps" on public.booking_workflow_steps
  for select to authenticated using (true);

drop policy if exists "Admin inserts workflow steps" on public.booking_workflow_steps;
create policy "Admin inserts workflow steps" on public.booking_workflow_steps
  for insert to authenticated with check (true);

drop policy if exists "Admin updates workflow steps" on public.booking_workflow_steps;
create policy "Admin updates workflow steps" on public.booking_workflow_steps
  for update to authenticated using (true);

drop policy if exists "Admin deletes workflow steps" on public.booking_workflow_steps;
create policy "Admin deletes workflow steps" on public.booking_workflow_steps
  for delete to authenticated using (true);

-- ── 2. workflow_notifications (owner-email dedupe guard) ─────────────────
create table if not exists public.workflow_notifications (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  step_key    text not null,
  kind        text not null check (kind in ('due','overdue')),
  sent_at     timestamptz default now()
);

create unique index if not exists workflow_notifications_uniq
  on public.workflow_notifications (booking_id, step_key, kind);

alter table public.workflow_notifications enable row level security;

-- Read-only for the admin (debugging "did the email fire?"); writes are
-- service-role only, from the workflow-reminders cron.
drop policy if exists "Admin reads workflow notifications" on public.workflow_notifications;
create policy "Admin reads workflow notifications" on public.workflow_notifications
  for select to authenticated using (true);

-- Sanity
select '— booking workflow tables ready —' as section,
  (select count(*) from public.booking_workflow_steps)  as steps,
  (select count(*) from public.workflow_notifications)  as notifications;
