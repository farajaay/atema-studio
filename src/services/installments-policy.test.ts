// Unit tests for the installment-plan policy module — the pure math behind
// the admin «خطة التقسيط» card, the bride's manage-page schedule, and the
// reminder prompts in the workflow-reminders cron.

import { describe, it, expect } from 'vitest';
import {
  buildInstallmentPlan,
  rebalanceUnpaid,
  installmentProgress,
  installmentPrompts,
  installmentPromptKey,
  depositOf,
  BRIDE_LEAD_DAYS,
  OVERDUE_GRACE_DAYS,
  type InstallmentRow,
} from '../../supabase/functions/_shared/installments';

const row = (over: Partial<InstallmentRow> & { seq: number }): InstallmentRow => ({
  amount: 1000, due_date: '2026-10-01', paid_amount: null, paid_at: null, ...over,
});

describe('buildInstallmentPlan', () => {
  it('splits a Royal-sized total into 3 with the deposit as seq 1', () => {
    const plan = buildInstallmentPlan({
      total: 12880, count: 3, startDate: '2026-08-13', eventDate: '2026-12-01',
    })!;
    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({ seq: 1, amount: depositOf(12880), dueDate: '2026-08-13' });
    // Amounts always sum to exactly the total (last row absorbs rounding).
    expect(plan.reduce((s, r) => s + r.amount, 0)).toBe(12880);
    // Final installment lands on the contract hard stop: event − 1 day.
    expect(plan[2].dueDate).toBe('2026-11-30');
  });

  it('gives the rounding remainder to the LAST row, never the middle', () => {
    // total 10001 → deposit 5001 (Math.round), balance 5000 over 4 → 1250 each; clean.
    // total 10003 → deposit 5002, balance 5001 over 4 → 1250×3 + 1251 last.
    const plan = buildInstallmentPlan({
      total: 10003, count: 5, startDate: '2026-08-13', eventDate: '2026-12-01',
    })!;
    expect(plan.map(r => r.amount)).toEqual([5002, 1250, 1250, 1250, 1251]);
    expect(plan.reduce((s, r) => s + r.amount, 0)).toBe(10003);
  });

  it('spaces intermediate due dates evenly and monotonically', () => {
    const plan = buildInstallmentPlan({
      total: 20000, count: 5, startDate: '2026-08-01', eventDate: '2026-12-01',
    })!;
    const dates = plan.map(r => r.dueDate);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);                    // never goes backwards
    expect(dates[dates.length - 1]).toBe('2026-11-30');
  });

  it('rejects counts outside 3/4/5, bad totals, and events too close to split', () => {
    const base = { total: 10000, startDate: '2026-08-13', eventDate: '2026-12-01' };
    expect(buildInstallmentPlan({ ...base, count: 2 })).toBeNull();
    expect(buildInstallmentPlan({ ...base, count: 6 })).toBeNull();
    expect(buildInstallmentPlan({ ...base, count: 3, total: 0 })).toBeNull();
    // Event tomorrow → last due today → zero span, nothing to spread.
    expect(buildInstallmentPlan({
      total: 10000, count: 3, startDate: '2026-08-13', eventDate: '2026-08-14',
    })).toBeNull();
  });
});

describe('rebalanceUnpaid', () => {
  const rows: InstallmentRow[] = [
    row({ seq: 1, amount: 5000, paid_amount: 5000, paid_at: '2026-08-01T10:00:00Z' }),
    row({ seq: 2, amount: 2500 }),
    row({ seq: 3, amount: 2500 }),
  ];

  it('re-spreads the new remainder across unpaid rows, last absorbs rounding', () => {
    // Total moved 10,000 → 11,001 (e.g. an upgrade). Paid 5,000 → 6,001 left.
    expect(rebalanceUnpaid(rows, 11001)).toEqual([
      { seq: 2, amount: 3000 },
      { seq: 3, amount: 3001 },
    ]);
  });

  it('keeps actually-received amounts untouchable and floors at zero', () => {
    // Total dropped below what was already paid → unpaid rows go to 0.
    expect(rebalanceUnpaid(rows, 4000)).toEqual([
      { seq: 2, amount: 0 },
      { seq: 3, amount: 0 },
    ]);
  });

  it('returns null when every row is already paid', () => {
    const all = rows.map(r => ({ ...r, paid_at: '2026-08-02T10:00:00Z', paid_amount: r.amount }));
    expect(rebalanceUnpaid(all, 12000)).toBeNull();
  });
});

describe('installmentProgress', () => {
  it('sums paid vs planned, finds the next unpaid, flags overdue and settled', () => {
    const rows: InstallmentRow[] = [
      row({ seq: 1, amount: 5000, paid_amount: 5000, paid_at: '2026-08-01T10:00:00Z', due_date: '2026-08-01' }),
      row({ seq: 2, amount: 2500, due_date: '2026-09-01' }),
      row({ seq: 3, amount: 2500, due_date: '2026-10-01' }),
    ];
    const p = installmentProgress(rows, { now: '2026-09-05' });
    expect(p.plannedTotal).toBe(10000);
    expect(p.paidTotal).toBe(5000);
    expect(p.remainingTotal).toBe(5000);
    expect(p.next?.seq).toBe(2);
    expect(p.overdue.map(r => r.seq)).toEqual([2]);   // seq 3 not due yet
    expect(p.settled).toBe(false);
  });

  it('honours uneven received amounts (paid_amount overrides planned)', () => {
    const rows: InstallmentRow[] = [
      row({ seq: 1, amount: 5000, paid_amount: 5000, paid_at: '2026-08-01T00:00:00Z' }),
      row({ seq: 2, amount: 2500, paid_amount: 3000, paid_at: '2026-09-01T00:00:00Z' }),
      row({ seq: 3, amount: 2500 }),
    ];
    const p = installmentProgress(rows, { now: '2026-09-02' });
    expect(p.paidTotal).toBe(8000);
    expect(p.remainingTotal).toBe(2000);
  });

  it('reports settled once the received sum covers the plan', () => {
    const rows: InstallmentRow[] = [
      row({ seq: 1, amount: 5000, paid_amount: 5000, paid_at: '2026-08-01T00:00:00Z' }),
      row({ seq: 2, amount: 5000, paid_amount: 5000, paid_at: '2026-09-01T00:00:00Z' }),
    ];
    expect(installmentProgress(rows, { now: '2026-09-02' }).settled).toBe(true);
    expect(installmentProgress([], {}).settled).toBe(false);   // empty ≠ settled
  });
});

describe('installmentPrompts', () => {
  const sentNone = new Set<string>();

  it('warns the bride inside the lead window but never about the deposit', () => {
    const rows: InstallmentRow[] = [
      row({ seq: 1, amount: 5000, due_date: '2026-09-01' }),   // deposit, unpaid, in window
      row({ seq: 2, amount: 2500, due_date: '2026-09-03' }),   // in window (2 days out)
      row({ seq: 3, amount: 2500, due_date: '2026-09-20' }),   // outside window
    ];
    const prompts = installmentPrompts({ rows, sent: sentNone, now: '2026-09-01' });
    const bride = prompts.filter(p => p.kind === 'bride_upcoming');
    expect(bride).toHaveLength(1);
    expect(bride[0]).toMatchObject({ seq: 2, days: 2 });
  });

  it('escalates the owner line from due to overdue past the grace window', () => {
    const rows: InstallmentRow[] = [
      row({ seq: 2, amount: 2500, due_date: '2026-09-01' }),
    ];
    const onDay = installmentPrompts({ rows, sent: sentNone, now: '2026-09-01' });
    expect(onDay.find(p => p.kind === 'due')).toMatchObject({ seq: 2, days: 0 });

    const late = installmentPrompts({
      rows, sent: sentNone, now: `2026-09-0${2 + OVERDUE_GRACE_DAYS}`,
    });
    expect(late.find(p => p.kind === 'overdue')).toMatchObject({ seq: 2 });
    expect(late.find(p => p.kind === 'due')).toBeUndefined();
  });

  it('is silent for paid rows and deduped (seq|kind) keys', () => {
    const rows: InstallmentRow[] = [
      row({ seq: 2, amount: 2500, due_date: '2026-09-01', paid_amount: 2500, paid_at: '2026-08-30T00:00:00Z' }),
      row({ seq: 3, amount: 2500, due_date: '2026-09-01' }),
    ];
    const sent = new Set([installmentPromptKey(3, 'due'), installmentPromptKey(3, 'bride_upcoming')]);
    expect(installmentPrompts({ rows, sent, now: '2026-09-01' })).toEqual([]);
  });

  it('uses the documented lead window constant', () => {
    const rows: InstallmentRow[] = [row({ seq: 2, amount: 100, due_date: '2026-09-10' })];
    const justInside = installmentPrompts({
      rows, sent: sentNone, now: `2026-09-0${10 - BRIDE_LEAD_DAYS}`,
    });
    expect(justInside.find(p => p.kind === 'bride_upcoming')).toBeTruthy();
    const justOutside = installmentPrompts({
      rows, sent: sentNone, now: `2026-09-0${10 - BRIDE_LEAD_DAYS - 1}`,
    });
    expect(justOutside.find(p => p.kind === 'bride_upcoming')).toBeUndefined();
  });
});
