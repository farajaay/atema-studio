// ATEMA STUDIO — change-booking Edge Function (Phase 1: reschedule).
//
// Lets a bride move her own booking via her private manage token. The token is
// the only credential (capability-link auth, like the Mood Board); the
// function runs as service-role and is the ONLY path that writes the change —
// anon never updates `bookings` directly.
//
// Enforces the contract policy (_shared/reschedule.ts) AND availability against
// the live calendar, then updates the date, bumps reschedule_count, writes an
// audit row, and notifies the customer + owner over WhatsApp (best-effort).
//
// Deploy:  supabase functions deploy change-booking
//
// Pairs with database/migrations-2026-05-booking-changes.sql.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { clampText } from '../_shared/validation.ts';
import { canReschedule, validateNewDate } from '../_shared/reschedule.ts';
import { sendText } from '../_shared/wa.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OWNER_PHONE           = Deno.env.get('OWNER_WA_NUMBER');

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return fail('method_not_allowed', 405);

  let body: any;
  try { body = await req.json(); }
  catch { return fail('invalid_json', 400); }

  const action = String(body.action ?? 'reschedule');
  if (action !== 'reschedule') return fail('unsupported_action', 400);

  // ── Credential: the manage token ──────────────────────────────────────
  const token = clampText(body.token, 64);
  if (!token || token.length < 16) return fail('token_invalid', 401);

  const newDate = String(body.newDate ?? '');
  if (!ISO_DATE.test(newDate)) return fail('date_invalid', 422);
  const newTime = clampText(body.newTime, 10) || '18:00';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  // ── Look up the booking by token (service-role) ───────────────────────
  const { data: booking, error: lookErr } = await supabase
    .from('bookings')
    .select('id, booking_ref, status, payment_status, event_date, event_time, customer_phone, reschedule_count')
    .eq('manage_token', token)
    .maybeSingle();
  if (lookErr) return fail('lookup_failed', 500, lookErr.message);
  if (!booking) return fail('not_found', 404);

  // ── Policy: eligible at all? ──────────────────────────────────────────
  const elig = canReschedule({
    eventDate: booking.event_date,
    status: booking.status,
    rescheduleCount: booking.reschedule_count ?? 0,
  });
  if (!elig.allowed) return fail('reschedule_' + elig.reason, 422);

  // ── Policy: is the requested new date acceptable? ─────────────────────
  const dateCheck = validateNewDate({
    originalEventDate: booking.event_date,
    newEventDate: newDate,
  });
  if (!dateCheck.allowed) return fail('reschedule_' + dateCheck.reason, 422);

  // ── Availability against the live calendar ────────────────────────────
  const { data: clash } = await supabase
    .from('bookings')
    .select('id')
    .eq('event_date', newDate)
    .neq('status', 'cancelled')
    .neq('id', booking.id)
    .limit(1);
  if (clash && clash.length > 0) return fail('date_unavailable', 409);

  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('date', newDate)
    .limit(1);
  if (blocked && blocked.length > 0) return fail('date_blocked', 409);

  // ── Apply the change ──────────────────────────────────────────────────
  const oldDate = booking.event_date;
  const oldTime = booking.event_time;
  const { error: updErr } = await supabase
    .from('bookings')
    .update({
      event_date: newDate,
      event_time: newTime,
      reschedule_count: (booking.reschedule_count ?? 0) + 1,
    })
    .eq('id', booking.id);
  if (updErr) return fail('update_failed', 500, updErr.message);

  // Audit (best-effort — never block the change on a logging failure).
  await supabase.from('booking_changes').insert({
    booking_id: booking.id,
    kind: 'reschedule',
    actor: 'customer',
    old_value: { event_date: oldDate, event_time: oldTime },
    new_value: { event_date: newDate, event_time: newTime },
  }).then(undefined, (e: unknown) => console.error('audit insert failed:', e));

  // Notify customer + owner (best-effort).
  if (booking.customer_phone) {
    await sendText(booking.customer_phone,
      `✓ تم تأجيل حجزك\n` +
      `رقم الحجز: ${booking.booking_ref}\n` +
      `الموعد الجديد: ${newDate} الساعة ${newTime}\n` +
      `بانتظارك 🤍`).catch(() => {});
  }
  if (OWNER_PHONE) {
    await sendText(OWNER_PHONE,
      `↻ ATEMA · تأجيل من العميلة\n` +
      `${booking.booking_ref}\n` +
      `${oldDate} → ${newDate} (${newTime})`).catch(() => {});
  }

  return ok({
    ok: true,
    bookingRef: booking.booking_ref,
    eventDate: newDate,
    eventTime: newTime,
    rescheduleCount: (booking.reschedule_count ?? 0) + 1,
  });
});
