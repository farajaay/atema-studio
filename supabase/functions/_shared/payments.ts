// ATEMA STUDIO — Payment-state policy (حالة الدفع).
//
// Before September 2026 `payment_status = 'paid'` quietly meant "the 50%
// deposit arrived", so the admin had no way to say "deposit in, balance
// still owed" and the revenue card counted the full total the moment the
// deposit landed. `deposit_paid` (عربون مدفوع) now carries that meaning and
// `paid` means paid in full.
//
// Single source of truth for the admin dashboard stats, the booking modal's
// collected/remaining lines, documents.ts, installments and the receipt
// Edge Functions. Dependency-free so it imports in the browser, the Deno
// edge runtime, and Vitest — the same discipline as installments.ts.

import { depositOf } from './installments.ts';

export const PAYMENT_STATUSES = [
  'unpaid', 'awaiting_transfer', 'deposit_paid', 'paid', 'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_LABEL_AR: Record<PaymentStatus, string> = {
  unpaid:            'غير مدفوع',
  awaiting_transfer: 'بانتظار التحويل',
  deposit_paid:      'عربون مدفوع',
  paid:              'مدفوع بالكامل',
  refunded:          'مُسترد',
};

/** Deposit received — whether or not the balance has followed. */
export function isDepositReceived(status: string | null | undefined): boolean {
  return status === 'deposit_paid' || status === 'paid';
}

/** Cash actually in hand for a booking, from its payment state. */
export function amountCollected(b: { payment_status: string; total: number }): number {
  if (b.payment_status === 'paid')         return b.total;
  if (b.payment_status === 'deposit_paid') return depositOf(b.total);
  return 0;
}

/** Still owed by the bride. Zero for refunded or cancelled bookings. */
export function amountOutstanding(b: { payment_status: string; total: number; status?: string }): number {
  if (b.status === 'cancelled' || b.payment_status === 'refunded') return 0;
  return Math.max(0, b.total - amountCollected(b));
}

/** State after a verified payment lands. A booking still owing its deposit
 *  moves to deposit_paid; one already holding the deposit moves to paid. */
export function statusAfterPayment(current: string): PaymentStatus {
  return isDepositReceived(current) ? 'paid' : 'deposit_paid';
}
