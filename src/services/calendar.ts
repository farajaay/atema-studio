// ATEMA STUDIO — Calendar service
//
// Two code paths into "what's booked":
//
//   - fetchPublicBookedDates   → reads the `public_booked_dates` view
//     (event_date + status only). Used by the CUSTOMER DatePicker so we
//     never leak names or booking refs over the wire.
//
//   - fetchAdminBookedDates    → reads the full `bookings` table. Used
//     by AdminCalendar where the admin needs the booking ref and name
//     for tooltips. Requires the authenticated Supabase session.
//
// The shape of `BookedDate` keeps optional PII fields so the admin path
// can populate them while the public path leaves them undefined.

import { supabase } from './supabase';

export interface BlockedDate {
  id:         string;
  date:       string;   // ISO date 'YYYY-MM-DD'
  reason:     string;
  created_at: string;
}

export interface BookedDate {
  date:          string;
  status:        string;
  /** Admin-only — undefined on the public path */
  booking_ref?:   string;
  /** Admin-only — undefined on the public path */
  customer_name?: string;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

/** PUBLIC (anon): event_date + status only. No PII leaves the database. */
export async function fetchPublicBookedDates(from?: string, to?: string): Promise<BookedDate[]> {
  if (!supabase) return [];
  let q = supabase.from('public_booked_dates').select('event_date, status');
  if (from) q = q.gte('event_date', from);
  if (to)   q = q.lte('event_date', to);
  const { data, error } = await q;
  if (error) { return []; }
  return (data ?? []).map(r => ({
    date: r.event_date as string,
    status: r.status as string,
  }));
}

/** ADMIN (authenticated): full booking detail. Do not call from public surfaces. */
export async function fetchAdminBookedDates(from?: string, to?: string): Promise<BookedDate[]> {
  if (!supabase) return [];
  let q = supabase.from('bookings')
    .select('event_date, booking_ref, status, customer_name')
    .neq('status', 'cancelled');
  if (from) q = q.gte('event_date', from);
  if (to)   q = q.lte('event_date', to);
  const { data, error } = await q;
  if (error) { return []; }
  return (data ?? []).map(r => ({
    date: r.event_date as string,
    booking_ref: r.booking_ref as string,
    status: r.status as string,
    customer_name: r.customer_name as string,
  }));
}

/**
 * @deprecated Use fetchPublicBookedDates for customer surfaces and
 *             fetchAdminBookedDates for admin surfaces. This shim defers
 *             to the public function so legacy callers don't leak PII.
 */
export const fetchBookedDates = fetchPublicBookedDates;

/** Admin-blocked dates */
export async function fetchBlockedDates(from?: string, to?: string): Promise<BlockedDate[]> {
  if (!supabase) return [];
  let q = supabase.from('blocked_dates').select('*');
  if (from) q = q.gte('date', from);
  if (to)   q = q.lte('date', to);
  const { data, error } = await q.order('date');
  if (error) { console.error('fetchBlockedDates:', error.message); return []; }
  return (data ?? []) as BlockedDate[];
}

// ── Mutations (admin) ─────────────────────────────────────────────────────────

export async function blockDate(date: string, reason: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('blocked_dates').insert({ date, reason });
  if (error) { console.error('blockDate:', error.message); return false; }
  return true;
}

export async function unblockDate(date: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('blocked_dates').delete().eq('date', date);
  if (error) { console.error('unblockDate:', error.message); return false; }
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isoDate(d: Date): string {
  // Local-tz safe ISO date (avoids UTC shift bug)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  // month is 0-indexed
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  return { from: isoDate(first), to: isoDate(last) };
}
