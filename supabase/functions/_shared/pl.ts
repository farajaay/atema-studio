// ATEMA STUDIO — per-booking P&L engine (spec: ATEMA-PL-CALCULATION-SPEC.md).
//
// Moved here from src/services/pl/ so the admin P&L views AND the Edge
// Functions (photographer brief — _shared/email-photographer.ts) run the
// exact same numbers. src/services/pl/{types,config,engine}.ts re-export
// from this file; don't fork the math. Dependency-free so it imports in the
// browser, the Deno edge runtime, and Vitest.
//
// All monetary values in SAR. Margins computed on ex-VAT revenue (spec §11.1).

export interface CostConfig {
  // Owner compensation
  ownerHourlyRate: number;
  ownerWorkHoursPerBooking: number;
  // Equipment depreciation (annual)
  cameraValue: number;
  cameraLifespanYears: number;
  lightingValue: number;
  lightingLifespanYears: number;
  // Monthly software subscriptions
  photoshopMonthly: number;
  videoLicenseMonthly: number;
  // Team rates
  assistantHourlyRate: number;
  videographerHourlyRateDefault: number;
  // Production costs (per album)
  albumA4Cost: number;
  albumA3Cost: number;
  albumCoverBoxCost: number;
  storageUnitCost: number;
  // Travel costs
  fuelCostPerKm: number;
  wearAndTearPerKm: number;
  // Business volume
  expectedBookingsPerYear: number;
  // Tax
  vatRate: number;
}

export interface BookingCostInputs {
  packageId: string | number;
  revenueExVat: number;          // booking.subtotal — ground-truth revenue
  travelDistanceKm: number;      // round-trip km driven
  travelFeeCharged: number;      // amount charged to client for travel (already in revenue)
  includesVideo: boolean;
  includesAssistant: boolean;
  includesVideographer: boolean;
  coverageHours: number;
  prepHours: number;
  albumIncluded: boolean;
  albumSize: 'none' | 'A4' | 'A3';
  albumPages: number;
  miniFamilyAlbum: boolean;
  extraStorageUnits: number;
}

export interface BookingPL {
  // Revenue
  revenueExVat: number;
  vat: number;
  totalIncVat: number;
  // Direct costs
  costAssistant: number;
  costVideographer: number;
  costAlbumPrint: number;
  costAlbumPackaging: number;
  costStorage: number;
  costTravel: number;
  costMiscellaneous: number;
  totalDirectCost: number;
  // Overhead allocation
  allocatedDepreciation: number;
  allocatedSoftware: number;
  totalOverhead: number;
  // Owner time
  ownerHours: number;
  ownerCompensation: number;
  // Three profit layers
  directMargin: number;
  directMarginPct: number;
  operatingMargin: number;
  operatingMarginPct: number;
  ownerCompensatedMargin: number;
  ownerCompensatedMarginPct: number;
  // Health
  status: 'profitable' | 'break-even' | 'loss';
  warnings: string[];
}

// Default cost configuration — spec Section 3
export const DEFAULT_COST_CONFIG: CostConfig = {
  ownerHourlyRate:              150,
  ownerWorkHoursPerBooking:     24,
  cameraValue:                  28000,
  cameraLifespanYears:          8,
  lightingValue:                5000,
  lightingLifespanYears:        5,
  photoshopMonthly:             75,
  videoLicenseMonthly:          86,
  assistantHourlyRate:          110,
  videographerHourlyRateDefault:450,
  albumA4Cost:                  450,
  albumA3Cost:                  700,
  albumCoverBoxCost:            300,
  storageUnitCost:              80,
  fuelCostPerKm:                0.5,
  wearAndTearPerKm:             0.15,
  expectedBookingsPerYear:      35,
  vatRate:                      0.15,
};

// Default P&L cost-inputs per package — spec Section 7 package table
export type PackageDefaults = Omit<BookingCostInputs, 'packageId' | 'revenueExVat' | 'travelDistanceKm' | 'travelFeeCharged' | 'extraStorageUnits'>;

// Studio policy: any predesigned package with > 2h of coverage takes an
// on-the-day assistant (lighting holds, BTS, family wrangling). The 2h
// engagement session is the only tier the owner shoots solo. The flag is
// reflected in P&L so direct costs aren't understated.
export const PACKAGE_DEFAULTS: Record<string, PackageDefaults> = {
  engagement: {
    coverageHours: 2, prepHours: 0,
    includesVideo: false, includesAssistant: false, includesVideographer: false,
    albumIncluded: false, albumSize: 'none', albumPages: 0, miniFamilyAlbum: false,
  },
  // The Base package — Customise-tab foundation. 2h, solo (same crew
  // profile as Engagement); add-ons stack on top in actual P&L.
  base: {
    coverageHours: 2, prepHours: 0,
    includesVideo: false, includesAssistant: false, includesVideographer: false,
    albumIncluded: false, albumSize: 'none', albumPages: 0, miniFamilyAlbum: false,
  },
  classic: {
    coverageHours: 4, prepHours: 0,
    includesVideo: false, includesAssistant: true, includesVideographer: false,
    albumIncluded: true, albumSize: 'A4', albumPages: 10, miniFamilyAlbum: false,
  },
  royal: {
    coverageHours: 5, prepHours: 0,
    includesVideo: true, includesAssistant: true, includesVideographer: true,
    albumIncluded: true, albumSize: 'A4', albumPages: 10, miniFamilyAlbum: true,
  },
  signature: {
    coverageHours: 6, prepHours: 0,
    includesVideo: true, includesAssistant: true, includesVideographer: true,
    albumIncluded: true, albumSize: 'A3', albumPages: 12, miniFamilyAlbum: true,
  },
};

// Fallback for unknown package IDs
export const DEFAULT_PACKAGE_INPUTS: PackageDefaults = {
  coverageHours: 4, prepHours: 0,
  includesVideo: false, includesAssistant: false, includesVideographer: false,
  albumIncluded: false, albumSize: 'none', albumPages: 0, miniFamilyAlbum: false,
};


// ── Package id → defaults (was inline in src/services/pnl.ts) ───────────────
// Per database/seed-packages-2026-05.sql (ids 1..6).
export const PACKAGE_KEY_BY_ID: Record<number, string> = {
  1: 'engagement',
  2: 'base',
  3: 'classic',
  4: 'royal',
  5: 'signature',
  6: 'couture',
};

// Couture is missing from PACKAGE_DEFAULTS above — supplied here.
export const COUTURE_DEFAULTS: PackageDefaults = {
  coverageHours: 8, prepHours: 1,
  includesVideo: true, includesAssistant: true, includesVideographer: true,
  albumIncluded: true, albumSize: 'A3', albumPages: 16,
  miniFamilyAlbum: true,
};

/** Default P&L cost inputs for a booking of `packageId` earning
 *  `revenueExVat` (booking.subtotal). A «بدون طباعة» booking prints no
 *  album, so its album cost lines drop to zero. */
export function plInputsForPackage(
  packageId: number, revenueExVat: number, opts?: { noPrint?: boolean },
): BookingCostInputs {
  const key = PACKAGE_KEY_BY_ID[packageId] ?? '';
  const defaults =
    packageId === 6 ? COUTURE_DEFAULTS
    : (PACKAGE_DEFAULTS[key] ?? DEFAULT_PACKAGE_INPUTS);
  const inputs: BookingCostInputs = {
    packageId,
    revenueExVat,
    travelDistanceKm: 0,
    travelFeeCharged:  0,
    extraStorageUnits: 0,
    ...defaults,
  };
  if (opts?.noPrint) {
    inputs.albumIncluded = false;
    inputs.albumSize = 'none';
    inputs.albumPages = 0;
    inputs.miniFamilyAlbum = false;
  }
  return inputs;
}


// ── Overhead allocation (spec Section 4) ─────────────────────────────────────
export function calculateOverhead(cfg: CostConfig): {
  allocatedDepreciation: number;
  allocatedSoftware: number;
  totalOverhead: number;
} {
  const cameraDepreciation = cfg.cameraValue / cfg.cameraLifespanYears;
  const lightingDepreciation = cfg.lightingValue / cfg.lightingLifespanYears;
  const photoshopAnnual = cfg.photoshopMonthly * 12;
  const videoLicenseAnnual = cfg.videoLicenseMonthly * 12;

  const allocatedDepreciation = (cameraDepreciation + lightingDepreciation) / cfg.expectedBookingsPerYear;
  const allocatedSoftware = (photoshopAnnual + videoLicenseAnnual) / cfg.expectedBookingsPerYear;
  const totalOverhead = allocatedDepreciation + allocatedSoftware;

  return { allocatedDepreciation, allocatedSoftware, totalOverhead };
}

// ── Owner hours (spec Section 5) ─────────────────────────────────────────────
export function calculateOwnerHours(booking: BookingCostInputs): number {
  const onsite = booking.coverageHours;
  const prep = booking.prepHours + 2;                    // 2hr baseline setup/travel
  const editing = booking.coverageHours * 2.4;           // scales with coverage
  const albumDesign = booking.albumIncluded ? 3 : 0;
  const communication = 2;
  const miniAlbumHours = booking.miniFamilyAlbum ? 1.5 : 0;
  const videoHours = booking.includesVideo ? 4 : 0;

  const total = onsite + prep + editing + albumDesign + communication + miniAlbumHours + videoHours;
  return Math.max(total, 5);   // spec rule 8: minimum 5 hours
}

// ── Team costs (spec Section 6.1) ─────────────────────────────────────────────
function calculateTeamCosts(booking: BookingCostInputs, cfg: CostConfig) {
  const totalHours = booking.coverageHours + booking.prepHours;
  const costAssistant = booking.includesAssistant
    ? totalHours * cfg.assistantHourlyRate
    : 0;
  const costVideographer = booking.includesVideographer
    ? totalHours * cfg.videographerHourlyRateDefault
    : 0;
  return { costAssistant, costVideographer };
}

// ── Album costs (spec Section 6.2) ─────────────────────────────────────────────
function calculateAlbumCosts(booking: BookingCostInputs, cfg: CostConfig) {
  if (!booking.albumIncluded || booking.albumSize === 'none') {
    return { costAlbumPrint: 0, costAlbumPackaging: 0 };
  }
  const baseAlbumCost = booking.albumSize === 'A3' ? cfg.albumA3Cost : cfg.albumA4Cost;
  const extraPages = Math.max(0, booking.albumPages - 10);
  const extraPagesCost = extraPages * 45;             // 45 SAR/extra page
  const miniAlbumCost = booking.miniFamilyAlbum ? 200 : 0;

  return {
    costAlbumPrint: baseAlbumCost + extraPagesCost + miniAlbumCost,
    costAlbumPackaging: cfg.albumCoverBoxCost,
  };
}

// ── Storage costs (spec Section 6.3) ─────────────────────────────────────────
function calculateStorageCost(booking: BookingCostInputs, cfg: CostConfig): number {
  return cfg.storageUnitCost + (booking.extraStorageUnits * cfg.storageUnitCost);
}

// ── Travel cost (spec Section 6.4) ───────────────────────────────────────────
function calculateTravelCost(distanceKm: number, cfg: CostConfig): number {
  const totalPerKm = cfg.fuelCostPerKm + cfg.wearAndTearPerKm;   // 0.65 SAR/km
  return Math.round(distanceKm * totalPerKm);
}

// ── Master P&L function (spec Section 8) ─────────────────────────────────────
export function calculateBookingPL(
  booking: BookingCostInputs,
  cfg: CostConfig,
): BookingPL {
  // Revenue — use booking's actual charged amount as source of truth
  const revenueExVat = booking.revenueExVat;
  const vat = Math.round(revenueExVat * cfg.vatRate);
  const totalIncVat = revenueExVat + vat;

  // Direct costs
  const { costAssistant, costVideographer } = calculateTeamCosts(booking, cfg);
  const { costAlbumPrint, costAlbumPackaging } = calculateAlbumCosts(booking, cfg);
  const costStorage = calculateStorageCost(booking, cfg);
  const costTravel = calculateTravelCost(booking.travelDistanceKm, cfg);
  const costMiscellaneous = 50;

  const totalDirectCost =
    costAssistant + costVideographer + costAlbumPrint + costAlbumPackaging +
    costStorage + costTravel + costMiscellaneous;

  // Overhead
  const { allocatedDepreciation, allocatedSoftware, totalOverhead } = calculateOverhead(cfg);

  // Owner compensation
  const ownerHours = calculateOwnerHours(booking);
  const ownerCompensation = ownerHours * cfg.ownerHourlyRate;

  // Three margin layers — always on ex-VAT revenue (spec Section 11.1)
  const directMargin = revenueExVat - totalDirectCost;
  const operatingMargin = directMargin - totalOverhead;
  const ownerCompensatedMargin = operatingMargin - ownerCompensation;

  const safePercent = (num: number, denom: number) =>
    denom === 0 ? 0 : Math.round((num / denom) * 1000) / 10;

  // Health status & warnings
  const warnings: string[] = [];
  let status: BookingPL['status'] = 'profitable';

  if (ownerCompensatedMargin < 0) {
    status = 'loss';
    warnings.push('hourly_rate_below_target');
  } else if (ownerCompensatedMargin < revenueExVat * 0.10) {
    status = 'break-even';
    warnings.push('thin_margin');
  }
  if (operatingMargin < 0) warnings.push('not_covering_overhead');
  if (directMargin < 0) warnings.push('below_direct_cost');

  return {
    revenueExVat, vat, totalIncVat,
    costAssistant, costVideographer, costAlbumPrint, costAlbumPackaging,
    costStorage, costTravel, costMiscellaneous, totalDirectCost,
    allocatedDepreciation, allocatedSoftware, totalOverhead,
    ownerHours, ownerCompensation,
    directMargin,          directMarginPct:          safePercent(directMargin, revenueExVat),
    operatingMargin,       operatingMarginPct:       safePercent(operatingMargin, revenueExVat),
    ownerCompensatedMargin, ownerCompensatedMarginPct: safePercent(ownerCompensatedMargin, revenueExVat),
    status, warnings,
  };
}
