// ATEMA STUDIO — Customer self-service booking management
//
// Route: /#/manage/:token (HashRouter)
//
// The bride opens her private manage link (token = the only credential) to
// reschedule her booking within the contract policy. Reads via the
// token-scoped RPC; writes via the change-booking Edge Function. No account,
// no PII exposure beyond her own booking.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import DatePicker from '../components/DatePicker';
import { useLang } from '../hooks/useLang';
import {
  getBookingByToken,
  rescheduleBooking,
  type ManagedBooking,
} from '../services/manage';
import {
  canReschedule,
  validateNewDate,
  rescheduleReasonText,
} from '../../supabase/functions/_shared/reschedule';

function reasonToText(reason: string | undefined, lang: 'ar' | 'en'): string {
  if (!reason) return lang === 'ar' ? 'تعذّر إتمام الطلب.' : 'The request could not be completed.';
  if (reason.startsWith('reschedule_')) {
    return rescheduleReasonText(reason.slice('reschedule_'.length) as never, lang);
  }
  const map: Record<string, { ar: string; en: string }> = {
    date_unavailable: { ar: 'هذا اليوم محجوز. يرجى اختيار يوم آخر.', en: 'That day is already booked. Please pick another.' },
    date_blocked:     { ar: 'هذا اليوم غير متاح. يرجى اختيار يوم آخر.', en: 'That day is unavailable. Please pick another.' },
    not_found:        { ar: 'الرابط غير صالح.', en: 'This link is not valid.' },
    token_invalid:    { ar: 'الرابط غير صالح.', en: 'This link is not valid.' },
    offline:          { ar: 'الخدمة غير متاحة حالياً.', en: 'The service is currently unavailable.' },
  };
  const m = map[reason];
  return m ? m[lang] : (lang === 'ar' ? 'تعذّر إتمام الطلب.' : 'The request could not be completed.');
}

export default function ManageBookingPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { lang, setLang } = useLang();
  const ar = lang === 'ar';

  const [booking,  setBooking]  = useState<ManagedBooking | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('18:00');
  const [submitting, setSubmitting] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setNotFound(true); setLoading(false); return; }
      const b = await getBookingByToken(token);
      if (cancelled) return;
      if (!b) { setNotFound(true); setLoading(false); return; }
      setBooking(b);
      setNewTime(b.event_time || '18:00');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const eligibility = useMemo(() => {
    if (!booking) return null;
    return canReschedule({
      eventDate: booking.event_date,
      status: booking.status,
      rescheduleCount: booking.reschedule_count,
    });
  }, [booking]);

  const dateCheck = useMemo(() => {
    if (!booking || !newDate) return null;
    return validateNewDate({ originalEventDate: booking.event_date, newEventDate: newDate });
  }, [booking, newDate]);

  const canSubmit = !!booking && !!eligibility?.allowed && !!dateCheck?.allowed && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const res = await rescheduleBooking({ token, newDate, newTime });
    setSubmitting(false);
    if (res.ok) {
      setSuccess(true);
      setBooking(b => b ? { ...b, event_date: res.eventDate ?? newDate, event_time: res.eventTime ?? newTime, reschedule_count: res.rescheduleCount ?? b.reschedule_count + 1 } : b);
    } else {
      setError(reasonToText(res.reason, lang));
    }
  }

  const wrap: React.CSSProperties = {
    minHeight: '100vh', background: 'var(--a-bg)', color: 'var(--a-text)',
    fontFamily: 'Inter, sans-serif',
  };
  const center: React.CSSProperties = {
    minHeight: '60vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 40,
  };

  if (loading) {
    return (
      <div style={{ ...wrap, ...center, color: 'var(--a-gold)', letterSpacing: '0.3em', fontFamily: "'Cinzel', serif", fontSize: '0.8rem' }}>
        ATEMA · {ar ? 'جارٍ التحميل' : 'LOADING'}
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div style={wrap}>
        <SiteHeader lang={lang} setLang={setLang} solidOnScroll />
        <div style={center}>
          <div style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.3em', color: 'var(--a-gold)' }}>ATEMA</div>
          <p style={{ color: 'var(--a-text-soft)' }}>
            {ar ? 'هذا الرابط غير صالح أو انتهت صلاحيته.' : 'This link is not valid or has expired.'}
          </p>
        </div>
        <SiteFooter lang={lang} />
      </div>
    );
  }

  const label: React.CSSProperties = { fontSize: '0.72rem', letterSpacing: '0.12em', color: 'var(--a-text-muted)', textTransform: 'uppercase', marginBottom: 4 };
  const val:   React.CSSProperties = { fontFamily: "'Amiri', serif", fontSize: '1.05rem', color: 'var(--a-text)' };
  const card:  React.CSSProperties = { background: 'var(--a-surface)', border: '1px solid var(--a-border)', borderRadius: 12, padding: 24 };

  return (
    <div style={wrap} dir={ar ? 'rtl' : 'ltr'}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 64px' }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.2em', color: 'var(--a-gold)', fontSize: '1.1rem', marginBottom: 24 }}>
          {ar ? 'إدارة حجزك' : 'Manage your booking'}
        </h1>

        {/* Summary */}
        <div style={{ ...card, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div><div style={label}>{ar ? 'رقم الحجز' : 'Booking ref'}</div><div style={val}>{booking.booking_ref}</div></div>
          <div><div style={label}>{ar ? 'الحالة' : 'Status'}</div><div style={val}>{booking.status}</div></div>
          <div><div style={label}>{ar ? 'الموعد الحالي' : 'Current date'}</div><div style={val}>{booking.event_date}</div></div>
          <div><div style={label}>{ar ? 'الوقت' : 'Time'}</div><div style={val}>{booking.event_time}</div></div>
        </div>

        {/* Reschedule */}
        <div style={card}>
          <h2 style={{ fontFamily: "'Amiri', serif", fontSize: '1.15rem', color: 'var(--a-gold)', marginBottom: 12 }}>
            {ar ? 'تأجيل الموعد' : 'Reschedule'}
          </h2>

          {success ? (
            <p style={{ color: 'var(--a-gold)' }}>
              {ar ? `تم تأجيل حجزك إلى ${booking.event_date} الساعة ${booking.event_time}. أرسلنا لك تأكيداً عبر واتساب.`
                  : `Your booking has moved to ${booking.event_date} at ${booking.event_time}. We've sent you a WhatsApp confirmation.`}
            </p>
          ) : !eligibility?.allowed ? (
            <p style={{ color: 'var(--a-text-soft)' }}>{rescheduleReasonText(eligibility?.reason ?? 'invalid', lang)}</p>
          ) : (
            <>
              <p style={{ color: 'var(--a-text-soft)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.7 }}>
                {ar ? 'يمكنك التأجيل مرة واحدة ضمن ٣٠ يوماً من موعدك الأصلي، وبما لا يقل عن ٧ أيام مقدماً.'
                    : 'You may reschedule once, within 30 days of your original date and at least 7 days in advance.'}
              </p>

              <div style={{ marginBottom: 16 }}>
                <div style={label}>{ar ? 'التاريخ الجديد' : 'New date'}</div>
                <DatePicker lang={lang} value={newDate} onChange={setNewDate} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={label}>{ar ? 'الوقت' : 'Time'}</div>
                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--a-border)', background: 'var(--a-surface)', color: 'var(--a-text)' }} />
              </div>

              {dateCheck && !dateCheck.allowed && (
                <p style={{ color: '#c98b8b', fontSize: '0.82rem', marginBottom: 12 }}>
                  {rescheduleReasonText(dateCheck.reason as never, lang)}
                </p>
              )}
              {error && <p style={{ color: '#c98b8b', fontSize: '0.82rem', marginBottom: 12 }}>{error}</p>}

              <button onClick={onSubmit} disabled={!canSubmit}
                style={{
                  padding: '12px 28px', borderRadius: 8, border: 'none',
                  background: canSubmit ? 'var(--a-gold)' : 'var(--a-border)',
                  color: canSubmit ? '#0B0B0B' : 'var(--a-text-muted)',
                  fontFamily: "'Cinzel', serif", letterSpacing: '0.12em', fontSize: '0.8rem',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}>
                {submitting ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'تأكيد التأجيل' : 'Confirm reschedule')}
              </button>
            </>
          )}
        </div>
      </div>
      <SiteFooter lang={lang} />
    </div>
  );
}
