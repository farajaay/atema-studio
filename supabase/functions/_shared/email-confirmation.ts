// ATEMA STUDIO — bilingual booking-confirmation email template.
//
// Standalone (no React, no DOM) — pure string assembly for the
// create-booking Edge Function. Matches the contract/invoice visual
// language: noir header + cream body + gold accents, Amiri serif for
// Arabic headlines, Tajawal sans for body text.
//
// Inline-styled and table-based on purpose: email clients (especially
// Outlook) ignore <style> blocks intermittently and don't speak flex/grid.

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

function formatDateAr(yyyyMmDd: string): string {
  if (!yyyyMmDd) return '';
  try {
    return new Date(yyyyMmDd).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory',
    });
  } catch { return yyyyMmDd; }
}

function formatDateEn(yyyyMmDd: string): string {
  if (!yyyyMmDd) return '';
  try {
    return new Date(yyyyMmDd).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return yyyyMmDd; }
}

export interface ConfirmationData {
  customerName:  string;
  bookingRef:    string;
  packageNameAr: string;
  packageNameEn: string;
  eventDate:     string;            // YYYY-MM-DD
  eventTime:     string;            // HH:MM
  total:         number;
  manageToken:   string | null;     // when set, CTA links to /#/manage/<token>
  siteOrigin:    string;            // e.g. https://atemastudio.xyz
}

export interface RenderedEmail {
  subject: string;
  html:    string;
  text:    string;
}

export function renderBookingConfirmation(d: ConfirmationData): RenderedEmail {
  const ref     = esc(d.bookingRef);
  const name    = esc(d.customerName);
  const pkgAr   = esc(d.packageNameAr || d.packageNameEn);
  const pkgEn   = esc(d.packageNameEn || d.packageNameAr);
  const dateAr  = esc(formatDateAr(d.eventDate));
  const dateEn  = esc(formatDateEn(d.eventDate));
  const time    = esc(d.eventTime || '');
  const totalAr = d.total.toLocaleString('ar-SA');
  const totalEn = d.total.toLocaleString('en-US');
  const origin  = d.siteOrigin.replace(/\/$/, '');
  const manageUrl = d.manageToken
    ? `${origin}/#/manage/${encodeURIComponent(d.manageToken)}`
    : null;

  const subject = `تأكيد الحجز · Booking confirmed — ${ref} — ATEMA STUDIO`;

  const text = [
    `عزيزتي ${name},`,
    `تأكدنا من استلام حجزك في ATEMA STUDIO.`,
    `رقم الحجز: ${ref}`,
    `الباقة: ${pkgAr}`,
    `التاريخ: ${dateAr} — ${time}`,
    `الإجمالي: ${totalAr} ر.س`,
    manageUrl ? `لإدارة حجزك: ${manageUrl}` : '',
    '',
    '— English —',
    `Dear ${name},`,
    `We've received your booking with ATEMA STUDIO.`,
    `Booking reference: ${ref}`,
    `Package: ${pkgEn}`,
    `Date: ${dateEn} — ${time}`,
    `Total: SAR ${totalEn}`,
    manageUrl ? `Manage your booking: ${manageUrl}` : '',
    '',
    `ATEMA STUDIO · Al-Jubail, Eastern Province · atemastudio.xyz`,
  ].filter(Boolean).join('\n');

  const ctaAr = manageUrl
    ? `<a href="${manageUrl}" style="display:inline-block;background:#1a1a1a;color:#e8d9c5;text-decoration:none;padding:14px 28px;border-radius:6px;font-family:'Tajawal',Arial,sans-serif;font-size:13px;letter-spacing:0.12em;font-weight:600">إدارة الحجز · MANAGE BOOKING</a>`
    : '';

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${subject}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@300;400;600;700&display=swap');
  body{margin:0;padding:0;background:#f4ede4;font-family:'Tajawal',Arial,sans-serif;color:#2c2218}
  a{color:#8c6b4f}
</style>
</head>
<body style="margin:0;padding:0;background:#f4ede4;font-family:'Tajawal',Arial,sans-serif;color:#2c2218">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4ede4;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

      <!-- Noir header -->
      <tr><td style="background:linear-gradient(135deg,#1a1a1a,#2c2c2c,#4a3728);padding:36px 32px;text-align:center;color:#ffffff" dir="rtl">
        <div style="font-family:'Amiri',serif;font-size:26px;letter-spacing:0.15em;margin:0 0 4px">ATEMA STUDIO</div>
        <div style="font-size:11px;letter-spacing:0.22em;opacity:0.6;font-weight:300">ATELIER · JUBAIL</div>
        <div style="display:inline-block;border:2px solid #c9b393;border-radius:8px;padding:6px 18px;font-size:11px;letter-spacing:0.14em;color:#c9b393;margin-top:16px">تأكيد الحجز · BOOKING CONFIRMED</div>
      </td></tr>

      <!-- Arabic body -->
      <tr><td style="padding:32px 36px 12px" dir="rtl">
        <p style="font-family:'Amiri',serif;font-size:18px;color:#2c2218;margin:0 0 12px">عزيزتي ${name}،</p>
        <p style="font-size:13.5px;line-height:1.9;color:#4a3728;margin:0">
          تم استلام طلب الحجز الخاص بكِ في ATEMA STUDIO. ستجدين أدناه ملخص الحجز،
          وسنتواصل معكِ قريبًا لإتمام التفاصيل النهائية.
        </p>
      </td></tr>

      <!-- Summary card -->
      <tr><td style="padding:8px 36px 24px" dir="rtl">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f9f5f0;border:1px solid #e8d9c5;border-radius:8px">
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:11px;letter-spacing:0.12em;color:#b09880;width:42%">رقم الحجز</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-family:'Amiri',serif;font-size:14px;color:#2c2218;font-weight:700">${ref}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:11px;letter-spacing:0.12em;color:#b09880">الباقة</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:13px;color:#2c2218">${pkgAr}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:11px;letter-spacing:0.12em;color:#b09880">التاريخ</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:13px;color:#2c2218">${dateAr} · ${time}</td>
          </tr>
          <tr>
            <td style="padding:14px 16px;background:#1a1a1a;font-size:11px;letter-spacing:0.12em;color:#c9b393;border-radius:0 0 0 8px">الإجمالي</td>
            <td style="padding:14px 16px;background:#1a1a1a;font-family:'Amiri',serif;font-size:18px;color:#e8d9c5;font-weight:700;border-radius:0 0 8px 0">${totalAr} <span style="font-size:11px;color:#c9b393">ر.س</span></td>
          </tr>
        </table>
      </td></tr>

      ${ctaAr ? `<tr><td align="center" style="padding:8px 36px 28px">${ctaAr}</td></tr>` : ''}

      <!-- Gold divider -->
      <tr><td style="padding:0 36px"><div style="height:1px;background:linear-gradient(to right, transparent, #c9b393, transparent)"></div></td></tr>

      <!-- English body -->
      <tr><td style="padding:24px 36px 8px" dir="ltr">
        <p style="font-family:'Amiri',serif;font-size:17px;color:#2c2218;margin:0 0 10px">Dear ${name},</p>
        <p style="font-size:13px;line-height:1.8;color:#4a3728;margin:0">
          We've received your booking with ATEMA STUDIO. A summary is below — we'll be in touch shortly to finalise the details.
        </p>
      </td></tr>

      <tr><td style="padding:8px 36px 28px" dir="ltr">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f9f5f0;border:1px solid #e8d9c5;border-radius:8px">
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:11px;letter-spacing:0.12em;color:#b09880;text-transform:uppercase;width:42%">Reference</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-family:'Amiri',serif;font-size:14px;color:#2c2218;font-weight:700">${ref}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:11px;letter-spacing:0.12em;color:#b09880;text-transform:uppercase">Package</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:13px;color:#2c2218">${pkgEn}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:11px;letter-spacing:0.12em;color:#b09880;text-transform:uppercase">Date</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e8d9c5;font-size:13px;color:#2c2218">${dateEn} · ${time}</td>
          </tr>
          <tr>
            <td style="padding:14px 16px;background:#1a1a1a;font-size:11px;letter-spacing:0.12em;color:#c9b393;text-transform:uppercase;border-radius:0 0 0 8px">Total</td>
            <td style="padding:14px 16px;background:#1a1a1a;font-family:'Amiri',serif;font-size:18px;color:#e8d9c5;font-weight:700;border-radius:0 0 8px 0">SAR ${totalEn}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f4ede4;padding:24px 36px;text-align:center;border-top:1px solid #e8d9c5">
        <p style="font-family:'Amiri',serif;font-size:13px;color:#8c6b4f;letter-spacing:0.1em;margin:0 0 6px">ATEMA STUDIO</p>
        <p style="font-size:11px;color:#b09880;letter-spacing:0.08em;margin:0">الجبيل · المنطقة الشرقية · المملكة العربية السعودية</p>
        <p style="font-size:11px;color:#b09880;letter-spacing:0.08em;margin:4px 0 12px" dir="ltr">Al-Jubail · Eastern Province · Saudi Arabia</p>
        <p style="font-size:11px;color:#b09880;margin:0">
          <a href="${origin}" style="color:#8c6b4f;text-decoration:none">atemastudio.xyz</a>
          &nbsp;·&nbsp;
          <a href="mailto:atema@atemastudio.xyz" style="color:#8c6b4f;text-decoration:none">atema@atemastudio.xyz</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
