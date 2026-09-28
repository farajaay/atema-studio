import { describe, it, expect } from 'vitest';
import {
  renderPhotographerBrief, briefTimeline, briefPL, briefFromBookingRow, type PhotographerBriefData,
} from '../../supabase/functions/_shared/email-photographer';

const base: PhotographerBriefData = {
  kind: 'new', bookingRef: 'AT-260101-ABCD',
  customerName: 'نورة <script>', customerPhone: '+966500000000', customerEmail: 'n@example.com',
  eventDate: '2026-12-01', eventTime: '19:00', location: 'jubail — قاعة',
  packageId: 3, packageNameAr: 'الكلاسيكية', packagePrice: 5500, noPrint: false,
  addons: [{ nameAr: 'مصورة ثانية', price: 900 }], cityFee: 0,
  grossSubtotal: 6400, discount: { code: 'LAUNCH15', amount: 800, kind: 'percent' },
  subtotal: 5600, vat: 840, total: 6440, today: '2026-10-01',
};

describe('photographer brief', () => {
  it('carries pricing, discount, add-ons and escapes customer strings', () => {
    const m = renderPhotographerBrief(base);
    expect(m.subject).toBe('[ATEMA] New booking - AT-260101-ABCD - 2026-12-01');
    expect(/^[\x20-\x7E]+$/.test(m.subject)).toBe(true);        // ASCII-only subject
    expect(m.html).toContain('LAUNCH15');
    expect(m.html).toContain('مصورة ثانية');
    expect(m.html).toContain('6,440 SAR');
    expect(m.html).toContain('3,220 SAR');                         // 50% deposit
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
    expect(m.text).toContain('بعد 61 يوم');                       // days to event
  });

  it('P&L matches the shared engine on ex-VAT revenue', () => {
    const pl = briefPL(base);
    expect(pl.revenueExVat).toBe(5600);
    expect(Number.isFinite(pl.ownerCompensatedMargin)).toBe(true);
    expect(renderPhotographerBrief(base).html).toContain(`${pl.ownerCompensatedMarginPct}%`);
  });

  it('printless booking drops the album rungs and album cost', () => {
    const tl = briefTimeline('2026-12-01', true, '2026-10-01');
    expect(tl.some(r => r.titleEn.includes('album'))).toBe(false);
    expect(briefTimeline('2026-12-01', false, '2026-10-01').length).toBe(tl.length + 2);
    expect(briefPL({ ...base, noPrint: true }).costAlbumPrint).toBe(0);
  });

  it('timeline carries contract deadlines and lapse', () => {
    const gallery = briefTimeline('2026-12-01', false, '2026-10-01').find(r => r.titleEn.startsWith('Deliver gallery'))!;
    expect(gallery.target).toBe('2027-03-31');
    expect(gallery.deadline).toBe('2027-05-30');
    expect(gallery.daysLeft).toBe(241);
  });

  it('modification brief lists what changed', () => {
    const m = renderPhotographerBrief({ ...base, kind: 'reschedule', changeLines: ['الموعد: 2026-11-01 ← 2026-12-01'] });
    expect(m.subject).toContain('Booking rescheduled');
    expect(m.html).toContain('ما الذي تغيّر');
    expect(m.text).toContain('2026-11-01 ← 2026-12-01');
  });

  it('maps a stored booking row (resend path)', () => {
    const d = briefFromBookingRow({
      booking_ref: 'AT-X', customer_name: 'س', customer_phone: '+9665', event_date: '2026-12-01',
      package_id: 3, addon_ids: ['a', 'b'], subtotal: 5600, vat: 840, total: 6440,
      discount_code: 'LAUNCH15', discount_amount: 800, discount_kind: 'percent',
      location: 'jubail — قاعة', manage_token: 'tok',
    }, { name_ar: 'الكلاسيكية', price: 5500 },
    [{ name_ar: 'أ', price: 900, active: true }, { name_ar: 'ب', price: 1, active: false }],
    { kind: 'new', siteOrigin: 'https://x', today: '2026-10-01' });
    expect(d.grossSubtotal).toBe(6400);
    expect(d.addons).toHaveLength(1);
    expect(d.discount?.code).toBe('LAUNCH15');
    expect(d.manageUrl).toBe('https://x/#/manage/tok');
  });
});
