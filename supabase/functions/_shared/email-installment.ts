// ATEMA STUDIO — bride installment reminder email (خطة التقسيط).
//
// Sent by the workflow-reminders cron a few days before each installment's
// due date (BRIDE_LEAD_DAYS in _shared/installments.ts). Email is the
// always-channel; WhatsApp stays behind app_settings.wa_enabled and is not
// part of this path. Pure string assembly, stationery-dressed like
// email-change.ts.
//
// Subjects stay ASCII-only: denomailer 1.6.0 emits broken RFC 2047 for
// mixed-script subjects (same constraint as the other renderers).
//
// Anti-fraud discipline (same as the OTP + transfer copy): the official
// IBAN is stated in full and the reader is pointed at /policy to verify —
// never "reply with your card details" energy.

import { STATIONERY } from './stationery.ts';
import { installmentLabelAr, installmentLabelEn } from './installments.ts';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

// Official transfer facts. Client-side source of truth is
// src/content/payment.ts (BANK) — keep in lock-step (change-both rule, same
// as the stationery mirrors).
const BANK_NAME_AR = 'مصرف الراجحي';
const BANK_HOLDER_AR = 'فاطمة بوحسن';
const BANK_IBAN = 'SA0380000000329608010885626';

export interface RenderedEmail {
  subject: string;
  html:    string;
  text:    string;
}

export interface InstallmentReminderData {
  bookingRef:    string;
  customerName?: string;
  seq:           number;
  count:         number;   // total installments in the plan
  amount:        number;   // SAR
  dueDate:       string;   // yyyy-mm-dd
  manageUrl?:    string | null;
  siteOrigin?:   string;   // for the /policy verification pointer
}

export function renderInstallmentReminderEmail(d: InstallmentReminderData): RenderedEmail {
  const S      = STATIONERY;
  const ref    = esc(d.bookingRef);
  const name   = esc(d.customerName || '');
  const amount = Number(d.amount).toLocaleString('ar-SA');
  const labelAr = installmentLabelAr(d.seq, d.count);
  const labelEn = installmentLabelEn(d.seq, d.count);
  const policyUrl = `${d.siteOrigin ?? 'https://atemastudio.xyz'}/#/policy`;

  const subject = `Payment reminder ${d.seq}/${d.count} - ATEMA STUDIO`;

  const text = [
    name ? `${d.customerName}،` : '',
    `تذكير لطيف: ${labelAr} من خطة دفعات حجزك (${d.bookingRef}) تستحق في ${d.dueDate}.`,
    `المبلغ: ${amount} ر.س`,
    `التحويل إلى: ${BANK_NAME_AR} — ${BANK_HOLDER_AR}`,
    `IBAN: ${BANK_IBAN}`,
    'بعد التحويل أرسلي الإيصال عبر واتساب ليُؤكَّد الاستلام.',
    d.manageUrl ? `تفاصيل خطتك: ${d.manageUrl}` : '',
    `للتحقق من حساباتنا الرسمية: ${policyUrl}`,
    '',
    `Gentle reminder: ${labelEn} of your booking ${d.bookingRef} is due on ${d.dueDate}.`,
    `Amount: ${Number(d.amount).toLocaleString('en-US')} SAR. IBAN: ${BANK_IBAN}`,
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
            تذكير لطيف بموعد ${esc(labelAr)} من خطة دفعات حجزك
            <span style="color:${S.goldDeep};font-weight:700;">${ref}</span>
          </p>
        </td></tr>
        <tr><td style="padding:14px 32px 8px;text-align:center;">
          <div style="display:inline-block;background:${S.paperAlt};border:1px solid ${S.borderDash};border-radius:12px;padding:16px 28px;font-family:${S.fontBody};">
            <div style="font-size:12px;color:${S.inkMuted};margin-bottom:6px;">المبلغ · Amount</div>
            <div style="font-size:22px;font-weight:700;color:${S.ink};">${amount} ر.س</div>
            <div style="border-top:1px solid ${S.borderHair};margin-top:12px;padding-top:12px;">
              <div style="font-size:12px;color:${S.inkMuted};margin-bottom:4px;">تاريخ الاستحقاق · Due date</div>
              <div dir="ltr" style="font-size:16px;font-weight:700;color:${S.goldDeep};letter-spacing:1px;">${esc(d.dueDate)}</div>
            </div>
          </div>
        </td></tr>
        <tr><td style="padding:10px 32px 6px;font-family:${S.fontBody};">
          <div style="background:${S.paperAlt};border:1px solid ${S.borderHair};border-radius:10px;padding:14px 18px;text-align:right;">
            <div style="font-size:12px;font-weight:700;color:${S.goldDeep};margin-bottom:8px;">التحويل إلى حسابنا الرسمي</div>
            <div style="font-size:12.5px;color:${S.inkSoft};line-height:2;">
              ${BANK_NAME_AR} — ${BANK_HOLDER_AR}<br>
              <span dir="ltr" style="font-family:monospace;letter-spacing:0.5px;">${BANK_IBAN}</span><br>
              بعد التحويل أرسلي الإيصال عبر واتساب ليُؤكَّد الاستلام.
            </div>
          </div>
        </td></tr>
        ${d.manageUrl ? `
        <tr><td style="padding:12px 32px 20px;text-align:center;">
          <a href="${esc(d.manageUrl)}" style="display:inline-block;background:${S.goldDeep};color:${S.card};font-family:${S.fontBody};font-size:13.5px;font-weight:700;text-decoration:none;border-radius:10px;padding:12px 30px;">
            عرض خطة الدفعات
          </a>
        </td></tr>` : `<tr><td style="padding:4px 0 16px;"></td></tr>`}
        <tr><td style="background:${S.paperAlt};border-top:1px solid ${S.borderHair};padding:16px 32px;text-align:center;font-family:${S.fontBody};font-size:11px;color:${S.inkFaint};">
          لن نطلب منك أبداً بيانات بطاقة أو رمز تحقق. تحقّقي من حساباتنا الرسمية عبر
          <a href="${esc(policyUrl)}" style="color:${S.goldDeep};">صفحة السياسات</a>.
          <br><span dir="ltr">We never ask for card details or verification codes. Verify our official accounts on the policy page.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
