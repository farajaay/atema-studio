import { describe, it, expect } from 'vitest';
import {
  applyDiscountToTotals,
  formatDiscountReason,
  formatDiscountKindDescription,
  previewDiscountCode,
} from './discount';

describe('applyDiscountToTotals', () => {
  it('subtracts the discount and applies VAT to the net subtotal', () => {
    expect(applyDiscountToTotals({ grossSubtotal: 1000, discountAmount: 100 }))
      .toEqual({ netSubtotal: 900, vat: 135, total: 1035 });
  });

  it('floors the net subtotal at zero when the discount exceeds it', () => {
    expect(applyDiscountToTotals({ grossSubtotal: 100, discountAmount: 500 }))
      .toEqual({ netSubtotal: 0, vat: 0, total: 0 });
  });

  it('honours a custom VAT rate', () => {
    expect(applyDiscountToTotals({ grossSubtotal: 1000, discountAmount: 0, vatRate: 0 }))
      .toEqual({ netSubtotal: 1000, vat: 0, total: 1000 });
  });

  it('rounds gross and discount before subtracting', () => {
    expect(applyDiscountToTotals({ grossSubtotal: 999.6, discountAmount: 99.4 }))
      .toEqual({ netSubtotal: 901, vat: 135, total: 1036 });
  });
});

describe('formatDiscountReason', () => {
  it('returns the localised string for a known reason', () => {
    expect(formatDiscountReason('ok', 'en')).toBe('Code applied');
    expect(formatDiscountReason('expired', 'ar')).toBe('انتهت صلاحية الكود');
  });

  it('returns empty string for the empty reason', () => {
    expect(formatDiscountReason('empty', 'en')).toBe('');
  });
});

describe('formatDiscountKindDescription', () => {
  it('describes percent and flat codes in both languages', () => {
    expect(formatDiscountKindDescription('percent', 15, 'en')).toBe('15% off');
    expect(formatDiscountKindDescription('flat', 500, 'en')).toBe('500 SAR off');
    expect(formatDiscountKindDescription('percent', 15, 'ar')).toBe('خصم 15%');
    expect(formatDiscountKindDescription('flat', 500, 'ar')).toBe('خصم 500 ر.س');
  });
});

describe('previewDiscountCode (demo / offline mode)', () => {
  // supabase is null without env vars, so these exercise the offline branch.
  it('returns empty for blank input', async () => {
    expect(await previewDiscountCode('', 1000)).toMatchObject({ reason: 'empty', appliedAmount: 0 });
  });

  it('treats a 4+ char code as 10% off in offline mode', async () => {
    expect(await previewDiscountCode('SAVE10', 1000)).toMatchObject({
      reason: 'ok',
      appliedKind: 'percent',
      appliedAmount: 100,
      codeValue: 10,
    });
  });

  it('rejects too-short codes as not_found', async () => {
    expect(await previewDiscountCode('AB', 1000)).toMatchObject({ reason: 'not_found' });
  });
});
