// Unit tests for the payment-state policy — the math behind the admin
// «الإيرادات المحصلة» card, the booking modal's collected/remaining lines and
// the receipt Edge Functions' next-state decision.

import { describe, it, expect } from 'vitest';
import {
  isDepositReceived,
  amountCollected,
  amountOutstanding,
  statusAfterPayment,
  PAYMENT_STATUSES,
  PAYMENT_LABEL_AR,
} from '../../supabase/functions/_shared/payments';

describe('payment-state policy', () => {
  it('labels every status', () => {
    for (const s of PAYMENT_STATUSES) expect(PAYMENT_LABEL_AR[s]).toBeTruthy();
  });

  it('treats deposit_paid and paid as deposit received', () => {
    expect(isDepositReceived('deposit_paid')).toBe(true);
    expect(isDepositReceived('paid')).toBe(true);
    expect(isDepositReceived('awaiting_transfer')).toBe(false);
    expect(isDepositReceived('unpaid')).toBe(false);
    expect(isDepositReceived(undefined)).toBe(false);
  });

  it('counts only the deposit for deposit_paid, the whole total for paid', () => {
    expect(amountCollected({ payment_status: 'deposit_paid', total: 11_201 })).toBe(5_601);
    expect(amountCollected({ payment_status: 'paid', total: 11_201 })).toBe(11_201);
    expect(amountCollected({ payment_status: 'awaiting_transfer', total: 5_000 })).toBe(0);
    expect(amountCollected({ payment_status: 'refunded', total: 5_000 })).toBe(0);
  });

  it('collected + outstanding === total for live bookings', () => {
    for (const s of ['unpaid', 'awaiting_transfer', 'deposit_paid', 'paid']) {
      const b = { payment_status: s, total: 13_001 };
      expect(amountCollected(b) + amountOutstanding(b)).toBe(13_001);
    }
  });

  it('owes nothing once cancelled or refunded', () => {
    expect(amountOutstanding({ payment_status: 'deposit_paid', total: 5_000, status: 'cancelled' })).toBe(0);
    expect(amountOutstanding({ payment_status: 'refunded', total: 5_000 })).toBe(0);
  });

  it('advances deposit first, then balance', () => {
    expect(statusAfterPayment('unpaid')).toBe('deposit_paid');
    expect(statusAfterPayment('awaiting_transfer')).toBe('deposit_paid');
    expect(statusAfterPayment('deposit_paid')).toBe('paid');
  });
});
