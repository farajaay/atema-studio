// ATEMA STUDIO — Booking-change policy (reschedule eligibility).
//
// Encodes the rescheduling rules from the customer contract (العقد، المادة
// الثالثة): a booking may be postponed ONCE, with at least 7 days' notice,
// to a date within 30 days of the original, and subject to availability.
// Availability itself is checked server-side against the calendar; this module
// covers the policy that can be decided from the booking alone.
//
// Single source of truth for both the client (to disable invalid choices and
// show reasons) and the change-booking Edge Function (which enforces it
// authoritatively). Dependency-free so it imports in the browser, the Deno
// edge runtime, and Vitest.

export const RESCHEDULE_MIN_NOTICE_DAYS = 7;
export const RESCHEDULE_MAX_WINDOW_DAYS = 30;
export const RESCHEDULE_MAX_COUNT = 1;

const DAY_MS = 86_400_000;

function toUtcMidnight(isoDate: string): number | null {
  const t = new Date(isoDate + 'T00:00:00Z').getTime();
  return Number.isNaN(t) ? null : t;
}

/** Whole days from `fromIso` to `toIso` (date-only, UTC). Negative if toIso is
 *  earlier. Null if either input is not a valid date. */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = toUtcMidnight(fromIso);
  const b = toUtcMidnight(toIso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Eligibility ────────────────────────────────────────────────────────────
export type RescheduleReason =
  | 'ok'
  | 'cancelled'
  | 'already_rescheduled'
  | 'too_close'
  | 'event_passed';

/** Can this booking be rescheduled at all (independent of the new date)? */
export function canReschedule(opts: {
  eventDate: string;              // current event date, YYYY-MM-DD
  status?: string;                // booking.status
  rescheduleCount?: number;       // how many times already moved
  now?: string;                   // YYYY-MM-DD, defaults to today (UTC)
}): { allowed: boolean; reason: RescheduleReason } {
  const now = opts.now ?? todayUtc();
  if ((opts.status ?? '') === 'cancelled') return { allowed: false, reason: 'cancelled' };
  if ((opts.rescheduleCount ?? 0) >= RESCHEDULE_MAX_COUNT) {
    return { allowed: false, reason: 'already_rescheduled' };
  }
  const days = daysBetween(now, opts.eventDate);
  if (days === null || days < 0) return { allowed: false, reason: 'event_passed' };
  if (days < RESCHEDULE_MIN_NOTICE_DAYS) return { allowed: false, reason: 'too_close' };
  return { allowed: true, reason: 'ok' };
}

// ── New-date validation ──────────────────────────────────────────────────
export type NewDateReason =
  | 'ok'
  | 'same_date'
  | 'new_date_past'
  | 'new_date_too_far'
  | 'invalid';

/** Is the requested new date acceptable per policy? (Availability is checked
 *  separately, server-side, against the calendar.) */
export function validateNewDate(opts: {
  originalEventDate: string;
  newEventDate: string;
  now?: string;
}): { allowed: boolean; reason: NewDateReason } {
  const now = opts.now ?? todayUtc();
  if (opts.newEventDate === opts.originalEventDate) return { allowed: false, reason: 'same_date' };

  const fromNow = daysBetween(now, opts.newEventDate);
  if (fromNow === null) return { allowed: false, reason: 'invalid' };
  if (fromNow <= 0) return { allowed: false, reason: 'new_date_past' };

  const fromOriginal = daysBetween(opts.originalEventDate, opts.newEventDate);
  if (fromOriginal === null) return { allowed: false, reason: 'invalid' };
  if (Math.abs(fromOriginal) > RESCHEDULE_MAX_WINDOW_DAYS) {
    return { allowed: false, reason: 'new_date_too_far' };
  }
  return { allowed: true, reason: 'ok' };
}

// ── Localized reason copy (for the manage page) ────────────────────────────
export function rescheduleReasonText(
  reason: RescheduleReason | NewDateReason,
  lang: 'ar' | 'en',
): string {
  const ar: Record<string, string> = {
    ok: '',
    cancelled: 'هذا الحجز ملغى ولا يمكن تعديله.',
    already_rescheduled: 'تم تأجيل هذا الحجز مسبقاً مرة واحدة، ولا يمكن تأجيله مجدداً.',
    too_close: 'لا يمكن التأجيل قبل أقل من ٧ أيام من موعد المناسبة. تواصلي معنا مباشرة.',
    event_passed: 'انقضى موعد المناسبة.',
    same_date: 'التاريخ الجديد مطابق للتاريخ الحالي.',
    new_date_past: 'يرجى اختيار تاريخ في المستقبل.',
    new_date_too_far: 'يمكن التأجيل ضمن ٣٠ يوماً من الموعد الأصلي فقط.',
    invalid: 'التاريخ غير صالح.',
  };
  const en: Record<string, string> = {
    ok: '',
    cancelled: 'This booking is cancelled and cannot be changed.',
    already_rescheduled: 'This booking has already been rescheduled once and cannot be moved again.',
    too_close: 'Rescheduling is not available within 7 days of the event. Please contact us directly.',
    event_passed: 'The event date has passed.',
    same_date: 'The new date is the same as the current date.',
    new_date_past: 'Please choose a date in the future.',
    new_date_too_far: 'Rescheduling is only allowed within 30 days of the original date.',
    invalid: 'That date is not valid.',
  };
  return (lang === 'ar' ? ar : en)[reason] ?? '';
}
