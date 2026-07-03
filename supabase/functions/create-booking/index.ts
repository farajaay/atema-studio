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

// Parsed request bodies and Supabase rows flow through as `any` — structural,
// same pattern as the other Edge Functions.
// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeSaudiMobile,
  validEmail,
  isFutureOrToday,
  clampText,
  CITY_FEES,
} from '../_shared/validation.ts';
import { sumActiveAddons, clampDiscount, computeBookingTotals } from '../_shared/pricing.ts';
import { sendEmail } from '../_shared/email.ts';
import { renderBookingConfirmation } from '../_shared/email-confirmation.ts';
import { generateContractHTML } from '../_shared/contract.ts';
import { generateInvoiceHTML, generateInvoiceNumber, DEFAULT_INVOICE_SETTINGS } from '../_shared/invoice.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;
const SITE_ORIGIN           = Deno.env.get('SITE_ORIGIN') ?? 'https://atemastudio.xyz';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keep the Deno worker alive for the fire-and-forget WhatsApp call so the
// fetch doesn't get cancelled when the HTTP response is returned.
function keepAlive(task: Promise<unknown>): void {
  const rt = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') {
    try { rt.waitUntil(task); return; } catch { /* fall through */ }
  }
}

function fail(error: string, status = 400, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function htmlToBytes(html: string): Uint8Array {
  return new TextEncoder().encode(html);
}

// Crockford base32 booking ref (same alphabet as booking.ts)
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function newRef(): string {
  const d = new Date();
  const yy  = String(d.getFullYear()).slice(2);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let tail = '';
  for (let i = 0; i < bytes.length; i++) tail += CROCKFORD[bytes[i] & 0x1f];
  return `ATEMA-${yy}${mm}${day}-${tail}`;
}

function traceId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < bytes.length; i++) id += CROCKFORD[bytes[i] & 0x1f];
  return id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return fail('method_not_allowed', 405);

  let body: any;
  try { body = await req.json(); }
  catch { return fail('invalid_json', 400); }

  const reqId: string = typeof body._reqId === 'string' && body._reqId.length <= 16
    ? body._reqId
    : traceId();
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

  log('→ db.packages.select', { packageId: pkgId });
  const { data: pkg, error: pkgErr } = await supabase
    .from('packages')
    .select('id, price, active, name_ar, name_en, duration_hours')
    .eq('id', pkgId)
    .single();
  log('← db.packages.select', {
    pkg: pkg ? { id: pkg.id, price: pkg.price, active: pkg.active } : null,
    error: pkgErr ? { code: (pkgErr as any).code, message: pkgErr.message } : null,
  });
  if (pkgErr || !pkg) { warn('reject: package_not_found'); return fail('package_not_found', 422, pkgErr?.message); }
  if (!pkg.active)    { warn('reject: package_inactive'); return fail('package_inactive', 422); }

  // Keep addon rows for document generation (names + prices)
  let addonsTotal = 0;
  let addonRows: Array<{ id: string; name_ar: string; name_en: string; price: number; active: boolean }> = [];
  if (addOnIds.length > 0) {
    log('→ db.addons.select', { addOnIds });
    const { data: addons, error: addErr } = await supabase
      .from('addons')
      .select('id, price, active, name_ar, name_en')
      .in('id', addOnIds);
    log('← db.addons.select', {
      rowCount: addons?.length ?? 0,
      error: addErr ? { code: (addErr as any).code, message: addErr.message } : null,
    });
    if (addErr) { warn('reject: addons_lookup_failed'); return fail('addons_lookup_failed', 500, addErr.message); }
    addonRows = (addons ?? []) as typeof addonRows;
    addonsTotal = sumActiveAddons(addonRows as Array<{ price: number; active: boolean }>);
  }

  const cityFee = CITY_FEES[String(body.city ?? '')] ?? 0;
  const grossSubtotal = pkg.price + addonsTotal + cityFee;
  log('computed grossSubtotal', { pkgPrice: pkg.price, addonsTotal, cityFee, grossSubtotal });

  // ── Discount redemption ───────────────────────────────────────────────
  let discountCode: string | null = null;
  let discountAmount = 0;
  let discountKind: 'percent' | 'flat' | null = null;
  if (typeof body.discountCode === 'string' && body.discountCode.trim()) {
    const codeRaw = String(body.discountCode).trim().toUpperCase();
    log('→ rpc.redeem_discount_code', { code: codeRaw, grossSubtotal });
    const { data: red, error: redErr } = await supabase
      .rpc('redeem_discount_code', { p_code: codeRaw, p_subtotal: grossSubtotal });
    log('← rpc.redeem_discount_code', {
      result: red,
      error: redErr ? { code: (redErr as any).code, message: redErr.message } : null,
    });
    if (redErr) { err('redeem RPC error:', redErr); return fail('discount_redeem_failed', 500, redErr.message); }
    const row = Array.isArray(red) ? red[0] : red;
    const reason = row?.reason as string | undefined;
    if (reason && reason !== 'ok') { warn(`reject: discount_${reason}`); return fail('discount_' + reason, 422); }
    discountAmount = clampDiscount(Number(row?.applied_amount ?? 0), grossSubtotal);
    discountKind   = (row?.applied_kind as 'percent' | 'flat' | null) ?? null;
    discountCode   = codeRaw;
  }

  log('→ db.app_settings.select');
  const { data: settings, error: settingsErr } = await supabase
    .from('app_settings')
    .select('vat_enabled, wa_enabled, seller_name_ar, vat_number, cr_number')
    .limit(1)
    .single();
  log('← db.app_settings.select', {
    settings,
    error: settingsErr ? { code: (settingsErr as any).code, message: settingsErr.message } : null,
  });
  const vatEnabled = settings?.vat_enabled ?? true;
  const waEnabled  = settings?.wa_enabled  ?? false;
  const { subtotal, vat, total } = computeBookingTotals({ grossSubtotal, discountAmount, vatEnabled });
  log('computed totals', { vatEnabled, subtotal, vat, total });

  // ── Insert ────────────────────────────────────────────────────────────
  const ref = newRef();

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
    discount_code:   discountCode,
    discount_amount: discountAmount,
    discount_kind:   discountKind,
    event_type:               eventType,
    guest_count:              guestCount,
    shot_list:                shotList || null,
    tc_accepted:              tcAccepted,
    tc_accepted_at:           tcAccepted ? new Date().toISOString() : null,
    pdpl_consent_snapshot:    pdplConsent,
    whatsapp_opt_in_snapshot: whatsappOptIn,
  };

  const COLUMN_NOT_FOUND_RE =
    /Could not find the ['"`]?([\w]+)['"`]? column|column ['"`]?([\w]+)['"`]? of relation .* does not exist|column ['"`]?([\w]+)['"`]? does not exist/i;

  const attempt: Record<string, unknown> = { ...fullRow };
  const dropped: string[] = [];
  let booking: any = null;
  let insErr: any = null;
  log('→ db.bookings.insert (attempt 1)', {
    columnCount: Object.keys(attempt).length,
    columns: Object.keys(attempt),
    row: { ...attempt, customer_phone: '<redacted>', customer_email: '<redacted>' },
  });
  for (let i = 0; i < 8; i++) {
    ({ data: booking, error: insErr } = await supabase
      .from('bookings')
      .insert([attempt])
      .select('id, booking_ref, status, created_at, event_date, total')
      .single());
    log(`← db.bookings.insert (attempt ${i + 1})`, {
      success: !insErr,
      bookingId: booking?.id ?? null,
      error: insErr ? {
        code:    (insErr as any).code,
        message: insErr.message,
        details: (insErr as any).details,
        hint:    (insErr as any).hint,
      } : null,
    });
    if (!insErr) break;
    const msg = (insErr as { message?: string }).message ?? '';
    const m = msg.match(COLUMN_NOT_FOUND_RE);
    const missing = m?.[1] || m?.[2] || m?.[3];
    if (!missing || !(missing in attempt)) break;
    warn(`stripping unknown column "${missing}" — retrying`);
    dropped.push(missing);
    delete (attempt as Record<string, unknown>)[missing];
  }
  if (dropped.length > 0 && !insErr) {
    warn(`succeeded after stripping unknown columns: ${dropped.join(', ')}.`);
  }

  if (insErr || !booking) {
    err('✗ insert failed', {
      message: insErr?.message,
      code: (insErr as any)?.code,
      details: (insErr as any)?.details,
      hint: (insErr as any)?.hint,
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

  const bookingId  = booking.id as string;
  const bookingRef = booking.booking_ref as string;

  // ── manage_token lookup ───────────────────────────────────────────────
  let manageToken: string | null = null;
  {
    const { data: tokRow, error: tokErr } = await supabase
      .from('bookings').select('manage_token').eq('id', bookingId).single();
    if (!tokErr && tokRow) {
      manageToken = (tokRow as { manage_token?: string | null }).manage_token ?? null;
    }
  }
  const manageLink = manageToken ? `${SITE_ORIGIN}/#/manage/${manageToken}` : null;

  // ── Email with contract + invoice attachments (BACKGROUND) ────────────
  // Runs AFTER the response returns, kept alive via EdgeRuntime.waitUntil
  // (same mechanism as the WhatsApp notify below). Returning immediately after
  // the DB insert stops the browser from timing out on a slow cold-start SMTP
  // session (lazy denomailer import + Zoho TLS handshake) — that race was
  // surfacing a false "booking failed" even though the row was saved and the
  // email sent. Delivery is best-effort and audited in email_messages.
  const emailTask = (async () => {
  if (email) {
    log('[email] preparing confirmation email');
    try {
      // Fetch discount code original value for document display
      let discountValue = 0;
      if (discountCode && discountKind) {
        const { data: dc } = await supabase
          .from('discount_codes')
          .select('value')
          .eq('code', discountCode)
          .single();
        discountValue = Number((dc as any)?.value ?? 0);
      }

      const discountForDocs = discountCode && discountAmount > 0 && discountKind
        ? { code: discountCode, amount: discountAmount, kind: discountKind, value: discountValue }
        : null;

      // Invoice settings from app_settings row
      const invoiceSettings = {
        vat_enabled:    vatEnabled,
        vat_number:     (settings as any)?.vat_number     ?? DEFAULT_INVOICE_SETTINGS.vat_number,
        cr_number:      (settings as any)?.cr_number      ?? DEFAULT_INVOICE_SETTINGS.cr_number,
        seller_name_ar: (settings as any)?.seller_name_ar ?? DEFAULT_INVOICE_SETTINGS.seller_name_ar,
      };

      const now = new Date().toISOString();
      const deposit  = Math.round(total * 0.5);
      const remaining = total - deposit;

      // Contract
      const contractHtml = generateContractHTML({
        customerName:    name,
        customerPhone:   phone,
        bookingRef,
        bookingId,
        contractDate:    now.split('T')[0],
        eventDate,
        eventTime,
        packageNameAr:   pkg.name_ar,
        packageNameEn:   pkg.name_en,
        location:        venue || '',
        durationHours:   Number(pkg.duration_hours ?? 0),
        subtotal,
        vat,
        total,
        deposit,
        remaining,
        addons:          addonRows.filter(a => a.active).map(a => a.name_ar || a.name_en),
        discount:        discountForDocs,
        grossSubtotal,
      });

      // Invoice
      const invoiceNumber = generateInvoiceNumber();
      const invoiceHtml = generateInvoiceHTML({
        invoiceNumber,
        bookingRef,
        bookingId,
        issueDate:      now,
        customerName:   name,
        customerPhone:  phone,
        packageNameAr:  pkg.name_ar,
        packageNameEn:  pkg.name_en,
        addons: addonRows
          .filter(a => a.active)
          .map(a => ({ name: a.name_ar || a.name_en, price: a.price })),
        subtotal,
        vat,
        total,
        paymentMethod:  'pending',
        settings:       invoiceSettings,
        discount:       discountForDocs,
        grossSubtotal,
      });

      const rendered = renderBookingConfirmation({
        customerName:  name,
        bookingRef,
        packageNameAr: pkg.name_ar,
        packageNameEn: pkg.name_en,
        eventDate,
        eventTime,
        total,
        manageToken,
        siteOrigin:    SITE_ORIGIN,
      });

      const result = await sendEmail({
        to:        email,
        subject:   rendered.subject,
        html:      rendered.html,
        text:      rendered.text,
        template:  'booking_confirmation',
        bookingId,
        attachments: [
          {
            filename:    `ATEMA-Contract-${bookingRef}.html`,
            contentType: 'text/html; charset=utf-8',
            content:     htmlToBytes(contractHtml),
          },
          {
            filename:    `ATEMA-Invoice-${bookingRef}.html`,
            contentType: 'text/html; charset=utf-8',
            content:     htmlToBytes(invoiceHtml),
          },
        ],
      });
      log('[email] send result:', result.status, result.error ?? '');
    } catch (e) {
      err('[email] unexpected error:', (e as Error).message);
    }
  }
  })();
  keepAlive(emailTask);

  // ── WhatsApp booking confirmation (fire-and-forget) ───────────────────
  if (waEnabled && whatsappOptIn) {
    const waTask = fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({
        phone, name, bookingRef,
        packageAr:  pkg.name_ar,
        packageEn:  pkg.name_en,
        total, eventDate, manageLink,
      }),
    }).catch((e: unknown) => console.error('wa-notify error:', (e as Error).message));
    keepAlive(waTask);
  }

  return new Response(
    JSON.stringify({
      id:         booking.id,
      bookingRef: booking.booking_ref,
      status:     booking.status,
      createdAt:  booking.created_at,
      eventDate:  booking.event_date,
      total:      booking.total,
      subtotal, vat,
      grossSubtotal,
      discountCode,
      discountAmount,
      discountKind,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
