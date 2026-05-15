import type { RaedPaymentResponse } from '../../types';

const RAED = {
  apiKey:     import.meta.env.VITE_RAED_API_KEY     as string || '',
  merchantId: import.meta.env.VITE_RAED_MERCHANT_ID  as string || '',
  baseUrl:    import.meta.env.VITE_RAED_BASE_URL     as string || 'https://api.raed.sa/api/v1',
  mode:       (import.meta.env.VITE_RAED_MODE        as 'sandbox' | 'production') || 'sandbox',
};

function orderId() {
  return `ATEMA-${Date.now()}-${Math.random().toString(36).substr(2,9).toUpperCase()}`;
}

function normPhone(phone: string): string {
  let c = phone.replace(/\D/g, '');
  if (c.startsWith('0')) c = c.substring(1);
  if (c.length === 9) c = '966' + c;
  return `+${c}`;
}

function validPhone(phone: string): boolean {
  return /^(\+966|00966|0)?5[0-9]{8}$/.test(phone.replace(/\s/g, ''));
}

export async function createRaedPaymentIntent(data: {
  customerName:  string;
  customerEmail: string;
  customerPhone: string;
  amount:        number;
  bookingRef:    string;
  description:   string;
}): Promise<RaedPaymentResponse> {
  if (!data.customerEmail.includes('@')) return { status:'failed', message:'Invalid email' };
  if (!validPhone(data.customerPhone))   return { status:'failed', message:'Invalid Saudi phone number' };
  if (data.amount <= 0)                  return { status:'failed', message:'Amount must be > 0' };

  // Live integration
  if (RAED.apiKey && RAED.merchantId) {
    try {
      const oid = orderId();
      const res = await fetch(`${RAED.baseUrl}/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${RAED.apiKey}`,
          'X-Merchant-ID': RAED.merchantId,
        },
        body: JSON.stringify({
          order_id:       oid,
          amount:         data.amount,
          currency:       'SAR',
          customer_email: data.customerEmail,
          customer_phone: normPhone(data.customerPhone),
          customer_name:  data.customerName,
          description:    data.description,
          booking_ref:    data.bookingRef,
          success_url:    `${window.location.origin}/booking/success?ref=${data.bookingRef}`,
          failure_url:    `${window.location.origin}/booking/failure?ref=${data.bookingRef}`,
          cancel_url:     `${window.location.origin}/booking/cancel?ref=${data.bookingRef}`,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const r = await res.json();
      return { status:'success', transactionId: r.transaction_id, paymentUrl: r.payment_url, message:'OK' };
    } catch (err) {
      return { status:'failed', message: err instanceof Error ? err.message : 'Gateway error' };
    }
  }

  // Sandbox mock
  await new Promise(r => setTimeout(r, 700));
  const oid = orderId();
  return {
    status: 'success',
    transactionId: `TXN-${Date.now()}`,
    paymentUrl:    `https://checkout.raed.sa/pay?order_id=${oid}&mode=sandbox`,
    message: 'Sandbox payment intent created',
  };
}

export function isValidPaymentResponse(r: RaedPaymentResponse): boolean {
  return r.status === 'success' && !!r.transactionId && !!r.paymentUrl;
}

export { RAED as RAED_CONFIG };
