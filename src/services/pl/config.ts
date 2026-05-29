import type { CostConfig, BookingCostInputs } from './types';

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
type PackageDefaults = Omit<BookingCostInputs, 'packageId' | 'revenueExVat' | 'travelDistanceKm' | 'travelFeeCharged' | 'extraStorageUnits'>;

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
