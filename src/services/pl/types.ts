// P&L types — source of truth: ATEMA-PL-CALCULATION-SPEC.md

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
