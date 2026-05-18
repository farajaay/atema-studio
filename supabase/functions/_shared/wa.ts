// ATEMA STUDIO — Shared WhatsApp Cloud API utilities.
// Used by wa-webhook, wa-receipt, wa-reminders, and (legacy) send-whatsapp.
// Wraps Meta's Graph API endpoints so each function stays focused on its
// own business logic.
//
// Environment variables required (set in Supabase Project → Secrets):
//   META_WA_PHONE_ID      — the Meta WhatsApp Business phone number id
//   META_WA_ACCESS_TOKEN  — long-lived access token from Meta Business
//   META_WA_VERIFY_TOKEN  — secret you choose; used on webhook verification
//   META_WA_APP_SECRET    — Meta app secret; used to verify X-Hub-Signature
//   SUPABASE_URL          — automatically provided by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY  — automatically provided
//   ANTHROPIC_API_KEY     — for receipt vision extraction (wa-receipt only)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
export const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PHONE_ID      = Deno.env.get('META_WA_PHONE_ID');
const ACCESS_TOKEN  = Deno.env.get('META_WA_ACCESS_TOKEN');
const GRAPH_VERSION = 'v20.0';

export function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

// ── Inbound webhook payload types (Meta Cloud API) ─────────────────────────
export interface WAInboundChange {
  field: string;
  value: {
    messaging_product: 'whatsapp';
    metadata: { display_phone_number: string; phone_number_id: string };
    messages?: WAInboundMessage[];
    statuses?: unknown[];
    contacts?: { wa_id: string; profile?: { name?: string } }[];
  };
}

export interface WAInboundMessage {
  id: string;
  from: string;                     // E.164 without "+"
  timestamp: string;                // unix seconds, string
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'interactive';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; filename?: string; mime_type: string; caption?: string };
  context?: { from: string; id: string };
}

// ── Send text message ──────────────────────────────────────────────────────
export async function sendText(toPhone: string, body: string): Promise<{ id: string } | null> {
  if (!PHONE_ID || !ACCESS_TOKEN) {
    console.warn('Meta WA credentials missing — message NOT sent:', toPhone, body);
    return null;
  }
  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeForApi(toPhone),
      type: 'text',
      text: { preview_url: true, body },
    }),
  });
  const j = await r.json();
  if (!r.ok) { console.error('sendText error:', j); return null; }
  return { id: j.messages?.[0]?.id ?? '' };
}

// ── Send pre-approved template ─────────────────────────────────────────────
// Templates MUST be approved in Meta Business Manager before use. See
// docs/integrations/wa-platform.md §6 for the exact template definitions.
export async function sendTemplate(
  toPhone: string,
  templateName: string,
  languageCode: 'ar' | 'ar_SA' | 'en' | 'en_US',
  components: TemplateComponent[],
): Promise<{ id: string } | null> {
  if (!PHONE_ID || !ACCESS_TOKEN) {
    console.warn('Meta WA credentials missing — template NOT sent:', toPhone, templateName);
    return null;
  }
  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeForApi(toPhone),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
  });
  const j = await r.json();
  if (!r.ok) { console.error('sendTemplate error:', templateName, j); return null; }
  return { id: j.messages?.[0]?.id ?? '' };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button' | 'footer';
  parameters?: TemplateParam[];
  sub_type?: 'quick_reply' | 'url' | 'phone_number';
  index?: string;
}
export type TemplateParam =
  | { type: 'text'; text: string }
  | { type: 'currency'; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: 'date_time'; date_time: { fallback_value: string } }
  | { type: 'image'; image: { link: string } };

// ── Fetch a media URL from Meta (their CDN URLs expire fast) ───────────────
export async function fetchMediaUrl(mediaId: string): Promise<string | null> {
  if (!ACCESS_TOKEN) return null;
  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });
  const j = await r.json();
  if (!r.ok || !j.url) { console.error('fetchMediaUrl error:', j); return null; }
  return j.url as string;
}

/** Download the actual media bytes (Meta requires the auth header on the
 *  signed CDN URL too). Returns ArrayBuffer ready for base64 encoding. */
export async function downloadMedia(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!ACCESS_TOKEN) return null;
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } });
  if (!r.ok) { console.error('downloadMedia error:', r.status); return null; }
  const mime = r.headers.get('content-type') ?? 'application/octet-stream';
  const buf  = new Uint8Array(await r.arrayBuffer());
  return { bytes: buf, mime };
}

// ── Phone normalisers ──────────────────────────────────────────────────────
/** Returns the same string Meta expects — E.164 without leading "+". */
export function normalizeForApi(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

/** Mirror of src/utils/validation.ts normalizeSaudiMobile (with "+"). */
export function toE164(raw: string): string | null {
  if (!raw) return null;
  let c = raw.replace(/[\s\-()]/g, '');
  if (c.startsWith('+'))  c = c.slice(1);
  if (c.startsWith('00')) c = c.slice(2);
  if (c.startsWith('0'))  c = '966' + c.slice(1);
  if (c.startsWith('5') && c.length === 9) c = '966' + c;
  return /^9665\d{8}$/.test(c) ? '+' + c : null;
}

// ── Verify X-Hub-Signature (Meta) ──────────────────────────────────────────
export async function verifySignature(req: Request, raw: string): Promise<boolean> {
  const sigHeader = req.headers.get('x-hub-signature-256') ?? '';
  const APP_SECRET = Deno.env.get('META_WA_APP_SECRET');
  if (!APP_SECRET) return true;          // skip if not configured (dev only)
  if (!sigHeader.startsWith('sha256=')) return false;

  const key  = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const expected = 'sha256=' + Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(sigHeader, expected);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ── CORS helper ────────────────────────────────────────────────────────────
export const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
