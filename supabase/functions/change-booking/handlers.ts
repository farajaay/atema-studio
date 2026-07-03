// ATEMA STUDIO — change-booking request handlers (glue layer).
//
// Extracted from index.ts so the wiring — token lookup, OTP gating, catalogue
// recompute, DB writes, notifications — is importable from Vitest with a
// mocked Supabase client (src/services/change-booking-glue.test.ts). This file
// must stay free of remote/Deno-only imports: the runtime bits (serve,
// createClient, Deno.env, sendText) are injected by index.ts through
// HandlerEnv.
//
// Behaviour contract: identical to the pre-extraction index.ts. The policy
// engines stay in _shared/{reschedule,otp,change,pricing}.ts — don't move
// policy in here, and don't fork it.

// The supabase client and request body flow through as `any` — same pattern
// as the other Edge Functions (the mocked client in tests is structural).
// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */
import { clampText, CITY_FEES, extractCityKey } from '../_shared/validation.ts';
import { canReschedule, validateNewDate, daysBetween } from '../_shared/reschedule.ts';
import { sumActiveAddons } from '../_shared/pricing.ts';
import { computePackageChange } from '../_shared/change.ts';
import { generateOtp, hashOtp, verifyOtp, OTP_TTL_MS } from '../_shared/otp.ts';
import { renderChangeOtpEmail } from '../_shared/email-otp.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Runtime dependencies injected by index.ts (and mocked in tests). */
export interface HandlerEnv {
  ownerPhone?: string;
  siteOrigin: string;
  /** Send a WhatsApp text. Must never throw (wrap the transport). */
  notify: (phone: string | undefined, message: string) => Promise<void>;
  /** Send a transactional email (the step-up OTP channel). Returns the
   *  delivery status so the caller can surface real failures instead of
   *  silently claiming "sent". Must never throw (wrap the transport). */
  sendEmail?: (args: {
    to: string; subject: string; html: string; text: string; bookingId?: string | null;
  }) => Promise<{ status: 'sent' | 'skipped' | 'failed'; error?: string }>;
  /** Today as YYYY-MM-DD — injectable for tests. */
  today?: () => string;
}

export function fail(error: string, status = 400, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
export function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Token lookup + action dispatch — the whole POST body lifecycle after JSON
 *  parsing. index.ts calls this with a real service-role client. */
export async function routeChangeRequest(supabase: any, body: any, env: HandlerEnv): Promise<Response> {
  const action = String(body.action ?? 'reschedule');

  // ── Credential: the manage token (required for every action) ──────────
  const token = clampText(body.token, 64);
  if (!token || token.length < 16) return fail('token_invalid', 401);

  // Look up the booking by token (service-role). Select * so a partially
  // migrated schema (missing discount/vat columns) doesn't break the read.
  const { data: booking, error: lookErr } = await supabase
    .from('bookings').select('*').eq('manage_token', token).maybeSingle();
  if (lookErr) return fail('lookup_failed', 500, lookErr.message);
  if (!booking) return fail('not_found', 404);

  if (booking.status === 'cancelled') return fail('booking_cancelled', 422);

  // Global WA gate — read once, passed to notify-capable handlers.
  // request_otp is security-critical and intentionally ungated.
  const { data: settingsRow } = await supabase
    .from('app_settings').select('wa_enabled').limit(1).maybeSingle();
  const waEnabled = settingsRow?.wa_enabled ?? false;

  switch (action) {
    case 'reschedule':     return await handleReschedule(supabase, booking, body, waEnabled, env);
    case 'request_otp':    return await handleRequestOtp(supabase, booking, env);
    case 'change_package': return await handleChangePackage(supabase, booking, body, waEnabled, env);
    default:               return fail('unsupported_action', 400);
  }
}

// ── Reschedule (Phase 1) ─────────────────────────────────────────────────────
export async function handleReschedule(supabase: any, booking: any, body: any, waEnabled: boolean, env: HandlerEnv): Promise<Response> {
  const newDate = String(body.newDate ?? '');
  if (!ISO_DATE.test(newDate)) return fail('date_invalid', 422);
  const newTime = clampText(body.newTime, 10) || '18:00';

  const elig = canReschedule({
    eventDate: booking.event_date,
    status: booking.status,
    rescheduleCount: booking.reschedule_count ?? 0,
  });
  if (!elig.allowed) return fail('reschedule_' + elig.reason, 422);

  const dateCheck = validateNewDate({ originalEventDate: booking.event_date, newEventDate: newDate });
  if (!dateCheck.allowed) return fail('reschedule_' + dateCheck.reason, 422);

  if (!(await dateIsFree(supabase, newDate, booking.id))) return fail('date_unavailable', 409);

  const { error: updErr } = await supabase.from('bookings').update({
    event_date: newDate,
    event_time: newTime,
    reschedule_count: (booking.reschedule_count ?? 0) + 1,
  }).eq('id', booking.id);
  if (updErr) return fail('update_failed', 500, updErr.message);

  await audit(supabase, booking.id, 'reschedule',
    { event_date: booking.event_date, event_time: booking.event_time },
    { event_date: newDate, event_time: newTime }, 0);

  if (waEnabled) {
    await env.notify(booking.customer_phone,
      `✓ تم تأجيل حجزك\nرقم الحجز: ${booking.booking_ref}\nالموعد الجديد: ${newDate} الساعة ${newTime}\nبانتظارك 🤍`);
    await env.notify(env.ownerPhone,
      `↻ ATEMA · تأجيل من العميلة\n${booking.booking_ref}\n${booking.event_date} → ${newDate} (${newTime})`);
  }

  return ok({
    ok: true, bookingRef: booking.booking_ref,
    eventDate: newDate, eventTime: newTime,
    rescheduleCount: (booking.reschedule_count ?? 0) + 1,
  });
}

// ── Request step-up OTP (Phase 2) ────────────────────────────────────────────
// The code is delivered by EMAIL (Zoho SMTP), not WhatsApp: a bride initiating
// a change from the website rarely has Meta's 24-hour session window open, so a
// free-form WhatsApp text would be rejected and never arrive — and OTPs by
// free-form text are against Meta policy anyway. Email has no such window.
//
// Delivery failures are surfaced, not swallowed: returning a fake "sent" would
// dead-end the bride (she could never obtain a valid code, so never change her
// package). The actionable cases (no email on file, send failed) come back as
// 200 + { ok:false, error } so the page can show a precise message.
export async function handleRequestOtp(supabase: any, booking: any, env: HandlerEnv): Promise<Response> {
  const email = String(booking.customer_email ?? '').trim();
  if (!email) return ok({ ok: false, error: 'no_email_on_file' });
  if (!env.sendEmail) return fail('otp_send_unavailable', 500);

  const code = generateOtp();
  const salt = crypto.randomUUID();
  const codeHash = await hashOtp(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error } = await supabase.from('booking_otps').insert({
    booking_id: booking.id, purpose: 'change_package',
    code_hash: codeHash, salt, expires_at: expiresAt,
  });
  if (error) return fail('otp_issue_failed', 500, error.message);

  // The code goes ONLY to the email on file — never in the HTTP response.
  const mail = renderChangeOtpEmail({
    code, bookingRef: booking.booking_ref, customerName: booking.customer_name,
    ttlMinutes: Math.round(OTP_TTL_MS / 60_000),
  });
  const sent = await env.sendEmail({
    to: email, subject: mail.subject, html: mail.html, text: mail.text, bookingId: booking.id,
  });
  // Delivery is best-effort and the OTP row is ALREADY stored above, so a flaky
  // SMTP *status* must not strand the bride on an error screen holding a code
  // she actually received. denomailer 1.6.0 + Zoho sometimes reports a non-'sent'
  // status even after the message is accepted; hard-failing here was exactly
  // what made the manage page "send the code but never let her enter it."
  // Advance to code entry regardless; if it truly didn't arrive she can resend.
  // (A missing recipient is still a hard stop above as no_email_on_file, and an
  // unconfigured mailer is otp_send_unavailable.)
  if (sent.status !== 'sent') {
    console.warn('[change-otp] non-sent email status (code still stored):', sent.status, sent.error ?? '');
  }
  return ok({ ok: true, sent: sent.status === 'sent', channel: 'email' });
}

// ── Change package / add-ons (Phase 2) ───────────────────────────────────────
export async function handleChangePackage(supabase: any, booking: any, body: any, waEnabled: boolean, env: HandlerEnv): Promise<Response> {
  // Money path → require a valid, unexpired, unconsumed OTP.
  const otpCode = clampText(body.otp, 12);
  const { data: otpRow } = await supabase.from('booking_otps')
    .select('*').eq('booking_id', booking.id).eq('purpose', 'change_package')
    .is('consumed_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!otpRow) return fail('otp_required', 401);

  const v = await verifyOtp({
    suppliedCode: otpCode, codeHash: otpRow.code_hash, salt: otpRow.salt,
    expiresAt: otpRow.expires_at, attempts: otpRow.attempts ?? 0,
  });
  if (!v.ok) {
    if (v.reason === 'mismatch') {
      await supabase.from('booking_otps').update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq('id', otpRow.id);
    }
    return fail('otp_' + v.reason, 401);
  }
  await supabase.from('booking_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otpRow.id);

  // Can't change a booking whose event has already passed.
  const today = env.today ? env.today() : new Date().toISOString().slice(0, 10);
  const days = daysBetween(today, booking.event_date);
  if (days === null || days < 0) return fail('event_passed', 422);

  // Recompute the new totals from the authoritative catalogue (never trust a
  // client-supplied price — same discipline as create-booking).
  const pkgId = typeof body.packageId === 'number' ? body.packageId : null;
  if (pkgId === null) return fail('package_required', 422);
  const { data: pkg } = await supabase
    .from('packages').select('id, price, active, name_ar, name_en').eq('id', pkgId).single();
  if (!pkg || !pkg.active) return fail('package_invalid', 422);

  const addOnIds: string[] = Array.isArray(body.addOnIds)
    ? body.addOnIds.filter((x: unknown) => typeof x === 'string').slice(0, 50) : [];
  let addonsTotal = 0;
  if (addOnIds.length > 0) {
    const { data: addons } = await supabase.from('addons').select('id, price, active').in('id', addOnIds);
    addonsTotal = sumActiveAddons((addons ?? []) as Array<{ price: number; active: boolean }>);
  }

  const cityFee = CITY_FEES[extractCityKey(booking.location)] ?? 0;
  const newGross = pkg.price + addonsTotal + cityFee;
  // Preserve the originally-redeemed discount (don't re-redeem / re-deplete).
  const discountAmount = Math.max(0, Math.min(Number(booking.discount_amount ?? 0), newGross));
  const vatEnabled = booking.vat_enabled ?? true;

  const change = computePackageChange({
    newGrossSubtotal: newGross, oldTotal: Number(booking.total ?? 0),
    discountAmount, vatEnabled,
  });

  const { error: updErr } = await supabase.from('bookings').update({
    package_id: pkgId, addon_ids: addOnIds,
    subtotal: change.subtotal, vat: change.vat, total: change.total,
  }).eq('id', booking.id);
  if (updErr) return fail('update_failed', 500, updErr.message);

  // Best-effort: persist outstanding top-up amount (silently skips if
  // migrations-2026-06-topup.sql hasn't been run yet).
  if (change.topUpDue > 0) {
    await supabase.from('bookings')
      .update({ topup_amount_due: change.topUpDue }).eq('id', booking.id)
      .then(undefined, (e: unknown) => console.warn('topup_amount_due update skipped:', e));
  }

  await audit(supabase, booking.id, 'package',
    { package_id: booking.package_id, addon_ids: booking.addon_ids, total: booking.total },
    { package_id: pkgId, addon_ids: addOnIds, total: change.total }, change.delta);

  // Build manage link for WA notification so the bride can return to pay.
  const manageLink = booking.manage_token
    ? `${env.siteOrigin}/#/manage/${booking.manage_token}`
    : null;

  let dueLine = '';
  if (change.topUpDue > 0) {
    dueLine = `\nالمبلغ المتبقّي للدفع: ${change.topUpDue.toLocaleString('ar-SA')} ر.س`;
    if (manageLink) dueLine += `\nادفعي الآن: ${manageLink}`;
  }
  if (waEnabled) {
    await env.notify(booking.customer_phone,
      `✓ تم تعديل باقتك\nرقم الحجز: ${booking.booking_ref}\nالإجمالي الجديد: ${change.total.toLocaleString('ar-SA')} ر.س${dueLine}`);
    await env.notify(env.ownerPhone,
      `✎ ATEMA · تعديل باقة من العميلة\n${booking.booking_ref}\nالإجمالي: ${booking.total} → ${change.total} (${change.direction})`);
  }

  return ok({
    ok: true, bookingRef: booking.booking_ref,
    subtotal: change.subtotal, vat: change.vat, total: change.total,
    delta: change.delta, direction: change.direction, topUpDue: change.topUpDue,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function dateIsFree(supabase: any, date: string, selfId: string): Promise<boolean> {
  const { data: clash } = await supabase.from('bookings')
    .select('id').eq('event_date', date).neq('status', 'cancelled').neq('id', selfId).limit(1);
  if (clash && clash.length > 0) return false;
  const { data: blocked } = await supabase.from('blocked_dates').select('id').eq('date', date).limit(1);
  return !(blocked && blocked.length > 0);
}

async function audit(supabase: any, bookingId: string, kind: string, oldV: unknown, newV: unknown, delta: number) {
  await supabase.from('booking_changes').insert({
    booking_id: bookingId, kind, actor: 'customer',
    old_value: oldV, new_value: newV, price_delta: delta,
  }).then(undefined, (e: unknown) => console.error('audit insert failed:', e));
}
