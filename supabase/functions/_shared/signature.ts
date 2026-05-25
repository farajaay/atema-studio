// ATEMA STUDIO — Meta X-Hub-Signature-256 verification (HMAC-SHA256).
//
// Extracted from _shared/wa.ts so the webhook signature check can be
// unit-tested. wa.ts itself pulls in remote esm.sh imports and reads Deno.env
// at module load, which makes it un-importable from Vitest; this module is
// dependency-free (Web Crypto only) so both the Deno edge runtime and a
// Node/Vitest process can import it.

/** Compute the `sha256=<hex>` signature Meta sends for a raw request body. */
export async function metaSignatureFor(appSecret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return 'sha256=' + Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison — avoids leaking the signature via timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Verify a Meta webhook signature. When no app secret is configured the check
 *  is skipped (dev-only) — matching the previous behaviour. */
export async function verifyMetaSignature(opts: {
  signatureHeader: string;
  rawBody: string;
  appSecret: string | undefined;
}): Promise<boolean> {
  if (!opts.appSecret) return true;
  if (!opts.signatureHeader.startsWith('sha256=')) return false;
  const expected = await metaSignatureFor(opts.appSecret, opts.rawBody);
  return timingSafeEqual(opts.signatureHeader, expected);
}
