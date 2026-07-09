// ATEMA STUDIO — workflow policy tests.
//
// Exercises the pure module shared by the admin timeline and the
// workflow-reminders cron: contract-derived target dates, dependent-step
// re-anchoring, derived step state, and the owner-confirmation prompt
// selection (with its idempotence guard).

import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_STEPS, computeTargets, stepView, currentStepKey, duePrompts,
  promptDedupeKey, addDaysIso, daysBetween,
  type WorkflowStepKey, type WorkflowStatus,
} from '../../supabase/functions/_shared/workflow';

const EVENT = '2026-08-01';

describe('date helpers', () => {
  it('adds days across month boundaries', () => {
    expect(addDaysIso('2026-08-30', 3)).toBe('2026-09-02');
    expect(addDaysIso('2026-08-01', -1)).toBe('2026-07-31');
  });
  it('computes signed day differences', () => {
    expect(daysBetween('2026-08-01', '2026-08-04')).toBe(3);
    expect(daysBetween('2026-08-04', '2026-08-01')).toBe(-3);
    expect(daysBetween('bogus', '2026-08-01')).toBeNull();
  });
});

describe('computeTargets', () => {
  it('derives contract dates from the event date', () => {
    const t = computeTargets(EVENT);
    expect(t.final_payment.target).toBe('2026-07-31');   // event − 1 (المادة الثانية)
    expect(t.event.target).toBe(EVENT);
    expect(t.editing.target).toBe('2026-08-08');         // event + 7
    expect(t.editing.deadline).toBe('2026-08-15');       // event + 14
    expect(t.gallery.target).toBe(addDaysIso(EVENT, 120));
    expect(t.gallery.deadline).toBe(addDaysIso(EVENT, 180));   // المادة الرابعة
    expect(t.video.target).toBe(addDaysIso(EVENT, 120));
    expect(t.video.deadline).toBe(addDaysIso(EVENT, 120));     // single contract date
  });

  it('projects dependent steps from the parent deadline while unfinished', () => {
    const t = computeTargets(EVENT);
    // Review window: 14 days after gallery delivery. Unfinished gallery →
    // target projects from gallery.target, deadline from gallery.deadline,
    // so a dependent is never "overdue" while the parent is within contract.
    expect(t.review.target).toBe(addDaysIso(EVENT, 134));
    expect(t.review.deadline).toBe(addDaysIso(EVENT, 194));
    expect(t.album_selection.target).toBe(addDaysIso(EVENT, 134));
    expect(t.album_delivery.target).toBe(addDaysIso(EVENT, 164));
  });

  it('re-anchors dependent steps on the real completion date', () => {
    const galleryDone = addDaysIso(EVENT, 90);           // delivered early
    const t = computeTargets(EVENT, { gallery: galleryDone });
    expect(t.review.target).toBe(addDaysIso(galleryDone, 14));
    expect(t.review.deadline).toBe(addDaysIso(galleryDone, 14));
    expect(t.album_selection.target).toBe(addDaysIso(galleryDone, 14));
    // …and the album chains off the real selection date when known.
    const selDone = addDaysIso(galleryDone, 10);
    const t2 = computeTargets(EVENT, { gallery: galleryDone, album_selection: selDone });
    expect(t2.album_delivery.target).toBe(addDaysIso(selDone, 30));
  });
});

describe('stepView', () => {
  const base = { target: '2026-08-10', deadline: '2026-08-20' };
  it('walks upcoming → due → overdue as dates pass', () => {
    expect(stepView({ status: 'pending', ...base, now: '2026-08-09' })).toBe('upcoming');
    expect(stepView({ status: 'pending', ...base, now: '2026-08-10' })).toBe('due');
    expect(stepView({ status: 'pending', ...base, now: '2026-08-20' })).toBe('due');
    expect(stepView({ status: 'pending', ...base, now: '2026-08-21' })).toBe('overdue');
  });
  it('a started step still turns overdue past the contract deadline', () => {
    expect(stepView({ status: 'in_progress', ...base, now: '2026-08-15' })).toBe('in_progress');
    expect(stepView({ status: 'in_progress', ...base, now: '2026-08-21' })).toBe('overdue');
  });
  it('done and skipped are terminal regardless of dates', () => {
    expect(stepView({ status: 'done',    ...base, now: '2027-01-01' })).toBe('done');
    expect(stepView({ status: 'skipped', ...base, now: '2027-01-01' })).toBe('skipped');
  });
});

describe('currentStepKey', () => {
  it('is the first step that is neither done nor skipped, in ladder order', () => {
    expect(currentStepKey({})).toBe('final_payment');
    expect(currentStepKey({ final_payment: 'done', event: 'done' })).toBe('editing');
    expect(currentStepKey({ final_payment: 'done', event: 'skipped' })).toBe('editing');
  });
  it('is null when everything is closed out', () => {
    const all = Object.fromEntries(
      WORKFLOW_STEPS.map(d => [d.key, 'done' as WorkflowStatus]),
    ) as Record<WorkflowStepKey, WorkflowStatus>;
    expect(currentStepKey(all)).toBeNull();
  });
});

describe('duePrompts (owner-confirmation emails)', () => {
  function prompts(opts: {
    statuses?: Partial<Record<WorkflowStepKey, WorkflowStatus>>;
    now: string;
    sent?: string[];
  }) {
    const statuses = opts.statuses ?? {};
    const completedOn: Partial<Record<WorkflowStepKey, string>> = {};
    return duePrompts({
      statuses,
      targets: computeTargets(EVENT, completedOn),
      sent: new Set(opts.sent ?? []),
      now: opts.now,
    });
  }

  it('is silent before any target date', () => {
    expect(prompts({ now: '2026-07-29' })).toEqual([]);
  });

  it('asks "has it started?" when a pending step reaches its target', () => {
    const p = prompts({ now: '2026-07-31' });
    expect(p).toEqual([
      { stepKey: 'final_payment', kind: 'due', target: '2026-07-31', deadline: '2026-07-31', daysLate: 0 },
    ]);
  });

  it('escalates to "delayed" past the contract deadline, even when started', () => {
    const p = prompts({
      statuses: { final_payment: 'done', event: 'done', editing: 'in_progress' },
      now: '2026-08-16',           // editing deadline = event + 14 = 08-15
    });
    expect(p).toEqual([
      { stepKey: 'editing', kind: 'overdue', target: '2026-08-08', deadline: '2026-08-15', daysLate: 1 },
    ]);
  });

  it('never re-sends a (step, kind) already recorded', () => {
    const sent = [promptDedupeKey('final_payment', 'due')];
    expect(prompts({ now: '2026-07-31', sent })).toEqual([]);
    // …but the escalation still fires later.
    const later = prompts({ now: '2026-08-01', sent });
    expect(later.map(p => `${p.stepKey}|${p.kind}`)).toContain('final_payment|overdue');
  });

  it('does not nag about a started step at the due stage', () => {
    const p = prompts({ statuses: { final_payment: 'in_progress' }, now: '2026-07-31' });
    expect(p).toEqual([]);
  });

  it('holds dependent steps until their parent is done or skipped', () => {
    const lateDay = addDaysIso(EVENT, 200);   // past every projected date
    const noGallery = prompts({
      statuses: { final_payment: 'done', event: 'done', editing: 'done', video: 'done' },
      now: lateDay,
    });
    expect(noGallery.map(p => p.stepKey)).toEqual(['gallery']);   // only the parent nags

    const withGallery = prompts({
      statuses: { final_payment: 'done', event: 'done', editing: 'done', video: 'done', gallery: 'done' },
      now: lateDay,
    });
    expect(withGallery.map(p => p.stepKey)).toEqual(
      expect.arrayContaining(['review', 'album_selection']),
    );
  });

  it('ignores done and skipped steps entirely', () => {
    const all = Object.fromEntries(
      WORKFLOW_STEPS.map(d => [d.key, 'done' as WorkflowStatus]),
    ) as Record<WorkflowStepKey, WorkflowStatus>;
    expect(prompts({ statuses: all, now: addDaysIso(EVENT, 500) })).toEqual([]);
  });
});
