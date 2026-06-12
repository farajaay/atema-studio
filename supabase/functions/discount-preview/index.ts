// ATEMA STUDIO — discount-preview Edge Function (Patch M-10).
//
// Wraps the preview_discount_code() RPC with per-IP token-bucket rate
// limiting so brides can't brute-force valid codes via dictionary
// attack from a single endpoint. The previous shipped version called
// the RPC directly from the client, with no rate limit.
//
// Pairs with src/services/discount.ts → previewDiscountCode (client
// now invokes this function instead of the RPC).
//
// Deploy:  supabase functions deploy discount-preview
//
// Rate-limit shape:
//   - 5 requests per 1-second window per IP
//   - 60 requests per 5-minute window per IP
// Per-instance in-memory state — for ATEMA's traffic this is fine
// (low volume, single-region). At higher scale, swap to a DB or
// Redis-backed counter.

// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any -- parsed request bodies are structural */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Rate-limit buckets ─────────────────────────────────────────────────
type Bucket = { tokens: number; lastRefill: number };
const SHORT_CAPACITY = 5;
const SHORT_REFILL_MS = 1_000;        // 5 / sec
const LONG_CAPACITY  = 60;
const LONG_REFILL_MS  = 5 * 60_000;   // 60 / 5 min

const shortBuckets = new Map<string, Bucket>();
const longBuckets  = new Map<string, Bucket>();

function consume(map: Map<string, Bucket>, capacity: number, refillMs: number, key: string): boolean {
  const now = Date.now();
  let b = map.get(key);
  if (!b) {
    b = { tokens: capacity, lastRefill: now };
    map.set(key, b);
  }
  // Refill
  const elapsed = now - b.lastRefill;
  if (elapsed >= refillMs) {
    const refills = Math.floor(elapsed / refillMs);
    b.tokens = Math.min(capacity, b.tokens + refills * capacity);
    b.lastRefill = now;
  }
  if (b.tokens <= 0) return false;
  b.tokens -= 1;
  return true;
}

function ipOf(req: Request): string {
  // Supabase forwards client IP in x-forwarded-for / x-real-ip.
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const ip = ipOf(req);
  if (!consume(shortBuckets, SHORT_CAPACITY, SHORT_REFILL_MS, ip)
   || !consume(longBuckets,  LONG_CAPACITY,  LONG_REFILL_MS,  ip)) {
    return jsonResponse({ error: 'rate_limited' }, 429);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const code     = String(body.code ?? '').trim().toUpperCase();
  const subtotal = Number(body.subtotal);
  if (!code || code.length < 2 || code.length > 32) {
    return jsonResponse({ applied_amount: 0, applied_kind: null, reason: 'empty',
                         code_value: null, code_max_discount: null });
  }
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return jsonResponse({ applied_amount: 0, applied_kind: null, reason: 'invalid_subtotal',
                         code_value: null, code_max_discount: null });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const { data, error } = await supabase
    .rpc('preview_discount_code', { p_code: code, p_subtotal: Math.round(subtotal) });
  if (error) {
    return jsonResponse({ error: 'rpc_failed', detail: error.message }, 500);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return jsonResponse(row ?? {
    applied_amount: 0, applied_kind: null, reason: 'not_found',
    code_value: null, code_max_discount: null,
  });
});
