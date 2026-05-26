// ATEMA STUDIO — change-booking Edge Function.
//
// Customer self-service booking changes, authenticated by the manage token
// (capability link). The function runs as service-role and is the ONLY path
// that writes a change — anon never updates `bookings` directly.
//
// Actions:
//   • reschedule     — move the date (Phase 1). Token only.
//   • request_otp    — text a step-up code to the booking phone (Phase 2).
//   • change_package — swap package / add-ons (Phase 2). Token + OTP.
//
// All policy lives in dependency-free _shared modules that are unit-tested:
//   reschedule.ts (date policy), pricing.ts + change.ts (money), otp.ts (2FA).
//
// Deploy:  supabase functions deploy change-booking
// Pairs with: migrations-2026-05-booking-changes.sql + ...-otp.sql

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { clampText, CITY_FEES, extractCityKey } from '../_shared/validation.ts';
import { canReschedule, validateNewDate, daysBetween } from '../_shared/reschedule.ts';
import { sumActiveAddons } from '../_shared/pricing.ts';
import { computePackageChange } from '../_shared/change.ts';
import { generateOtp, hashOtp, verifyOtp, OTP_TTL_MS } from '../_shared/otp.ts';
import { sendText } from '../_shared/wa.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OWNER_PHONE           = Deno.env.get('OWNER_WA_NUMBER');

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(error: string, status = 400, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return fail('method_not_allowed', 405);

  let body: any;
  try { body = await req.json(); }
  catch { return fail('invalid_json', 400); }

  const action = String(body.action ?? 'reschedule');

  // ── Credential: the manage token (required for every action) ──────────
  const token = clampText(body.token, 64);
  if (!token || token.length < 16) return fail('token_invalid', 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  // Look up the booking by token (service-role). Select * so a partially
  // migrated schema (missing discount/vat columns) doesn't break the read.
  const { data: booking, error: lookErr } = await supabase
    .from('bookings').select('*').eq('manage_token', token).maybeSingle();
  if (lookErr) return fail('lookup_failed', 500, lookErr.message);
  if (!booking) return fail('not_found', 404);

  if (booking.status === 'cancelled') return fail('booking_cancelled', 422);

  switch (action) {
    case 'reschedule':     return await handleReschedule(supabase, booking, body);
    case 'request_otp':    return await handleRequestOtp(supabase, booking);
    case 'change_package': return await handleChangePackage(supabase, booking, body);
    default:               return fail('unsupported_action', 400);
  }
});

// ── Reschedule (Phase 1) ─────────────────────────────────────────────────────
async function handleReschedule(supabase: any, booking: any, body: any): Promise<Response> {
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

  await notify(booking.customer_phone,
    `✓ تم تأجيل حجزك\nرقم الحجز: ${booking.booking_ref}\nالموعد الجديد: ${newDate} الساعة ${newTime}\nبانتظارك 🤍`);
  await notify(OWNER_PHONE,
    `↻ ATEMA · تأجيل من العميلة\n${booking.booking_ref}\n${booking.event_date} → ${newDate} (${newTime})`);

  return ok({
    ok: true, bookingRef: booking.booking_ref,
    eventDate: newDate, eventTime: newTime,
    rescheduleCount: (booking.reschedule_count ?? 0) + 1,
  });
}

// ── Request step-up OTP (Phase 2) ────────────────────────────────────────────
async function handleRequestOtp(supabase: any, booking: any): Promise<Response> {
  if (!booking.customer_phone) return fail('no_phone_on_file', 422);

  const code = generateOtp();
  const salt = crypto.randomUUID();
  const codeHash = await hashOtp(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error } = await supabase.from('booking_otps').insert({
    booking_id: booking.id, purpose: 'change_package',
    code_hash: codeHash, salt, expires_at: expiresAt,
  });
  if (error) return fail('otp_issue_failed', 500, error.message);

  // The code goes ONLY to the phone on file — never in the HTTP response.
  await notify(booking.customer_phone,
    `رمز ATEMA لتعديل حجزك: ${code}\nصالح لمدة ١٠ دقائق. لا تشاركيه مع أحد.`);

  return ok({ ok: true, sent: true });
}

// ── Change package / add-ons (Phase 2) ───────────────────────────────────────
async function handleChangePackage(supabase: any, booking: any, body: any): Promise<Response> {
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
  const days = daysBetween(new Date().toISOString().slice(0, 10), booking.event_date);
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

  await audit(supabase, booking.id, 'package',
    { package_id: booking.package_id, addon_ids: booking.addon_ids, total: booking.total },
    { package_id: pkgId, addon_ids: addOnIds, total: change.total }, change.delta);

  const dueLine = change.topUpDue > 0
    ? `\nالمبلغ المتبقّي للدفع: ${change.topUpDue.toLocaleString('ar-SA')} ر.س`
    : '';
  await notify(booking.customer_phone,
    `✓ تم تعديل باقتك\nرقم الحجز: ${booking.booking_ref}\nالإجمالي الجديد: ${change.total.toLocaleString('ar-SA')} ر.س${dueLine}`);
  await notify(OWNER_PHONE,
    `✎ ATEMA · تعديل باقة من العميلة\n${booking.booking_ref}\nالإجمالي: ${booking.total} → ${change.total} (${change.direction})`);

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

async function notify(phone: string | undefined, message: string) {
  if (!phone) return;
  await sendText(phone, message).catch(() => {});
}
