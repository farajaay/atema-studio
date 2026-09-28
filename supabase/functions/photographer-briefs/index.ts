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
// POST { days?: number }   (1…60, default 7)
// → { ok, total, sent, failed, skipped, capped }

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
// SMTP sends are sequential; keep one run well inside the Edge wall clock.
const MAX_BOOKINGS = 40;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  const days = Math.min(60, Math.max(1, Math.floor(Number(body.days ?? 7)) || 7));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: rows, error } = await supabase
    .from('bookings').select('*')
    .gte('created_at', since).neq('status', 'cancelled')
    .order('created_at', { ascending: true })
    .limit(MAX_BOOKINGS + 1);
  if (error) return json({ error: 'lookup_failed', detail: error.message }, 500);

  const bookings = (rows ?? []).slice(0, MAX_BOOKINGS);
  const pkgIds   = [...new Set(bookings.map((b: any) => b.package_id).filter((x: any) => x != null))];
  const addonIds = [...new Set(bookings.flatMap((b: any) => Array.isArray(b.addon_ids) ? b.addon_ids : []))];
  const { data: pkgs }   = pkgIds.length   ? await supabase.from('packages').select('*').in('id', pkgIds) : { data: [] };
  const { data: addons } = addonIds.length
    ? await supabase.from('addons').select('id, price, active, name_ar, name_en').in('id', addonIds)
    : { data: [] };
  const pkgById   = new Map((pkgs ?? []).map((p: any) => [p.id, p]));
  const addonById = new Map((addons ?? []).map((a: any) => [a.id, a]));

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0, failed = 0, skipped = 0;
  for (const b of bookings as any[]) {
    try {
      const rowAddons = (Array.isArray(b.addon_ids) ? b.addon_ids : [])
        .map((id: string) => addonById.get(id)).filter(Boolean);
      const mail = renderPhotographerBrief(briefFromBookingRow(b, pkgById.get(b.package_id), rowAddons, {
        kind: 'new', siteOrigin: SITE_ORIGIN, today,
      }));
      const r = await sendEmail({
        to: PHOTOGRAPHER_EMAIL, subject: mail.subject, html: mail.html, text: mail.text,
        template: 'photographer_brief', bookingId: b.id,
      });
      if (r.status === 'sent') sent++; else if (r.status === 'failed') failed++; else skipped++;
    } catch (e) {
      console.error('[briefs] render/send failed:', b.booking_ref, (e as Error).message);
      failed++;
    }
  }

  return json({
    ok: true, days, total: bookings.length, sent, failed, skipped,
    capped: (rows ?? []).length > MAX_BOOKINGS,
  });
});
