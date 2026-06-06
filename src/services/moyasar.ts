// ── Moyasar Payment Gateway Integration ──────────────────────────────────────
// Docs: https://moyasar.com/docs/api/

declare global {
  interface Window {
    Moyasar: {
      init: (options: MoyasarInitOptions) => void;
    };
  }
}

export interface MoyasarInitOptions {
  element: HTMLElement | string;
  amount: number;        // in halalas — 1 SAR = 100 halalas
  currency: string;      // 'SAR'
  description: string;
  publishable_api_key: string;
  callback_url: string;
  methods: Array<'creditcard' | 'stcpay' | 'applepay'>;
  metadata?: Record<string, string>;
  on_completed?: (payment: MoyasarPayment) => void;
  on_failure?: (error: { type: string; message: string }) => void;
}

export interface MoyasarPayment {
  id: string;
  status: 'initiated' | 'paid' | 'failed' | 'authorized' | 'captured' | 'refunded' | 'voided';
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  source: {
    type: string;
    company?: string;
    number?: string;
    message?: string;
  };
}

// Callback URL params returned by Moyasar after redirect:
// ?id=pay_xxx &status=paid &message=... + any params you added to callback_url
export interface MoyasarCallbackParams {
  id: string;
  status: string;
  message: string;
  bookingId: string;
  bookingRef: string;
  /** 'booking' for initial deposit; 'topup' for post-upgrade balance payment. */
  purpose: 'booking' | 'topup';
}

// ── SDK Loader ────────────────────────────────────────────────────────────────
const MOYASAR_VERSION = '1.14.0';
let _loaded = false;

export function loadMoyasarSDK(): Promise<void> {
  if (_loaded && window.Moyasar) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // Inject CSS once
    if (!document.querySelector('link[href*="moyasar"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://cdn.moyasar.com/moyasar/${MOYASAR_VERSION}/moyasar.css`;
      document.head.appendChild(link);
    }

    // Inject JS
    const script = document.createElement('script');
    script.src = `https://cdn.moyasar.com/moyasar/${MOYASAR_VERSION}/moyasar.js`;
    script.onload  = () => { _loaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Moyasar SDK'));
    document.head.appendChild(script);
  });
}

// ── Parse callback params from current URL ────────────────────────────────────
export function parseMoyasarCallback(): MoyasarCallbackParams | null {
  const p = new URLSearchParams(window.location.search);
  const id = p.get('id');
  const status = p.get('status');
  if (!id || !status) return null;
  const purposeRaw = p.get('purpose');
  return {
    id,
    status,
    message:    p.get('message')    ?? '',
    bookingId:  p.get('booking_id') ?? '',
    bookingRef: p.get('booking_ref') ?? '',
    purpose:    purposeRaw === 'topup' ? 'topup' : 'booking',
  };
}
