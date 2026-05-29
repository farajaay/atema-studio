// ATEMA STUDIO — create-booking Supabase Edge Function (Patch C-3).
//
// Re-computes booking subtotal / vat / total from the authoritative
// packages + addons + app_settings tables. The client is never trusted to
// supply monetary values — this closes the C-3 audit finding ("crafted POST
// could record a 14,000 SAR Couture booking with total=1 SAR").
//
// Inputs the function still trusts from the client (after sanitising):
//   customerName / customerPhone / customerEmail / eventDate / eventTime /
//   city / location / specialRequests / packageId (numeric) / addOnIds[].
// Everything monetary is derived server-side.
//
// Deploy:
//   supabase functions deploy create-booking
//
// After deploy, lock down direct anon INSERTs on `bookings` so this function
// (running as service-role) is the only insert path:
//   alter table public.bookings disable row level security;
//   alter table public.bookings enable  row level security;
//   drop policy if exists "Anon insert bookings" on public.bookings;
//
// Existing WhatsApp notification trigger preserved at the bottom.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeSaudiMobile,
  validEmail,
  isFutureOrToday,
  clampText,
  bookingRef,
  CITY_FEES,
} from '../_shared/validation.ts';
import { sumActiveAddons, clampDiscount, computeBookingTotals } from '../_shared/pricing.ts';
import { sendEmail } from '../_shared/email.ts';
import { renderBookingConfirmation } from '../_shared/email-confirmation.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;
const SITE_ORIGIN           = Deno.env.get('SITE_ORIGIN') ?? 'https://atemastudio.xyz';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fail(error: string, status = 400, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return fail('method_not_allowed', 405);

  let body: any;
  try { body = await req.json(); }
  catch { return fail('invalid_json', 400); }

  // Correlation id — echoed by src/services/booking.ts. Lets us match a
  // single client-side [booking:xxxx] console group to one log stream
  // here. Generated server-side if the client didn't supply one.
  const reqId: string = typeof body._reqId === 'string' && body._reqId.length <= 16
    ? body._reqId
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  const t0 = Date.now();
  const log = (...args: unknown[]) => console.log(`[booking:${reqId}]`, ...args);
  const warn = (...args: unknown[]) => console.warn(`[booking:${reqId}]`, ...args);
  const err  = (...args: unknown[]) => console.error(`[booking:${reqId}]`, ...args);

  log('inbound request', {
    customerName:  body.customerName,
    customerPhone: body.customerPhone,
    customerEmail: body.customerEmail,
    packageId:     body.packageId,
    addOnIds:      Array.isArray(body.addOnIds) ? body.addOnIds.length : 0,
    eventDate:     body.eventDate,
    city:          body.city,
    discountCode:  body.discountCode ?? null,
  });

  // ── Sanitise + validate inputs ────────────────────────────────────────
  const name = clampText(body.customerName, 120);
  if (!name) { warn('reject: name_required'); return fail('name_required', 422); }

  const phone = normalizeSaudiMobile(body.customerPhone ?? '');
  if (!phone) return fail('phone_invalid', 422);

  const email = clampText(body.customerEmail, 254);
  if (email && !validEmail(email)) return fail('email_invalid', 422);

  const eventDate = String(body.eventDate ?? '');
  if (!isFutureOrToday(eventDate)) return fail('date_invalid', 422);

  const eventTime = clampText(body.eventTime, 10) || '18:00';
  const venue     = clampText(body.location, 200);
  const notes     = clampText(body.specialRequests, 2000);

  const pkgId = typeof body.packageId === 'number' ? body.packageId : null;
  if (pkgId === null) return fail('package_required', 422);

  const addOnIds: string[] = Array.isArray(body.addOnIds)
    ? body.addOnIds.filter((x: unknown) => typeof x === 'string').slice(0, 50)
    : [];

  // ── Shoot-logistics + consent (audit append, 2026-05) ──────────────────
  const EVENT_TYPES = new Set([
    'wedding', 'engagement', 'portrait', 'corporate',
    'product', 'real_estate', 'industrial', 'other',
  ]);
  const eventType = EVENT_TYPES.has(String(body.eventType ?? ''))
    ? String(body.eventType)
    : null;
  // Reasonable upper bound — anything north of 5000 attendees is clearly
  // junk for a private photography booking and should be flagged.
  const guestCount = (() => {
    const n = Number(body.guestCount);
    return Number.isInteger(n) && n >= 0 && n <= 5000 ? n : null;
  })();
  const shotList     = clampText(body.shotList, 2000);
  const tcAccepted   = body.tcAccepted    === true;
  const pdplConsent  = body.pdplConsent   === true;
  const whatsappOptIn = body.whatsappOptIn === true;

  // ── Server-side recompute ─────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  const { data: pkg, error: pkgErr } = await supabase
    .from('packages').select('id, price, active, name_ar, name_en').eq('id', pkgId).single();
  if (pkgErr || !pkg) return fail('package_not_found', 422);
  if (!pkg.active)    return fail('package_inactive', 422);

  let addonsTotal = 0;
  if (addOnIds.length > 0) {
    const { data: addons, error: addErr } = await supabase
      .from('addons').select('id, price, active').in('id', addOnIds);
    if (addErr) return fail('addons_lookup_failed', 500, addErr.message);
    addonsTotal = sumActiveAddons((addons ?? []) as Array<{ price: number; active: boolean }>);
  }

  const cityFee = CITY_FEES[String(body.city ?? '')] ?? 0;
  const grossSubtotal = pkg.price + addonsTotal + cityFee;

  // ── Discount redemption (atomic, single source of truth) ──────────────
  // The client may supply discountCode; we validate + redeem via the
  // redeem_discount_code() RPC. This bumps used_count in the same txn,
  // preventing two simultaneous brides from both consuming the last
  // available seat of a max_uses-capped code.
  let discountCode: string | null = null;
  let discountAmount = 0;
  let discountKind: 'percent' | 'flat' | null = null;
  if (typeof body.discountCode === 'string' && body.discountCode.trim()) {
    const codeRaw = String(body.discountCode).trim().toUpperCase();
    const { data: red, error: redErr } = await supabase
      .rpc('redeem_discount_code', { p_code: codeRaw, p_subtotal: grossSubtotal });
    if (redErr) {
      console.error('redeem RPC error:', redErr);
      return fail('discount_redeem_failed', 500, redErr.message);
    }
    const row = Array.isArray(red) ? red[0] : red;
    const reason = row?.reason as string | undefined;
    if (reason && reason !== 'ok') {
      return fail('discount_' + reason, 422);
    }
    discountAmount = clampDiscount(Number(row?.applied_amount ?? 0), grossSubtotal);
    discountKind   = (row?.applied_kind as 'percent' | 'flat' | null) ?? null;
    discountCode   = codeRaw;
  }

  const { data: settings } = await supabase
    .from('app_settings').select('vat_enabled').limit(1).single();
  const vatEnabled = settings?.vat_enabled ?? true;
  const { subtotal, vat, total } = computeBookingTotals({ grossSubtotal, discountAmount, vatEnabled });

  // ── Insert ────────────────────────────────────────────────────────────
  const ref = bookingRef();

  // Canonical full row — every column we'd ideally write. If the live
  // schema is missing any (audit / discount / vat_enabled migrations
  // not yet applied), the resilient inserter below strips them and
  // retries so the booking still completes.
  const fullRow: Record<string, unknown> = {
    booking_ref: ref,
    package_id:  pkgId,
    addon_ids:   addOnIds,
    event_date:  eventDate,
    event_time:  eventTime,
    customer_name:    name,
    customer_phone:   phone,
    customer_email:   email || null,
    location:         venue || null,
    special_requests: notes || null,
    subtotal, vat, total,
    vat_enabled: vatEnabled,
    status:         'pending',
    payment_status: 'unpaid',
    // Discount columns (migrations-2026-05-discount-codes.sql)
    discount_code:   discountCode,
    discount_amount: discountAmount,
    discount_kind:   discountKind,
    // Audit columns (database-alteration-v2.sql)
    event_type:               eventType,
    guest_count:              guestCount,
    shot_list:                shotList || null,
    tc_accepted:              tcAccepted,
    tc_accepted_at:           tcAccepted ? new Date().toISOString() : null,
    pdpl_consent_snapshot:    pdplConsent,
    whatsapp_opt_in_snapshot: whatsappOptIn,
  };

  // Resilient insert: auto-strip any column PostgREST says doesn't
  // exist, retry. Caps at 8 retries to bound recovery time.
  const COLUMN_NOT_FOUND_RE =
    /Could not find the ['"`]?([\w]+)['"`]? column|column ['"`]?([\w]+)['"`]? of relation .* does not exist|column ['"`]?([\w]+)['"`]? does not exist/i;

  let attempt: Record<string, unknown> = { ...fullRow };
  const dropped: string[] = [];
  let booking: any = null;
  let insErr: any = null;
  for (let i = 0; i < 8; i++) {
    ({ data: booking, error: insErr } = await supabase
      .from('bookings')
      .insert([attempt])
      .select('id, booking_ref, status, created_at, event_date, total, manage_token')
      .single());
    if (!insErr) break;
    const msg = (insErr as { message?: string }).message ?? '';
    const m = msg.match(COLUMN_NOT_FOUND_RE);
    const missing = m?.[1] || m?.[2] || m?.[3];
    if (!missing || !(missing in attempt)) break;
    dropped.push(missing);
    delete (attempt as Record<string, unknown>)[missing];
  }
  if (dropped.length > 0 && !insErr) {
    console.warn(`[create-booking] succeeded after stripping unknown columns: ${dropped.join(', ')}.`);
  }

  if (insErr || !booking) {
    err('✗ insert failed', {
      message: insErr?.message,
      code: (insErr as { code?: string })?.code,
      details: (insErr as { details?: string })?.details,
      hint: (insErr as { hint?: string })?.hint,
      droppedColumns: dropped,
      row: { ...attempt, customer_phone: '<redacted>', customer_email: '<redacted>' },
    });
    return fail('insert_failed', 500, insErr?.message);
  }
  log(`✓ insert success in ${Date.now() - t0}ms`, {
    bookingId: booking.id,
    ref: booking.booking_ref,
    droppedColumns: dropped.length > 0 ? dropped : undefined,
  });

  // ── Email confirmation (fire & forget; Zoho Mail SMTP) ─────────────────
  // Failure is non-fatal — sendEmail() logs to email_messages and returns
  // a status object rather than throwing, so a flaky SMTP session never
  // rolls back a successful booking. We don't await it.
  if (email) {
    (async () => {
      const rendered = renderBookingConfirmation({
        customerName:  name,
        bookingRef:    ref,
        packageNameAr: pkg.name_ar,
        packageNameEn: pkg.name_en,
        eventDate,
        eventTime,
        total,
        manageToken:   (booking as { manage_token?: string | null }).manage_token ?? null,
        siteOrigin:    SITE_ORIGIN,
      });
      await sendEmail({
        to:        email,
        subject:   rendered.subject,
        html:      rendered.html,
        text:      rendered.text,
        template:  'booking_confirmation',
        bookingId: booking.id,
      });
    })().catch(err => console.error('email-confirm error:', (err as Error).message));
  }

  // ── WhatsApp notification (fire & forget; preserved from previous stub) ──
  fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({
      phone:      phone,
      name,
      bookingRef: ref,
      packageAr:  pkg.name_ar,
      packageEn:  pkg.name_en,
      total,
      eventDate,
    }),
  }).catch(err => console.error('wa-notify error:', err));

  return new Response(
    JSON.stringify({
      id:         booking.id,
      bookingRef: booking.booking_ref,
      status:     booking.status,
      createdAt:  booking.created_at,
      eventDate:  booking.event_date,
      total:      booking.total,
      subtotal, vat,   // server-recomputed values, echoed back
      grossSubtotal,
      discountCode,
      discountAmount,
      discountKind,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
