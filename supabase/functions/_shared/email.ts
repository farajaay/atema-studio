// ATEMA STUDIO — Zoho Mail SMTP wrapper.
//
// Sends transactional mail from atema@atemastudio.xyz via smtp.zoho.com
// (port 465, implicit TLS). Auth uses a Zoho app-specific password — the
// mailbox password itself is rejected when 2FA is on.
//
// Failure is non-fatal: every attempt is recorded in `email_messages` and
// the function returns rather than throws, so a flaky SMTP session can
// never roll back a successful booking insert.
//
// Required Supabase secrets:
//   ZOHO_SMTP_HOST       (default: smtp.zoho.com)
//   ZOHO_SMTP_PORT       (default: 465)
//   ZOHO_SMTP_USER       e.g. atema@atemastudio.xyz
//   ZOHO_SMTP_PASSWORD   16-char app password from Zoho Accounts
//   ZOHO_SMTP_FROM_NAME  (default: "ATEMA STUDIO")
//   ZOHO_SMTP_FROM       (default: same as USER)

// deno-lint-ignore-file no-explicit-any
// NB: the SMTP library (denomailer) is imported LAZILY inside sendEmail, not
// at module top level. A top-level remote import that fails to load would
// boot-fail the ENTIRE calling Edge Function (e.g. create-booking →
// "Failed to send a request to the Edge Function"), even though email is
// fire-and-forget. Keeping it dynamic means a flaky mailer dependency
// degrades to a logged 'failed' send instead of taking down booking.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface EmailAttachment {
  filename:    string;
  contentType: string;
  content:     Uint8Array;
}

export interface SendArgs {
  to:           string;
  subject:      string;
  html:         string;
  text:         string;
  template:     string;
  bookingId?:   string | null;
  replyTo?:     string;
  attachments?: EmailAttachment[];
}

export interface SendResult {
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}

const HOST = Deno.env.get('ZOHO_SMTP_HOST') ?? 'smtp.zoho.com';
const PORT = Number(Deno.env.get('ZOHO_SMTP_PORT') ?? '465');
const USER = Deno.env.get('ZOHO_SMTP_USER') ?? '';
const PASS = Deno.env.get('ZOHO_SMTP_PASSWORD') ?? '';
const FROM_NAME = Deno.env.get('ZOHO_SMTP_FROM_NAME') ?? 'ATEMA STUDIO';
const FROM      = Deno.env.get('ZOHO_SMTP_FROM')      ?? USER;

// Build a strict RFC 5322 mailbox-address for the From: header. Display
// names with spaces or non-ASCII characters MUST be in a quoted-string
// (or RFC 2047 encoded). Without quoting, denomailer 1.6.0 sometimes
// emits a malformed message body and Gmail rejects with:
//   5.7.1 'From' header is missing. ... not RFC 5322 compliant.
// If FROM_NAME is empty, return just the bare address.
function formatFromHeader(displayName: string, address: string): string {
  const name = (displayName ?? '').trim();
  if (!name) return address;
  // Escape any embedded double-quotes or backslashes per RFC 5322.
  const escaped = name.replace(/([\\"])/g, '\\$1');
  return `"${escaped}" <${address}>`;
}

// Cheap structural check — we never want to ship a confirmation to a typo'd
// address and we never want to log PII in error messages. Mirrors validation.ts.
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function logToAudit(args: SendArgs, status: SendResult['status'], error?: string) {
  const url  = Deno.env.get('SUPABASE_URL');
  const key  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    console.warn('[email] audit insert skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return;                            // best-effort; never blow up the caller
  }
  try {
    const supabase = createClient(url, key);
    // PostgREST returns errors in the result, NOT via throw. The previous
    // bare `await` swallowed table-missing / RLS-blocked failures silently,
    // making the empty email_messages table mysterious. Pull the error out
    // and log it so future failures are visible in the function logs.
    const { error: insErr } = await supabase.from('email_messages').insert([{
      booking_id: args.bookingId ?? null,
      to_address: args.to,
      subject:    args.subject,
      template:   args.template,
      status,
      error:      error ?? null,
    }]);
    if (insErr) {
      console.error('[email] audit insert rejected:', insErr.message, insErr.code ?? '', insErr.details ?? '');
    }
  } catch (e) {
    console.error('[email] audit insert failed:', (e as Error).message);
  }
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  if (!args.to || !looksLikeEmail(args.to)) {
    const r: SendResult = { status: 'skipped', error: 'no_valid_recipient' };
    await logToAudit(args, r.status, r.error);
    return r;
  }
  if (!USER || !PASS) {
    const r: SendResult = { status: 'skipped', error: 'smtp_credentials_unset' };
    console.warn('[email] ZOHO_SMTP_USER / ZOHO_SMTP_PASSWORD not set — skipping send.');
    await logToAudit(args, r.status, r.error);
    return r;
  }

  let client: { send: (m: any) => Promise<unknown>; close: () => Promise<void> } | null = null;
  try {
    // Lazy remote import — a load failure here is caught below and logged as
    // a 'failed' send, never a function-wide boot error (see the import note).
    const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts');
    client = new SMTPClient({
      connection: {
        hostname: HOST,
        port:     PORT,
        tls:      true,          // 465 = implicit TLS; denomailer handles handshake
        auth:     { username: USER, password: PASS },
      },
    });
    // denomailer 1.6.0 needs an explicit `encoding` per attachment. Our
    // contract/invoice bytes are a Uint8Array, which requires encoding:'binary'
    // — WITHOUT it denomailer drops the content and the attached .html files
    // arrive EMPTY. (binary → it base64-encodes the bytes into the MIME part.)
    const attachments = (args.attachments ?? []).map(a => ({
      filename:    a.filename,
      contentType: a.contentType,
      encoding:    'binary' as const,
      content:     a.content,
    }));
    await client.send({
      from:    formatFromHeader(FROM_NAME, FROM),
      to:      args.to,
      replyTo: args.replyTo ?? FROM,
      subject: args.subject,
      content: args.text,
      html:    args.html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    await logToAudit(args, 'sent');
    return { status: 'sent' };
  } catch (e) {
    const msg = (e as Error).message ?? 'send_failed';
    console.error('[email] send failed:', msg);
    await logToAudit(args, 'failed', msg);
    return { status: 'failed', error: msg };
  } finally {
    try { await client?.close(); } catch { /* noop */ }
  }
}
