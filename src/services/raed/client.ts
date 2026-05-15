/**
 * ATEMA Studio — Raed Payment Gateway (STUB)
 * 
 * This file contains STUBBED Raed API calls.
 * Replace the implementation when ready for production.
 * 
 * TODO[RAED-INTEGRATION]: 
 * 1. Get Raed API credentials from admin panel
 * 2. Replace BASE_URL with actual endpoint
 * 3. Test webhook integration for payment status updates
 */

import { RaedPaymentIntent, RaedPaymentResponse } from '../types';

// ===== CONFIGURATION =====
const RAED_CONFIG = {
  // Replace with your actual Raed credentials
  apiKey: process.env.REACT_APP_RAED_API_KEY || 'raed_test_key_xxx',
  merchantId: process.env.REACT_APP_RAED_MERCHANT_ID || 'merchant_xxx',
  baseUrl: process.env.REACT_APP_RAED_BASE_URL || 'https://api.raed.sa/api/v1',
  mode: (process.env.REACT_APP_RAED_MODE || 'sandbox') as 'sandbox' | 'production'
};

// ===== MOCK RESPONSES (FOR DEVELOPMENT) =====
const mockSuccessResponse = (orderId: string): RaedPaymentResponse => ({
  status: 'success',
  transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  paymentUrl: `https://checkout.raed.sa/pay?order_id=${orderId}`,
  message: 'Payment intent created successfully'
});

const mockErrorResponse = (): RaedPaymentResponse => ({
  status: 'failed',
  message: 'Payment processing failed. Please try again.'
});

// ===== HELPER FUNCTIONS =====

/**
 * Generate unique order ID for this booking
 */
function generateOrderId(): string {
  return `ATEMA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

/**
 * Validate Saudi phone number format
 */
function isValidSaudiPhone(phone: string): boolean {
  return /^(\+966|00966|0)?5[0-9]{8}$/.test(phone.replace(/\s/g, ''));
}

/**
 * Format phone to international format (+966...)
 */
function formatPhoneToInternational(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.length === 9) {
    cleaned = '966' + cleaned;
  }
  return `+${cleaned}`;
}

// ===== MAIN RAED PAYMENT FUNCTION =====

/**
 * Create payment intent with Raed
 * 
 * STUB: Currently returns mock success. Replace with actual API call.
 * 
 * @param bookingData - Booking details
 * @returns Payment response with checkout URL
 */
export async function createRaedPaymentIntent(
  bookingData: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    amount: number;
    bookingRef: string;
    description: string;
  }
): Promise<RaedPaymentResponse> {
  try {
    // ===== VALIDATION =====
    if (!bookingData.customerEmail || !bookingData.customerEmail.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (!isValidSaudiPhone(bookingData.customerPhone)) {
      throw new Error('Invalid Saudi phone number');
    }

    if (bookingData.amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // ===== STUB IMPLEMENTATION =====
    console.log('[STUB] createRaedPaymentIntent called with:', {
      ...bookingData,
      mode: RAED_CONFIG.mode
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock success response (85% chance) or failure (15% chance)
    const isSuccess = Math.random() > 0.15;

    if (isSuccess) {
      const orderId = generateOrderId();
      console.log('[STUB] Payment intent created:', orderId);
      return mockSuccessResponse(orderId);
    } else {
      console.log('[STUB] Payment processing failed (simulated)');
      return mockErrorResponse();
    }

    // ===== PRODUCTION IMPLEMENTATION (UNCOMMENT WHEN READY) =====
    /*
    const orderId = generateOrderId();
    const normalizedPhone = formatPhoneToInternational(bookingData.customerPhone);

    const payload = {
      order_id: orderId,
      amount: bookingData.amount,
      currency: 'SAR',
      customer_email: bookingData.customerEmail,
      customer_phone: normalizedPhone,
      customer_name: bookingData.customerName,
      description: bookingData.description,
      booking_ref: bookingData.bookingRef,
      success_url: `${window.location.origin}/booking/success?ref=${bookingData.bookingRef}`,
      failure_url: `${window.location.origin}/booking/failure?ref=${bookingData.bookingRef}`,
      cancel_url: `${window.location.origin}/booking/cancel?ref=${bookingData.bookingRef}`
    };

    const response = await fetch(`${RAED_CONFIG.baseUrl}/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAED_CONFIG.apiKey}`,
        'X-Merchant-ID': RAED_CONFIG.merchantId
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Payment gateway error');
    }

    const result = await response.json();

    return {
      status: 'success',
      transactionId: result.transaction_id,
      paymentUrl: result.payment_url,
      message: 'Payment intent created successfully'
    };
    */

  } catch (error) {
    console.error('[RAED] Payment error:', error);
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ===== WEBHOOK HANDLER (FOR PAYMENT STATUS UPDATES) =====

/**
 * Handle payment status webhook from Raed
 * Call this when Raed sends payment confirmation
 */
export function handleRaedWebhook(payload: any): void {
  // TODO[RAED-INTEGRATION]: Verify webhook signature
  // TODO[RAED-INTEGRATION]: Update booking status in Supabase
  // TODO[RAED-INTEGRATION]: Send WhatsApp notification to customer

  console.log('[RAED-WEBHOOK] Payment update:', {
    orderId: payload.order_id,
    status: payload.status,
    transactionId: payload.transaction_id,
    amount: payload.amount
  });

  // This will be called from your backend when Raed sends the webhook
}

// ===== HELPER: VALIDATE PAYMENT RESPONSE =====

export function isValidPaymentResponse(response: RaedPaymentResponse): boolean {
  return (
    response.status === 'success' &&
    !!response.transactionId &&
    !!response.paymentUrl
  );
}

// ===== EXPORT CONFIG FOR TESTING =====
export { RAED_CONFIG };
