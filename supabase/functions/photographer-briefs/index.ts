// ATEMA STUDIO — photographer-briefs Edge Function (admin-only resend).
//
// Re-sends the internal photographer brief (_shared/email-photographer.ts)
// for every non-cancelled booking CREATED in the last N days — used to
// backfill the bookings that predate PHOTOGRAPHER_EMAIL, or to re-deliver a
// brief that failed. Triggered from the admin «إعدادات النظام» card.
//
// Auth: the caller's Supabase session JWT must belong to a signed-in user
// (the studio's single admin — same "authenticated = admin" model as the
// RLS policies). The anon key is rejected.
//
// Two short calls, driven one booking at a time by the admin page — a single
// request sending every brief blew the Edge CPU limit (the worker was killed
// mid-loop and the browser saw "Failed to send a request"):
//   POST { days?: number }      (1…60, default 7) → { ok, ids: string[], capped }
//   POST { bookingId: string }  → { ok, status: 'sent'|'failed'|'skipped', error? }

// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';
import { renderPhotographerBrief, briefFromBookingRow } from '../_shared/email-photographer.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_ORIGIN           = Deno.env.get('SITE_ORIGIN') ?? 'https://atemastudio.xyz';
const PHOTOGRAPHER_EMAIL    = Deno.env.get('PHOTOGRAPHER_EMAIL') ?? '';
// One admin click never queues more than this many sends.
const MAX_BOOKINGS = 40;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
  if (!userData?.user) return json({ error: 'forbidden' }, 401);

  if (!PHOTOGRAPHER_EMAIL) return json({ error: 'photographer_email_unset' }, 422);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body → defaults */ }

  // ── Send ONE brief ──────────────────────────────────────────────────────
  if (typeof body.bookingId === 'string' && body.bookingId) {
    const { data: b, error } = await supabase
      .from('bookings').select('*').eq('id', body.bookingId).maybeSingle();
    if (error) return json({ error: 'lookup_failed', detail: error.message }, 500);
    if (!b)    return json({ error: 'not_found' }, 404);
    const ids: string[] = Array.isArray(b.addon_ids) ? b.addon_ids : [];
    const { data: pkg } = await supabase.from('packages').select('*').eq('id', b.package_id).maybeSingle();
    const { data: addons } = ids.length
      ? await supabase.from('addons').select('id, price, active, name_ar, name_en').in('id', ids)
      : { data: [] };
    const mail = renderPhotographerBrief(briefFromBookingRow(b, pkg, (addons ?? []) as any[], {
      kind: 'new', siteOrigin: SITE_ORIGIN, today: new Date().toISOString().slice(0, 10),
    }));
    const r = await sendEmail({
      to: PHOTOGRAPHER_EMAIL, subject: mail.subject, html: mail.html, text: mail.text,
      template: 'photographer_brief', bookingId: b.id,
    });
    return json({ ok: true, status: r.status, error: r.error });
  }

  // ── List the bookings to send ───────────────────────────────────────────
  const days = Math.min(60, Math.max(1, Math.floor(Number(body.days ?? 7)) || 7));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: rows, error } = await supabase
    .from('bookings').select('id')
    .gte('created_at', since).neq('status', 'cancelled')
    .order('created_at', { ascending: true })
    .limit(MAX_BOOKINGS + 1);
  if (error) return json({ error: 'lookup_failed', detail: error.message }, 500);
  const ids = (rows ?? []).slice(0, MAX_BOOKINGS).map((r: any) => r.id as string);
  return json({ ok: true, days, ids, capped: (rows ?? []).length > MAX_BOOKINGS });
});
