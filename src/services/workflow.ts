// ATEMA STUDIO — Booking workflow service (admin side).
//
// The workflow tracker shows where a booking stands in the contract-derived
// production ladder (final payment → event → editing → gallery → film →
// review → album) and lets Fatima confirm each step: started, done, skipped
// — the same confirmations the workflow-reminders cron emails her about.
//
// All policy (step ladder, target dates, lateness) lives in the pure module
// supabase/functions/_shared/workflow.ts — shared with the Edge cron so the
// dates in her inbox and in this tab can never disagree. This service is
// only the Supabase glue. Pairs with database/migrations-2026-07-workflow.sql.

import { supabase } from './supabase';
import {
  WORKFLOW_STEPS, computeTargets,
  type WorkflowStepKey, type WorkflowStatus,
} from '../../supabase/functions/_shared/workflow';

export interface WorkflowStepRow {
  id: string;
  booking_id: string;
  step_key: WorkflowStepKey;
  status: WorkflowStatus;
  target_date: string;
  deadline_date: string;
  started_at: string | null;
  completed_at: string | null;
  note: string | null;
}

const STEP_ORDER = new Map(WORKFLOW_STEPS.map(d => [d.key, d.order]));

function sortLadder(rows: WorkflowStepRow[]): WorkflowStepRow[] {
  return [...rows].sort(
    (a, z) => (STEP_ORDER.get(a.step_key) ?? 99) - (STEP_ORDER.get(z.step_key) ?? 99),
  );
}

/**
 * Load the workflow ladder for a booking, seeding it (and re-anchoring
 * dependent targets after completions/reschedules) on the way — the same
 * reconciliation the cron performs, so whichever side touches a booking
 * first materialises the ladder. Returns null when Supabase is not
 * configured or the table is missing (migration not yet applied).
 */
export async function fetchWorkflowSteps(
  bookingId: string,
  eventDate: string,
): Promise<WorkflowStepRow[] | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('booking_workflow_steps')
    .select('id, booking_id, step_key, status, target_date, deadline_date, started_at, completed_at, note')
    .eq('booking_id', bookingId);
  if (error) {
    console.error('[workflow] fetch failed:', error.message);
    return null;
  }

  const rows  = (data ?? []) as WorkflowStepRow[];
  const byKey = new Map(rows.map(r => [r.step_key, r]));

  const completedOn: Partial<Record<WorkflowStepKey, string>> = {};
  for (const r of rows) {
    if (r.status === 'done' && r.completed_at) completedOn[r.step_key] = r.completed_at.slice(0, 10);
  }
  const targets = computeTargets(eventDate, completedOn);

  for (const def of WORKFLOW_STEPS) {
    const want = targets[def.key];
    const row  = byKey.get(def.key);
    if (!row) {
      const { data: ins, error: insErr } = await supabase
        .from('booking_workflow_steps')
        .insert({
          booking_id: bookingId, step_key: def.key,
          target_date: want.target, deadline_date: want.deadline,
        })
        .select('id, booking_id, step_key, status, target_date, deadline_date, started_at, completed_at, note')
        .single();
      if (insErr || !ins) {
        console.error('[workflow] seed failed:', insErr?.message);
        return null;
      }
      rows.push(ins as WorkflowStepRow);
    } else if (row.target_date !== want.target || row.deadline_date !== want.deadline) {
      const { error: updErr } = await supabase
        .from('booking_workflow_steps')
        .update({ target_date: want.target, deadline_date: want.deadline })
        .eq('id', row.id);
      if (!updErr) { row.target_date = want.target; row.deadline_date = want.deadline; }
    }
  }

  return sortLadder(rows);
}

/**
 * Confirm a step's state. Timestamps follow the status: started_at stamps on
 * in_progress (kept when advancing to done), completed_at stamps on done and
 * clears otherwise; reverting to pending clears both. After a completion the
 * caller should refetch — dependent steps re-anchor on the real date.
 */
export async function updateWorkflowStep(
  step: WorkflowStepRow,
  status: WorkflowStatus,
  note?: string,
): Promise<boolean> {
  if (!supabase) return false;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  patch.started_at   = (status === 'in_progress' || status === 'done') ? (step.started_at ?? now) : null;
  patch.completed_at = status === 'done' ? (step.completed_at ?? now) : null;
  if (note !== undefined) patch.note = note.trim() || null;

  const { error } = await supabase
    .from('booking_workflow_steps')
    .update(patch)
    .eq('id', step.id);
  if (error) console.error('[workflow] update failed:', error.message);
  return !error;
}
