// ATEMA STUDIO — bilingual booking-change confirmation emails.
//
// The email side of the dual-channel notification policy: email is ALWAYS
// sent for self-service changes (reschedule / package change); WhatsApp is
// sent additionally only when app_settings.wa_enabled is on (Meta approval
// pending — see AGENTS.md). Pure string assembly, stationery-dressed like
// email-otp.ts / email-confirmation.ts.
//
// Subjects stay ASCII-only: denomailer 1.6.0 emits broken RFC 2047 for
// mixed-script subjects (same constraint as the other renderers).

import { STATIONERY } from './stationery.ts';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

export interface RenderedEmail {
  subject: string;
  html:    string;
  text:    string;
}

function shell(bodyRows: string): string {
  const S = STATIONERY;
  return `<!DOCTYPE html>
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
        ${bodyRows}
        <tr><td style="background:${S.paperAlt};border-top:1px solid ${S.borderHair};padding:16px 32px;text-align:center;font-family:${S.fontBody};font-size:11px;color:${S.inkFaint};">
          هذه رسالة تأكيد تلقائية لتعديلٍ أجريتِه بنفسك من رابط إدارة الحجز.
          <br><span dir="ltr">This confirms a change you made yourself from your booking-management link.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Reschedule confirmation (bride) ─────────────────────────────────────────
export interface RescheduleEmailData {
  bookingRef:    string;
  customerName?: string;
  newDate:       string;   // ISO yyyy-mm-dd
  newTime:       string;
}

export function renderRescheduleEmail(d: RescheduleEmailData): RenderedEmail {
  const S    = STATIONERY;
  const ref  = esc(d.bookingRef);
  const name = esc(d.customerName || '');
  const date = esc(d.newDate);
  const time = esc(d.newTime);

  const subject = `Your new date is set - ATEMA STUDIO`;

  const text = [
    name ? `${d.customerName}،` : '',
    `تم تأجيل حجزك (${d.bookingRef}).`,
    `الموعد الجديد: ${d.newDate} الساعة ${d.newTime}.`,
    'بانتظارك.',
    '',
    `Your booking ${d.bookingRef} has been rescheduled.`,
    `New date: ${d.newDate} at ${d.newTime}.`,
  ].filter(Boolean).join('\n');

  const html = shell(`
        <tr><td style="padding:30px 32px 8px;text-align:center;font-family:${S.fontBody};color:${S.ink};">
          ${name ? `<p style="margin:0 0 8px;font-size:15px;color:${S.inkSoft};">${name}،</p>` : ''}
          <p style="margin:0;font-size:14px;line-height:1.9;color:${S.inkSoft};">
            تم تأجيل حجزك <span style="color:${S.goldDeep};font-weight:700;">${ref}</span>
          </p>
        </td></tr>
        <tr><td style="padding:14px 32px 22px;text-align:center;">
          <div style="display:inline-block;background:${S.paperAlt};border:1px solid ${S.borderDash};border-radius:12px;padding:16px 28px;font-family:${S.fontBody};">
            <div style="font-size:12px;color:${S.inkMuted};margin-bottom:6px;">الموعد الجديد · New date</div>
            <div dir="ltr" style="font-size:22px;font-weight:700;color:${S.ink};letter-spacing:1px;">${date} · ${time}</div>
          </div>
          <p style="margin:16px 0 0;font-family:${S.fontBody};font-size:13px;color:${S.inkSoft};">بانتظارك 🤍</p>
        </td></tr>`);

  return { subject, html, text };
}

// ── Package / add-on change confirmation (bride) ────────────────────────────
export interface PackageChangeEmailData {
  bookingRef:    string;
  customerName?: string;
  total:         number;   // new grand total, SAR
  topUpDue:      number;   // 0 when nothing further is owed
  manageUrl?:    string | null;
}

export function renderPackageChangeEmail(d: PackageChangeEmailData): RenderedEmail {
  const S     = STATIONERY;
  const ref   = esc(d.bookingRef);
  const name  = esc(d.customerName || '');
  const total = Number(d.total).toLocaleString('ar-SA');
  const due   = Number(d.topUpDue).toLocaleString('ar-SA');

  const subject = `Your booking was updated - ATEMA STUDIO`;

  const text = [
    name ? `${d.customerName}،` : '',
    `تم تعديل باقة حجزك (${d.bookingRef}).`,
    `الإجمالي الجديد: ${total} ر.س`,
    d.topUpDue > 0 ? `المبلغ المتبقّي للدفع: ${due} ر.س` : 'لا توجد مبالغ إضافية مستحقة.',
    d.topUpDue > 0 && d.manageUrl ? `للاطلاع والدفع: ${d.manageUrl}` : '',
    '',
    `Your booking ${d.bookingRef} package was updated. New total: ${Number(d.total).toLocaleString('en-US')} SAR.`,
    d.topUpDue > 0 ? `Balance to pay: ${Number(d.topUpDue).toLocaleString('en-US')} SAR.` : 'No additional payment is due.',
  ].filter(Boolean).join('\n');

  const html = shell(`
        <tr><td style="padding:30px 32px 8px;text-align:center;font-family:${S.fontBody};color:${S.ink};">
          ${name ? `<p style="margin:0 0 8px;font-size:15px;color:${S.inkSoft};">${name}،</p>` : ''}
          <p style="margin:0;font-size:14px;line-height:1.9;color:${S.inkSoft};">
            تم تعديل باقة حجزك <span style="color:${S.goldDeep};font-weight:700;">${ref}</span>
          </p>
        </td></tr>
        <tr><td style="padding:14px 32px 8px;text-align:center;">
          <div style="display:inline-block;background:${S.paperAlt};border:1px solid ${S.borderDash};border-radius:12px;padding:16px 28px;font-family:${S.fontBody};">
            <div style="font-size:12px;color:${S.inkMuted};margin-bottom:6px;">الإجمالي الجديد · New total</div>
            <div style="font-size:22px;font-weight:700;color:${S.ink};">${total} ر.س</div>
            ${d.topUpDue > 0 ? `
            <div style="border-top:1px solid ${S.borderHair};margin-top:12px;padding-top:12px;">
              <div style="font-size:12px;color:${S.inkMuted};margin-bottom:4px;">المبلغ المتبقّي للدفع · Balance due</div>
              <div style="font-size:17px;font-weight:700;color:${S.goldDeep};">${due} ر.س</div>
            </div>` : `
            <div style="font-size:12px;color:${S.inkMuted};margin-top:10px;">لا توجد مبالغ إضافية مستحقة · No additional payment is due</div>`}
          </div>
        </td></tr>
        ${d.topUpDue > 0 && d.manageUrl ? `
        <tr><td style="padding:12px 32px 24px;text-align:center;">
          <a href="${esc(d.manageUrl)}" style="display:inline-block;background:${S.goldDeep};color:${S.card};font-family:${S.fontBody};font-size:13.5px;font-weight:700;text-decoration:none;border-radius:10px;padding:12px 30px;">
            إدارة الحجز وإتمام الدفع
          </a>
        </td></tr>` : `<tr><td style="padding:4px 0 20px;"></td></tr>`}`);

  return { subject, html, text };
}

// ── Owner alert (studio inbox) ───────────────────────────────────────────────
export interface OwnerChangeAlertData {
  kind:       'reschedule' | 'package';
  bookingRef: string;
  lines:      string[];    // pre-formatted Arabic detail lines
}

export function renderOwnerChangeAlertEmail(d: OwnerChangeAlertData): RenderedEmail {
  const S     = STATIONERY;
  const label = d.kind === 'reschedule' ? 'تأجيل موعد من العميلة' : 'تعديل باقة من العميلة';
  const subject = `[ATEMA] Customer ${d.kind === 'reschedule' ? 'reschedule' : 'package change'} - ${d.bookingRef}`;
  const text = [`${label} — ${d.bookingRef}`, ...d.lines].join('\n');
  const html = shell(`
        <tr><td style="padding:28px 32px 24px;font-family:${S.fontBody};color:${S.ink};">
          <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:${S.goldDeep};">${esc(label)}</p>
          <p style="margin:0 0 12px;font-size:13px;color:${S.inkSoft};">رقم الحجز: <b>${esc(d.bookingRef)}</b></p>
          ${d.lines.map(l => `<p style="margin:0 0 6px;font-size:13px;line-height:1.8;color:${S.inkSoft};">${esc(l)}</p>`).join('')}
        </td></tr>`);
  return { subject, html, text };
}
