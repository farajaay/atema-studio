// ATEMA STUDIO — Calendar service
// Booked dates = any booking row whose status is not 'cancelled'
// Blocked dates = admin-managed rows in `blocked_dates` table

import { supabase } from './supabase';

export interface BlockedDate {
  id:         string;
  date:       string;   // ISO date 'YYYY-MM-DD'
  reason:     string;
  created_at: string;
}

export interface BookedDate {
  date:       string;
  booking_ref: string;
  status:     string;
  customer_name: string;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

/** Booked dates within an inclusive [from, to] window (or all if omitted) */
export async function fetchBookedDates(from?: string, to?: string): Promise<BookedDate[]> {
  if (!supabase) return [];
  let q = supabase.from('bookings')
    .select('event_date, booking_ref, status, customer_name')
    .neq('status', 'cancelled');
  if (from) q = q.gte('event_date', from);
  if (to)   q = q.lte('event_date', to);
  const { data, error } = await q;
  if (error) { console.error('fetchBookedDates:', error.message); return []; }
  return (data ?? []).map(r => ({
    date: r.event_date, booking_ref: r.booking_ref,
    status: r.status, customer_name: r.customer_name,
  }));
}

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
