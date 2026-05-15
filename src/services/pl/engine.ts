// P&L calculation engine — spec Sections 4–8
// All monetary values in SAR. Margins computed on ex-VAT revenue per spec Section 11.1.

import type { CostConfig, BookingCostInputs, BookingPL } from './types';

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
