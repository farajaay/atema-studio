// ZATCA-compliant Simplified Tax Invoice (Phase 1)
// — Generates HTML invoice with embedded TLV-encoded base64 QR code
// — QR contains: seller name, VAT number, timestamp, total with VAT, VAT amount

import { supabase } from './supabase';
import { DEFAULT_SETTINGS } from './settings';
import type { AppSettings } from './settings';
import { STATIONERY, STATIONERY_FONTS_IMPORT } from '../theme/stationery';

export interface InvoiceData {
  invoiceNumber:   string;
  bookingRef:      string;
  bookingId:       string;
  issueDate:       string;             // ISO timestamp
  customerName:    string;
  customerPhone:   string;
  packageNameAr:   string;
  packageNameEn:   string;
  addons:          { name: string; price: number; qty?: number }[];
  subtotal:        number;             // Excl VAT
  vat:             number;
  total:           number;             // Incl VAT (when vatEnabled=false this equals subtotal)
  paymentMethod:   'card' | 'transfer' | 'pending';
  /** Optional explicit payment state for the status badge. Regenerated
   *  invoices use this because the method isn't stored on the booking —
   *  without it a paid booking's reissued invoice would read "pending".
   *  Falls back to the paymentMethod inference when absent. */
  paymentState?:   'paid' | 'awaiting_transfer' | 'pending';
  depositPaid?:    number;
  /** Dynamic seller + VAT config — overrides hardcoded defaults */
  settings?:       AppSettings;
  /** Discount applied to this booking — when null/undefined, no line shown. */
  discount?: {
    code: string;
    amount: number;
    kind: 'percent' | 'flat';
    value: number;
  } | null;
  /** Gross (pre-discount) subtotal in SAR. Only shown when a discount is applied. */
  grossSubtotal?: number;
}

// ── TLV encoder (per ZATCA spec) ──────────────────────────────────────────────
function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function tlv(tag: number, value: string): Uint8Array {
  const bytes = strToBytes(value);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = tag;
  out[1] = bytes.length;
  out.set(bytes, 2);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function generateZatcaQR(d: { sellerName: string; vatNumber: string; timestamp: string; total: number; vat: number }): string {
  const parts = [
    tlv(1, d.sellerName),
    tlv(2, d.vatNumber),
    tlv(3, d.timestamp),
    tlv(4, d.total.toFixed(2)),
    tlv(5, d.vat.toFixed(2)),
  ];
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const merged = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) { merged.set(p, off); off += p.length; }
  return bytesToBase64(merged);
}

// ── Invoice number generator ──────────────────────────────────────────────────
// Patch M-8: cryptographically-random Crockford base32 suffix (40 bits =
// ~1.1 T possibilities) replaces the previous 5-digit Math.random — that
// version birthday-collided at ~300 bookings/month and broke the customer
// flow when `invoices.invoice_number UNIQUE` threw. Same Crockford
// alphabet as src/services/booking.ts so refs read consistently.
const INV_CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function generateInvoiceNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let tail = '';
  for (let i = 0; i < bytes.length; i++) tail += INV_CROCKFORD[bytes[i] & 31];
  return `INV-${yy}${mm}-${tail}`;
}

// ── Invoice HTML generator ────────────────────────────────────────────────────
// Escape user-controlled strings before interpolating into the template
// (Patch C-1). Invoices and contracts are rendered via window.document.write,
// so any unescaped < / " in customer values would execute as markup or
// break document structure.
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', calendar: 'gregory',
  });
}

export function generateInvoiceHTML(d: InvoiceData): string {
  const s = d.settings ?? DEFAULT_SETTINGS;
  const vatActive = s.vat_enabled && d.vat > 0;
  const docTitleAr = vatActive ? 'فاتورة ضريبية مبسطة' : 'فاتورة';
  const docTitleEn = vatActive ? 'SIMPLIFIED TAX INVOICE' : 'INVOICE';

  // QR is ZATCA-required only when VAT is active
  const qrBase64 = vatActive ? generateZatcaQR({
    sellerName: s.seller_name_ar,
    vatNumber:  s.vat_number,
    timestamp:  d.issueDate,
    total:      d.total,
    vat:        d.vat,
  }) : '';
  // Public QR generator — encodes base64 string into QR image (empty when no VAT)
  const qrImgUrl = vatActive
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrBase64)}`
    : '';

  const addonRows = d.addons.length === 0 ? '' : d.addons.map(a => `
    <tr>
      <td>${esc(a.name)}${a.qty && a.qty > 1 ? ` × ${a.qty}` : ''}</td>
      <td style="text-align:left;direction:ltr">${fmt(a.price * (a.qty ?? 1))}</td>
    </tr>
  `).join('');

  const effectiveState = d.paymentState
    ?? (d.paymentMethod === 'card' ? 'paid'
      : d.paymentMethod === 'transfer' ? 'awaiting_transfer'
      : 'pending');
  const statusBadge = effectiveState === 'paid'
    ? '<div class="badge paid">مدفوعة — Paid</div>'
    : effectiveState === 'awaiting_transfer'
    ? '<div class="badge pending">في انتظار التحويل البنكي — Awaiting Bank Transfer</div>'
    : '<div class="badge pending">بانتظار الدفع — Pending Payment</div>';

  const depositInfo = d.depositPaid && d.depositPaid > 0
    ? `<tr><td style="font-weight:600">دفعة أولى مسددة (٥٠٪)</td><td style="text-align:left;direction:ltr;color:${STATIONERY.okInk};font-weight:700">${fmt(d.depositPaid)} SAR</td></tr>
       <tr><td style="font-weight:600">المتبقي (يُسدَّد قبل المناسبة)</td><td style="text-align:left;direction:ltr">${fmt(d.total - d.depositPaid)} SAR</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(docTitleAr)} — ${esc(d.invoiceNumber)}</title>
<style>
  ${STATIONERY_FONTS_IMPORT}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${STATIONERY.fontBody};background:${STATIONERY.paper};color:${STATIONERY.ink};padding:24px;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .invoice{max-width:780px;margin:0 auto;background:${STATIONERY.card};border-radius:16px;box-shadow:${STATIONERY.cardShadow};overflow:hidden}
  .header{background:${STATIONERY.noirGrad};padding:30px 36px;color:white;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px}
  .brand h1{font-family:${STATIONERY.fontWordmark};font-size:28px;letter-spacing:0.18em;color:${STATIONERY.goldHi}}
  .brand p{font-size:11px;letter-spacing:0.22em;color:${STATIONERY.borderDash};margin-top:4px}
  .brand .crinfo{font-size:10px;color:rgba(232,217,197,0.7);margin-top:8px;font-family:${STATIONERY.fontBody}}
  .doc-meta{text-align:left;direction:ltr}
  .doc-meta .doc-title{font-family:${STATIONERY.fontDisplayEn};font-size:11px;letter-spacing:0.2em;color:${STATIONERY.borderDash};margin-bottom:6px}
  .doc-meta .doc-num{font-family:${STATIONERY.fontBody};font-size:18px;color:${STATIONERY.goldHi};font-weight:600;letter-spacing:0.05em;font-feature-settings:"tnum" 1}
  .doc-meta .doc-date{font-size:11px;color:rgba(232,217,197,0.75);margin-top:4px}
  .body{padding:32px 36px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
  .info-box{background:${STATIONERY.paper};border-radius:10px;padding:16px 18px;border:1px solid ${STATIONERY.borderHair}}
  .info-box .lbl{font-size:10px;letter-spacing:0.14em;color:${STATIONERY.goldDeep};text-transform:uppercase;margin-bottom:6px;font-family:${STATIONERY.fontBody}}
  .info-box .val{font-family:${STATIONERY.fontDisplayAr};font-size:15px;color:${STATIONERY.ink};font-weight:700}
  .info-box .sub{font-size:12px;color:${STATIONERY.goldDeep};margin-top:3px}
  h2{font-family:${STATIONERY.fontDisplayAr};font-size:15px;color:${STATIONERY.goldDeep};border-bottom:1px solid ${STATIONERY.borderHair};padding-bottom:8px;margin:18px 0 12px}
  table.items{width:100%;border-collapse:collapse;margin-bottom:18px}
  table.items th{background:${STATIONERY.noir};color:${STATIONERY.goldHi};padding:10px 14px;font-size:12px;font-weight:600;text-align:right;letter-spacing:0.06em;font-family:${STATIONERY.fontBody}}
  table.items th:last-child{text-align:left;direction:ltr}
  table.items td{padding:10px 14px;border-bottom:1px solid ${STATIONERY.paper};font-size:13px;color:${STATIONERY.ink}}
  table.items td:last-child{font-feature-settings:"tnum" 1;font-weight:600;color:${STATIONERY.goldDeep}}
  .totals{width:100%;border-collapse:collapse;margin-top:8px}
  .totals td{padding:9px 14px;border-bottom:1px solid ${STATIONERY.paper};font-size:13px}
  .totals td:first-child{color:${STATIONERY.inkSoft}}
  .totals td:last-child{text-align:left;direction:ltr;font-feature-settings:"tnum" 1;color:${STATIONERY.ink}}
  .totals tr.grand td{font-weight:700;font-size:17px;border-top:2px solid ${STATIONERY.goldDeep};border-bottom:none;padding-top:14px;color:${STATIONERY.ink}}
  .totals tr.grand td:last-child{color:${STATIONERY.goldDeep};font-family:${STATIONERY.fontDisplayAr};font-size:22px}
  .badge{display:inline-block;padding:6px 16px;border-radius:8px;font-size:12px;font-weight:700;letter-spacing:0.04em;font-family:${STATIONERY.fontBody};margin-bottom:12px}
  .badge.paid{background:${STATIONERY.okBg};color:${STATIONERY.okInk};border:1px solid ${STATIONERY.okBorder}}
  .badge.pending{background:${STATIONERY.warnBg};color:${STATIONERY.warnIn};border:1px solid ${STATIONERY.warnBorder}}
  .qr-section{background:${STATIONERY.paper};border-radius:12px;padding:20px;display:flex;gap:20px;align-items:center;margin-top:24px;border:1px dashed ${STATIONERY.borderDash}}
  .qr-section img{width:140px;height:140px;background:white;padding:8px;border-radius:8px;flex-shrink:0;border:1px solid ${STATIONERY.borderHair}}
  .qr-section .qr-info .lbl{font-size:11px;letter-spacing:0.14em;color:${STATIONERY.goldDeep};font-family:${STATIONERY.fontBody};margin-bottom:6px}
  .qr-section .qr-info h3{font-family:${STATIONERY.fontDisplayAr};font-size:14px;color:${STATIONERY.ink};margin-bottom:4px}
  .qr-section .qr-info p{font-size:11px;color:${STATIONERY.inkSoft};line-height:1.7}
  .footer-bar{background:${STATIONERY.paperAlt};padding:18px 36px;text-align:center;border-top:1px solid ${STATIONERY.borderHair}}
  .footer-bar .eta{font-size:10px;color:${STATIONERY.goldDeep};letter-spacing:0.16em;font-family:${STATIONERY.fontBody};margin-bottom:6px}
  .footer-bar p{font-size:11px;color:${STATIONERY.inkSoft}}
  /* FAB couture monogram — reserved for printable invoice / T&C only (per brand-usage rule) */
  .invoice{position:relative}
  .fab-monogram{position:absolute;top:20px;left:20px;width:44px;height:44px;border:1px solid rgba(214,191,163,0.55);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:${STATIONERY.fontWordmark};font-size:13px;letter-spacing:0.04em;color:${STATIONERY.borderDash};background:rgba(0,0,0,0.18);z-index:2}
  .actions{position:fixed;top:14px;left:14px;display:flex;gap:8px;z-index:100}
  .actions button{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;font-family:${STATIONERY.fontBody};font-size:12px;font-weight:600;background:${STATIONERY.noir};color:${STATIONERY.goldHi};box-shadow:0 4px 12px rgba(0,0,0,0.15)}
  @media print{.actions{display:none}.invoice{box-shadow:none;border-radius:0}body{background:white;padding:0}}
</style>
</head>
<body>
<div class="actions">
  <button onclick="window.print()">🖨 طباعة / تنزيل PDF</button>
</div>
<div class="invoice">
  <!-- FAB couture monogram (reserved for printable docs only) -->
  <div class="fab-monogram" aria-hidden="true"><span>FAB</span></div>
  <div class="header">
    <div class="brand">
      <h1>A T E M A</h1>
      <p>S T U D I O</p>
      <div class="crinfo">
        ${esc(s.seller_name_ar)} · جبيل، السعودية<br/>
        ${vatActive ? `الرقم الضريبي / VAT: ${esc(s.vat_number)}<br/>` : ''}
        ${s.cr_number ? `السجل التجاري / CR: ${esc(s.cr_number)}` : ''}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">${esc(docTitleEn)}</div>
      <div class="doc-num">${esc(d.invoiceNumber)}</div>
      <div class="doc-date">${esc(fmtDate(d.issueDate))}</div>
    </div>
  </div>

  <div class="body">
    ${statusBadge}

    <div class="row">
      <div class="info-box">
        <div class="lbl">العميلة / Customer</div>
        <div class="val">${esc(d.customerName)}</div>
        <div class="sub" dir="ltr">${esc(d.customerPhone)}</div>
      </div>
      <div class="info-box">
        <div class="lbl">رقم الحجز / Booking Ref</div>
        <div class="val" style="font-family:'Inter',sans-serif;font-size:13px">${esc(d.bookingRef)}</div>
        <div class="sub">طريقة الدفع: ${d.paymentMethod === 'card' ? 'بطاقة ائتمانية' : d.paymentMethod === 'transfer' ? 'تحويل بنكي' : 'بانتظار التحديد'}</div>
      </div>
    </div>

    <h2>تفاصيل الخدمة / Service Details</h2>
    <table class="items">
      <thead>
        <tr><th>الوصف / Description</th><th>المبلغ / Amount (SAR)</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${esc(d.packageNameAr)}</strong> <span style="color:${STATIONERY.inkFaint}">(${esc(d.packageNameEn)})</span></td>
          <td>${fmt(d.subtotal - d.addons.reduce((s, a) => s + a.price * (a.qty ?? 1), 0))}</td>
        </tr>
        ${addonRows}
      </tbody>
    </table>

    <table class="totals">
      ${d.discount && d.grossSubtotal ? `
        <tr>
          <td>الإجمالي الفرعي / Gross subtotal</td>
          <td>${fmt(d.grossSubtotal)} SAR</td>
        </tr>
        <tr>
          <td>خصم — ${esc(d.discount.code)}
            (${d.discount.kind === 'percent' ? `${d.discount.value}%` : `${fmt(d.discount.value)} SAR`})
            / Discount
          </td>
          <td style="color:${STATIONERY.goldDeep}">−${fmt(d.discount.amount)} SAR</td>
        </tr>
      ` : ''}
      ${vatActive
        ? `<tr><td>${d.discount ? 'الإجمالي بعد الخصم' : 'الإجمالي قبل الضريبة'} / Subtotal</td><td>${fmt(d.subtotal)} SAR</td></tr>
           <tr><td>ضريبة القيمة المضافة (15%) / VAT</td><td>${fmt(d.vat)} SAR</td></tr>
           <tr class="grand"><td>الإجمالي شامل الضريبة / Total Incl. VAT</td><td>${fmt(d.total)} SAR</td></tr>`
        : `<tr class="grand"><td>الإجمالي / Total</td><td>${fmt(d.total)} SAR</td></tr>`}
      ${depositInfo}
    </table>

    ${vatActive ? `
    <div class="qr-section">
      <img src="${qrImgUrl}" alt="ZATCA QR Code"/>
      <div class="qr-info">
        <div class="lbl">ZATCA Phase 1 — رمز الفاتورة</div>
        <h3>رمز الاستجابة السريعة المعتمد</h3>
        <p>هذا الرمز يحتوي على بيانات الفاتورة وفق متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA). يمكن للجهات المختصة مسحه للتحقق.</p>
      </div>
    </div>
    ` : `
    <div style="background:${STATIONERY.paper};border-radius:12px;padding:14px 18px;margin-top:18px;text-align:center;font-size:12px;color:${STATIONERY.inkSoft};border:1px dashed ${STATIONERY.borderDash}">
      هذه الفاتورة لا تخضع لضريبة القيمة المضافة — Non-VAT Invoice
    </div>
    `}
  </div>

  <div class="footer-bar">
    <div class="eta">CAPTURING MOMENTS · ELEVATING MEMORIES · EST. 2018</div>
    <p>ATEMA STUDIO · atema.studio · 0548323496 · جبيل، المملكة العربية السعودية</p>
  </div>
</div>
</body>
</html>`;
}

// ── Save invoice to Supabase ──────────────────────────────────────────────────
export async function saveInvoice(
  bookingId: string,
  bookingRef: string,
  invoiceNumber: string,
  html: string,
  total: number
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      booking_id: bookingId,
      booking_ref: bookingRef,
      invoice_number: invoiceNumber,
      content_html: html,
      total,
      issued_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) { console.error('Invoice save error:', error.message); return null; }
  return (data as { id: string }).id;
}

// ── Open invoice/contract in new tab for view + print ─────────────────────────
export function openDocumentInNewTab(html: string, title: string = 'Document'): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('يُرجى السماح بفتح النوافذ المنبثقة لعرض المستند');
    return;
  }
  win.document.title = title;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── Download an HTML document as a self-contained .html file ──────────────────
export function downloadDocument(html: string, filename: string): void {
  const safeName = filename.endsWith('.html') ? filename : `${filename}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari/iOS can pick up the blob before it's freed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
