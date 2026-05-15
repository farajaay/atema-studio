/**
 * ATEMA Studio — Booking API (Supabase)
 * 
 * Stubs for Supabase Edge Functions
 * Replace with actual API calls when backend is ready
 */

import { CreateBookingRequest, BookingResponse } from '../types';

const SUPABASE_CONFIG = {
  url: process.env.REACT_APP_SUPABASE_URL || 'https://your-project.supabase.co',
  anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key'
};

// ===== MOCK RESPONSE =====
function generateBookingRef(): string {
  return `ATEMA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

const mockBookingResponse = (req: CreateBookingRequest): BookingResponse => ({
  id: `booking_${Date.now()}`,
  bookingRef: generateBookingRef(),
  status: 'pending',
  createdAt: new Date().toISOString(),
  eventDate: req.eventDate,
  total: req.total
});

// ===== API: CREATE BOOKING =====

/**
 * Create a new booking in Supabase
 * 
 * STUB: Currently returns mock data with realistic booking reference
 * 
 * Actual implementation will:
 * - Call Edge Function: POST /functions/v1/create-booking
 * - Insert row into bookings table
 * - Create notification for WhatsApp dispatch
 * - Return booking reference for confirmation
 * 
 * TODO[BACKEND]: Replace with actual Supabase fetch call
 */
export async function createBooking(
  payload: CreateBookingRequest
): Promise<BookingResponse> {
  try {
    console.log('[BOOKING-STUB] Creating booking:', {
      packageId: payload.packageId,
      total: payload.total,
      eventDate: payload.eventDate
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Return mock success
    const response = mockBookingResponse(payload);
    console.log('[BOOKING-STUB] Booking created:', response.bookingRef);
    return response;

    // ===== PRODUCTION IMPLEMENTATION =====
    /*
    const response = await fetch(
      `${SUPABASE_CONFIG.url}/functions/v1/create-booking`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Booking creation failed');
    }

    return response.json();
    */

  } catch (error) {
    console.error('[BOOKING] Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

// ===== API: GET PACKAGES =====

/**
 * Fetch available packages from Supabase
 * 
 * TODO[BACKEND]: Replace with actual API call to Supabase
 */
export async function getPackages() {
  try {
    // For now, packages are imported from constants
    // In production, fetch from Supabase:
    // const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/packages`, {...});
    
    console.log('[PACKAGES-STUB] Fetching packages (using local constants)');
    return null; // Return null to use local constants in component
  } catch (error) {
    console.error('[PACKAGES] Error:', error);
    throw error;
  }
}

// ===== API: RECORD PAYMENT =====

/**
 * Record payment in Supabase after Raed confirmation
 * 
 * Called from payment success page
 */
export async function recordPayment(
  bookingRef: string,
  transactionId: string,
  amount: number
) {
  try {
    console.log('[PAYMENT-STUB] Recording payment:', {
      bookingRef,
      transactionId,
      amount
    });

    await new Promise(resolve => setTimeout(resolve, 800));

    console.log('[PAYMENT-STUB] Payment recorded successfully');
    return { success: true, bookingRef };

    // ===== PRODUCTION =====
    /*
    const response = await fetch(
      `${SUPABASE_CONFIG.url}/functions/v1/record-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        },
        body: JSON.stringify({
          booking_ref: bookingRef,
          transaction_id: transactionId,
          amount
        })
      }
    );

    if (!response.ok) throw new Error('Payment recording failed');
    return response.json();
    */

  } catch (error) {
    console.error('[PAYMENT] Error:', error);
    throw error;
  }
}

export { SUPABASE_CONFIG };
