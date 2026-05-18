// ── Payment Result Page ───────────────────────────────────────────────────────
// Shown when Moyasar redirects back after payment attempt
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
  paymentId:   string;
  paymentStatus: string;
  bookingId:   string;
  bookingRef:  string;
}

export default function PaymentResultPage({ paymentId, paymentStatus, bookingId, bookingRef }: Props) {
  const isPaid = paymentStatus === 'paid' || paymentStatus === 'authorized';
  const [updating, setUpdating] = useState(isPaid);
  const [dbError,  setDbError]  = useState('');

  useEffect(() => {
    if (!isPaid || !bookingId || !supabase) { setUpdating(false); return; }

    supabase
      .from('bookings')
      .update({ payment_status: 'paid', status: 'confirmed' })
      .eq('id', bookingId)
      .then(({ error }) => {
        if (error) setDbError(error.message);
        setUpdating(false);
      });
  }, [isPaid, bookingId]);

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

        {isPaid ? (
          <>
            {updating ? (
              <Loader2 size={48} color={T.gold}
                style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px', display: 'block' }} />
            ) : (
              <CheckCircle2 size={52} color={T.gold} style={{ marginBottom: '4px' }} />
            )}
            <h2 style={heading}>تم الدفع بنجاح!</h2>
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
              سيتواصل معكِ فريق ATEMA قريباً لتأكيد تفاصيل مناسبتكِ.
              شكراً جزيلاً على ثقتكِ بنا!
            </p>
            {dbError && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '16px' }}>
                ملاحظة: الحجز سُجّل ولكن لم يتم تحديث الحالة تلقائياً ({dbError}).
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
              {paymentStatus === 'failed'
                ? 'تعذّر تنفيذ الدفع. لم يتم خصم أي مبلغ من حسابكِ.'
                : `حالة الدفع: ${paymentStatus}`}
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
