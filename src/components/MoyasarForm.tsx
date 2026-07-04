// ── Moyasar Hosted Payment Form ───────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { loadMoyasarSDK } from '../services/moyasar';
import { Loader2 } from 'lucide-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY ?? '';
// Custom domain — also configure both production hosts in Moyasar dashboard
// callback URLs so we transition without breaking older bookmarked sessions.
const SITE_BASE       = 'https://atemastudio.xyz/';

interface Props {
  depositSAR:     number;   // amount to charge (SAR)
  description:    string;
  bookingRef:     string;
  bookingId:      string;
  lang:           'ar' | 'en';
  /** 'booking' = initial 50% deposit; 'topup' = post-upgrade balance payment. Defaults to 'booking'. */
  purpose?:       'booking' | 'topup';
  /** Moyasar method identifiers to enable (e.g. ['creditcard','mada','applepay']). Defaults to creditcard + stcpay. */
  allowedMethods?: Array<'creditcard' | 'stcpay' | 'applepay' | 'mada'>;
}

export default function MoyasarForm({ depositSAR, description, bookingRef, bookingId, lang, purpose = 'booking', allowedMethods }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const initialized   = useRef(false);
  const [sdkReady,   setSdkReady]   = useState(false);
  const [sdkError,   setSdkError]   = useState('');

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    loadMoyasarSDK()
      .then(() => setSdkReady(true))
      .catch(() => setSdkError(lang === 'ar'
        ? 'فشل تحميل نموذج الدفع. تحقق من الاتصال وأعيدي المحاولة.'
        : 'Failed to load payment form. Check your connection and try again.'
      ));
    // The SDK loads exactly once (initialized ref guards re-entry); `lang`
    // only flavours the error string of that one load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once SDK is ready and container exists, initialize Moyasar
  useEffect(() => {
    if (!sdkReady || !containerRef.current || !PUBLISHABLE_KEY) return;

    const callbackUrl =
      `${SITE_BASE}?booking_id=${encodeURIComponent(bookingId)}` +
      `&booking_ref=${encodeURIComponent(bookingRef)}` +
      `&purpose=${encodeURIComponent(purpose)}`;

    window.Moyasar.init({
      element:             containerRef.current,
      amount:              Math.round(depositSAR * 100), // halalas
      currency:            'SAR',
      description,
      publishable_api_key: PUBLISHABLE_KEY,
      callback_url:        callbackUrl,
      methods:             allowedMethods && allowedMethods.length > 0 ? allowedMethods : ['creditcard', 'stcpay'],
      metadata:            { booking_id: bookingId, booking_ref: bookingRef, purpose },
    });
    // Moyasar.init mounts the payment form into the container exactly once,
    // when the SDK becomes ready. Re-running on prop changes would re-mount
    // the form mid-payment — the props are fixed for the life of the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady]);

  // Key not configured — a customer surface must never leak build internals.
  // The bride sees a calm hand-off to WhatsApp; the env hint appears in dev only.
  if (!PUBLISHABLE_KEY) {
    return (
      <div style={{ padding:'32px 24px', textAlign:'center',
        fontFamily:'Tajawal,sans-serif', color:'var(--a-text)' }}>
        <p style={{ fontSize:'0.92rem', lineHeight:1.9, color:'var(--a-text)' }}>
          {lang === 'ar'
            ? 'الدفع بالبطاقة غير متاح في هذه اللحظة، وحجزكِ محفوظ كما هو. راسلينا عبر واتساب وسنُتمّ الدفع معكِ مباشرة.'
            : 'Card payment is unavailable at this moment — your booking is safe as it is. Message us on WhatsApp and we will complete the payment with you directly.'}
        </p>
        <a href="https://wa.me/966548323496" target="_blank" rel="noreferrer"
          style={{ display:'inline-block', marginTop:'16px', padding:'11px 26px',
            background:'var(--a-gold)', color:'#0B0B0B', borderRadius:'10px',
            textDecoration:'none', fontWeight:700, fontSize:'0.88rem' }}>
          {lang === 'ar' ? 'التواصل عبر واتساب' : 'Message us on WhatsApp'}
        </a>
        {import.meta.env.DEV && (
          <code style={{ display:'block', marginTop:'18px', fontSize:'0.78rem',
            background:'var(--a-surface-alt)', padding:'8px 12px', borderRadius:'6px',
            fontFamily:'monospace', color:'var(--a-text)' }}>
            VITE_MOYASAR_PUBLISHABLE_KEY=pk_test_...
          </code>
        )}
      </div>
    );
  }

  return (
    <div dir="ltr" style={{ padding:'8px 0' }}>
      {!sdkReady && !sdkError && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
          gap:'10px', padding:'32px', color:'var(--a-gold)', fontFamily:'Tajawal,sans-serif' }}>
          <Loader2 size={20} style={{ animation:'spin 1s linear infinite' }} />
          {lang === 'ar' ? 'جارٍ تحميل نموذج الدفع...' : 'Loading payment form...'}
        </div>
      )}
      {sdkError && (
        <div style={{ padding:'16px 20px', background:'#fff5f5',
          border:'1px solid #fecaca', borderRadius:'8px',
          color:'#dc2626', fontSize:'0.85rem', fontFamily:'Tajawal,sans-serif' }}>
          {sdkError}
        </div>
      )}
      {/* Moyasar injects the card form here */}
      <div ref={containerRef} />
    </div>
  );
}
