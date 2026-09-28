// ATEMA STUDIO — photographer brief (internal email to the photographer's
// PERSONAL inbox).
//
// A second notification layer on top of the studio-inbox alerts: whenever a
// booking is created (create-booking) or a bride changes it from her manage
// link (change-booking: reschedule / package change), the photographer gets
// one self-contained brief — client + event, package + add-ons, pricing and
// applied discount, the package P&L estimate, and the production timeline
// with every service deadline and how far away it is.
//
// Recipient: Supabase secret PHOTOGRAPHER_EMAIL. Unset → nothing is sent
// (the callers guard). Internal only — it carries full PII by design, so it
// must never be pointed at a shared or customer-facing address.
//
// Pure string assembly (unit-tested in src/services/photographer-brief.test.ts).
// The money comes from the caller's server-side recompute; the P&L from
// _shared/pl.ts; the timeline from _shared/workflow.ts — nothing is forked.
// Subjects stay ASCII-only (denomailer 1.6.0 mixed-script limitation).

import { STATIONERY } from './stationery.ts';
import { calculateBookingPL, plInputsForPackage, DEFAULT_COST_CONFIG, type BookingPL } from './pl.ts';
import { stepsForBooking, computeTargets, daysBetween } from './workflow.ts';
import { CITY_FEES, extractCityKey } from './validation.ts';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

// Tajawal when the mail client loads web fonts; Tahoma/Arial otherwise —
// both ship on every desktop and phone and render Arabic cleanly.
const FONT = "'Tajawal', Tahoma, Arial, 'Segoe UI', sans-serif";

export type BriefKind = 'new' | 'reschedule' | 'package';

export interface BriefAddon { nameAr: string; nameEn?: string; price: number }

export interface PhotographerBriefData {
  kind:           BriefKind;
  bookingRef:     string;
  customerName:   string;
  customerPhone:  string;
  customerEmail?: string | null;
  eventDate:      string;           // yyyy-mm-dd
  eventTime?:     string | null;
  eventType?:     string | null;
  guestCount?:    number | null;
  location?:      string | null;
  notes?:         string | null;
  shotList?:      string | null;
  packageId:      number;
  packageNameAr:  string;
  packageNameEn?: string | null;
  packagePrice:   number;           // list price before «بدون طباعة»
  noPrint:        boolean;
  addons:         BriefAddon[];
  cityFee:        number;
  grossSubtotal:  number;           // before discount
  discount?:      { code: string; amount: number; kind: 'percent' | 'flat' | null } | null;
  subtotal:       number;           // ex-VAT revenue
  vat:            number;
  total:          number;
  paymentStatus?: string | null;
  topUpDue?:      number;
  /** Pre-formatted Arabic lines describing what changed (modifications only). */
  changeLines?:   string[];
  manageUrl?:     string | null;
  /** Today as yyyy-mm-dd — injectable for tests. */
  today:          string;
}

export interface RenderedEmail { subject: string; html: string; text: string }

export interface TimelineRow {
  titleAr:  string;
  titleEn:  string;
  target:   string;
  deadline: string;
  /** Whole days from today to the deadline (negative = passed). */
  daysLeft: number | null;
}

/** The production ladder for this booking with target/deadline dates. */
export function briefTimeline(eventDate: string, noPrint: boolean, today: string): TimelineRow[] {
  const dates = computeTargets(eventDate);
  return stepsForBooking({ noPrint }).map(def => ({
    titleAr:  def.titleAr,
    titleEn:  def.titleEn,
    target:   dates[def.key].target,
    deadline: dates[def.key].deadline,
    daysLeft: daysBetween(today, dates[def.key].deadline),
  }));
}

export function briefPL(d: Pick<PhotographerBriefData, 'packageId' | 'subtotal' | 'noPrint'>): BookingPL {
  return calculateBookingPL(
    plInputsForPackage(d.packageId, d.subtotal, { noPrint: d.noPrint }),
    DEFAULT_COST_CONFIG,
  );
}

const SAR = (n: number) => `${Math.round(n).toLocaleString('en-US')} SAR`;

function lapse(days: number | null): string {
  if (days === null) return '—';
  if (days === 0)  return 'اليوم';
  if (days > 0)    return `بعد ${days} يوم`;
  return `مضى ${-days} يوم`;
}

const STATUS_AR: Record<BookingPL['status'], string> = {
  'profitable': 'مربحة', 'break-even': 'عند نقطة التعادل', 'loss': 'خاسرة',
};
const WARNING_AR: Record<string, string> = {
  hourly_rate_below_target: 'أجر الساعة أقل من المستهدف',
  thin_margin:              'هامش ربح ضعيف (< 10%)',
  not_covering_overhead:    'لا تغطي المصاريف الثابتة',
  below_direct_cost:        'أقل من التكلفة المباشرة',
};
const KIND_AR: Record<BriefKind, string> = {
  new:        'حجز جديد',
  reschedule: 'تعديل حجز — تغيير الموعد',
  package:    'تعديل حجز — تغيير الباقة / الإضافات',
};
const KIND_EN: Record<BriefKind, string> = {
  new: 'New booking', reschedule: 'Booking rescheduled', package: 'Booking package changed',
};

export function renderPhotographerBrief(d: PhotographerBriefData): RenderedEmail {
  const S   = STATIONERY;
  const pl  = briefPL(d);
  const tl  = briefTimeline(d.eventDate, d.noPrint, d.today);
  const deposit   = Math.round(d.total * 0.5);
  const remaining = d.total - deposit;
  const daysToEvent = daysBetween(d.today, d.eventDate);
  const addonsTotal = d.addons.reduce((s, a) => s + Number(a.price || 0), 0);
  const pkgNet = d.grossSubtotal - addonsTotal - d.cityFee;

  const subject = `[ATEMA] ${KIND_EN[d.kind]} - ${d.bookingRef} - ${d.eventDate}`;

  // ── Plain-text twin ────────────────────────────────────────────────────
  const t: string[] = [`${KIND_AR[d.kind]} — ${d.bookingRef}`, ''];
  if (d.changeLines?.length) t.push('ما الذي تغيّر:', ...d.changeLines.map(l => `• ${l}`), '');
  t.push(
    'العميلة والمناسبة:',
    `الاسم: ${d.customerName}`, `الجوال: ${d.customerPhone}`,
    ...(d.customerEmail ? [`البريد: ${d.customerEmail}`] : []),
    `التاريخ: ${d.eventDate} ${d.eventTime ?? ''} (${lapse(daysToEvent)})`,
    ...(d.eventType ? [`نوع المناسبة: ${d.eventType}`] : []),
    ...(d.guestCount != null ? [`عدد الضيوف: ${d.guestCount}`] : []),
    ...(d.location ? [`الموقع: ${d.location}`] : []),
    ...(d.notes ? [`ملاحظات: ${d.notes}`] : []),
    ...(d.shotList ? [`قائمة اللقطات: ${d.shotList}`] : []),
    '',
    'الباقة والإضافات:',
    `${d.packageNameAr}${d.noPrint ? ' (بدون طباعة)' : ''}: ${SAR(pkgNet)}`,
    ...d.addons.map(a => `+ ${a.nameAr}: ${SAR(a.price)}`),
    ...(d.cityFee > 0 ? [`+ رسوم المدينة: ${SAR(d.cityFee)}`] : []),
    '',
    'التسعير:',
    `المجموع قبل الخصم: ${SAR(d.grossSubtotal)}`,
    ...(d.discount && d.discount.amount > 0 ? [`الخصم (${d.discount.code}): −${SAR(d.discount.amount)}`] : []),
    `الإجمالي قبل الضريبة: ${SAR(d.subtotal)}`, `الضريبة: ${SAR(d.vat)}`, `الإجمالي: ${SAR(d.total)}`,
    `العربون 50%: ${SAR(deposit)} · المتبقي: ${SAR(remaining)}`,
    ...(d.topUpDue && d.topUpDue > 0 ? [`مستحق إضافي بعد التعديل: ${SAR(d.topUpDue)}`] : []),
    '',
    `الربحية التقديرية (${STATUS_AR[pl.status]}):`,
    `الإيراد: ${SAR(pl.revenueExVat)} · التكاليف المباشرة: ${SAR(pl.totalDirectCost)} · الثابتة: ${SAR(pl.totalOverhead)}`,
    `ساعات العمل: ${pl.ownerHours} · أجرك: ${SAR(pl.ownerCompensation)}`,
    `الهامش المباشر: ${SAR(pl.directMargin)} (${pl.directMarginPct}%)`,
    `الهامش التشغيلي: ${SAR(pl.operatingMargin)} (${pl.operatingMarginPct}%)`,
    `الربح الصافي بعد أجرك: ${SAR(pl.ownerCompensatedMargin)} (${pl.ownerCompensatedMarginPct}%)`,
    ...pl.warnings.map(w => `⚠ ${WARNING_AR[w] ?? w}`),
    '',
    'الجدول الزمني والمواعيد النهائية:',
    ...tl.map(r => `• ${r.titleAr}: ${r.target}${r.deadline !== r.target ? ` → آخر موعد ${r.deadline}` : ''} (${lapse(r.daysLeft)})`),
    ...(d.manageUrl ? ['', `رابط إدارة الحجز: ${d.manageUrl}`] : []),
  );
  const text = t.join('\n');

  // ── HTML ───────────────────────────────────────────────────────────────
  const h2 = (s: string) =>
    `<p style="margin:22px 0 8px;font-size:13px;font-weight:700;letter-spacing:.5px;color:${S.goldDeep};border-bottom:1px solid ${S.borderHair};padding-bottom:6px;">${esc(s)}</p>`;
  const row = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:4px 0;font-size:13px;color:${S.inkFaint};width:42%;vertical-align:top;">${esc(k)}</td>` +
    `<td style="padding:4px 0;font-size:13px;color:${S.ink};${strong ? 'font-weight:700;' : ''}vertical-align:top;">${esc(v)}</td></tr>`;
  const table = (rows: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;

  const change = d.changeLines?.length
    ? h2('ما الذي تغيّر') + d.changeLines.map(l =>
        `<p style="margin:0 0 6px;font-size:13px;line-height:1.8;color:${S.ink};">• ${esc(l)}</p>`).join('')
    : '';

  const client = h2('العميلة والمناسبة') + table([
    row('الاسم', d.customerName, true),
    row('الجوال', d.customerPhone),
    d.customerEmail ? row('البريد', d.customerEmail) : '',
    row('التاريخ', `${d.eventDate} ${d.eventTime ?? ''} — ${lapse(daysToEvent)}`, true),
    d.eventType ? row('نوع المناسبة', d.eventType) : '',
    d.guestCount != null ? row('عدد الضيوف', String(d.guestCount)) : '',
    d.location ? row('الموقع', d.location) : '',
    d.notes ? row('ملاحظات', d.notes) : '',
    d.shotList ? row('قائمة اللقطات', d.shotList) : '',
  ].join(''));

  const services = h2('الباقة والإضافات') + table([
    row(`${d.packageNameAr}${d.noPrint ? ' (بدون طباعة)' : ''}`, SAR(pkgNet), true),
    ...d.addons.map(a => row(`+ ${a.nameAr}`, SAR(a.price))),
    d.addons.length === 0 ? row('الإضافات', 'لا يوجد') : '',
    d.cityFee > 0 ? row('+ رسوم المدينة', SAR(d.cityFee)) : '',
  ].join(''));

  const pricing = h2('التسعير') + table([
    row('المجموع قبل الخصم', SAR(d.grossSubtotal)),
    d.discount && d.discount.amount > 0
      ? row(`الخصم — ${d.discount.code}`, `−${SAR(d.discount.amount)}`) : row('الخصم', 'لا يوجد'),
    row('الإجمالي قبل الضريبة', SAR(d.subtotal)),
    row('الضريبة', SAR(d.vat)),
    row('الإجمالي', SAR(d.total), true),
    row('العربون (50%)', SAR(deposit)),
    row('المتبقي', SAR(remaining)),
    d.topUpDue && d.topUpDue > 0 ? row('مستحق إضافي بعد التعديل', SAR(d.topUpDue), true) : '',
  ].join(''));

  const profit = h2(`الربحية التقديرية — ${STATUS_AR[pl.status]}`) + table([
    row('الإيراد (دون ضريبة)', SAR(pl.revenueExVat)),
    row('التكاليف المباشرة', SAR(pl.totalDirectCost)),
    row('حصة المصاريف الثابتة', SAR(pl.totalOverhead)),
    row('ساعات عملك / أجرك', `${pl.ownerHours} س · ${SAR(pl.ownerCompensation)}`),
    row('الهامش المباشر', `${SAR(pl.directMargin)} (${pl.directMarginPct}%)`),
    row('الهامش التشغيلي', `${SAR(pl.operatingMargin)} (${pl.operatingMarginPct}%)`),
    row('الربح الصافي بعد أجرك', `${SAR(pl.ownerCompensatedMargin)} (${pl.ownerCompensatedMarginPct}%)`, true),
  ].join('')) +
    pl.warnings.map(w =>
      `<p style="margin:6px 0 0;font-size:12px;color:${S.warnInk};">⚠ ${esc(WARNING_AR[w] ?? w)}</p>`).join('') +
    `<p style="margin:8px 0 0;font-size:11px;color:${S.inkFaint};">تقدير مبني على الإعدادات الافتراضية للباقة — للتفاصيل الدقيقة افتحي تبويب الربحية في لوحة الإدارة.</p>`;

  const timeline = h2('الجدول الزمني والمواعيد النهائية') + table(tl.map(r => {
    const late = r.daysLeft !== null && r.daysLeft < 0;
    return `<tr>
      <td style="padding:6px 0;font-size:13px;color:${S.ink};vertical-align:top;border-bottom:1px solid ${S.borderHair};">${esc(r.titleAr)}<br><span dir="ltr" style="font-size:11px;color:${S.inkFaint};">${esc(r.titleEn)}</span></td>
      <td style="padding:6px 0;font-size:12px;color:${S.inkSoft};vertical-align:top;border-bottom:1px solid ${S.borderHair};" dir="ltr">${esc(r.target)}${r.deadline !== r.target ? `<br>≤ ${esc(r.deadline)}` : ''}</td>
      <td style="padding:6px 0;font-size:12px;color:${late ? S.warnInk : S.inkSoft};font-weight:${late ? 700 : 400};vertical-align:top;border-bottom:1px solid ${S.borderHair};">${esc(lapse(r.daysLeft))}</td>
    </tr>`;
  }).join(''));

  const manage = d.manageUrl
    ? `<p style="margin:20px 0 0;font-size:12px;color:${S.inkSoft};">رابط إدارة الحجز: <a href="${esc(d.manageUrl)}" style="color:${S.goldDeep};" dir="ltr">${esc(d.manageUrl)}</a></p>`
    : '';

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${S.paper};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${S.paper};padding:24px 10px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${S.card};border:1px solid ${S.borderHair};border-radius:16px;overflow:hidden;">
        <tr><td style="background:${S.noirGrad};padding:20px 24px;text-align:center;">
          <div style="font-family:${FONT};color:${S.goldHi};font-size:20px;letter-spacing:6px;">ATEMA</div>
          <div style="font-family:${FONT};color:${S.goldChampagne};font-size:11px;letter-spacing:2px;margin-top:6px;">${esc(KIND_AR[d.kind])} · ${esc(d.bookingRef)}</div>
        </td></tr>
        <tr><td style="padding:8px 24px 26px;font-family:${FONT};color:${S.ink};">
          ${change}${client}${services}${pricing}${profit}${timeline}${manage}
        </td></tr>
        <tr><td style="background:${S.paperAlt};border-top:1px solid ${S.borderHair};padding:12px 24px;text-align:center;font-family:${FONT};font-size:11px;color:${S.inkFaint};">
          ملخّص داخلي للمصوّرة — يحتوي بيانات شخصية للعميلة، لا يُعاد توجيهه.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

/** Map a stored `bookings` row (plus its package + add-on rows) to brief
 *  data. Used wherever the brief is built from the database rather than from
 *  a fresh server-side recompute: change-booking and the photographer-briefs
 *  resend. Ex-VAT subtotal is stored after the discount, so the gross is
 *  subtotal + discount_amount. */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function briefFromBookingRow(row: any, pkg: any, addons: any[], opts: {
  kind: BriefKind; siteOrigin: string; today: string; changeLines?: string[];
}): PhotographerBriefData {
  const discountAmount = Number(row.discount_amount ?? 0);
  const subtotal = Number(row.subtotal ?? 0);
  return {
    kind: opts.kind, bookingRef: row.booking_ref,
    customerName: row.customer_name, customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    eventDate: row.event_date, eventTime: row.event_time,
    eventType: row.event_type, guestCount: row.guest_count,
    location: row.location, notes: row.special_requests, shotList: row.shot_list,
    packageId: Number(row.package_id),
    packageNameAr: pkg?.name_ar ?? String(row.package_id), packageNameEn: pkg?.name_en,
    packagePrice: Number(pkg?.price ?? 0), noPrint: row.no_print === true,
    addons: (addons ?? []).filter(a => a.active)
      .map(a => ({ nameAr: a.name_ar, nameEn: a.name_en, price: Number(a.price) })),
    cityFee: CITY_FEES[extractCityKey(row.location)] ?? 0,
    grossSubtotal: subtotal + discountAmount,
    discount: row.discount_code && discountAmount > 0
      ? { code: row.discount_code, amount: discountAmount, kind: row.discount_kind ?? null } : null,
    subtotal, vat: Number(row.vat ?? 0), total: Number(row.total ?? 0),
    paymentStatus: row.payment_status, topUpDue: Number(row.topup_amount_due ?? 0),
    changeLines: opts.changeLines,
    manageUrl: row.manage_token ? `${opts.siteOrigin}/#/manage/${row.manage_token}` : null,
    today: opts.today,
  };
}
