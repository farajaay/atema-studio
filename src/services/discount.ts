// ATEMA STUDIO — Discount codes service
//
// Client-side wrapper around the discount-codes SQL layer. Two responsibilities:
//
//   1. Cosmetic preview — preview_discount_code() RPC. Tells the UI
//      whether a typed code would apply, what the discount would be,
//      and why (if not). Read-only — does NOT increment used_count.
//
//   2. Server-of-truth — the actual redemption happens inside the
//      create-booking Edge Function via redeem_discount_code(), in
//      the same transaction as the booking insert. The client never
//      consumes a code directly.
//
// Full design: docs/integrations/discount-codes.md.

import { supabase } from './supabase';

export type DiscountKind = 'percent' | 'flat';

/** Result codes returned by both preview_discount_code() + redeem_discount_code(). */
export type DiscountReason =
  | 'ok'
  | 'empty'
  | 'invalid_subtotal'
  | 'not_found'
  | 'inactive'
  | 'not_yet_active'
  | 'expired'
  | 'exhausted'
  | 'below_min_subtotal';

export interface DiscountPreview {
  appliedAmount: number;   // SAR off subtotal
  appliedKind:   DiscountKind | null;
  reason:        DiscountReason;
}

export interface DiscountCode {
  code:          string;
  description:   string | null;
  kind:          DiscountKind;
  value:         number;
  max_discount:  number | null;
  min_subtotal:  number;
  valid_from:    string | null;
  valid_to:      string | null;
  max_uses:      number | null;
  used_count:    number;
  active:        boolean;
  created_at:    string;
  updated_at:    string;
}

// ── 1. Preview ──────────────────────────────────────────────────────────
/**
 * Forecast what a code would do for a given subtotal. NO mutation.
 * Used by the booking-flow input field for instant feedback.
 */
export async function previewDiscountCode(
  code: string,
  subtotal: number,
): Promise<DiscountPreview> {
  if (!code || !code.trim()) {
    return { appliedAmount: 0, appliedKind: null, reason: 'empty' };
  }
  if (!supabase) {
    // Demo / offline mode: pretend any 4-char+ uppercase code is "10% off".
    if (code.trim().length >= 4) {
      const amount = Math.floor(subtotal * 0.1);
      return { appliedAmount: amount, appliedKind: 'percent', reason: 'ok' };
    }
    return { appliedAmount: 0, appliedKind: null, reason: 'not_found' };
  }
  const { data, error } = await supabase.rpc('preview_discount_code', {
    p_code: code.trim().toUpperCase(),
    p_subtotal: Math.round(subtotal),
  });
  if (error || !data || data.length === 0) {
    return { appliedAmount: 0, appliedKind: null, reason: 'not_found' };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    appliedAmount: Number(row.applied_amount ?? 0),
    appliedKind:   (row.applied_kind as DiscountKind | null) ?? null,
    reason:        (row.reason as DiscountReason) ?? 'not_found',
  };
}

// ── 2. Total computation (matches the Edge Function authoritative math) ─
/**
 * Apply a discount amount to a gross subtotal and re-compute VAT + total.
 * VAT is on the **net** subtotal (post-discount) per ZATCA Phase-1
 * simplified-invoice treatment.
 */
export function applyDiscountToTotals(input: {
  grossSubtotal: number;
  discountAmount: number;
  vatRate?: number;       // default 0.15
}): {
  netSubtotal: number;
  vat: number;
  total: number;
} {
  const vatRate = input.vatRate ?? 0.15;
  const net = Math.max(0, Math.round(input.grossSubtotal) - Math.round(input.discountAmount));
  const vat = Math.round(net * vatRate);
  return { netSubtotal: net, vat, total: net + vat };
}

// ── 3. Display helpers ──────────────────────────────────────────────────
export function formatDiscountReason(reason: DiscountReason, lang: 'ar' | 'en'): string {
  const ar: Record<DiscountReason, string> = {
    ok:                  'تم تطبيق الكود',
    empty:               '',
    invalid_subtotal:    'مبلغ الحجز غير صالح',
    not_found:           'الكود غير صحيح',
    inactive:            'هذا الكود لم يعد متاحاً',
    not_yet_active:      'الكود لم يبدأ سريانه بعد',
    expired:             'انتهت صلاحية الكود',
    exhausted:           'تم استنفاد عدد مرات استخدام الكود',
    below_min_subtotal:  'الكود متاح للحجوزات الأعلى قيمةً',
  };
  const en: Record<DiscountReason, string> = {
    ok:                  'Code applied',
    empty:               '',
    invalid_subtotal:    'Invalid subtotal',
    not_found:           'Code not recognised',
    inactive:            'This code is no longer available',
    not_yet_active:      'Code is not yet active',
    expired:             'Code has expired',
    exhausted:           'Code has been fully redeemed',
    below_min_subtotal:  'Code is for larger bookings',
  };
  return (lang === 'ar' ? ar : en)[reason] ?? '';
}

export function formatDiscountKindDescription(
  kind: DiscountKind,
  value: number,
  lang: 'ar' | 'en',
): string {
  if (kind === 'percent') {
    return lang === 'ar' ? `خصم ${value}%` : `${value}% off`;
  }
  // flat
  const sar = lang === 'ar' ? 'ر.س' : 'SAR';
  return lang === 'ar' ? `خصم ${value} ${sar}` : `${value} ${sar} off`;
}

// ── 4. Admin CRUD ───────────────────────────────────────────────────────
export async function listDiscountCodes(): Promise<DiscountCode[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('discount_codes')
    .select('*')
    .order('active', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []) as DiscountCode[];
}

export async function upsertDiscountCode(input: {
  code: string;
  description?: string | null;
  kind: DiscountKind;
  value: number;
  max_discount?: number | null;
  min_subtotal?: number;
  valid_from?: string | null;
  valid_to?: string | null;
  max_uses?: number | null;
  active?: boolean;
}): Promise<DiscountCode | null> {
  if (!supabase) return null;
  const payload = {
    code:         input.code.trim().toUpperCase(),
    description:  input.description ?? null,
    kind:         input.kind,
    value:        Math.round(input.value),
    max_discount: input.max_discount ?? null,
    min_subtotal: input.min_subtotal ?? 0,
    valid_from:   input.valid_from ?? null,
    valid_to:     input.valid_to ?? null,
    max_uses:     input.max_uses ?? null,
    active:       input.active ?? true,
  };
  const { data, error } = await supabase
    .from('discount_codes')
    .upsert(payload, { onConflict: 'code' })
    .select('*')
    .maybeSingle();
  if (error) return null;
  return (data as DiscountCode | null) ?? null;
}

export async function setDiscountCodeActive(code: string, active: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('discount_codes')
    .update({ active })
    .eq('code', code);
  return !error;
}

export async function deleteDiscountCode(code: string): Promise<boolean> {
  if (!supabase) return false;
  // RLS only allows delete when used_count = 0; if it's been used, this
  // will return rows=0 silently. UI should pause the code instead.
  const { error } = await supabase
    .from('discount_codes')
    .delete()
    .eq('code', code);
  return !error;
}
