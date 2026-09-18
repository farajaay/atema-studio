import { describe, it, expect } from 'vitest';
import { grossForPackage, isNoPrint, computeBookingTotals } from '../../supabase/functions/_shared/pricing';
import {
  stepsForBooking, computeTargets, duePrompts, WORKFLOW_STEPS,
  type WorkflowStepKey, type WorkflowStatus,
} from '../../supabase/functions/_shared/workflow';

// The two tiers that offer the choice (live catalogue, Sept 2026 snapshot).
const CLASSIC = { price: 5500,  noPrintEnabled: true, noPrintDiscount: 700 };
const ROYAL   = { price: 11200, noPrintEnabled: true, noPrintDiscount: 1200 };
// Signature keeps its A3 album — the option is off at the package level.
const SIGNATURE = { price: 13000, noPrintEnabled: false, noPrintDiscount: 0 };

describe('grossForPackage', () => {
  it('leaves the price alone when she keeps the printed album', () => {
    expect(grossForPackage({ ...CLASSIC, noPrint: false })).toBe(5500);
    expect(grossForPackage({ ...CLASSIC })).toBe(5500);
  });

  it('takes the fixed amount off when she picks بدون طباعة', () => {
    expect(grossForPackage({ ...CLASSIC, noPrint: true })).toBe(4800);
    expect(grossForPackage({ ...ROYAL,   noPrint: true })).toBe(10000);
  });

  it('IGNORES a no-print request on a tier that does not offer it', () => {
    // A crafted POST must not invent a discount on باقة التوقيع.
    expect(grossForPackage({ ...SIGNATURE, noPrint: true })).toBe(13000);
  });

  it('never lets a mis-typed discount produce a free or negative booking', () => {
    expect(grossForPackage({ price: 5500, noPrint: true, noPrintEnabled: true, noPrintDiscount: 9999 })).toBe(1);
    expect(grossForPackage({ price: 5500, noPrint: true, noPrintEnabled: true, noPrintDiscount: -400 })).toBe(5500);
    expect(grossForPackage({ price: 5500, noPrint: true, noPrintEnabled: true, noPrintDiscount: NaN })).toBe(5500);
  });

  it('flows through the VAT math — VAT follows the lower subtotal', () => {
    const gross = grossForPackage({ ...CLASSIC, noPrint: true });
    const t = computeBookingTotals({ grossSubtotal: gross });
    expect(t.subtotal).toBe(4800);
    expect(t.vat).toBe(720);
    expect(t.total).toBe(5520);
  });

  it('discounts the package only — add-ons keep their full price', () => {
    const gross = grossForPackage({ ...ROYAL, noPrint: true }) + 900 /* extra hour */;
    expect(gross).toBe(10900);
  });
});

describe('isNoPrint', () => {
  it('is true only when she asked AND the tier offers it', () => {
    expect(isNoPrint({ noPrint: true,  noPrintEnabled: true  })).toBe(true);
    expect(isNoPrint({ noPrint: true,  noPrintEnabled: false })).toBe(false);
    expect(isNoPrint({ noPrint: false, noPrintEnabled: true  })).toBe(false);
    expect(isNoPrint({})).toBe(false);
  });
});


describe('stepsForBooking — the ladder a no-print booking walks', () => {
  it('keeps the full ladder for a printed-album booking', () => {
    expect(stepsForBooking()).toHaveLength(WORKFLOW_STEPS.length);
    expect(stepsForBooking({ noPrint: false })).toHaveLength(WORKFLOW_STEPS.length);
  });

  it('drops both album rungs when nothing is being printed', () => {
    const keys = stepsForBooking({ noPrint: true }).map(d => d.key);
    expect(keys).not.toContain('album_selection');
    expect(keys).not.toContain('album_delivery');
    expect(keys).toHaveLength(WORKFLOW_STEPS.length - 2);
    // Everything else survives, in order.
    expect(keys).toEqual(['final_payment', 'event', 'editing', 'gallery', 'video', 'review']);
  });

  it('never nags the owner about an album she is not printing', () => {
    // A year-old event with everything done through the review round: the
    // only steps left on the full ladder are the two album ones.
    const eventDate = '2026-01-01';
    const done: Partial<Record<WorkflowStepKey, string>> = {
      final_payment: '2025-12-31', event: eventDate, editing: '2026-01-08',
      gallery: '2026-02-01', video: '2026-02-01', review: '2026-02-15',
    };
    const statuses = Object.fromEntries(
      Object.keys(done).map(k => [k, 'done' as WorkflowStatus]),
    ) as Partial<Record<WorkflowStepKey, WorkflowStatus>>;
    const targets = computeTargets(eventDate, done);
    const args = { statuses, targets, sent: new Set<string>(), now: '2026-09-18' };

    const withPrinting = duePrompts(args).map(p => p.stepKey);
    expect(withPrinting).toContain('album_selection');

    const withoutPrinting = duePrompts({ ...args, steps: stepsForBooking({ noPrint: true }) });
    expect(withoutPrinting).toHaveLength(0);
  });
});
