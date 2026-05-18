// ATEMA STUDIO — Smart Lifecycle Reminders cron.
//
// Run this Edge Function on a schedule (every 30 minutes is plenty) and it
// will dispatch the right WhatsApp reminder for every booking that's due
// one. Idempotent — the wa_reminders_sent table guards against duplicate
// sends.
//
// Reminder ladder (every customer who opts in walks through these):
//
//   pre_72h          3 days before event → suggest add-ons + final tweaks
//   pre_48h          2 days before       → location, photographer name, map link
//   pre_24h          1 day before        → prep tips, arrival window
//   post_2h          2 hours after event → thank-you + delivery timeline
//   post_30d         30 days after       → gallery sneak-peek + review prompt
//   anniversary_1y   365 days after      → loyalty discount + anniversary upsell
//
// All messages MUST be pre-approved Meta templates because the 24-hour
// service window will have lapsed by the time the cron fires. Template
// definitions live in docs/integrations/wa-platform.md §6 — submit each to
// Meta Business Manager → WhatsApp → Message Templates before going live.
//
// Trigger:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     https://<project>.supabase.co/functions/v1/wa-reminders
//
// Schedule via cron-job.org / EasyCron / supabase-cron, etc. Set
// CRON_SECRET as both a Supabase secret AND the Authorization bearer on the
// scheduler so casual GETs can't fire the cron.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { db, sendTemplate, jsonResponse, corsHeaders } from '../_shared/wa.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

type Booking = {
  id: string;
  booking_ref: string;
  customer_name: string;
  customer_phone: string;
  event_date: string;
  event_time: string | null;
  package_id: number;
  status: string;
  payment_status: string;
  total: number;
  wa_reminders_enabled: boolean;
  package_name_ar?: string | null;
  package_name_en?: string | null;
  location?: string | null;
};

type ReminderKind = 'pre_72h' | 'pre_48h' | 'pre_24h' | 'post_2h' | 'post_30d' | 'anniversary_1y';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Simple shared-secret auth — keeps the endpoint from being fired by random scanners
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${CRON_SECRET}`) return jsonResponse({ error: 'forbidden' }, 401);
  }

  const supa = db();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  // ── Find candidate bookings (load once, filter in memory) ──────────────
  const { data: bookings, error } = await supa.from('bookings')
    .select(`
      id, booking_ref, customer_name, customer_phone,
      event_date, event_time, package_id, status, payment_status,
      total, wa_reminders_enabled, location
    `)
    .eq('wa_reminders_enabled', true)
    .neq('status', 'cancelled')
    .gte('event_date', addDays(todayIso, -400));   // up to 1 year + buffer ago

  if (error) return jsonResponse({ error: error.message }, 500);

  // Load already-sent reminders for this set (single round trip)
  const ids = (bookings ?? []).map(b => b.id);
  const { data: sentRows } = ids.length
    ? await supa.from('wa_reminders_sent')
        .select('booking_id, reminder_kind').in('booking_id', ids)
    : { data: [] };

  const sentKey = new Set((sentRows ?? []).map(r => `${r.booking_id}|${r.reminder_kind}`));

  // ── Decide who's due for what ────────────────────────────────────────
  const due: { booking: Booking; kind: ReminderKind }[] = [];
  for (const b of (bookings ?? []) as Booking[]) {
    const diffDays = daysBetween(b.event_date, todayIso);
    // Negative diff = event is in the future, positive = past.
    const kind = chooseKind(diffDays, b);
    if (!kind) continue;
    if (sentKey.has(`${b.id}|${kind}`)) continue;
    due.push({ booking: b, kind });
  }

  // ── Send them (with per-booking error isolation) ─────────────────────
  const results: { ref: string; kind: string; ok: boolean; reason?: string }[] = [];
  for (const { booking, kind } of due) {
    try {
      const res = await sendReminder(booking, kind);
      results.push({ ref: booking.booking_ref, kind, ok: !!res });
      if (res) {
        await supa.from('wa_reminders_sent').insert({
          booking_id:    booking.id,
          reminder_kind: kind,
          wa_message_id: res.id,
        });
        await supa.from('bookings').update({
          wa_last_reminder_at: new Date().toISOString(),
        }).eq('id', booking.id);
      }
    } catch (err) {
      console.error('reminder error', booking.booking_ref, kind, err);
      results.push({ ref: booking.booking_ref, kind, ok: false, reason: String(err) });
    }
  }

  return jsonResponse({
    ok: true, scanned: bookings?.length ?? 0, due: due.length, sent: results.filter(r => r.ok).length,
    results,
  });
});

// ─── Reminder selection logic ──────────────────────────────────────────────
function chooseKind(diffDays: number, b: Booking): ReminderKind | null {
  // -3 = event in 3 days
  if (diffDays === -3 && b.status !== 'cancelled')             return 'pre_72h';
  if (diffDays === -2 && b.status === 'confirmed')             return 'pre_48h';
  if (diffDays === -1 && b.status === 'confirmed')             return 'pre_24h';
  if (diffDays === 0  && hoursElapsedSinceEvent(b) >= 2 && b.status !== 'cancelled') return 'post_2h';
  if (diffDays === 30 && b.status === 'completed')             return 'post_30d';
  if (diffDays === 365)                                        return 'anniversary_1y';
  return null;
}

function hoursElapsedSinceEvent(b: Booking): number {
  if (!b.event_date) return 0;
  const evt = new Date(`${b.event_date}T${b.event_time ?? '18:00'}:00`);
  return (Date.now() - evt.getTime()) / (1000 * 60 * 60);
}

// ─── Sender — each kind maps to a Meta-approved template ───────────────────
async function sendReminder(b: Booking, kind: ReminderKind) {
  // Template names + params must match exactly what's approved in Meta BM.
  // Variables use {{1}}, {{2}}, … in the template body. See docs/integrations/wa-platform.md §6.

  switch (kind) {
    case 'pre_72h':
      return sendTemplate(b.customer_phone, 'atema_pre_72h', 'ar', [
        { type: 'body', parameters: [
          { type: 'text', text: b.customer_name.split(' ')[0] },         // {{1}} first name
          { type: 'text', text: shortDate(b.event_date) },                // {{2}} event date
        ]},
        { type: 'button', sub_type: 'url', index: '0', parameters: [
          { type: 'text', text: `book?ref=${b.booking_ref}` },            // {{1}} on URL button → CTA back to /book#summary
        ]},
      ]);

    case 'pre_48h':
      return sendTemplate(b.customer_phone, 'atema_pre_48h', 'ar', [
        { type: 'body', parameters: [
          { type: 'text', text: b.customer_name.split(' ')[0] },
          { type: 'text', text: shortDate(b.event_date) },
          { type: 'text', text: b.location ?? '—' },
        ]},
      ]);

    case 'pre_24h':
      return sendTemplate(b.customer_phone, 'atema_pre_24h', 'ar', [
        { type: 'body', parameters: [
          { type: 'text', text: b.customer_name.split(' ')[0] },
          { type: 'text', text: b.event_time ?? '18:00' },
        ]},
      ]);

    case 'post_2h':
      return sendTemplate(b.customer_phone, 'atema_post_2h', 'ar', [
        { type: 'body', parameters: [
          { type: 'text', text: b.customer_name.split(' ')[0] },
        ]},
      ]);

    case 'post_30d':
      return sendTemplate(b.customer_phone, 'atema_post_30d', 'ar', [
        { type: 'body', parameters: [
          { type: 'text', text: b.customer_name.split(' ')[0] },
        ]},
      ]);

    case 'anniversary_1y':
      return sendTemplate(b.customer_phone, 'atema_anniversary_1y', 'ar', [
        { type: 'body', parameters: [
          { type: 'text', text: b.customer_name.split(' ')[0] },
        ]},
        { type: 'button', sub_type: 'url', index: '0', parameters: [
          { type: 'text', text: 'book?coupon=LOYAL15' },
        ]},
      ]);
  }
}

// ─── Tiny date helpers ─────────────────────────────────────────────────────
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(eventIso: string, todayIso: string): number {
  const e = new Date(eventIso + 'T00:00:00Z').getTime();
  const t = new Date(todayIso + 'T00:00:00Z').getTime();
  return Math.round((t - e) / (1000 * 60 * 60 * 24));
}
function shortDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('ar-SA', {
      day: 'numeric', month: 'long', year: 'numeric', calendar: 'gregory',
    });
  } catch { return iso; }
}
