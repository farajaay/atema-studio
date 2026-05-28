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
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SendArgs {
  to:        string;
  subject:   string;
  html:      string;
  text:      string;
  template:  string;
  bookingId?: string | null;
  replyTo?:  string;
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

// Cheap structural check — we never want to ship a confirmation to a typo'd
// address and we never want to log PII in error messages. Mirrors validation.ts.
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function logToAudit(args: SendArgs, status: SendResult['status'], error?: string) {
  const url  = Deno.env.get('SUPABASE_URL');
  const key  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;            // best-effort; never blow up the caller
  try {
    const supabase = createClient(url, key);
    await supabase.from('email_messages').insert([{
      booking_id: args.bookingId ?? null,
      to_address: args.to,
      subject:    args.subject,
      template:   args.template,
      status,
      error:      error ?? null,
    }]);
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

  const client = new SMTPClient({
    connection: {
      hostname: HOST,
      port:     PORT,
      tls:      true,          // 465 = implicit TLS; denomailer handles handshake
      auth:     { username: USER, password: PASS },
    },
  });

  try {
    await client.send({
      from:    `${FROM_NAME} <${FROM}>`,
      to:      args.to,
      replyTo: args.replyTo ?? FROM,
      subject: args.subject,
      content: args.text,
      html:    args.html,
    });
    await logToAudit(args, 'sent');
    return { status: 'sent' };
  } catch (e) {
    const msg = (e as Error).message ?? 'send_failed';
    console.error('[email] send failed:', msg);
    await logToAudit(args, 'failed', msg);
    return { status: 'failed', error: msg };
  } finally {
    try { await client.close(); } catch { /* noop */ }
  }
}
