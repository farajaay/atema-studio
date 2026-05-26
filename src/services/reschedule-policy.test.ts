import { describe, it, expect } from 'vitest';
import {
  canReschedule,
  validateNewDate,
  daysBetween,
  rescheduleReasonText,
  RESCHEDULE_MIN_NOTICE_DAYS,
} from '../../supabase/functions/_shared/reschedule';

const NOW = '2026-06-01';

describe('daysBetween', () => {
  it('counts whole UTC days, signed', () => {
    expect(daysBetween('2026-06-01', '2026-06-08')).toBe(7);
    expect(daysBetween('2026-06-08', '2026-06-01')).toBe(-7);
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0);
  });

  it('returns null for invalid dates', () => {
    expect(daysBetween('not-a-date', '2026-06-01')).toBeNull();
  });
});

describe('canReschedule', () => {
  it('allows a future booking with enough notice and no prior move', () => {
    expect(canReschedule({ eventDate: '2026-07-01', now: NOW })).toEqual({ allowed: true, reason: 'ok' });
  });

  it('allows exactly at the 7-day notice boundary', () => {
    const at = canReschedule({ eventDate: '2026-06-08', now: NOW }); // 7 days out
    expect(at.allowed).toBe(true);
    expect(RESCHEDULE_MIN_NOTICE_DAYS).toBe(7);
  });

  it('blocks within the 7-day notice window', () => {
    expect(canReschedule({ eventDate: '2026-06-05', now: NOW }))
      .toEqual({ allowed: false, reason: 'too_close' });
  });

  it('blocks a booking already rescheduled once', () => {
    expect(canReschedule({ eventDate: '2026-07-01', rescheduleCount: 1, now: NOW }))
      .toEqual({ allowed: false, reason: 'already_rescheduled' });
  });

  it('blocks a cancelled booking', () => {
    expect(canReschedule({ eventDate: '2026-07-01', status: 'cancelled', now: NOW }))
      .toEqual({ allowed: false, reason: 'cancelled' });
  });

  it('blocks a past event', () => {
    expect(canReschedule({ eventDate: '2026-05-01', now: NOW }))
      .toEqual({ allowed: false, reason: 'event_passed' });
  });
});

describe('validateNewDate', () => {
  const original = '2026-07-01';

  it('accepts a future date within 30 days of the original', () => {
    expect(validateNewDate({ originalEventDate: original, newEventDate: '2026-07-15', now: NOW }))
      .toEqual({ allowed: true, reason: 'ok' });
  });

  it('accepts exactly 30 days from the original', () => {
    expect(validateNewDate({ originalEventDate: original, newEventDate: '2026-07-31', now: NOW }).allowed).toBe(true);
  });

  it('rejects more than 30 days from the original', () => {
    expect(validateNewDate({ originalEventDate: original, newEventDate: '2026-08-15', now: NOW }))
      .toEqual({ allowed: false, reason: 'new_date_too_far' });
  });

  it('rejects the same date', () => {
    expect(validateNewDate({ originalEventDate: original, newEventDate: original, now: NOW }))
      .toEqual({ allowed: false, reason: 'same_date' });
  });

  it('rejects a date in the past', () => {
    expect(validateNewDate({ originalEventDate: original, newEventDate: '2026-05-20', now: NOW }))
      .toEqual({ allowed: false, reason: 'new_date_past' });
  });
});

describe('rescheduleReasonText', () => {
  it('gives bilingual copy for a blocking reason and empty for ok', () => {
    expect(rescheduleReasonText('too_close', 'en')).toMatch(/7 days/);
    expect(rescheduleReasonText('too_close', 'ar')).toMatch(/٧/);
    expect(rescheduleReasonText('ok', 'en')).toBe('');
  });
});
