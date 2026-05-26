// ATEMA STUDIO — Shared validation + booking primitives for Edge Functions.
//
// Single source of truth for the logic that USED to be inlined (and silently
// duplicated) inside create-booking/index.ts. The client mirror lives at
// src/utils/validation.ts; a Vitest parity suite
// (src/services/booking-edge-parity.test.ts) imports BOTH this module and the
// client module and asserts they agree, so the two copies can no longer drift
// apart without a failing test.
//
// This file is intentionally dependency-free (no Deno globals beyond the
// standard `crypto`, no remote imports) so it is importable from both the
// Deno edge runtime AND a Node/Vitest test process.
//
// Note on dates: Supabase Edge Functions run with the system clock in UTC, so
// the local-time arithmetic below behaves identically to the previous
// UTC-based implementation on the server.

/** Strict Saudi mobile validator → normalised E.164, or null on failure. */
export function normalizeSaudiMobile(raw: string): string | null {
  if (!raw) return null;
  let c = raw.replace(/[\s\-()]/g, '');
  if (c.startsWith('+')) c = c.slice(1);
  if (c.startsWith('00')) c = c.slice(2);
  if (c.startsWith('0')) c = '966' + c.slice(1);
  if (c.startsWith('5') && c.length === 9) c = '966' + c;
  return /^9665\d{8}$/.test(c) ? '+' + c : null;
}

/** Pragmatic email validator. Empty/undefined is valid (email is optional). */
export function validEmail(raw: string | undefined): boolean {
  if (!raw) return true;
  const v = raw.trim();
  if (v.length > 254) return false;
  if (/\s/.test(v)) return false;
  const m = v.match(/^([^@]+)@([^@]+)$/);
  if (!m) return false;
  const [, local, domain] = m;
  if (local.length === 0 || local.length > 64) return false;
  if (!/\./.test(domain)) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

/** True when the ISO date string is today or in the future. */
export function isFutureOrToday(isoDate: string): boolean {
  if (!isoDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return false;
  return target >= today;
}

/** Trim + cap a free-text field to a max length. */
export function clampText(raw: string | undefined, max: number): string {
  if (!raw) return '';
  const t = raw.trim();
  return t.length > max ? t.slice(0, max) : t;
}

// ── Booking reference generator (matches client src/services/booking.ts) ─────
// Format: ATEMA-{YYMMDD}-{8-char Crockford base32 from CSPRNG bytes}.
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomTail(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += CROCKFORD[bytes[i] & 0x1f];
  return out;
}

export function bookingRef(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `ATEMA-${yy}${mm}${day}-${randomTail()}`;
}

// ── City travel-fee map (mirrors CITIES in src/pages/BookingPage.tsx) ────────
export const CITY_FEES: Record<string, number> = {
  jubail: 0, dammam: 200, khobar: 200, qatif: 200, ahsa: 450,
  riyadh: 0, other: 0,
};

/** Best-effort extraction of a CITY_FEES key from a free-text location string
 *  (Arabic or English). Used to re-derive the travel fee server-side when a
 *  booking is changed. */
export function extractCityKey(location: string | null | undefined): string {
  if (!location) return 'other';
  const v = location.toLowerCase();
  if (v.includes('jubail') || v.includes('الجبيل')) return 'jubail';
  if (v.includes('dammam') || v.includes('الدمام')) return 'dammam';
  if (v.includes('khobar') || v.includes('الخبر'))  return 'khobar';
  if (v.includes('qatif')  || v.includes('القطيف'))  return 'qatif';
  if (v.includes('ahsa')   || v.includes('الأحساء'))  return 'ahsa';
  if (v.includes('riyadh') || v.includes('الرياض'))  return 'riyadh';
  return 'other';
}
