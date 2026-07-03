// ATEMA STUDIO — change-booking Edge Function.
//
// Customer self-service booking changes, authenticated by the manage token
// (capability link). The function runs as service-role and is the ONLY path
// that writes a change — anon never updates `bookings` directly.
//
// Actions:
//   • reschedule     — move the date (Phase 1). Token only.
//   • request_otp    — EMAIL a step-up code to the booking's address (Phase 2).
//                      Email, not WhatsApp: a web-initiated change rarely has
//                      Meta's 24h session window open, so a free-form WA text
//                      would be rejected (and OTP-by-text is against policy).
//   • change_package — swap package / add-ons (Phase 2). Token + OTP.
//
// All policy lives in dependency-free _shared modules that are unit-tested:
//   reschedule.ts (date policy), pricing.ts + change.ts (money), otp.ts (2FA).
// The request wiring lives in ./handlers.ts so the glue is unit-tested too
// (src/services/change-booking-glue.test.ts) — this file is only the Deno
// runtime shell: HTTP, env, service-role client, WhatsApp transport.
//
// Deploy:  supabase functions deploy change-booking
// Pairs with: migrations-2026-05-booking-changes.sql + ...-otp.sql

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendText } from '../_shared/wa.ts';
import { sendEmail } from '../_shared/email.ts';
import { routeChangeRequest, corsHeaders, fail } from './handlers.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OWNER_PHONE           = Deno.env.get('OWNER_WA_NUMBER');
const SITE_ORIGIN           = Deno.env.get('SITE_ORIGIN') ?? 'https://atemastudio.xyz';

// Keep the worker alive for background work (OTP email) so we can return the
// HTTP response immediately without the SMTP session being torn down.
function keepAlive(task: Promise<unknown>): void {
  const rt = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') {
    try { rt.waitUntil(task); } catch { /* best-effort */ }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return fail('method_not_allowed', 405);

  let body: unknown;
  try { body = await req.json(); }
  catch { return fail('invalid_json', 400); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  return await routeChangeRequest(supabase, body, {
    ownerPhone: OWNER_PHONE,
    siteOrigin: SITE_ORIGIN,
    keepAlive,
    notify: async (phone, message) => {
      if (!phone) return;
      await sendText(phone, message).catch(() => {});
    },
    sendEmail: async ({ to, subject, html, text, bookingId }) => {
      try {
        const r = await sendEmail({ to, subject, html, text, template: 'change_otp', bookingId });
        return { status: r.status, error: r.error };
      } catch (e) {
        return { status: 'failed', error: (e as Error).message };
      }
    },
  });
});
