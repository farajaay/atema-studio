// ATEMA STUDIO — bilingual step-up verification (OTP) email.
//
// Sent when a bride asks to change her package / add-ons from the
// /#/manage/<token> page. The 6-digit code is the second factor that gates the
// money path in change-booking. Pure string assembly (no React, no DOM, no
// Deno-only API), sourcing colours + fonts from the shared stationery palette
// so it wears the same dress as the contract, invoice, and booking email.
//
// Security: the code travels ONLY in this email — never in the HTTP response,
// never in the subject line (so it can't leak via a lock-screen preview). The
// anti-phishing line ships with every send, mirroring the WhatsApp copy.

import { STATIONERY } from './stationery.ts';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

export interface ChangeOtpData {
  code:          string;
  bookingRef:    string;
  customerName?: string;
  ttlMinutes?:   number;   // default 10
}

export interface RenderedEmail {
  subject: string;
  html:    string;
  text:    string;
}

export function renderChangeOtpEmail(d: ChangeOtpData): RenderedEmail {
  const S    = STATIONERY;
  const code = esc(d.code);
  const ref  = esc(d.bookingRef);
  const name = esc(d.customerName || '');
  const ttl  = d.ttlMinutes ?? 10;

  // ASCII-only subject, and the code is deliberately NOT in it — denomailer
  // 1.6.0 emits broken RFC 2047 for mixed-script subjects (see
  // email-confirmation.ts), and an OTP in the subject leaks to notifications.
  const subject = `Your verification code - ATEMA STUDIO`;

  const text = [
    name ? `${d.customerName}،` : '',
    `رمز التحقق لتعديل حجزك (${d.bookingRef}): ${d.code}`,
    `صالح لمدة ${ttl} دقائق. لا تشاركيه مع أحد — فريق ATEMA لن يطلبه منكِ أبداً.`,
    '',
    `Your verification code for changing booking ${d.bookingRef}: ${d.code}`,
    `Valid for ${ttl} minutes. Never share it — ATEMA will never ask you for this code.`,
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${S.paper};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${S.paper};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${S.card};border:1px solid ${S.borderHair};border-radius:16px;box-shadow:${S.cardShadow};overflow:hidden;">
        <tr><td style="background:${S.noirGrad};padding:26px 0;text-align:center;">
          <div style="font-family:${S.fontWordmark};color:${S.goldHi};font-size:24px;letter-spacing:6px;">ATEMA</div>
          <div style="font-family:${S.fontBody};color:${S.goldChampagne};font-size:10px;letter-spacing:4px;margin-top:4px;">STUDIO</div>
        </td></tr>
        <tr><td style="padding:30px 32px 8px;text-align:center;font-family:${S.fontBody};color:${S.ink};">
          ${name ? `<p style="margin:0 0 8px;font-size:15px;color:${S.inkSoft};">${name}،</p>` : ''}
          <p style="margin:0;font-size:14px;line-height:1.9;color:${S.inkSoft};">
            رمز التحقق لتعديل حجزك
            <span style="color:${S.goldDeep};font-weight:700;">${ref}</span>
          </p>
        </td></tr>
        <tr><td style="padding:14px 32px 6px;text-align:center;">
          <div style="display:inline-block;background:${S.paperAlt};border:1px solid ${S.borderDash};border-radius:12px;padding:16px 28px;">
            <span style="font-family:${S.fontDisplayEn};font-size:38px;font-weight:600;letter-spacing:10px;color:${S.ink};">${code}</span>
          </div>
        </td></tr>
        <tr><td style="padding:14px 32px 4px;text-align:center;font-family:${S.fontBody};">
          <p style="margin:0;font-size:12.5px;color:${S.inkMuted};">صالح لمدة ${ttl} دقائق</p>
        </td></tr>
        <tr><td style="padding:18px 32px 26px;">
          <div style="background:${S.warnBg};border:1px solid ${S.warnBorder};border-radius:10px;padding:12px 16px;font-family:${S.fontBody};font-size:12px;line-height:1.8;color:${S.warnIn};text-align:center;">
            لا تشاركي هذا الرمز مع أحد — فريق ATEMA لن يطلبه منكِ أبداً.
            <br><span dir="ltr" style="display:inline-block;margin-top:4px;">ATEMA will never ask you for this code.</span>
          </div>
        </td></tr>
        <tr><td style="background:${S.paperAlt};border-top:1px solid ${S.borderHair};padding:16px 32px;text-align:center;font-family:${S.fontBody};font-size:11px;color:${S.inkFaint};">
          إذا لم تطلبي هذا الرمز، يمكنك تجاهل هذه الرسالة.
          <br><span dir="ltr">If you didn't request this, you can safely ignore this email.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
