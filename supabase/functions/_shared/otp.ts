// ATEMA STUDIO — One-time-passcode (step-up auth) primitives.
//
// Used to gate the MONEY path of customer self-service: changing a package or
// add-ons requires a fresh code texted to the booking's phone, on top of the
// manage-link token. The capability link alone protects low-risk edits; this
// adds a second factor before anything financial moves.
//
// Codes are never stored in clear — only a salted SHA-256 hash. Verification is
// constant-time, rate-limited by an attempt counter, and time-boxed.
//
// Dependency-free (Web Crypto only) so it imports in the Deno edge runtime and
// in Vitest. Reuses timingSafeEqual from signature.ts to avoid a second copy.

import { timingSafeEqual } from './signature.ts';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;   // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

/** A 6-digit numeric code from a CSPRNG. */
export function generateOtp(): string {
  const bytes = new Uint8Array(OTP_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < OTP_LENGTH; i++) out += String(bytes[i] % 10);
  return out;
}

/** Salted SHA-256 hash of a code, as lowercase hex. The salt is stored
 *  alongside the hash so the same code yields a per-row-unique digest. */
export async function hashOtp(code: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type OtpReason = 'ok' | 'missing' | 'too_many_attempts' | 'expired' | 'mismatch';

/** Verify a supplied code against a stored hash. Order matters: lockout and
 *  expiry are checked BEFORE the (constant-time) hash comparison, so a guessing
 *  attacker can't keep trying past the cap or the deadline. */
export async function verifyOtp(opts: {
  suppliedCode: string;
  codeHash: string;
  salt: string;
  expiresAt: string;     // ISO timestamp
  attempts: number;
  now?: number;          // ms epoch (for tests)
}): Promise<{ ok: boolean; reason: OtpReason }> {
  if (!opts.suppliedCode || !opts.codeHash) return { ok: false, reason: 'missing' };
  if (opts.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  const now = opts.now ?? Date.now();
  const exp = new Date(opts.expiresAt).getTime();
  if (Number.isNaN(exp) || now > exp) return { ok: false, reason: 'expired' };

  const supplied = await hashOtp(opts.suppliedCode, opts.salt);
  return timingSafeEqual(supplied, opts.codeHash)
    ? { ok: true, reason: 'ok' }
    : { ok: false, reason: 'mismatch' };
}
