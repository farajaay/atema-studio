// ATEMA STUDIO — verify-payment Edge Function (Patch M-11).
//
// Verifies a Moyasar payment server-side before updating booking status.
// Closes the security gap where a client could forge ?status=paid in the
// callback URL and trigger a DB update without having actually paid.
//
// Flow:
//   1. Client POSTs { paymentId, bookingId } after Moyasar redirect
//   2. Function fetches the payment from Moyasar API using the secret key
//   3. Validates payment.metadata.booking_id === bookingId (prevents
//      replaying a valid payment ID from a different booking)
//   4. If status is paid/authorized, updates bookings via service-role
//   5. Returns { verified, status }
//
// Required Supabase secret:
//   MOYASAR_SECRET_KEY — the "sk_..." key from your Moyasar dashboard
//
// Deploy:
//   supabase functions deploy verify-payment

// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any -- parsed request/Moyasar payloads are structural */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MOYASAR_SECRET_KEY    = Deno.env.get('MOYASAR_SECRET_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);

  if (!MOYASAR_SECRET_KEY) {
    console.error('[verify-payment] MOYASAR_SECRET_KEY not set');
    return json({ error: 'gateway_not_configured' }, 503);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const paymentId = String(body.paymentId ?? '').trim();
  const bookingId = String(body.bookingId ?? '').trim();

  if (!paymentId || !bookingId) return json({ error: 'missing_params' }, 400);

  // Reject obvious path traversal / injection attempts in the payment ID.
  // Moyasar payment IDs are alphanumeric with underscores: e.g. pay_abc123
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(paymentId)) {
    return json({ error: 'invalid_payment_id' }, 400);
  }

  // Fetch payment from Moyasar API using the secret key for Basic auth.
  // Basic auth for Moyasar: base64(secretKey + ":") — empty password.
  let moyasarPayment: any;
  try {
    const resp = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Basic ${btoa(MOYASAR_SECRET_KEY + ':')}`,
      },
    });
    if (resp.status === 404) {
      return json({ verified: false, status: 'not_found' });
    }
    if (!resp.ok) {
      console.error(`[verify-payment] Moyasar API error: ${resp.status}`);
      return json({ error: 'gateway_error' }, 502);
    }
    moyasarPayment = await resp.json();
  } catch (e) {
    console.error('[verify-payment] fetch failed:', (e as Error).message);
    return json({ error: 'gateway_unreachable' }, 502);
  }

  // Confirm the payment's stored metadata points at this booking.
  // This prevents an attacker from re-using a valid payment ID from
  // a different (or their own) transaction to mark another booking as paid.
  const metaBookingId = String(moyasarPayment?.metadata?.booking_id ?? '').trim();
  if (metaBookingId !== bookingId) {
    console.warn(`[verify-payment] booking_id mismatch: got "${metaBookingId}", expected "${bookingId}"`);
    return json({ verified: false, status: 'booking_mismatch' });
  }

  const paymentStatus: string = moyasarPayment.status ?? 'unknown';
  const isPaid = paymentStatus === 'paid' || paymentStatus === 'authorized';

  if (!isPaid) {
    return json({ verified: false, status: paymentStatus });
  }

  // purpose is stored in Moyasar metadata at payment creation time.
  // 'topup'   — top-up for a package upgrade; clears topup_amount_due.
  // 'booking' — initial deposit; marks the booking as paid/confirmed.
  const purpose: string = String(moyasarPayment?.metadata?.purpose ?? 'booking');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  if (purpose === 'topup') {
    const { error: dbErr } = await supabase
      .from('bookings')
      .update({ topup_amount_due: 0 })
      .eq('id', bookingId);
    if (dbErr) {
      console.error('[verify-payment] topup DB update failed:', dbErr.message);
      return json({ error: 'db_update_failed', detail: dbErr.message }, 500);
    }
    return json({ verified: true, status: paymentStatus, purpose: 'topup' });
  }

  // Default: initial booking payment — confirm the booking.
  const { error: dbErr } = await supabase
    .from('bookings')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('id', bookingId);

  if (dbErr) {
    console.error('[verify-payment] DB update failed:', dbErr.message);
    return json({ error: 'db_update_failed', detail: dbErr.message }, 500);
  }

  return json({ verified: true, status: paymentStatus, purpose: 'booking' });
});
