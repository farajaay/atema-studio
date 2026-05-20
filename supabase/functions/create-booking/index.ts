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

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Booking ref generator (matches client H-2 patch) ─────────────────────────
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function randomTail(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += CROCKFORD[bytes[i] & 0x1f];
  return out;
}
function bookingRef(): string {
  const d = new Date();
  return `ATEMA-${String(d.getUTCFullYear()).slice(2)}${
    String(d.getUTCMonth() + 1).padStart(2, '0')}${
    String(d.getUTCDate()).padStart(2, '0')}-${randomTail()}`;
}

// ── Validators (mirror of src/utils/validation.ts) ───────────────────────────
function normalizeSaudiMobile(raw: string): string | null {
  if (!raw) return null;
  let c = raw.replace(/[\s\-()]/g, '');
  if (c.startsWith('+'))  c = c.slice(1);
  if (c.startsWith('00')) c = c.slice(2);
  if (c.startsWith('0'))  c = '966' + c.slice(1);
  if (c.startsWith('5') && c.length === 9) c = '966' + c;
  return /^9665\d{8}$/.test(c) ? '+' + c : null;
}
function validEmail(raw: string | undefined): boolean {
  if (!raw) return true;
  const v = raw.trim();
  if (v.length > 254 || /\s/.test(v)) return false;
  const m = v.match(/^([^@]+)@([^@]+)$/);
  if (!m) return false;
  const [, local, domain] = m;
  return local.length > 0 && local.length <= 64 &&
    /\./.test(domain) && !domain.startsWith('.') && !domain.endsWith('.');
}
function isFutureOrToday(iso: string): boolean {
  if (!iso) return false;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const t = new Date(iso + 'T00:00:00Z');
  return !Number.isNaN(t.getTime()) && t >= today;
}
function clampText(raw: string | undefined, max: number): string {
  if (!raw) return '';
  const t = raw.trim();
  return t.length > max ? t.slice(0, max) : t;
}

const VAT_RATE = 0.15;

// City fee map mirrors src/pages/BookingPage.tsx CITIES constant.
const CITY_FEES: Record<string, number> = {
  jubail: 0, dammam: 200, khobar: 200, qatif: 200, ahsa: 450,
  riyadh: 0, other: 0,
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

  // ── Sanitise + validate inputs ────────────────────────────────────────
  const name = clampText(body.customerName, 120);
  if (!name) return fail('name_required', 422);

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
    for (const a of addons ?? []) {
      if (a.active) addonsTotal += a.price;
    }
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
    discountAmount = Math.max(0, Math.min(Number(row?.applied_amount ?? 0), grossSubtotal));
    discountKind   = (row?.applied_kind as 'percent' | 'flat' | null) ?? null;
    discountCode   = codeRaw;
  }

  const subtotal = Math.max(0, grossSubtotal - discountAmount);

  const { data: settings } = await supabase
    .from('app_settings').select('vat_enabled').limit(1).single();
  const vatEnabled = settings?.vat_enabled ?? true;
  const vat   = vatEnabled ? Math.round(subtotal * VAT_RATE) : 0;
  const total = subtotal + vat;

  // ── Insert ────────────────────────────────────────────────────────────
  const ref = bookingRef();
  const { data: booking, error: insErr } = await supabase
    .from('bookings')
    .insert([{
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
      discount_code:   discountCode,
      discount_amount: discountAmount,
      discount_kind:   discountKind,
    }])
    .select('id, booking_ref, status, created_at, event_date, total')
    .single();
  if (insErr) {
    console.error('insert error:', insErr);
    return fail('insert_failed', 500, insErr.message);
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
