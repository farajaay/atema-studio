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
export interface CreateBookingRequest {
  customerId?: string;
  packageId: number;
  addOnIds: string[];
  eventDate: string;
  eventTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  location: string;
  specialRequests?: string;
  subtotal: number;
  vat: number;
  total: number;
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

// ===== RAED PAYMENT (STUB) =====
export interface RaedPaymentIntent {
  orderId: string;
  amount: number; // SAR
  currency: 'SAR';
  description: string;
  customerEmail: string;
  customerPhone: string;
  redirectUrl: string;
}

export interface RaedPaymentResponse {
  status: 'success' | 'pending' | 'failed';
  transactionId?: string;
  paymentUrl?: string;
  message: string;
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
