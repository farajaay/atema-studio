import { describe, it, expect } from 'vitest';
import { computePackageChange } from '../../supabase/functions/_shared/change';

// Original booking: gross 3000 → total 3450 (15% VAT).
const OLD_TOTAL = 3450;

describe('computePackageChange', () => {
  it('classifies an upgrade as top_up with the difference due', () => {
    // new gross 4000 → total 4600; delta +1150
    const c = computePackageChange({ newGrossSubtotal: 4000, oldTotal: OLD_TOTAL });
    expect(c.total).toBe(4600);
    expect(c.delta).toBe(1150);
    expect(c.direction).toBe('top_up');
    expect(c.topUpDue).toBe(1150);
  });

  it('classifies a downgrade with no refund and nothing due', () => {
    // new gross 2000 → total 2300; delta -1150 — deposit non-refundable
    const c = computePackageChange({ newGrossSubtotal: 2000, oldTotal: OLD_TOTAL });
    expect(c.total).toBe(2300);
    expect(c.delta).toBe(-1150);
    expect(c.direction).toBe('downgrade');
    expect(c.topUpDue).toBe(0);
  });

  it('classifies an unchanged total as none', () => {
    const c = computePackageChange({ newGrossSubtotal: 3000, oldTotal: OLD_TOTAL });
    expect(c.direction).toBe('none');
    expect(c.topUpDue).toBe(0);
  });

  it('applies a preserved discount before VAT', () => {
    // new gross 4000, discount 500 → net 3500, vat 525, total 4025
    const c = computePackageChange({ newGrossSubtotal: 4000, oldTotal: OLD_TOTAL, discountAmount: 500 });
    expect(c.subtotal).toBe(3500);
    expect(c.vat).toBe(525);
    expect(c.total).toBe(4025);
    expect(c.topUpDue).toBe(575);
  });

  it('honours VAT disabled', () => {
    const c = computePackageChange({ newGrossSubtotal: 4000, oldTotal: OLD_TOTAL, vatEnabled: false });
    expect(c.vat).toBe(0);
    expect(c.total).toBe(4000);
  });
});
