// ATEMA STUDIO — Package/add-on change math (Phase 2 of booking changes).
//
// When a bride swaps her package or toggles add-ons, the new totals are
// recomputed server-side from the authoritative catalogue (same discipline as
// create-booking), then compared to what was already charged. The contract's
// deposit is non-refundable, so a downgrade never produces a refund here — it
// simply lowers the balance; only an upgrade creates a top-up due.
//
// Pure + dependency-free; reuses computeBookingTotals so the VAT/discount math
// has a single source of truth. Tested in src/services/change-math.test.ts.

import { computeBookingTotals } from './pricing.ts';

export type ChangeDirection = 'none' | 'top_up' | 'downgrade';

export interface PackageChange {
  subtotal: number;
  vat: number;
  total: number;
  delta: number;            // newTotal - oldTotal (signed)
  direction: ChangeDirection;
  topUpDue: number;         // amount the customer must pay now (>= 0)
}

export function computePackageChange(opts: {
  newGrossSubtotal: number;
  oldTotal: number;
  discountAmount?: number;
  vatEnabled?: boolean;
}): PackageChange {
  const { subtotal, vat, total } = computeBookingTotals({
    grossSubtotal: opts.newGrossSubtotal,
    discountAmount: opts.discountAmount,
    vatEnabled: opts.vatEnabled,
  });
  const delta = total - opts.oldTotal;
  const direction: ChangeDirection = delta > 0 ? 'top_up' : delta < 0 ? 'downgrade' : 'none';
  // Deposit non-refundable → a downgrade owes nothing extra and refunds nothing.
  const topUpDue = delta > 0 ? delta : 0;
  return { subtotal, vat, total, delta, direction, topUpDue };
}
