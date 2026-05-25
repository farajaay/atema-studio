import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  metaSignatureFor,
  timingSafeEqual,
  verifyMetaSignature,
} from '../../supabase/functions/_shared/signature';

const SECRET = 'meta_app_secret';
const BODY = '{"object":"whatsapp_business_account","entry":[{"id":"123"}]}';

/** Independent oracle: Node's crypto, to cross-check the Web Crypto impl. */
function oracle(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('metaSignatureFor', () => {
  it('matches an independent HMAC-SHA256 computation', async () => {
    expect(await metaSignatureFor(SECRET, BODY)).toBe(oracle(SECRET, BODY));
  });

  it('changes when the body changes', async () => {
    const a = await metaSignatureFor(SECRET, BODY);
    const b = await metaSignatureFor(SECRET, BODY + ' ');
    expect(a).not.toBe(b);
  });
});

describe('timingSafeEqual', () => {
  it('is true for identical strings and false otherwise', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
  });

  it('is false for differing lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('verifyMetaSignature', () => {
  it('accepts a correctly signed body', async () => {
    const sig = await metaSignatureFor(SECRET, BODY);
    expect(await verifyMetaSignature({ signatureHeader: sig, rawBody: BODY, appSecret: SECRET })).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const sig = await metaSignatureFor(SECRET, BODY);
    expect(await verifyMetaSignature({ signatureHeader: sig, rawBody: BODY + 'x', appSecret: SECRET })).toBe(false);
  });

  it('rejects a signature signed with the wrong secret', async () => {
    const sig = await metaSignatureFor('wrong_secret', BODY);
    expect(await verifyMetaSignature({ signatureHeader: sig, rawBody: BODY, appSecret: SECRET })).toBe(false);
  });

  it('rejects a header without the sha256= prefix', async () => {
    expect(await verifyMetaSignature({ signatureHeader: 'deadbeef', rawBody: BODY, appSecret: SECRET })).toBe(false);
  });

  it('skips verification (dev only) when no app secret is configured', async () => {
    expect(await verifyMetaSignature({ signatureHeader: '', rawBody: BODY, appSecret: undefined })).toBe(true);
  });
});
