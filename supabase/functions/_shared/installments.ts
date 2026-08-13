// ATEMA STUDIO — Installment-plan policy (خطة التقسيط).
//
// Encodes the split-payment rules the owner offers on high-value bookings:
// the booking total divided over 3, 4 or 5 دفعات where the existing 50%
// deposit IS installment #1 (the booking flow stays untouched) and the
// remaining balance spreads across the rest. The contract's hard stop holds:
// the final installment is due one day before the event (المادة الثانية).
//
// Single source of truth for the admin «خطة التقسيط» card, the bride's
// manage-page schedule, and the workflow-reminders cron. Dependency-free so
// it imports in the browser, the Deno edge runtime, and Vitest — the same
// discipline as reschedule.ts / workflow.ts.

export const INSTALLMENT_COUNTS = [3, 4, 5] as const;
export type InstallmentCount = (typeof INSTALLMENT_COUNTS)[number];

/** Same rule as BookingPage / create-booking / documents.ts — the deposit is
 *  derived, never stored. Keep the four call sites and this one in lock-step. */
export function depositOf(total: number): number {
  return Math.round(total * 0.5);
}

// ── Date helpers (date-only, UTC — same discipline as workflow.ts) ─────────
const DAY_MS = 86_400_000;

function toUtcMidnight(isoDate: string): number | null {
  const t = new Date(isoDate + 'T00:00:00Z').getTime();
  return Number.isNaN(t) ? null : t;
}

export function addDaysIso(isoDate: string, days: number): string {
  const t = toUtcMidnight(isoDate);
  if (t === null) return isoDate;
  return new Date(t + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso`. Negative when toIso is earlier. */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = toUtcMidnight(fromIso);
  const b = toUtcMidnight(toIso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Plan construction ──────────────────────────────────────────────────────
export interface PlannedInstallment {
  seq:     number;   // 1-based; seq 1 = the deposit
  amount:  number;   // whole SAR
  dueDate: string;   // yyyy-mm-dd
}

/**
 * Build a plan of `count` installments for a booking.
 *
 * - seq 1 = the 50% deposit, due on `startDate` (plan-creation day). It is
 *   normally already paid — the caller marks it so from payment_status.
 * - The balance splits evenly across the remaining rows in whole SAR; the
 *   LAST row absorbs the rounding remainder so the plan always sums to
 *   exactly `total`.
 * - The last installment is due `eventDate − 1 day` (contract hard stop);
 *   the intermediates space evenly between startDate and that stop. When
 *   the event is too close for real spacing, dates clamp forward — the
 *   admin can still hand-adjust expectations, the sums stay right.
 *
 * Returns null when the inputs can't make a plan (bad count, non-positive
 * total, event not after startDate).
 */
export function buildInstallmentPlan(opts: {
  total:     number;
  count:     number;
  startDate: string;   // yyyy-mm-dd — plan creation day
  eventDate: string;   // yyyy-mm-dd
}): PlannedInstallment[] | null {
  const { total, count, startDate, eventDate } = opts;
  if (!(INSTALLMENT_COUNTS as readonly number[]).includes(count)) return null;
  if (!Number.isFinite(total) || total <= 0) return null;

  const lastDue = addDaysIso(eventDate, -1);
  const span = daysBetween(startDate, lastDue);
  if (span === null || span < 1) return null;   // event today/tomorrow — nothing to split

  const deposit = depositOf(total);
  const balance = total - deposit;
  const rest = count - 1;
  const base = Math.floor(balance / rest);

  const rows: PlannedInstallment[] = [{ seq: 1, amount: deposit, dueDate: startDate }];
  for (let i = 1; i <= rest; i++) {
    rows.push({
      seq: i + 1,
      // Last row absorbs the remainder so Σ amounts === total exactly.
      amount: i === rest ? balance - base * (rest - 1) : base,
      dueDate: addDaysIso(startDate, Math.round((i * span) / rest)),
    });
  }
  return rows;
}

/**
 * Re-spread the outstanding remainder across the UNPAID rows after the
 * booking total changed (VAT toggle, package change). Paid rows keep what
 * was actually received; due dates keep their places; only unpaid amounts
 * move. Returns the new amount per unpaid row id/seq, or null when there is
 * nothing sensible to do (no unpaid rows, or the paid sum already covers
 * the new total — then unpaid rows go to 0).
 */
export function rebalanceUnpaid(
  rows: readonly InstallmentRow[],
  newTotal: number,
): { seq: number; amount: number }[] | null {
  const unpaid = rows.filter(r => !r.paid_at).sort((a, z) => a.seq - z.seq);
  if (unpaid.length === 0) return null;
  const paidSum = rows.reduce((s, r) => s + (r.paid_at ? (r.paid_amount ?? r.amount) : 0), 0);
  const remainder = Math.max(0, newTotal - paidSum);
  const base = Math.floor(remainder / unpaid.length);
  return unpaid.map((r, i) => ({
    seq: r.seq,
    amount: i === unpaid.length - 1 ? remainder - base * (unpaid.length - 1) : base,
  }));
}

// ── Progress / derived state ───────────────────────────────────────────────
export interface InstallmentRow {
  seq:         number;
  amount:      number;
  due_date:    string;
  paid_amount: number | null;
  paid_at:     string | null;   // timestamptz ISO or null — null = unpaid
  note?:       string | null;
}

export interface InstallmentProgress {
  plannedTotal:   number;
  paidTotal:      number;
  remainingTotal: number;               // planned − paid, floored at 0
  next:           InstallmentRow | null; // first unpaid by seq
  overdue:        InstallmentRow[];      // unpaid with due_date strictly past
  settled:        boolean;               // paid covers the planned total
}

export function installmentProgress(
  rows: readonly InstallmentRow[],
  opts: { now?: string } = {},
): InstallmentProgress {
  const now = opts.now ?? todayUtc();
  const sorted = [...rows].sort((a, z) => a.seq - z.seq);
  const plannedTotal = sorted.reduce((s, r) => s + r.amount, 0);
  const paidTotal = sorted.reduce(
    (s, r) => s + (r.paid_at ? (r.paid_amount ?? r.amount) : 0), 0);
  const unpaid = sorted.filter(r => !r.paid_at);
  return {
    plannedTotal,
    paidTotal,
    remainingTotal: Math.max(0, plannedTotal - paidTotal),
    next: unpaid[0] ?? null,
    overdue: unpaid.filter(r => (daysBetween(r.due_date, now) ?? 0) > 0),
    settled: sorted.length > 0 && paidTotal >= plannedTotal,
  };
}

// ── Reminder prompts (the email side) ──────────────────────────────────────
// Owner (rides the daily workflow digest):
//   'due'            → due date reached, still unpaid: "حان موعد الدفعة".
//   'overdue'        → BRIDE_GRACE_DAYS past due, still unpaid.
// Bride (individual email):
//   'bride_upcoming' → within BRIDE_LEAD_DAYS before (or on) the due date.
// Each (booking, seq, kind) fires once; installment_notifications is the
// dedupe guard (mirrors wa_reminders_sent / workflow_notifications).

export type InstallmentPromptKind = 'due' | 'overdue' | 'bride_upcoming';

/** Days before the due date the bride's reminder goes out. */
export const BRIDE_LEAD_DAYS = 3;
/** Days past due before the owner's line escalates from 'due' to 'overdue'. */
export const OVERDUE_GRACE_DAYS = 3;

export interface InstallmentPrompt {
  seq:      number;
  kind:     InstallmentPromptKind;
  dueDate:  string;
  amount:   number;
  /** Days past due ('due'/'overdue') or until due ('bride_upcoming'). */
  days:     number;
}

export function installmentPromptKey(seq: number, kind: string): string {
  return `${seq}|${kind}`;
}

export function installmentPrompts(opts: {
  rows: readonly InstallmentRow[];
  /** Already-notified (seq|kind) keys for this booking. */
  sent: Set<string>;
  now?: string;
}): InstallmentPrompt[] {
  const now = opts.now ?? todayUtc();
  const prompts: InstallmentPrompt[] = [];

  for (const r of opts.rows) {
    if (r.paid_at) continue;
    const pastDue = daysBetween(r.due_date, now);
    if (pastDue === null) continue;

    // Bride: gentle heads-up in the lead window (includes the due day).
    if (
      pastDue >= -BRIDE_LEAD_DAYS && pastDue <= 0 &&
      // The deposit (seq 1) is due at plan creation and communicated at
      // booking time — reminding the bride about it would read as a dunning
      // notice for a payment she made weeks ago or is actively making.
      r.seq > 1 &&
      !opts.sent.has(installmentPromptKey(r.seq, 'bride_upcoming'))
    ) {
      prompts.push({ seq: r.seq, kind: 'bride_upcoming', dueDate: r.due_date, amount: r.amount, days: -pastDue });
    }

    // Owner: due on the day, escalating to overdue after the grace window.
    if (pastDue > OVERDUE_GRACE_DAYS && !opts.sent.has(installmentPromptKey(r.seq, 'overdue'))) {
      prompts.push({ seq: r.seq, kind: 'overdue', dueDate: r.due_date, amount: r.amount, days: pastDue });
    } else if (
      pastDue >= 0 && pastDue <= OVERDUE_GRACE_DAYS &&
      !opts.sent.has(installmentPromptKey(r.seq, 'due'))
    ) {
      prompts.push({ seq: r.seq, kind: 'due', dueDate: r.due_date, amount: r.amount, days: pastDue });
    }
  }
  return prompts;
}

// ── Copy helpers (shared by admin card, manage page, emails) ───────────────
const ORDINALS_AR = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'];

export function installmentLabelAr(seq: number, count: number): string {
  const ord = ORDINALS_AR[seq - 1] ?? String(seq);
  return seq === 1
    ? `الدفعة الأولى (العربون)`
    : `الدفعة ${ord} من ${count === 3 ? 'ثلاث' : count === 4 ? 'أربع' : 'خمس'}`;
}

export function installmentLabelEn(seq: number, count: number): string {
  return seq === 1 ? 'Installment 1 (deposit)' : `Installment ${seq} of ${count}`;
}
