// ATEMA STUDIO — Booking workflow tracker cron.
//
// Run daily (once a day is plenty — targets are date-granular). For every
// active booking it:
//
//   1. seeds the workflow-step ladder (contract-derived target dates) if the
//      booking doesn't have one yet,
//   2. re-anchors dependent targets (review / album selection / album
//      delivery) once their parent step completes,
//   3. finds steps that reached their target date without being confirmed
//      started, or blew past their contract deadline without being done, and
//   4. emails the owner ONE digest asking her to confirm each: has the step
//      started, or is it delayed? (Confirmation happens in the admin booking
//      modal → «سير العمل» tab.)
//
// Step ladder + all date math live in _shared/workflow.ts (pure,
// unit-tested, shared with the admin UI). Idempotent — the
// workflow_notifications table guards each (booking, step, kind) email.
//
// Trigger:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     https://<project>.supabase.co/functions/v1/workflow-reminders
//
// Schedule via cron-job.org / EasyCron / supabase-cron at e.g. `0 5 * * *`
// (05:00 UTC = 08:00 KSA). Set CRON_SECRET as both a Supabase secret AND
// the Authorization bearer on the scheduler — same pattern as wa-reminders.
// Email goes to OWNER_EMAIL (falls back to the Zoho sender mailbox).

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { db, jsonResponse, corsHeaders } from '../_shared/wa.ts';
import { sendEmail } from '../_shared/email.ts';
import { renderWorkflowDigestEmail, type WorkflowDigestItem } from '../_shared/email-workflow.ts';
import {
  WORKFLOW_STEPS, computeTargets, duePrompts, promptDedupeKey, todayUtc, addDaysIso,
  type WorkflowStepKey, type WorkflowStatus,
} from '../_shared/workflow.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const SITE_ORIGIN = Deno.env.get('SITE_ORIGIN') ?? 'https://atemastudio.xyz';
const OWNER_EMAIL = Deno.env.get('OWNER_EMAIL') ?? Deno.env.get('ZOHO_SMTP_USER') ?? '';

type BookingRow = {
  id: string;
  booking_ref: string;
  customer_name: string;
  event_date: string;
  status: string;
  payment_status: string;
};

type StepRow = {
  id: string;
  booking_id: string;
  step_key: WorkflowStepKey;
  status: WorkflowStatus;
  target_date: string;
  deadline_date: string;
  completed_at: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (CRON_SECRET) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${CRON_SECRET}`) return jsonResponse({ error: 'forbidden' }, 401);
  }

  const supa  = db();
  const today = todayUtc();

  // ── Candidate bookings: committed money, not cancelled, and inside the
  // window where any step can be actionable (final payment fires at
  // event−1; the album tail can run ~240 days past the event). ────────────
  const { data: bookings, error } = await supa.from('bookings')
    .select('id, booking_ref, customer_name, event_date, status, payment_status')
    .neq('status', 'cancelled')
    .in('payment_status', ['paid', 'awaiting_transfer'])
    .gte('event_date', addDaysIso(today, -300))
    .lte('event_date', addDaysIso(today, 7));

  if (error) return jsonResponse({ error: error.message }, 500);
  const active = (bookings ?? []) as BookingRow[];
  if (active.length === 0) return jsonResponse({ ok: true, scanned: 0, prompts: 0 });

  const ids = active.map(b => b.id);

  // ── Existing step rows + notification history (one round trip each) ─────
  const [{ data: stepRows }, { data: sentRows }] = await Promise.all([
    supa.from('booking_workflow_steps')
      .select('id, booking_id, step_key, status, target_date, deadline_date, completed_at')
      .in('booking_id', ids),
    supa.from('workflow_notifications')
      .select('booking_id, step_key, kind')
      .in('booking_id', ids),
  ]);

  const stepsByBooking = new Map<string, StepRow[]>();
  for (const r of (stepRows ?? []) as StepRow[]) {
    const list = stepsByBooking.get(r.booking_id) ?? [];
    list.push(r);
    stepsByBooking.set(r.booking_id, list);
  }
  const sentByBooking = new Map<string, Set<string>>();
  for (const r of (sentRows ?? []) as { booking_id: string; step_key: string; kind: string }[]) {
    const set = sentByBooking.get(r.booking_id) ?? new Set<string>();
    set.add(promptDedupeKey(r.step_key, r.kind));
    sentByBooking.set(r.booking_id, set);
  }

  const digest: WorkflowDigestItem[] = [];
  const pendingNotifications: { booking_id: string; step_key: string; kind: string }[] = [];
  let seeded = 0, retargeted = 0;

  for (const b of active) {
    const rows = stepsByBooking.get(b.id) ?? [];
    const byKey = new Map(rows.map(r => [r.step_key, r]));

    // Real completion dates re-anchor the dependent steps.
    const completedOn: Partial<Record<WorkflowStepKey, string>> = {};
    for (const r of rows) {
      if (r.status === 'done' && r.completed_at) {
        completedOn[r.step_key] = r.completed_at.slice(0, 10);
      }
    }
    const targets = computeTargets(b.event_date, completedOn);

    // Seed missing steps / refresh drifted targets (reschedules, completions).
    for (const def of WORKFLOW_STEPS) {
      const want = targets[def.key];
      const row  = byKey.get(def.key);
      if (!row) {
        const { error: insErr } = await supa.from('booking_workflow_steps').insert({
          booking_id:    b.id,
          step_key:      def.key,
          target_date:   want.target,
          deadline_date: want.deadline,
        });
        if (insErr) console.error('seed failed', b.booking_ref, def.key, insErr.message);
        else seeded++;
      } else if (row.target_date !== want.target || row.deadline_date !== want.deadline) {
        const { error: updErr } = await supa.from('booking_workflow_steps')
          .update({ target_date: want.target, deadline_date: want.deadline })
          .eq('id', row.id);
        if (updErr) console.error('retarget failed', b.booking_ref, def.key, updErr.message);
        else retargeted++;
      }
    }

    // What needs the owner's confirmation today?
    const statuses: Partial<Record<WorkflowStepKey, WorkflowStatus>> = {};
    for (const r of rows) statuses[r.step_key] = r.status;

    const prompts = duePrompts({
      statuses, targets, now: today,
      sent: sentByBooking.get(b.id) ?? new Set<string>(),
    });
    for (const p of prompts) {
      const def = WORKFLOW_STEPS.find(d => d.key === p.stepKey)!;
      digest.push({
        bookingRef:   b.booking_ref,
        customerName: b.customer_name,
        eventDate:    b.event_date,
        stepTitleAr:  def.titleAr,
        kind:         p.kind,
        target:       p.target,
        deadline:     p.deadline,
        daysLate:     p.daysLate,
      });
      pendingNotifications.push({ booking_id: b.id, step_key: p.stepKey, kind: p.kind });
    }
  }

  // ── One digest email per run; record the guard rows only on real send so
  // a flaky SMTP session retries tomorrow instead of going silent. ─────────
  let emailStatus = 'skipped_empty';
  if (digest.length > 0) {
    // Overdue first, then most-late first — the owner reads the urgent top.
    digest.sort((a, z) =>
      (a.kind === z.kind ? z.daysLate - a.daysLate : a.kind === 'overdue' ? -1 : 1));

    const rendered = renderWorkflowDigestEmail({
      items: digest,
      adminUrl: `${SITE_ORIGIN}/#/admin/dashboard`,
    });
    const res = await sendEmail({
      to:       OWNER_EMAIL,
      subject:  rendered.subject,
      html:     rendered.html,
      text:     rendered.text,
      template: 'workflow_digest',
    });
    emailStatus = res.status;
    if (res.status === 'sent') {
      const { error: guardErr } = await supa.from('workflow_notifications')
        .insert(pendingNotifications);
      if (guardErr) console.error('notification guard insert failed:', guardErr.message);
    }
  }

  return jsonResponse({
    ok: true,
    scanned: active.length,
    seeded, retargeted,
    prompts: digest.length,
    email: emailStatus,
  });
});
