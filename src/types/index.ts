// ===== PACKAGES & PRICING =====
export interface Package {
  id: number;
  nameAr: string;
  nameEn: string;
  price: number;
  durationHours: number;
  editedPhotos: number;
  album: string;
  video: boolean;
  description: string;
  features: string[];
  badge?: string;
  isPopular?: boolean;
}

// ===== ADD-ONS =====
export interface AddOn {
  id: string;
  iconEmoji: string;
  nameAr: string;
  nameEn: string;
  price: number;
  quantity?: number;
}

// ===== CUSTOMER BOOKING =====
export interface BookingFormData {
  fullName: string;
  phone: string; // +966 format
  email?: string;
  eventDate: string; // ISO date
  eventTime: string;
  city: string;
  location?: string;
  specialRequests?: string;
  agreeToTerms: boolean;
}

// ===== BOOKING REQUEST (TO SUPABASE) =====
export type EventType =
  | 'wedding'
  | 'engagement'
  | 'portrait'
  | 'corporate'
  | 'product'
  | 'real_estate'
  | 'industrial'
  | 'other';

export interface CreateBookingRequest {
  customerId?: string;
  packageId: number | string;
  addOnIds: string[];
  eventDate: string;
  eventTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  /** Structured city key (jubail / dammam / khobar / qatif / ahsa / riyadh /
   *  other) — used by the server-side Edge Function for fee lookup. */
  city?: string;
  location: string;
  specialRequests?: string;

  /** ── Shoot-logistics (audit append, 2026-05) ─────────────────────────
   *  Captured so the studio can quote staffing and prep without a callback.
   *  All optional from the client's perspective — server may default. */
  eventType?: EventType;
  /** Approximate attendee count — drives second-photographer recommendation. */
  guestCount?: number | null;
  /** Optional must-have shot list ("bride with grandmother", "ring close-up"…). */
  shotList?: string;

  /** ── Consent snapshots captured at booking time (audit append) ──────
   *  Persisted alongside the booking so we have an immutable record of
   *  what the customer agreed to, even if profile flags change later. */
  tcAccepted?: boolean;
  pdplConsent?: boolean;
  /** Separate, explicit, revocable. PDPL-compliant — NEVER bundle with the
   *  general PDPL consent above. */
  whatsappOptIn?: boolean;

  /** subtotal / vat / total are echoed to the server but the Edge Function
   *  (Patch C-3) recomputes them from packages + addons and ignores these. */
  subtotal: number;
  vat: number;
  total: number;
  /** Discount code typed by the bride. Server re-validates via
   *  redeem_discount_code() and re-computes the discount amount
   *  authoritatively. Client value is for display only. */
  discountCode?: string | null;
}

// ===== BOOKING RESPONSE (FROM SUPABASE) =====
export interface BookingResponse {
  id: string;
  bookingRef: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
  eventDate: string;
  total: number;
}


// ===== BOOKING SUMMARY STATE =====
export interface BookingSummary {
  selectedPackage: Package | null;
  selectedAddOns: AddOn[];
  subtotal: number;
  vat: number;
  total: number;
  isLoading: boolean;
  error?: string;
}

// ===== DESIGN THEME =====
export interface ThemeColors {
  champagne: string;
  warmSand: string;
  deepBronze: string;
  softIvory: string;
  editorialBlack: string;
}

// ===== APP CONTEXT =====
export interface AppContextType {
  language: 'ar' | 'en';
  design: 1 | 2;
  booking: BookingSummary;
  setLanguage: (lang: 'ar' | 'en') => void;
  setDesign: (design: 1 | 2) => void;
  updateBooking: (summary: Partial<BookingSummary>) => void;
}
