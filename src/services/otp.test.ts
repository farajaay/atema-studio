import { describe, it, expect } from 'vitest';
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
} from '../../supabase/functions/_shared/otp';

const SALT = 'booking-salt-123';

describe('generateOtp', () => {
  it('returns a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateOtp();
      expect(c).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
    }
  });
});

describe('hashOtp', () => {
  it('is deterministic for the same code+salt and differs across salts', async () => {
    const a = await hashOtp('123456', SALT);
    const b = await hashOtp('123456', SALT);
    const c = await hashOtp('123456', 'other-salt');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyOtp', () => {
  const future = new Date(Date.now() + 60_000).toISOString();

  it('accepts the correct code before expiry and under the attempt cap', async () => {
    const codeHash = await hashOtp('424242', SALT);
    expect(await verifyOtp({ suppliedCode: '424242', codeHash, salt: SALT, expiresAt: future, attempts: 0 }))
      .toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects a wrong code', async () => {
    const codeHash = await hashOtp('424242', SALT);
    expect(await verifyOtp({ suppliedCode: '000000', codeHash, salt: SALT, expiresAt: future, attempts: 0 }))
      .toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects an expired code even if correct', async () => {
    const codeHash = await hashOtp('424242', SALT);
    const past = new Date(Date.now() - 1000).toISOString();
    expect(await verifyOtp({ suppliedCode: '424242', codeHash, salt: SALT, expiresAt: past, attempts: 0 }))
      .toEqual({ ok: false, reason: 'expired' });
  });

  it('locks out once the attempt cap is reached (before checking the code)', async () => {
    const codeHash = await hashOtp('424242', SALT);
    expect(await verifyOtp({ suppliedCode: '424242', codeHash, salt: SALT, expiresAt: future, attempts: OTP_MAX_ATTEMPTS }))
      .toEqual({ ok: false, reason: 'too_many_attempts' });
  });

  it('reports missing inputs', async () => {
    expect(await verifyOtp({ suppliedCode: '', codeHash: 'x', salt: SALT, expiresAt: future, attempts: 0 }))
      .toEqual({ ok: false, reason: 'missing' });
  });
});
