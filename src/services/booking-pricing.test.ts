import { describe, it, expect } from 'vitest';
import {
  VAT_RATE,
  sumActiveAddons,
  clampDiscount,
  computeBookingTotals,
} from '../../supabase/functions/_shared/pricing';

describe('sumActiveAddons', () => {
  it('sums only the active add-ons', () => {
    expect(sumActiveAddons([
      { price: 500, active: true },
      { price: 300, active: false }, // retired — must not be priced in
      { price: 200, active: true },
    ])).toBe(700);
  });

  it('returns 0 for an empty list', () => {
    expect(sumActiveAddons([])).toBe(0);
  });
});

describe('clampDiscount', () => {
  it('passes a normal discount through unchanged', () => {
    expect(clampDiscount(200, 1000)).toBe(200);
  });

  it('caps a discount at the gross subtotal', () => {
    expect(clampDiscount(5000, 1000)).toBe(1000);
  });

  it('floors a negative discount at zero', () => {
    expect(clampDiscount(-50, 1000)).toBe(0);
  });

  it('coerces non-numeric input to zero', () => {
    expect(clampDiscount(NaN, 1000)).toBe(0);
    expect(clampDiscount(Number('abc'), 1000)).toBe(0);
  });
});

describe('computeBookingTotals (Patch C-3 recompute)', () => {
  it('charges 15% VAT on the net subtotal', () => {
    expect(computeBookingTotals({ grossSubtotal: 3000 }))
      .toEqual({ subtotal: 3000, vat: 450, total: 3450 });
    expect(VAT_RATE).toBe(0.15);
  });

  it('applies the discount before VAT', () => {
    // net 2700 → vat 405 → total 3105
    expect(computeBookingTotals({ grossSubtotal: 3000, discountAmount: 300 }))
      .toEqual({ subtotal: 2700, vat: 405, total: 3105 });
  });

  it('zeroes VAT when VAT is disabled', () => {
    expect(computeBookingTotals({ grossSubtotal: 3000, vatEnabled: false }))
      .toEqual({ subtotal: 3000, vat: 0, total: 3000 });
  });

  it('cannot be driven negative by an oversized discount', () => {
    expect(computeBookingTotals({ grossSubtotal: 1000, discountAmount: 99999 }))
      .toEqual({ subtotal: 0, vat: 0, total: 0 });
  });

  it('rounds VAT to the nearest halala-free SAR', () => {
    // 1999 * 0.15 = 299.85 → 300
    expect(computeBookingTotals({ grossSubtotal: 1999 }).vat).toBe(300);
  });
});
