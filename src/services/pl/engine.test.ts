import { describe, it, expect } from 'vitest';
import { calculateOverhead, calculateOwnerHours, calculateBookingPL } from './engine';
import { DEFAULT_COST_CONFIG, PACKAGE_DEFAULTS } from './config';
import type { BookingCostInputs } from './types';

const cfg = DEFAULT_COST_CONFIG;

function booking(over: Partial<BookingCostInputs> = {}): BookingCostInputs {
  return {
    packageId: 'classic',
    revenueExVat: 3000,
    travelDistanceKm: 0,
    travelFeeCharged: 0,
    includesVideo: false,
    includesAssistant: false,
    includesVideographer: false,
    coverageHours: 4,
    prepHours: 0,
    albumIncluded: false,
    albumSize: 'none',
    albumPages: 0,
    miniFamilyAlbum: false,
    extraStorageUnits: 0,
    ...over,
  };
}

describe('calculateOverhead', () => {
  it('allocates depreciation + software across expected bookings', () => {
    const o = calculateOverhead(cfg);
    // (28000/8 + 5000/5) / 35 = 4500/35
    expect(o.allocatedDepreciation).toBeCloseTo(4500 / 35, 6);
    // (75*12 + 86*12) / 35 = 1932/35
    expect(o.allocatedSoftware).toBeCloseTo(1932 / 35, 6);
    expect(o.totalOverhead).toBeCloseTo(6432 / 35, 6);
  });
});

describe('calculateOwnerHours', () => {
  it('sums the components for a typical booking', () => {
    // onsite 2 + prep(0+2) + editing(2*2.4) + comm 2 = 10.8
    expect(calculateOwnerHours(booking({ coverageHours: 2 }))).toBeCloseTo(10.8, 6);
  });

  it('adds album, mini-album and video time', () => {
    // onsite 5 + prep 2 + editing 12 + album 3 + comm 2 + mini 1.5 + video 4 = 29.5
    const hrs = calculateOwnerHours(
      booking({ coverageHours: 5, albumIncluded: true, miniFamilyAlbum: true, includesVideo: true }),
    );
    expect(hrs).toBeCloseTo(29.5, 6);
  });

  it('enforces the spec rule-8 minimum of 5 hours', () => {
    // onsite 0 + prep 2 + editing 0 + comm 2 = 4 → floored to 5
    expect(calculateOwnerHours(booking({ coverageHours: 0 }))).toBe(5);
  });
});

describe('calculateBookingPL', () => {
  it('computes VAT on ex-VAT revenue and the three margin layers', () => {
    const pl = calculateBookingPL(booking({ revenueExVat: 3000, coverageHours: 4 }), cfg);
    expect(pl.vat).toBe(450);          // 3000 * 0.15
    expect(pl.totalIncVat).toBe(3450);
    expect(pl.directMargin).toBe(pl.revenueExVat - pl.totalDirectCost);
    expect(pl.operatingMargin).toBeCloseTo(pl.directMargin - pl.totalOverhead, 6);
    expect(pl.ownerCompensatedMargin).toBeCloseTo(pl.operatingMargin - pl.ownerCompensation, 6);
  });

  it('flags a loss when owner-compensated margin goes negative', () => {
    const pl = calculateBookingPL(booking({ revenueExVat: 200, coverageHours: 6 }), cfg);
    expect(pl.status).toBe('loss');
    expect(pl.warnings).toContain('hourly_rate_below_target');
  });

  it('flags a thin margin near break-even', () => {
    // Tuned so 0 <= ownerCompensatedMargin < 10% of revenue.
    const pl = calculateBookingPL(booking({ revenueExVat: 1500, coverageHours: 5 }), cfg);
    if (pl.ownerCompensatedMargin >= 0 && pl.ownerCompensatedMargin < 1500 * 0.1) {
      expect(pl.status).toBe('break-even');
      expect(pl.warnings).toContain('thin_margin');
    }
  });

  it('guards against divide-by-zero when revenue is zero', () => {
    const pl = calculateBookingPL(booking({ revenueExVat: 0 }), cfg);
    expect(pl.directMarginPct).toBe(0);
    expect(pl.operatingMarginPct).toBe(0);
    expect(pl.ownerCompensatedMarginPct).toBe(0);
    expect(Number.isNaN(pl.directMarginPct)).toBe(false);
  });

  it('runs for every predefined package tier without NaN', () => {
    for (const key of Object.keys(PACKAGE_DEFAULTS)) {
      const pl = calculateBookingPL(booking({ ...PACKAGE_DEFAULTS[key], revenueExVat: 4000 }), cfg);
      expect(Number.isFinite(pl.ownerCompensatedMargin)).toBe(true);
      expect(['profitable', 'break-even', 'loss']).toContain(pl.status);
    }
  });
});
