// ATEMA STUDIO — admin installment-plan glue (خطة التقسيط).
//
// CRUD around booking_installments for the admin booking modal. All the
// math (splitting, rebalancing, progress) lives in the pure policy module
// supabase/functions/_shared/installments.ts — this file only does the IO.
//
// Writes carry `.select()` for the same reason as useAdminData: RLS answers
// a blocked write with 200 + zero rows, so the echoed row is what separates
// "saved" from "silently dropped by a lapsed session".

import { supabase } from './supabase';
import {
  buildInstallmentPlan,
  rebalanceUnpaid,
  todayUtc,
  type InstallmentRow,
} from '../../supabase/functions/_shared/installments';

export interface StoredInstallment extends InstallmentRow {
  id:         string;
  booking_id: string;
  note:       string | null;
}

export async function fetchInstallments(bookingId: string): Promise<StoredInstallment[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('booking_installments')
    .select('*').eq('booking_id', bookingId).order('seq');
  return (data ?? []) as StoredInstallment[];
}

/**
 * Create a 3/4/5 plan for a booking. The deposit row (seq 1) is marked paid
 * immediately when the booking's deposit has already been received
 * (payment_status === 'paid') — that money arrived through the normal
 * booking flow, the plan just accounts for it.
 *
 * Returns the stored rows, or null on failure (offline / RLS / too-close
 * event). Setting bookings.installment_plan is the CALLER's job (through the
 * admin save path) so the dashboard's local state and list chip stay in sync.
 */
export async function createInstallmentPlan(booking: {
  id: string; total: number; event_date: string; payment_status: string;
}, count: number): Promise<StoredInstallment[] | null> {
  if (!supabase) return null;
  const plan = buildInstallmentPlan({
    total: booking.total, count,
    startDate: todayUtc(), eventDate: booking.event_date,
  });
  if (!plan) return null;

  const depositPaid = booking.payment_status === 'paid';
  const { data, error } = await supabase.from('booking_installments')
    .insert(plan.map(p => ({
      booking_id: booking.id,
      seq:        p.seq,
      amount:     p.amount,
      due_date:   p.dueDate,
      ...(p.seq === 1 && depositPaid
        ? { paid_amount: p.amount, paid_at: new Date().toISOString(),
            note: 'العربون — سُدِّد عند الحجز' }
        : {}),
    })))
    .select();
  if (error || !data || data.length !== plan.length) return null;

  return (data as StoredInstallment[]).sort((a, z) => a.seq - z.seq);
}

export async function recordInstallmentPayment(id: string, payment: {
  paidAmount: number; paidDate: string; note?: string;
}): Promise<StoredInstallment | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('booking_installments')
    .update({
      paid_amount: payment.paidAmount,
      // Date-only input from the admin form; store midnight UTC of that day.
      paid_at:     `${payment.paidDate}T00:00:00Z`,
      note:        payment.note?.trim() || null,
    })
    .eq('id', id).select();
  if (error || !data || data.length === 0) return null;
  return data[0] as StoredInstallment;
}

/** Undo a recorded payment (wrong row / typo) — clears the received fields. */
export async function undoInstallmentPayment(id: string): Promise<StoredInstallment | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('booking_installments')
    .update({ paid_amount: null, paid_at: null, note: null })
    .eq('id', id).select();
  if (error || !data || data.length === 0) return null;
  return data[0] as StoredInstallment;
}

/**
 * Re-spread the outstanding remainder over the unpaid rows after the
 * booking's total changed (VAT toggle / package change). Paid rows are
 * never touched. Returns the refreshed rows or null.
 */
export async function rebalanceInstallments(
  bookingId: string, rows: StoredInstallment[], newTotal: number,
): Promise<StoredInstallment[] | null> {
  if (!supabase) return null;
  const updates = rebalanceUnpaid(rows, newTotal);
  if (!updates) return null;
  for (const u of updates) {
    const target = rows.find(r => r.seq === u.seq);
    if (!target) continue;
    const { error } = await supabase.from('booking_installments')
      .update({ amount: u.amount }).eq('id', target.id).select();
    if (error) return null;
  }
  return fetchInstallments(bookingId);
}

/** Delete the whole plan's rows (armed-confirm path in the admin card).
 *  Clearing bookings.installment_plan is the caller's job — same reason as
 *  createInstallmentPlan. */
export async function removeInstallmentPlan(bookingId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('booking_installments')
    .delete().eq('booking_id', bookingId).select();
  return !error;
}
