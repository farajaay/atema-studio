// ATEMA STUDIO — Booking production-workflow policy.
//
// Encodes the delivery timeline the customer contract promises (العقد،
// المادة الثانية/الرابعة/الخامسة) as a ladder of trackable steps, each with
// a target date and a contract deadline derived from the event date:
//
//   final_payment    الدفعة الثانية        event − 1 day        (المادة الثانية)
//   event            يوم المناسبة          event day
//   editing          بدء تعديل الصور       event + 7            (internal studio target)
//   gallery          تسليم رابط المعرض     event + 120 … 180    (المادة الرابعة)
//   video            تسليم الفيلم          event + 120          (المادة الرابعة)
//   review           جولة المراجعة         gallery + 14         (المادة الرابعة مكرر)
//   album_selection  اختيار صور الألبوم    gallery + 14         (المادة الخامسة)
//   album_delivery   تسليم الألبوم         selection + 30       (internal studio target)
//
// Steps anchored on a previous step ("after") project their target from the
// parent's target until the parent actually completes, then re-anchor on the
// real completion date. This module also decides which owner-confirmation
// emails are due ("has this step started, or is it delayed?") — the
// workflow-reminders cron enforces it, the admin WorkflowTracker displays it.
//
// Single source of truth for the client (src/services/workflow.ts + the
// admin timeline) and the workflow-reminders Edge Function. Dependency-free
// so it imports in the browser, the Deno edge runtime, and Vitest.

export type WorkflowStepKey =
  | 'final_payment'
  | 'event'
  | 'editing'
  | 'gallery'
  | 'video'
  | 'review'
  | 'album_selection'
  | 'album_delivery';

export type WorkflowStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface WorkflowStepDef {
  key:      WorkflowStepKey;
  order:    number;
  titleAr:  string;
  titleEn:  string;
  /** What the target date counts from: the event day, or a previous step. */
  anchor:   'event' | { after: WorkflowStepKey };
  /** Days from the anchor date to the target ("should have started/happened"). */
  offsetDays: number;
  /** Days from the anchor date to the contract deadline. Past this = overdue.
   *  Defaults to offsetDays when the contract gives a single date. */
  deadlineDays?: number;
}

export const WORKFLOW_STEPS: readonly WorkflowStepDef[] = [
  { key: 'final_payment',   order: 1, titleAr: 'تحصيل الدفعة الثانية',      titleEn: 'Collect final payment',
    anchor: 'event', offsetDays: -1 },
  { key: 'event',           order: 2, titleAr: 'يوم المناسبة',              titleEn: 'Event day',
    anchor: 'event', offsetDays: 0 },
  { key: 'editing',         order: 3, titleAr: 'بدء تعديل الصور',           titleEn: 'Start photo editing',
    anchor: 'event', offsetDays: 7, deadlineDays: 14 },
  { key: 'gallery',         order: 4, titleAr: 'تسليم رابط المعرض (الصور المعدّلة)', titleEn: 'Deliver gallery link (edited photos)',
    anchor: 'event', offsetDays: 120, deadlineDays: 180 },
  { key: 'video',           order: 5, titleAr: 'تسليم الفيلم السينمائي',    titleEn: 'Deliver cinematic film',
    anchor: 'event', offsetDays: 120 },
  { key: 'review',          order: 6, titleAr: 'جولة المراجعة (١٤ يوماً)',   titleEn: 'Review round (14 days)',
    anchor: { after: 'gallery' }, offsetDays: 14 },
  { key: 'album_selection', order: 7, titleAr: 'اختيار صور الألبوم',        titleEn: 'Album photo selection',
    anchor: { after: 'gallery' }, offsetDays: 14 },
  { key: 'album_delivery',  order: 8, titleAr: 'تسليم الألبوم المطبوع',     titleEn: 'Deliver printed album',
    anchor: { after: 'album_selection' }, offsetDays: 30 },
] as const;

export function workflowStepDef(key: WorkflowStepKey): WorkflowStepDef {
  return WORKFLOW_STEPS.find(s => s.key === key)!;
}

// ── Date helpers (date-only, UTC — same discipline as reschedule.ts) ────────
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

// ── Target computation ──────────────────────────────────────────────────────
export interface StepDates { target: string; deadline: string }

/**
 * Compute every step's target + deadline for a booking.
 *
 * `completedOn` maps a step key to the DATE (yyyy-mm-dd) it was actually
 * completed, when known. Steps anchored `{ after: X }` count from X's real
 * completion date when present, otherwise from X's projected DEADLINE (the
 * latest date the contract allows X to happen — projecting from the deadline
 * avoids flagging a dependent step "overdue" while its parent is still
 * within contract).
 */
export function computeTargets(
  eventDate: string,
  completedOn: Partial<Record<WorkflowStepKey, string>> = {},
): Record<WorkflowStepKey, StepDates> {
  const out = {} as Record<WorkflowStepKey, StepDates>;
  for (const def of WORKFLOW_STEPS) {           // defs are in dependency order
    let anchorTarget: string;
    let anchorDeadline: string;
    if (def.anchor === 'event') {
      anchorTarget = anchorDeadline = eventDate;
    } else {
      const parentDone = completedOn[def.anchor.after];
      if (parentDone) {
        anchorTarget = anchorDeadline = parentDone;
      } else {
        anchorTarget   = out[def.anchor.after].target;
        anchorDeadline = out[def.anchor.after].deadline;
      }
    }
    out[def.key] = {
      target:   addDaysIso(anchorTarget,   def.offsetDays),
      deadline: addDaysIso(anchorDeadline, def.deadlineDays ?? def.offsetDays),
    };
  }
  return out;
}

// ── Derived step state ──────────────────────────────────────────────────────
export type StepView = 'upcoming' | 'due' | 'overdue' | 'in_progress' | 'done' | 'skipped';

export function stepView(opts: {
  status:   WorkflowStatus;
  target:   string;
  deadline: string;
  now?:     string;                 // yyyy-mm-dd, defaults to today (UTC)
}): StepView {
  const now = opts.now ?? todayUtc();
  if (opts.status === 'done')    return 'done';
  if (opts.status === 'skipped') return 'skipped';
  const pastDeadline = (daysBetween(opts.deadline, now) ?? 0) > 0;
  if (pastDeadline) return 'overdue';           // even if started — it's late
  if (opts.status === 'in_progress') return 'in_progress';
  const reached = (daysBetween(opts.target, now) ?? -1) >= 0;
  return reached ? 'due' : 'upcoming';
}

/** First step (in ladder order) that is neither done nor skipped. */
export function currentStepKey(
  statuses: Partial<Record<WorkflowStepKey, WorkflowStatus>>,
): WorkflowStepKey | null {
  for (const def of WORKFLOW_STEPS) {
    const s = statuses[def.key] ?? 'pending';
    if (s !== 'done' && s !== 'skipped') return def.key;
  }
  return null;
}

// ── Owner-confirmation prompts (the email side) ─────────────────────────────
// 'due'     → target date reached and the step hasn't been confirmed started:
//             "هل بدأت هذه المرحلة؟"
// 'overdue' → contract deadline passed and the step still isn't done:
//             "هذه المرحلة متأخرة — أكّدي حالتها."
// Each (step, kind) fires once per booking; the workflow_notifications table
// is the dedupe guard (mirrors wa_reminders_sent).

export type PromptKind = 'due' | 'overdue';

export interface OwnerPrompt {
  stepKey:  WorkflowStepKey;
  kind:     PromptKind;
  target:   string;
  deadline: string;
  /** Days past the relevant date (target for 'due', deadline for 'overdue'). */
  daysLate: number;
}

export function promptDedupeKey(stepKey: string, kind: string): string {
  return `${stepKey}|${kind}`;
}

export function duePrompts(opts: {
  statuses: Partial<Record<WorkflowStepKey, WorkflowStatus>>;
  targets:  Record<WorkflowStepKey, StepDates>;
  /** Already-notified (step|kind) keys for this booking. */
  sent:     Set<string>;
  now?:     string;
}): OwnerPrompt[] {
  const now = opts.now ?? todayUtc();
  const prompts: OwnerPrompt[] = [];

  for (const def of WORKFLOW_STEPS) {
    const status = opts.statuses[def.key] ?? 'pending';
    if (status === 'done' || status === 'skipped') continue;

    // Don't nag about a dependent step while its parent hasn't happened —
    // the parent's own prompts carry the lateness signal.
    if (def.anchor !== 'event') {
      const parent = opts.statuses[def.anchor.after] ?? 'pending';
      if (parent !== 'done' && parent !== 'skipped') continue;
    }

    const { target, deadline } = opts.targets[def.key];
    const pastTarget   = daysBetween(target,   now) ?? -1;
    const pastDeadline = daysBetween(deadline, now) ?? -1;

    if (pastDeadline > 0 && !opts.sent.has(promptDedupeKey(def.key, 'overdue'))) {
      prompts.push({ stepKey: def.key, kind: 'overdue', target, deadline, daysLate: pastDeadline });
    } else if (
      pastTarget >= 0 && status === 'pending' &&
      !opts.sent.has(promptDedupeKey(def.key, 'due'))
    ) {
      prompts.push({ stepKey: def.key, kind: 'due', target, deadline, daysLate: pastTarget });
    }
  }
  return prompts;
}
