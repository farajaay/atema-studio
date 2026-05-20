// ATEMA STUDIO — Discount code input
//
// Sits inside the booking summary panel, just above the running total.
// The bride types a code, taps "Apply", we preview it server-side
// (preview_discount_code RPC — read-only, no mutation), and call back
// up with { code, amount, kind } if valid. Real redemption happens
// later inside the create-booking Edge Function.
//
// Self-contained: holds its own input + error state. The parent owns
// "is a discount currently applied" via the applied prop.

import { useState } from 'react';
import { Tag, Check, X, Loader2 } from 'lucide-react';
import {
  previewDiscountCode,
  formatDiscountReason,
  formatDiscountKindDescription,
  type DiscountKind,
  type DiscountReason,
} from '../services/discount';

type Lang = 'ar' | 'en';

interface AppliedDiscount {
  code: string;
  amount: number;       // SAR
  kind: DiscountKind;
  value: number;        // 25 for percent code 25, 500 for flat 500-SAR code
}

interface Props {
  lang: Lang;
  subtotal: number;                                       // gross subtotal (pre-discount)
  applied: AppliedDiscount | null;
  onApplied: (d: AppliedDiscount) => void;
  onCleared: () => void;
  /** Theme colours, passed in to match the booking page palette. */
  ink:   string;
  gold:  string;
  muted: string;
  fieldBg: string;
}

export default function DiscountInput({
  lang, subtotal, applied, onApplied, onCleared,
  ink, gold, muted, fieldBg,
}: Props) {
  const [input,    setInput]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [reason,   setReason]   = useState<DiscountReason | null>(null);

  const tx = (ar: string, en: string) => lang === 'ar' ? ar : en;

  async function handleApply() {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return;
    if (subtotal <= 0) {
      setReason('invalid_subtotal');
      return;
    }
    setBusy(true);
    setReason(null);
    try {
      const result = await previewDiscountCode(trimmed, subtotal);
      if (result.reason === 'ok' && result.appliedAmount > 0 && result.appliedKind) {
        // Look up the raw value (percent or flat) by reverse-engineering:
        // percent → infer from (amount * 100 / subtotal); flat → amount.
        // We could also fetch the code row, but exposing /discount_codes/ to
        // anon defeats the security model. The display string only needs the
        // KIND (so "25% off" vs "500 SAR off") and the AMOUNT — both of which
        // we already have. We store amount + kind and derive the display.
        onApplied({
          code: trimmed,
          amount: result.appliedAmount,
          kind: result.appliedKind,
          value: result.appliedKind === 'percent'
            ? Math.round((result.appliedAmount / subtotal) * 100)
            : result.appliedAmount,
        });
        setInput('');
        setReason('ok');
      } else {
        setReason(result.reason);
      }
    } catch {
      setReason('not_found');
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    onCleared();
    setReason(null);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  }

  const isError =
    reason && reason !== 'ok' && reason !== 'empty';

  // ── APPLIED state ───────────────────────────────────────────────────
  if (applied) {
    return (
      <div style={{
        background: 'rgba(120, 180, 130, 0.10)',
        border: '1px solid rgba(120, 180, 130, 0.35)',
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.78rem', fontFamily: 'Tajawal, sans-serif',
      }}>
        <Check size={14} color="#0a8a4a" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 700, color: ink, letterSpacing: 0.4 }}>
            {applied.code}
          </span>
          <span style={{ color: muted, marginInlineStart: 8 }}>
            {formatDiscountKindDescription(applied.kind, applied.value, lang)}
          </span>
          <span style={{ color: gold, fontWeight: 700, marginInlineStart: 8 }}>
            −{applied.amount.toLocaleString()}
          </span>
        </div>
        <button
          onClick={handleRemove}
          aria-label={tx('إزالة الكود', 'Remove code')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: muted, padding: 4, display: 'flex', alignItems: 'center',
          }}>
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── EMPTY state ─────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{
          flex: 1, position: 'relative', display: 'flex', alignItems: 'center',
          background: fieldBg,
          border: `1px solid ${isError ? '#c44a4a' : 'rgba(201,179,147,0.45)'}`,
          borderRadius: 8, padding: '0 10px',
          transition: 'border-color 0.15s',
        }}>
          <Tag size={13} color={muted} style={{ flexShrink: 0 }} />
          <input
            value={input}
            onChange={e => { setInput(e.target.value.toUpperCase()); setReason(null); }}
            onKeyDown={handleKeyDown}
            maxLength={32}
            placeholder={tx('كود خصم؟', 'Discount code?')}
            disabled={busy}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              padding: '8px 10px',
              fontSize: '0.82rem', fontFamily: 'Tajawal, sans-serif',
              color: ink, letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          />
        </div>
        <button
          onClick={handleApply}
          disabled={busy || !input.trim()}
          style={{
            background: input.trim() ? gold : 'rgba(201,179,147,0.20)',
            color: input.trim() ? '#fff' : muted,
            border: 'none', borderRadius: 8,
            padding: '0 14px',
            fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Tajawal, sans-serif',
            cursor: input.trim() && !busy ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'background 0.15s',
            minWidth: 70, justifyContent: 'center',
          }}>
          {busy
            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            : tx('تطبيق', 'Apply')}
        </button>
      </div>
      {isError && (
        <div style={{
          marginTop: 6, fontSize: '0.74rem',
          color: reason === 'below_min_subtotal' ? '#a06030' : '#c44a4a',
          fontFamily: 'Tajawal, sans-serif',
        }}>
          {formatDiscountReason(reason!, lang)}
        </div>
      )}
    </div>
  );
}
