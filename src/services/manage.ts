// ATEMA STUDIO — Customer self-service "manage my booking" client.
//
// Backs the /#/manage/<token> page. Reads the booking through the token-scoped
// get_booking_by_token RPC (anon never touches the bookings table), and applies
// changes through the change-booking Edge Function (service-role). The token is
// the only credential.

import { supabase } from './supabase';

export interface ManagedBooking {
  booking_ref:      string;
  status:           string;
  payment_status:   string;
  event_date:       string;
  event_time:       string;
  package_id:       number | null;
  addon_ids:        string[];
  location:         string | null;
  subtotal:         number;
  vat:              number;
  total:            number;
  reschedule_count: number;
}

export async function getBookingByToken(token: string): Promise<ManagedBooking | null> {
  if (!supabase || !token) return null;
  const { data, error } = await supabase.rpc('get_booking_by_token', { p_token: token });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ManagedBooking | null) ?? null;
}

export interface RescheduleResult {
  ok: boolean;
  /** Reason code on failure — e.g. 'reschedule_too_close', 'date_unavailable'. */
  reason?: string;
  eventDate?: string;
  eventTime?: string;
  rescheduleCount?: number;
}

export async function rescheduleBooking(input: {
  token: string;
  newDate: string;
  newTime: string;
}): Promise<RescheduleResult> {
  if (!supabase) return { ok: false, reason: 'offline' };
  const { data, error } = await supabase.functions.invoke('change-booking', {
    body: { action: 'reschedule', token: input.token, newDate: input.newDate, newTime: input.newTime },
  });
  // The function returns { ok: true, ... } on success, or a non-2xx body
  // { error: '<reason>' } which supabase surfaces via `error` + `data`.
  const row = (data ?? {}) as Record<string, unknown>;
  if (!error && row.ok === true) {
    return {
      ok: true,
      eventDate: row.eventDate as string,
      eventTime: row.eventTime as string,
      rescheduleCount: Number(row.rescheduleCount ?? 0),
    };
  }
  const reason = typeof row.error === 'string'
    ? row.error
    : (error as { message?: string } | null)?.message ?? 'change_failed';
  return { ok: false, reason };
}
