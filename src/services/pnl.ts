// ATEMA STUDIO — Studio-wide P&L aggregation
//
// Wraps the per-booking engine (src/services/pl/engine.ts) and rolls many
// bookings into monthly / quarterly / yearly summaries with a per-package
// breakdown inside each bucket.
//
// Used by:
//   - src/components/StudioPLDashboard.tsx (admin "Profit & Loss" tab)
//
// Revenue rule (chosen 2026-05-20):
//   A booking counts in the P&L if it has reached commitment — i.e.
//   status in (confirmed | completed) OR payment_status in (paid |
//   awaiting_transfer). Cancelled and refunded never count.
//
// Per-package input defaults come from src/services/pl/config.ts. Couture
// (package id 6) is not in that table, so we supply sensible defaults
// inline below — same shape as the spec-defined packages.

import type { Booking } from '../hooks/useAdminData';
import { calculateBookingPL } from './pl/engine';
import {
  DEFAULT_COST_CONFIG,
  DEFAULT_PACKAGE_INPUTS,
  PACKAGE_DEFAULTS,
} from './pl/config';
import type { BookingCostInputs, CostConfig } from './pl/types';

// ── Package id ↔ defaults / display name ─────────────────────────────────
// Per database/seed-packages-2026-05.sql (ids 1..6).
export const PACKAGE_KEY_BY_ID: Record<number, string> = {
  1: 'engagement',
  2: 'base',
  3: 'classic',
  4: 'royal',
  5: 'signature',
  6: 'couture',
};

export const PACKAGE_NAME_AR: Record<number, string> = {
  1: 'الخطوبة',
  2: 'الأساسية',
  3: 'الكلاسيكية',
  4: 'الملكية',
  5: 'التوقيع',
  6: 'ATEMA كوتور',
};

export const PACKAGE_NAME_EN: Record<number, string> = {
  1: 'Engagement',
  2: 'Base',
  3: 'Classic',
  4: 'Royal',
  5: 'Signature',
  6: 'Couture',
};

// Couture is missing from PACKAGE_DEFAULTS in pl/config.ts — supply here.
const COUTURE_DEFAULTS = {
  coverageHours: 8, prepHours: 1,
  includesVideo: true, includesAssistant: true, includesVideographer: true,
  albumIncluded: true, albumSize: 'A3' as const, albumPages: 16,
  miniFamilyAlbum: true,
};

function inputsForBooking(b: Booking): BookingCostInputs {
  const key = PACKAGE_KEY_BY_ID[b.package_id] ?? '';
  const defaults =
    b.package_id === 6 ? COUTURE_DEFAULTS
    : (PACKAGE_DEFAULTS[key] ?? DEFAULT_PACKAGE_INPUTS);

  return {
    packageId: b.package_id,
    revenueExVat: b.subtotal,
    travelDistanceKm: 0,
    travelFeeCharged:  0,
    extraStorageUnits: 0,
    ...defaults,
  };
}

// ── Inclusion rule ───────────────────────────────────────────────────────
export function isPLRevenueBooking(b: Booking): boolean {
  if (b.status === 'cancelled') return false;
  if (b.payment_status === 'refunded') return false;
  if (b.status === 'confirmed' || b.status === 'completed') return true;
  if (b.payment_status === 'paid') return true;
  // 'awaiting_transfer' may appear as a string in older rows even though
  // the canonical TS union is unpaid|paid|refunded.
  if ((b.payment_status as string) === 'awaiting_transfer') return true;
  return false;
}

// ── Bucket types ─────────────────────────────────────────────────────────
export interface PackageBucket {
  packageId: number;
  bookingCount: number;
  revenueExVat: number;
  totalDirectCost: number;
  trueProfit: number;
  marginPct: number;
}

export interface PeriodAggregate {
  /** '2026-05' for month, '2026-Q2' for quarter, '2026' for year, 'total' for grand */
  period: string;
  bookingCount: number;
  revenueExVat: number;
  vat: number;
  totalIncVat: number;
  totalDirectCost: number;
  totalOverhead: number;
  totalOwnerComp: number;
  directMargin: number;
  operatingMargin: number;
  trueProfit: number;
  marginPct: number;
  byPackage: Record<number, PackageBucket>;
}

function blankAggregate(period: string): PeriodAggregate {
  return {
    period, bookingCount: 0,
    revenueExVat: 0, vat: 0, totalIncVat: 0,
    totalDirectCost: 0, totalOverhead: 0, totalOwnerComp: 0,
    directMargin: 0, operatingMargin: 0, trueProfit: 0, marginPct: 0,
    byPackage: {},
  };
}

function finalisePct(agg: PeriodAggregate): void {
  agg.marginPct = agg.revenueExVat > 0 ? (agg.trueProfit / agg.revenueExVat) * 100 : 0;
  for (const id of Object.keys(agg.byPackage)) {
    const p = agg.byPackage[Number(id)];
    p.marginPct = p.revenueExVat > 0 ? (p.trueProfit / p.revenueExVat) * 100 : 0;
  }
}

// ── Per-month aggregation (bucket key = event_date YYYY-MM) ─────────────
export function aggregateMonthly(
  bookings: Booking[],
  cfg: CostConfig = DEFAULT_COST_CONFIG,
): PeriodAggregate[] {
  const buckets = new Map<string, PeriodAggregate>();

  for (const b of bookings) {
    if (!isPLRevenueBooking(b)) continue;
    if (!b.event_date) continue;
    const ym = b.event_date.slice(0, 7); // 'YYYY-MM'
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;

    const pl = calculateBookingPL(inputsForBooking(b), cfg);

    let agg = buckets.get(ym);
    if (!agg) { agg = blankAggregate(ym); buckets.set(ym, agg); }

    agg.bookingCount    += 1;
    agg.revenueExVat    += pl.revenueExVat;
    agg.vat             += pl.vat;
    agg.totalIncVat     += pl.totalIncVat;
    agg.totalDirectCost += pl.totalDirectCost;
    agg.totalOverhead   += pl.totalOverhead;
    agg.totalOwnerComp  += pl.ownerCompensation;
    agg.directMargin    += pl.directMargin;
    agg.operatingMargin += pl.operatingMargin;
    agg.trueProfit      += pl.ownerCompensatedMargin;

    const pkg = agg.byPackage[b.package_id] ?? {
      packageId: b.package_id, bookingCount: 0,
      revenueExVat: 0, totalDirectCost: 0, trueProfit: 0, marginPct: 0,
    };
    pkg.bookingCount    += 1;
    pkg.revenueExVat    += pl.revenueExVat;
    pkg.totalDirectCost += pl.totalDirectCost;
    pkg.trueProfit      += pl.ownerCompensatedMargin;
    agg.byPackage[b.package_id] = pkg;
  }

  for (const agg of buckets.values()) finalisePct(agg);
  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
}

// ── Roll monthly into quarter or year buckets ───────────────────────────
export type Period = 'month' | 'quarter' | 'year';

export function rollupBy(
  period: Period,
  monthly: PeriodAggregate[],
): PeriodAggregate[] {
  if (period === 'month') return monthly;

  const buckets = new Map<string, PeriodAggregate>();
  for (const m of monthly) {
    const [yStr, moStr] = m.period.split('-');
    const y  = yStr;
    const mo = Number(moStr);
    const key = period === 'year' ? y : `${y}-Q${Math.ceil(mo / 3)}`;

    let agg = buckets.get(key);
    if (!agg) { agg = blankAggregate(key); buckets.set(key, agg); }

    agg.bookingCount    += m.bookingCount;
    agg.revenueExVat    += m.revenueExVat;
    agg.vat             += m.vat;
    agg.totalIncVat     += m.totalIncVat;
    agg.totalDirectCost += m.totalDirectCost;
    agg.totalOverhead   += m.totalOverhead;
    agg.totalOwnerComp  += m.totalOwnerComp;
    agg.directMargin    += m.directMargin;
    agg.operatingMargin += m.operatingMargin;
    agg.trueProfit      += m.trueProfit;

    for (const idStr of Object.keys(m.byPackage)) {
      const id  = Number(idStr);
      const src = m.byPackage[id];
      const dst = agg.byPackage[id] ?? {
        packageId: id, bookingCount: 0,
        revenueExVat: 0, totalDirectCost: 0, trueProfit: 0, marginPct: 0,
      };
      dst.bookingCount    += src.bookingCount;
      dst.revenueExVat    += src.revenueExVat;
      dst.totalDirectCost += src.totalDirectCost;
      dst.trueProfit      += src.trueProfit;
      agg.byPackage[id] = dst;
    }
  }

  for (const agg of buckets.values()) finalisePct(agg);
  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
}

// ── Grand total across all rows (e.g. for KPI strip) ────────────────────
export function totalSummary(rows: PeriodAggregate[]): PeriodAggregate {
  const total = blankAggregate('total');
  for (const r of rows) {
    total.bookingCount    += r.bookingCount;
    total.revenueExVat    += r.revenueExVat;
    total.vat             += r.vat;
    total.totalIncVat     += r.totalIncVat;
    total.totalDirectCost += r.totalDirectCost;
    total.totalOverhead   += r.totalOverhead;
    total.totalOwnerComp  += r.totalOwnerComp;
    total.directMargin    += r.directMargin;
    total.operatingMargin += r.operatingMargin;
    total.trueProfit      += r.trueProfit;

    for (const idStr of Object.keys(r.byPackage)) {
      const id  = Number(idStr);
      const src = r.byPackage[id];
      const dst = total.byPackage[id] ?? {
        packageId: id, bookingCount: 0,
        revenueExVat: 0, totalDirectCost: 0, trueProfit: 0, marginPct: 0,
      };
      dst.bookingCount    += src.bookingCount;
      dst.revenueExVat    += src.revenueExVat;
      dst.totalDirectCost += src.totalDirectCost;
      dst.trueProfit      += src.trueProfit;
      total.byPackage[id] = dst;
    }
  }
  finalisePct(total);
  return total;
}

// ── Period-label formatting (bilingual) ─────────────────────────────────
const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];
const MONTHS_EN = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

export function labelForPeriod(period: string, lang: 'ar' | 'en'): string {
  // 'YYYY-MM' → month
  const mMatch = /^(\d{4})-(\d{2})$/.exec(period);
  if (mMatch) {
    const y  = Number(mMatch[1]);
    const mo = Number(mMatch[2]) - 1;
    if (mo >= 0 && mo < 12) {
      return lang === 'ar' ? `${MONTHS_AR[mo]} ${y}` : `${MONTHS_EN[mo]} ${y}`;
    }
  }
  // 'YYYY-QN' → quarter
  const qMatch = /^(\d{4})-Q([1-4])$/.exec(period);
  if (qMatch) {
    return lang === 'ar'
      ? `الربع ${qMatch[2]} · ${qMatch[1]}`
      : `Q${qMatch[2]} ${qMatch[1]}`;
  }
  // 'YYYY' → year
  if (/^\d{4}$/.test(period)) return period;
  return period;
}
