import { describe, it, expect } from 'vitest';
import {
  buildContractData, buildInvoiceData,
  type RegenBooking, type RegenPackage, type RegenAddon,
} from './documents';
import { generateInvoiceHTML } from './invoice';

const NOW = new Date('2026-06-12T12:00:00Z');

function booking(over: Partial<RegenBooking> = {}): RegenBooking {
  return {
    id: 'b-1',
    booking_ref: 'ATEMA-260612-ABCDEFGH',
    customer_name: 'نورة',
    customer_phone: '+966512345678',
    package_id: 4,
    addon_ids: ['henna'],
    event_date: '2026-09-01',
    event_time: '18:00',
    location: 'الجبيل',
    subtotal: 12900, vat: 1935, total: 14835,
    payment_status: 'paid',
    ...over,
  };
}

const PKG: RegenPackage = {
  name_ar: 'الباقة الملكية', name_en: 'Royal',
  duration_hours: 5, edited_photos: 400, editorial_photos: 4,
};
const ADDONS: RegenAddon[] = [
  { id: 'henna', name_ar: 'تغطية ليلة الحناء', name_en: 'Henna night coverage', price: 2400 },
];

describe('buildContractData', () => {
  it('halves the total into deposit + remaining', () => {
    const d = buildContractData(booking(), PKG, ADDONS, NOW);
    expect(d.deposit).toBe(Math.round(14835 * 0.5));
    expect(d.deposit + d.remaining).toBe(14835);
  });

  it('dates the contract at regeneration time and maps catalogue fields', () => {
    const d = buildContractData(booking(), PKG, ADDONS, NOW);
    expect(d.contractDate).toBe('2026-06-12');
    expect(d.packageNameAr).toBe('الباقة الملكية');
    expect(d.durationHours).toBe(5);
    expect(d.editorialPhotos).toBe(4);
    expect(d.addons).toEqual(['تغطية ليلة الحناء']);
  });

  it('omits the discount block when no code was applied', () => {
    const d = buildContractData(booking(), PKG, ADDONS, NOW);
    expect(d.discount).toBeNull();
    expect(d.grossSubtotal).toBeUndefined();
  });

  it('reconstructs a percent discount from the persisted amount', () => {
    // 15% of gross 12,000 = 1,800 → stored subtotal 10,200
    const d = buildContractData(booking({
      subtotal: 10200, discount_code: 'LAUNCH15',
      discount_amount: 1800, discount_kind: 'percent',
    }), PKG, ADDONS, NOW);
    expect(d.discount).toEqual({ code: 'LAUNCH15', amount: 1800, kind: 'percent', value: 15 });
    expect(d.grossSubtotal).toBe(12000);
  });

  it('passes a flat discount through with value = amount', () => {
    const d = buildContractData(booking({
      subtotal: 12400, discount_code: 'FLAT500',
      discount_amount: 500, discount_kind: 'flat',
    }), PKG, ADDONS, NOW);
    expect(d.discount).toEqual({ code: 'FLAT500', amount: 500, kind: 'flat', value: 500 });
  });
});

describe('buildInvoiceData', () => {
  it('marks a paid booking paid with the deposit recorded', () => {
    const d = buildInvoiceData(booking(), PKG, ADDONS, 'INV-2606-ABCDE', undefined, NOW);
    expect(d.paymentState).toBe('paid');
    expect(d.depositPaid).toBe(Math.round(14835 * 0.5));
  });

  it('marks an unpaid booking pending with no deposit', () => {
    const d = buildInvoiceData(
      booking({ payment_status: 'unpaid' }), PKG, ADDONS, 'INV-2606-ABCDE', undefined, NOW);
    expect(d.paymentState).toBe('pending');
    expect(d.depositPaid).toBe(0);
  });

  it('keeps awaiting_transfer visible on the badge state', () => {
    const d = buildInvoiceData(
      booking({ payment_status: 'awaiting_transfer' }), PKG, ADDONS, 'INV-2606-ABCDE', undefined, NOW);
    expect(d.paymentState).toBe('awaiting_transfer');
  });

  it('renders the paid badge through paymentState even with method pending', () => {
    const d = buildInvoiceData(booking(), PKG, ADDONS, 'INV-2606-ABCDE', undefined, NOW);
    const html = generateInvoiceHTML(d);
    expect(html).toContain('مدفوعة — Paid');
    expect(html).not.toContain('بانتظار الدفع');
  });
});
