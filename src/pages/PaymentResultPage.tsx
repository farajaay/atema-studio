// ── Payment Result Page ───────────────────────────────────────────────────────
// Shown when Moyasar redirects back after payment attempt.
// Patch M-11: booking status is now updated only after the verify-payment
// Edge Function confirms the payment with the Moyasar API using the secret
// key — the URL ?status= param is used only for initial display while the
// server check is in flight and is never trusted for DB writes.
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

const T = {
  pearl:   '#F5EDE4',
  gold:    '#8C6B4F',
  taupe:   '#6B5440',
  coffee:  '#1A1A1A',
  champagne: '#E8D9C5',
};

interface Props {
  paymentId:     string;
  paymentStatus: string;
  bookingId:     string;
  bookingRef:    string;
  /** 'topup' shows a balance-paid message instead of booking-confirmed. */
  purpose?:      'booking' | 'topup';
}

export default function PaymentResultPage({ paymentId, paymentStatus, bookingId, bookingRef, purpose = 'booking' }: Props) {
  // optimistic hint from URL — replaced by server-verified result
  const urlHintPaid = paymentStatus === 'paid' || paymentStatus === 'authorized';

  const [verifying,     setVerifying]     = useState(true);
  const [verified,      setVerified]      = useState(false);
  const [verifiedStatus, setVerifiedStatus] = useState('');
  const [verifyError,   setVerifyError]   = useState('');

  useEffect(() => {
    if (!paymentId || !bookingId || !supabase) {
      // No payment to verify (e.g. failed before gateway)
      setVerifying(false);
      setVerifiedStatus(paymentStatus);
      return;
    }

    supabase.functions
      .invoke('verify-payment', { body: { paymentId, bookingId } })
      .then(({ data, error }) => {
        if (error) {
          setVerifyError(error.message);
        } else {
          setVerified(data?.verified === true);
          setVerifiedStatus(data?.status ?? paymentStatus);
          if (data?.error) setVerifyError(data.error);
        }
      })
      .catch((e: Error) => setVerifyError(e.message))
      .finally(() => setVerifying(false));
  }, [paymentId, bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPaid = verifying ? urlHintPaid : verified;

  const card: React.CSSProperties = {
    background: 'white',
    borderRadius: '20px',
    padding: '48px 40px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 48px rgba(26,26,26,0.09)',
    border: '1px solid rgba(214,191,163,0.25)',
  };

  const heading: React.CSSProperties = {
    fontFamily: "'Amiri', serif",
    fontSize: '1.65rem',
    color: T.coffee,
    margin: '16px 0 10px',
  };

  const body: React.CSSProperties = {
    fontSize: '0.85rem',
    color: T.taupe,
    lineHeight: 1.85,
    fontFamily: 'Tajawal, sans-serif',
    marginBottom: '6px',
  };

  const btn = (dark = true): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '12px 28px', borderRadius: '9px', textDecoration: 'none',
    fontSize: '0.9rem', fontFamily: 'Tajawal, sans-serif', fontWeight: 500,
    transition: 'all 0.2s', cursor: 'pointer',
    background: dark ? T.coffee : 'transparent',
    color:      dark ? T.champagne : T.coffee,
    border:     dark ? 'none' : `1.5px solid rgba(214,191,163,0.55)`,
  });

  return (
    <div dir="rtl" style={{
      minHeight: '100vh', background: T.pearl,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'Tajawal, sans-serif',
    }}>
      <div style={card}>

        {/* ATEMA wordmark */}
        <div className="atema-wordmark" style={{ fontSize: '1.1rem', marginBottom: '24px' }}>
          ATEMA
        </div>

        {verifying ? (
          <div style={{ padding: '24px 0' }}>
            <Loader2 size={48} color={T.gold}
              style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px', display: 'block' }} />
            <p style={{ ...body, textAlign: 'center' }}>جارٍ التحقق من حالة الدفع…</p>
          </div>
        ) : isPaid ? (
          <>
            <CheckCircle2 size={52} color={T.gold} style={{ marginBottom: '4px' }} />
            <h2 style={heading}>
              {purpose === 'topup' ? 'تم سداد المبلغ المتبقّي!' : 'تم الدفع بنجاح!'}
            </h2>
            <p style={body}>
              رقم الحجز:{' '}
              <strong style={{ color: T.gold, fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem' }}>
                {bookingRef || '—'}
              </strong>
            </p>
            <p style={{ ...body, fontFamily: "'Cormorant Garamond', serif",
              fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '20px' }}>
              Payment ID: {paymentId}
            </p>
            <p style={{ ...body, maxWidth: '340px', margin: '0 auto 28px' }}>
              {purpose === 'topup'
                ? 'تم تحديث حجزك بالكامل. سيتواصل معكِ فريق ATEMA بتأكيد نهائي.'
                : 'سيتواصل معكِ فريق ATEMA قريباً لتأكيد تفاصيل مناسبتكِ. شكراً جزيلاً على ثقتكِ بنا!'}
            </p>
            {verifyError && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '16px' }}>
                ملاحظة: الحجز سُجّل ولكن حدث خطأ في التحديث التلقائي ({verifyError}).
                سنتولى ذلك يدوياً.
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://atemastudio.xyz/" style={btn(true)}>
                العودة للرئيسية
              </a>
              <a href="https://wa.me/966548323496" target="_blank" rel="noreferrer"
                style={btn(false)}>
                تواصل معنا
              </a>
            </div>
          </>
        ) : (
          <>
            <XCircle size={52} color="#dc2626" style={{ marginBottom: '4px' }} />
            <h2 style={heading}>لم تكتمل عملية الدفع</h2>
            <p style={{ ...body, marginBottom: '6px' }}>
              {verifiedStatus === 'failed'
                ? 'تعذّر تنفيذ الدفع. لم يتم خصم أي مبلغ من حسابكِ.'
                : `حالة الدفع: ${verifiedStatus || paymentStatus}`}
            </p>
            {bookingRef && (
              <p style={{ ...body, marginBottom: '24px' }}>
                رقم الحجز لا يزال محجوزاً:{' '}
                <strong style={{ color: T.gold }}>{bookingRef}</strong>
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://atemastudio.xyz/" style={btn(true)}>
                إعادة المحاولة
              </a>
              <a href="https://wa.me/966548323496" target="_blank" rel="noreferrer"
                style={btn(false)}>
                تواصل معنا
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
