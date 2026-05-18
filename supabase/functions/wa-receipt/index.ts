// ATEMA STUDIO — Bank-transfer receipt auto-confirm.
//
// Called by wa-webhook when a customer with an open booking sends an image
// or PDF over WhatsApp. We download the media from Meta, base64-encode it,
// hand it to Claude Vision with a strict JSON-extraction prompt, then match
// the extracted amount against the booking's deposit (or full total).
//
// Confidence tiers:
//   • exact amount match (±1 SAR) → auto-confirm + WhatsApp the customer + ping owner
//   • amount within 5% → mark needs_review, ping owner with a quick-reply
//   • no match → mark unmatched, ping owner with the photo

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import {
  db, sendText, fetchMediaUrl, downloadMedia, jsonResponse, corsHeaders,
} from '../_shared/wa.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const OWNER_PHONE       = Deno.env.get('OWNER_WA_NUMBER');

const SYSTEM_PROMPT = `
You are extracting structured data from Saudi bank transfer receipts (Al Rajhi,
SNB, Riyad Bank, STC Pay, etc.). The receipt may be in Arabic, English, or
both. Return ONLY a JSON object with these exact keys (no markdown, no
commentary):

{
  "amount":       number,             // total SAR amount transferred, integer
  "currency":     "SAR" | string,
  "date":         "YYYY-MM-DD" | null,
  "sender_name":  string | null,
  "reference":    string | null,      // bank transaction reference / OTP / IBAN tail
  "beneficiary":  string | null,      // who the money was sent TO
  "confidence":   number              // 0.0 — 1.0; your certainty the extraction is correct
}

If the image is NOT a bank-transfer receipt, return:
  { "amount": 0, "currency": "SAR", "date": null, "sender_name": null,
    "reference": null, "beneficiary": null, "confidence": 0 }

Be conservative — if the amount is unclear, lower the confidence.`.trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const body: any = await req.json();
  const { wa_log_id, media_id, message_id, from_phone, booking_id, mime } = body;

  if (!media_id || !from_phone || !booking_id) {
    return jsonResponse({ error: 'missing_fields' }, 400);
  }
  if (!ANTHROPIC_API_KEY) {
    console.warn('wa-receipt: ANTHROPIC_API_KEY missing — skipping extraction');
    await flagForReview(wa_log_id, booking_id, 'ANTHROPIC_API_KEY not configured');
    return jsonResponse({ ok: true, note: 'no_extraction' });
  }

  // ── 1. Download media from Meta ──────────────────────────────────────
  const cdnUrl = await fetchMediaUrl(media_id);
  if (!cdnUrl) {
    await flagForReview(wa_log_id, booking_id, 'fetch_media_url failed');
    return jsonResponse({ ok: true, note: 'media_url_failed' });
  }
  const media = await downloadMedia(cdnUrl);
  if (!media) {
    await flagForReview(wa_log_id, booking_id, 'downloadMedia failed');
    return jsonResponse({ ok: true, note: 'media_download_failed' });
  }

  // ── 2. Base64 + Claude Vision ────────────────────────────────────────
  const base64 = bytesToBase64(media.bytes);
  const inferredMime = mime ?? media.mime;

  let extracted: any = null;
  try {
    extracted = await callClaude(inferredMime, base64);
  } catch (err) {
    console.error('Claude extraction error:', err);
    await flagForReview(wa_log_id, booking_id, `claude_error: ${err}`);
    return jsonResponse({ ok: true, note: 'claude_error' });
  }

  // ── 3. Persist extraction + match to booking ─────────────────────────
  const supa = db();
  const { data: booking } = await supa.from('bookings')
    .select('*').eq('id', booking_id).single();
  if (!booking) {
    await flagForReview(wa_log_id, booking_id, 'booking_not_found');
    return jsonResponse({ ok: true, note: 'booking_missing' });
  }

  const amount = Number(extracted?.amount ?? 0);
  const conf   = Number(extracted?.confidence ?? 0);
  const due    = booking.deposit && booking.payment_status === 'unpaid'
    ? booking.deposit
    : (booking.total - (booking.deposit ?? 0));

  const exact   = Math.abs(amount - due) <= 1 && conf >= 0.7;
  const partial = !exact && Math.abs(amount - due) / due <= 0.05 && conf >= 0.5;

  let status: 'auto_confirmed' | 'needs_review' = exact ? 'auto_confirmed' : 'needs_review';

  await supa.from('wa_messages').update({
    extracted, status, media_url: cdnUrl,
    notes: exact ? null : partial ? 'partial_match' : 'no_match',
    resolved_at: new Date().toISOString(),
  }).eq('id', wa_log_id);

  // ── 4. Update booking + notify ──────────────────────────────────────
  if (exact) {
    await supa.from('bookings').update({
      payment_status:       'paid',
      payment_method:       'transfer',
      payment_ref:          extracted.reference ?? message_id,
      payment_evidence_url: cdnUrl,
      payment_received_at:  new Date().toISOString(),
      status: booking.status === 'pending' ? 'confirmed' : booking.status,
    }).eq('id', booking.id);

    // Customer confirmation
    await sendText(from_phone,
      `✓ تم استلام الدفعة\n` +
      `رقم الحجز: ${booking.booking_ref}\n` +
      `المبلغ: ${amount.toLocaleString('ar-SA')} ر.س\n` +
      `${extracted.reference ? `المرجع: ${extracted.reference}\n` : ''}` +
      `\nنشرّفنا برؤيتك يوم ${booking.event_date} 🤍\n` +
      `سيتم إرسال العقد والفاتورة خلال دقائق.`);

    // Owner ping
    if (OWNER_PHONE) {
      await sendText(OWNER_PHONE,
        `✓ ATEMA · دفعة مؤكدة تلقائياً\n` +
        `${booking.booking_ref} · ${amount.toLocaleString()} SAR\n` +
        `${booking.customer_name} · ${booking.event_date}`);
    }
  } else {
    // Needs admin review
    if (OWNER_PHONE) {
      await sendText(OWNER_PHONE,
        `⚠️ ATEMA · إيصال يحتاج مراجعة\n` +
        `${booking.booking_ref} · ${booking.customer_name}\n` +
        `المبلغ المستخرج: ${amount.toLocaleString()} SAR (${(conf * 100).toFixed(0)}% ثقة)\n` +
        `المتوقّع: ${due.toLocaleString()} SAR\n` +
        `راجعي في لوحة الإدارة → الحجوزات.`);
    }
    // Customer acknowledgement (don't promise yet)
    await sendText(from_phone,
      'تم استلام صورة الحوالة 📨\n' +
      'سيتم مراجعتها وتأكيد الحجز خلال ساعات.\n' +
      'شكراً لكِ 🌸');
  }

  return jsonResponse({ ok: true, status, amount, due, confidence: conf });
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function callClaude(mime: string, base64: string): Promise<any> {
  // Use a vision-capable model. claude-3-5-sonnet handles Arabic receipts well.
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'x-api-key':          ANTHROPIC_API_KEY!,
      'anthropic-version':  '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mime, data: base64 },
          },
          {
            type: 'text',
            text: 'Extract the receipt data as JSON per the system instructions.',
          },
        ],
      }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`anthropic_${r.status}: ${JSON.stringify(j)}`);

  const text = j.content?.[0]?.text ?? '';
  // Tolerate stray markdown fences
  const cleaned = text.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();
  try { return JSON.parse(cleaned); }
  catch (e) {
    console.warn('claude returned non-JSON:', text);
    throw new Error('parse_failed');
  }
}

async function flagForReview(wa_log_id: string, booking_id: string, note: string) {
  const supa = db();
  await supa.from('wa_messages').update({
    status: 'needs_review', notes: note, resolved_at: new Date().toISOString(),
  }).eq('id', wa_log_id);
  if (OWNER_PHONE) {
    await sendText(OWNER_PHONE,
      `⚠️ ATEMA · إيصال يحتاج مراجعة يدوية (${note})\nبحث في لوحة الإدارة.`);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
