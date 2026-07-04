// ATEMA STUDIO — Customer self-service "manage my booking" client.
//
// Backs the /#/manage/<token> page. Reads the booking through the token-scoped
// get_booking_by_token RPC (anon never touches the bookings table), and applies
// changes through the change-booking Edge Function (service-role). The token is
// the only credential.

import { supabase } from './supabase';

export interface ManagedBooking {
  id:               string;   // UUID — needed to reference the booking in payment flows
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

/** Which confirmation channels the server actually used — the page words
    its success message from this instead of assuming WhatsApp. */
export interface NotifiedChannels { wa: boolean; email: boolean }

export interface RescheduleResult {
  ok: boolean;
  /** Reason code on failure — e.g. 'reschedule_too_close', 'date_unavailable'. */
  reason?: string;
  eventDate?: string;
  eventTime?: string;
  rescheduleCount?: number;
  notified?: NotifiedChannels;
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
      notified: row.notified as NotifiedChannels | undefined,
    };
  }
  const reason = typeof row.error === 'string'
    ? row.error
    : (error as { message?: string } | null)?.message ?? 'change_failed';
  return { ok: false, reason };
}

// ── Phase 2: package / add-on change (step-up OTP) ──────────────────────────
export interface ChangeOption {
  id: string | number;
  name_ar: string;
  name_en: string;
  price: number;
}

export async function listChangeOptions(): Promise<{ packages: ChangeOption[]; addons: ChangeOption[] }> {
  if (!supabase) return { packages: [], addons: [] };
  const [{ data: pkgs }, { data: adds }] = await Promise.all([
    supabase.from('packages').select('id, name_ar, name_en, price, active').eq('active', true).order('price'),
    supabase.from('addons').select('id, name_ar, name_en, price, active').eq('active', true).order('price'),
  ]);
  return {
    packages: (pkgs ?? []) as ChangeOption[],
    addons: (adds ?? []) as ChangeOption[],
  };
}

/** Ask the server to email a step-up code to the booking's email on file. */
export async function requestChangeOtp(token: string): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) return { ok: false, reason: 'offline' };
  const { data, error } = await supabase.functions.invoke('change-booking', {
    body: { action: 'request_otp', token },
  });
  const row = (data ?? {}) as Record<string, unknown>;
  if (!error && row.ok === true) return { ok: true };
  const reason = typeof row.error === 'string' ? row.error
    : (error as { message?: string } | null)?.message ?? 'otp_failed';
  return { ok: false, reason };
}

export interface ChangeResult {
  ok: boolean;
  reason?: string;
  total?: number;
  delta?: number;
  direction?: 'none' | 'top_up' | 'downgrade';
  topUpDue?: number;
}

export async function changePackage(input: {
  token: string;
  otp: string;
  packageId: number;
  addOnIds: string[];
}): Promise<ChangeResult> {
  if (!supabase) return { ok: false, reason: 'offline' };
  const { data, error } = await supabase.functions.invoke('change-booking', {
    body: {
      action: 'change_package',
      token: input.token, otp: input.otp,
      packageId: input.packageId, addOnIds: input.addOnIds,
    },
  });
  const row = (data ?? {}) as Record<string, unknown>;
  if (!error && row.ok === true) {
    return {
      ok: true,
      total: Number(row.total ?? 0),
      delta: Number(row.delta ?? 0),
      direction: row.direction as ChangeResult['direction'],
      topUpDue: Number(row.topUpDue ?? 0),
    };
  }
  const reason = typeof row.error === 'string' ? row.error
    : (error as { message?: string } | null)?.message ?? 'change_failed';
  return { ok: false, reason };
}
