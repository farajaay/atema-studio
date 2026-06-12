// ATEMA STUDIO — WhatsApp Cloud API inbound webhook.
//
// Meta calls this endpoint on every event (message, status update, etc.).
// Responsibilities:
//   1. GET handshake — respond with hub.challenge when verify_token matches.
//   2. POST verification — verify X-Hub-Signature, parse the payload.
//   3. Route messages:
//        • image / document from a sender who has a pending booking
//          → call wa-receipt (Vision-based bank-receipt extraction)
//        • everything else → just log to wa_messages (status='received')
//          and notify the owner via a forwarded message
//
// Deploy:
//   supabase functions deploy wa-webhook --no-verify-jwt
// Then in Meta Business Manager → WhatsApp → Configuration:
//   Webhook URL: https://<project>.supabase.co/functions/v1/wa-webhook
//   Verify token: same value as META_WA_VERIFY_TOKEN secret
//   Subscribe to: messages

// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any -- Meta webhook envelopes are structural */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import {
  db, sendText, verifySignature, jsonResponse, corsHeaders,
  type WAInboundChange, type WAInboundMessage,
} from '../_shared/wa.ts';

const VERIFY_TOKEN = Deno.env.get('META_WA_VERIFY_TOKEN');
const OWNER_PHONE  = Deno.env.get('OWNER_WA_NUMBER'); // optional — gets forwards

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── 1. Meta webhook verification (GET) ────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode      = url.searchParams.get('hub.mode');
    const verify    = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && verify === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // ── 2. Verify Meta's X-Hub-Signature-256 ─────────────────────────────
  const raw = await req.text();
  if (!(await verifySignature(req, raw))) {
    console.warn('wa-webhook: signature verification failed');
    return jsonResponse({ error: 'invalid_signature' }, 401);
  }

  let payload: any;
  try { payload = JSON.parse(raw); }
  catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  // Meta webhook envelope: { object: 'whatsapp_business_account', entry: [{ changes: […] }] }
  const changes: WAInboundChange[] = [];
  for (const entry of payload.entry ?? []) {
    for (const ch of entry.changes ?? []) changes.push(ch);
  }

  // Process each message (Meta batches up to 100 per event).
  const promises: Promise<void>[] = [];
  for (const change of changes) {
    for (const msg of change.value.messages ?? []) {
      promises.push(handleMessage(msg, change.value.contacts?.[0]?.profile?.name));
    }
  }
  await Promise.allSettled(promises);

  // Meta REQUIRES a 200 within 5 seconds, otherwise it retries. We've already
  // persisted everything we need; processing happens in the background.
  return jsonResponse({ ok: true });
});

async function handleMessage(msg: WAInboundMessage, contactName?: string) {
  const supa = db();
  const fromPhone = '+' + msg.from;

  // Find any open booking for this phone (latest unpaid, non-cancelled)
  const { data: openBooking } = await supa.from('bookings')
    .select('id, booking_ref, deposit, total, payment_status, status, event_date, customer_name')
    .eq('customer_phone', fromPhone)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Insert audit log row (we keep everything) ───────────────────────
  const baseRow = {
    wa_message_id: msg.id,
    from_phone:    fromPhone,
    direction:     'inbound' as const,
    message_type:  msg.type,
    body:          msg.text?.body ?? msg.image?.caption ?? msg.document?.caption ?? null,
    matched_booking: openBooking?.id ?? null,
    raw_payload:   msg as unknown as Record<string, unknown>,
    status:        'received' as const,
  };

  const { data: logRow } = await supa.from('wa_messages').insert(baseRow).select('id').single();

  // ── Route based on message type ─────────────────────────────────────
  try {
    if ((msg.type === 'image' || msg.type === 'document') && openBooking) {
      // Bank-transfer receipt path → fire-and-forget call to wa-receipt
      await supa.from('wa_messages').update({ status: 'processing' }).eq('id', logRow?.id);
      const receiptUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/wa-receipt`;
      fetch(receiptUrl, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          wa_log_id:   logRow?.id,
          media_id:    msg.image?.id ?? msg.document?.id,
          message_id:  msg.id,
          from_phone:  fromPhone,
          booking_id:  openBooking.id,
          mime:        msg.image?.mime_type ?? msg.document?.mime_type,
        }),
      }).catch(err => console.error('wa-receipt dispatch error:', err));
    } else if (msg.type === 'text') {
      // No concierge AI in this rollout — forward to owner if configured,
      // otherwise just acknowledge.
      if (OWNER_PHONE) {
        await sendText(OWNER_PHONE,
          `📥 ATEMA · رسالة جديدة من ${contactName ?? fromPhone}\n` +
          `${openBooking ? `حجز: ${openBooking.booking_ref}\n` : ''}` +
          `"${(msg.text?.body ?? '').slice(0, 400)}"`);
      }
      await sendText(fromPhone,
        'شكراً لرسالتك 🌸 سيتم الرد عليكِ قريباً.\n' +
        'Thanks for your message — we\'ll respond shortly.');
      await supa.from('wa_messages').update({ status: 'ignored' }).eq('id', logRow?.id);
    } else {
      // Audio / video / sticker / location / interactive — log only
      await supa.from('wa_messages').update({ status: 'ignored' }).eq('id', logRow?.id);
    }
  } catch (err) {
    console.error('handleMessage error:', err);
    await supa.from('wa_messages')
      .update({ status: 'failed', notes: String(err) })
      .eq('id', logRow?.id);
  }
}
