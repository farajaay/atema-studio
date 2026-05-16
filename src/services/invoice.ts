// ZATCA-compliant Simplified Tax Invoice (Phase 1)
// — Generates HTML invoice with embedded TLV-encoded base64 QR code
// — QR contains: seller name, VAT number, timestamp, total with VAT, VAT amount

import { supabase } from './supabase';
import { DEFAULT_SETTINGS } from './settings';
import type { AppSettings } from './settings';

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
  depositPaid?:    number;
  /** Dynamic seller + VAT config — overrides hardcoded defaults */
  settings?:       AppSettings;
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
export function generateInvoiceNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = Math.floor(Math.random() * 90000 + 10000);
  return `INV-${yy}${mm}-${seq}`;
}

// ── Invoice HTML generator ────────────────────────────────────────────────────
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
      <td>${a.name}${a.qty && a.qty > 1 ? ` × ${a.qty}` : ''}</td>
      <td style="text-align:left;direction:ltr">${fmt(a.price * (a.qty ?? 1))}</td>
    </tr>
  `).join('');

  const statusBadge = d.paymentMethod === 'card'
    ? '<div class="badge paid">مدفوعة — Paid</div>'
    : d.paymentMethod === 'transfer'
    ? '<div class="badge pending">في انتظار التحويل البنكي — Awaiting Bank Transfer</div>'
    : '<div class="badge pending">بانتظار الدفع — Pending Payment</div>';

  const depositInfo = d.depositPaid && d.depositPaid > 0
    ? `<tr><td style="font-weight:600">دفعة أولى مسددة (٥٠٪)</td><td style="text-align:left;direction:ltr;color:#059669;font-weight:700">${fmt(d.depositPaid)} SAR</td></tr>
       <tr><td style="font-weight:600">المتبقي (يُسدَّد قبل المناسبة)</td><td style="text-align:left;direction:ltr">${fmt(d.total - d.depositPaid)} SAR</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${docTitleAr} — ${d.invoiceNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@300;400;600;700&family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Tajawal',sans-serif;background:#F5EDE4;color:#1A1A1A;padding:24px;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .invoice{max-width:780px;margin:0 auto;background:white;border-radius:16px;box-shadow:0 6px 32px rgba(26,26,26,0.08);overflow:hidden}
  .header{background:linear-gradient(135deg,#1A1A1A,#2C2C2C,#4A3728);padding:30px 36px;color:white;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px}
  .brand h1{font-family:'Amiri',serif;font-size:28px;letter-spacing:0.18em;color:#E8D9C5}
  .brand p{font-size:11px;letter-spacing:0.22em;color:#D6BFA3;margin-top:4px}
  .brand .crinfo{font-size:10px;color:rgba(232,217,197,0.7);margin-top:8px;font-family:'Inter',sans-serif}
  .doc-meta{text-align:left;direction:ltr}
  .doc-meta .doc-title{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:0.2em;color:#D6BFA3;margin-bottom:6px}
  .doc-meta .doc-num{font-family:'Inter',sans-serif;font-size:18px;color:#E8D9C5;font-weight:600;letter-spacing:0.05em}
  .doc-meta .doc-date{font-size:11px;color:rgba(232,217,197,0.75);margin-top:4px}
  .body{padding:32px 36px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
  .info-box{background:#F5EDE4;border-radius:10px;padding:16px 18px;border:1px solid #E8D9C5}
  .info-box .lbl{font-size:10px;letter-spacing:0.14em;color:#8C6B4F;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif}
  .info-box .val{font-family:'Amiri',serif;font-size:15px;color:#1A1A1A;font-weight:700}
  .info-box .sub{font-size:12px;color:#8C6B4F;margin-top:3px}
  h2{font-family:'Amiri',serif;font-size:15px;color:#8C6B4F;border-bottom:1px solid #E8D9C5;padding-bottom:8px;margin:18px 0 12px}
  table.items{width:100%;border-collapse:collapse;margin-bottom:18px}
  table.items th{background:#1A1A1A;color:#E8D9C5;padding:10px 14px;font-size:12px;font-weight:600;text-align:right;letter-spacing:0.06em;font-family:'Inter',sans-serif}
  table.items th:last-child{text-align:left;direction:ltr}
  table.items td{padding:10px 14px;border-bottom:1px solid #F5EDE4;font-size:13px;color:#1A1A1A}
  table.items td:last-child{font-family:'Inter',sans-serif;font-weight:600;color:#8C6B4F}
  .totals{width:100%;border-collapse:collapse;margin-top:8px}
  .totals td{padding:9px 14px;border-bottom:1px solid #F5EDE4;font-size:13px}
  .totals td:first-child{color:#4A3728}
  .totals td:last-child{text-align:left;direction:ltr;font-family:'Inter',sans-serif;color:#1A1A1A}
  .totals tr.grand td{font-weight:700;font-size:17px;border-top:2px solid #8C6B4F;border-bottom:none;padding-top:14px;color:#1A1A1A}
  .totals tr.grand td:last-child{color:#8C6B4F;font-family:'Amiri',serif;font-size:22px}
  .badge{display:inline-block;padding:6px 16px;border-radius:8px;font-size:12px;font-weight:700;letter-spacing:0.04em;font-family:'Inter',sans-serif;margin-bottom:12px}
  .badge.paid{background:#d1fae5;color:#065f46;border:1px solid #6ee7b7}
  .badge.pending{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
  .qr-section{background:#F5EDE4;border-radius:12px;padding:20px;display:flex;gap:20px;align-items:center;margin-top:24px;border:1px dashed #D6BFA3}
  .qr-section img{width:140px;height:140px;background:white;padding:8px;border-radius:8px;flex-shrink:0;border:1px solid #E8D9C5}
  .qr-section .qr-info .lbl{font-size:11px;letter-spacing:0.14em;color:#8C6B4F;font-family:'Inter',sans-serif;margin-bottom:6px}
  .qr-section .qr-info h3{font-family:'Amiri',serif;font-size:14px;color:#1A1A1A;margin-bottom:4px}
  .qr-section .qr-info p{font-size:11px;color:#4A3728;line-height:1.7}
  .footer-bar{background:#F5EDE4;padding:18px 36px;text-align:center;border-top:1px solid #E8D9C5}
  .footer-bar .eta{font-size:10px;color:#8C6B4F;letter-spacing:0.16em;font-family:'Inter',sans-serif;margin-bottom:6px}
  .footer-bar p{font-size:11px;color:#4A3728}
  .actions{position:fixed;top:14px;left:14px;display:flex;gap:8px;z-index:100}
  .actions button{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;background:#1A1A1A;color:#E8D9C5;box-shadow:0 4px 12px rgba(0,0,0,0.15)}
  @media print{.actions{display:none}.invoice{box-shadow:none;border-radius:0}body{background:white;padding:0}}
</style>
</head>
<body>
<div class="actions">
  <button onclick="window.print()">🖨 طباعة / تنزيل PDF</button>
</div>
<div class="invoice">
  <div class="header">
    <div class="brand">
      <h1>A T E M A</h1>
      <p>S T U D I O</p>
      <div class="crinfo">
        ${s.seller_name_ar} · جبيل، السعودية<br/>
        ${vatActive ? `الرقم الضريبي / VAT: ${s.vat_number}<br/>` : ''}
        ${s.cr_number ? `السجل التجاري / CR: ${s.cr_number}` : ''}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">${docTitleEn}</div>
      <div class="doc-num">${d.invoiceNumber}</div>
      <div class="doc-date">${fmtDate(d.issueDate)}</div>
    </div>
  </div>

  <div class="body">
    ${statusBadge}

    <div class="row">
      <div class="info-box">
        <div class="lbl">العميلة / Customer</div>
        <div class="val">${d.customerName}</div>
        <div class="sub" dir="ltr">${d.customerPhone}</div>
      </div>
      <div class="info-box">
        <div class="lbl">رقم الحجز / Booking Ref</div>
        <div class="val" style="font-family:'Inter',sans-serif;font-size:13px">${d.bookingRef}</div>
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
          <td><strong>${d.packageNameAr}</strong> <span style="color:#888">(${d.packageNameEn})</span></td>
          <td>${fmt(d.subtotal - d.addons.reduce((s, a) => s + a.price * (a.qty ?? 1), 0))}</td>
        </tr>
        ${addonRows}
      </tbody>
    </table>

    <table class="totals">
      ${vatActive
        ? `<tr><td>الإجمالي قبل الضريبة / Subtotal</td><td>${fmt(d.subtotal)} SAR</td></tr>
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
    <div style="background:#F5EDE4;border-radius:12px;padding:14px 18px;margin-top:18px;text-align:center;font-size:12px;color:#6B5440;border:1px dashed #D6BFA3">
      هذه الفاتورة لا تخضع لضريبة القيمة المضافة — Non-VAT Invoice
    </div>
    `}
  </div>

  <div class="footer-bar">
    <div class="eta">CAPTURING MOMENTS · ELEVATING MEMORIES · EST. 2024</div>
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
