// ATEMA STUDIO — Shared input validation helpers.
// Used by the booking form, the bank-transfer flow, and any other surface
// that accepts customer-supplied identifiers.

/** Strict Saudi mobile validator. Accepts any of:
 *    +9665XXXXXXXX   (E.164, with leading + and country code)
 *     9665XXXXXXXX   (no +)
 *    009665XXXXXXXX  (international dialling prefix)
 *      05XXXXXXXX    (local format, 10 digits, leading 0)
 *  Whitespace and dashes inside the number are tolerated.
 *  Returns the normalised E.164 form on success, or null on failure.
 */
export function normalizeSaudiMobile(raw: string): string | null {
  if (!raw) return null;
  // Strip spaces, dashes, parens
  let c = raw.replace(/[\s\-()]/g, '');
  // Strip leading "+"
  if (c.startsWith('+')) c = c.slice(1);
  // 00966… → 966…
  if (c.startsWith('00')) c = c.slice(2);
  // Local 05X → 9665X
  if (c.startsWith('0')) c = '966' + c.slice(1);
  // Bare 5X → 9665X
  if (c.startsWith('5') && c.length === 9) c = '966' + c;
  // Must now be exactly 12 digits starting with 9665
  if (!/^9665\d{8}$/.test(c)) return null;
  return '+' + c;
}

/** Boolean wrapper around normalizeSaudiMobile for use in form validators. */
export function validSaudiMobile(raw: string): boolean {
  return normalizeSaudiMobile(raw) !== null;
}

/** Pragmatic email validator. Not RFC 5322 — but rejects the common
 *  "looks like an email" mistakes (missing @, missing TLD, internal spaces).
 *  Empty string returns true so callers can treat email as optional.
 */
export function validEmail(raw: string): boolean {
  if (!raw) return true;
  const v = raw.trim();
  // Length sanity, no spaces, has @, both sides non-empty, dot in domain.
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

/** True when the given ISO-date string is today or in the future. */
export function isFutureOrToday(isoDate: string): boolean {
  if (!isoDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return false;
  return target >= today;
}

/** Trim + cap a free-text field to a max length. Returns the value unchanged
 *  if it's already within bounds; otherwise returns the slice. */
export function clampText(raw: string, max: number): string {
  if (!raw) return '';
  const t = raw.trim();
  return t.length > max ? t.slice(0, max) : t;
}
