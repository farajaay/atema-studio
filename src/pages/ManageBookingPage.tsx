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
import MoyasarForm from '../components/MoyasarForm';
import { useLang } from '../hooks/useLang';
import {
  getBookingByToken,
  rescheduleBooking,
  listChangeOptions,
  requestChangeOtp,
  changePackage,
  type ManagedBooking,
  type ChangeOption,
  type ChangeResult,
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
    event_passed:     { ar: 'انقضى موعد المناسبة.', en: 'The event date has passed.' },
    no_phone_on_file: { ar: 'لا يوجد رقم جوال مسجّل لهذا الحجز.', en: 'No phone number on file for this booking.' },
    no_email_on_file: { ar: 'لا يوجد بريد إلكتروني مسجّل لهذا الحجز. يرجى التواصل مع الستوديو لتعديل الباقة.', en: 'No email on file for this booking. Please contact the studio to change your package.' },
    otp_send_failed:  { ar: 'تعذّر إرسال الرمز إلى بريدك. حاولي مرة أخرى أو تواصلي مع الستوديو.', en: 'We could not email your code. Please try again or contact the studio.' },
    otp_send_unavailable: { ar: 'خدمة التحقق غير متاحة حالياً. حاولي لاحقاً.', en: 'Verification is temporarily unavailable. Please try again later.' },
    otp_required:     { ar: 'أدخلي رمز التحقق المرسل إليك.', en: 'Enter the verification code we sent you.' },
    otp_missing:      { ar: 'أدخلي رمز التحقق المرسل إليك.', en: 'Enter the verification code we sent you.' },
    otp_mismatch:     { ar: 'الرمز غير صحيح.', en: 'That code is incorrect.' },
    otp_expired:      { ar: 'انتهت صلاحية الرمز. اطلبي رمزاً جديداً.', en: 'The code has expired — request a new one.' },
    otp_too_many_attempts: { ar: 'محاولات كثيرة. اطلبي رمزاً جديداً.', en: 'Too many attempts — request a new code.' },
    package_invalid:  { ar: 'الباقة المختارة غير متاحة.', en: 'The selected package is unavailable.' },
    package_required: { ar: 'يرجى اختيار باقة.', en: 'Please select a package.' },
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

  // Package/add-on change (step-up OTP)
  const [packages, setPackages] = useState<ChangeOption[]>([]);
  const [addons,   setAddons]   = useState<ChangeOption[]>([]);
  const [changeOpen, setChangeOpen] = useState(false);
  const [selPkg,    setSelPkg]    = useState<number | null>(null);
  const [selAddons, setSelAddons] = useState<string[]>([]);
  const [otpSent,   setOtpSent]   = useState(false);
  const [otpCode,   setOtpCode]   = useState('');
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeResult, setChangeResult] = useState<ChangeResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setNotFound(true); setLoading(false); return; }
      const b = await getBookingByToken(token);
      if (cancelled) return;
      if (!b) { setNotFound(true); setLoading(false); return; }
      setBooking(b);
      setNewTime(b.event_time || '18:00');
      setSelPkg(b.package_id);
      setSelAddons(b.addon_ids ?? []);
      setLoading(false);
      const opts = await listChangeOptions();
      if (cancelled) return;
      setPackages(opts.packages);
      setAddons(opts.addons);
    })();
    return () => { cancelled = true; };
  }, [token]);

  function toggleAddon(id: string) {
    setSelAddons(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  async function onRequestOtp() {
    setChangeError(null);
    setChangeBusy(true);
    const res = await requestChangeOtp(token);
    setChangeBusy(false);
    if (res.ok) setOtpSent(true);
    else setChangeError(reasonToText(res.reason, lang));
  }

  async function onConfirmChange() {
    if (selPkg === null) { setChangeError(reasonToText('package_required', lang)); return; }
    setChangeError(null);
    setChangeBusy(true);
    const res = await changePackage({ token, otp: otpCode, packageId: selPkg, addOnIds: selAddons });
    setChangeBusy(false);
    if (res.ok) {
      setChangeResult(res);
      setBooking(b => b ? { ...b, total: res.total ?? b.total, package_id: selPkg, addon_ids: selAddons } : b);
    } else {
      setChangeError(reasonToText(res.reason, lang));
    }
  }

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

  const estSubtotal = useMemo(() => {
    const p = packages.find(x => String(x.id) === String(selPkg));
    const a = addons.filter(x => selAddons.includes(String(x.id))).reduce((s, x) => s + x.price, 0);
    return (p?.price ?? 0) + a;
  }, [packages, addons, selPkg, selAddons]);

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
  const optRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--a-border)', fontSize: '0.9rem', color: 'var(--a-text)' };
  const secondaryBtn: React.CSSProperties = { padding: '10px 22px', borderRadius: 8, border: '1px solid var(--a-gold)', background: 'transparent', color: 'var(--a-gold)', fontFamily: "'Cinzel', serif", letterSpacing: '0.1em', fontSize: '0.78rem', cursor: 'pointer' };
  const primaryBtn = (enabled: boolean): React.CSSProperties => ({ padding: '12px 28px', borderRadius: 8, border: 'none', background: enabled ? 'var(--a-gold)' : 'var(--a-border)', color: enabled ? '#0B0B0B' : 'var(--a-text-muted)', fontFamily: "'Cinzel', serif", letterSpacing: '0.12em', fontSize: '0.8rem', cursor: enabled ? 'pointer' : 'not-allowed' });

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

        {/* Change package / add-ons (step-up OTP) */}
        <div style={{ ...card, marginTop: 24 }}>
          <h2 style={{ fontFamily: "'Amiri', serif", fontSize: '1.15rem', color: 'var(--a-gold)', marginBottom: 12 }}>
            {ar ? 'تغيير الباقة أو الإضافات' : 'Change package or add-ons'}
          </h2>

          {changeResult ? (
            <div style={{ lineHeight: 1.9 }}>
              <p style={{ color: 'var(--a-gold)' }}>{ar ? 'تم تحديث حجزك.' : 'Your booking has been updated.'}</p>
              <p>{ar ? 'الإجمالي الجديد: ' : 'New total: '}
                {(changeResult.total ?? 0).toLocaleString(ar ? 'ar-SA' : 'en-US')} {ar ? 'ر.س' : 'SAR'}</p>
              {changeResult.topUpDue && changeResult.topUpDue > 0 ? (
                <div>
                  <p style={{ color: 'var(--a-text)', marginBottom: 16 }}>
                    {ar ? 'المبلغ المتبقّي للدفع: ' : 'Balance to pay: '}
                    <strong style={{ color: 'var(--a-gold)' }}>
                      {changeResult.topUpDue.toLocaleString(ar ? 'ar-SA' : 'en-US')} {ar ? 'ر.س' : 'SAR'}
                    </strong>
                  </p>
                  <MoyasarForm
                    depositSAR={changeResult.topUpDue}
                    description={ar
                      ? `تسوية رصيد الحجز ${booking?.booking_ref ?? ''}`
                      : `Balance top-up for booking ${booking?.booking_ref ?? ''}`}
                    bookingRef={booking?.booking_ref ?? ''}
                    bookingId={booking?.id ?? ''}
                    lang={lang}
                    purpose="topup"
                  />
                </div>
              ) : (
                <p style={{ color: 'var(--a-text-soft)', fontSize: '0.85rem' }}>
                  {ar ? 'لا توجد مبالغ إضافية مستحقة.' : 'No additional payment is due.'}
                </p>
              )}
            </div>
          ) : !changeOpen ? (
            <button onClick={() => setChangeOpen(true)} style={secondaryBtn}>
              {ar ? 'تعديل الباقة' : 'Edit my package'}
            </button>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={label}>{ar ? 'الباقة' : 'Package'}</div>
                {packages.map(p => (
                  <label key={p.id} style={optRow}>
                    <input type="radio" name="pkg" checked={String(selPkg) === String(p.id)}
                      onChange={() => setSelPkg(Number(p.id))} />
                    <span style={{ flex: 1 }}>{ar ? p.name_ar : p.name_en}</span>
                    <span style={{ color: 'var(--a-text-soft)' }}>{p.price.toLocaleString(ar ? 'ar-SA' : 'en-US')} {ar ? 'ر.س' : 'SAR'}</span>
                  </label>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={label}>{ar ? 'الإضافات' : 'Add-ons'}</div>
                {addons.map(a => (
                  <label key={a.id} style={optRow}>
                    <input type="checkbox" checked={selAddons.includes(String(a.id))}
                      onChange={() => toggleAddon(String(a.id))} />
                    <span style={{ flex: 1 }}>{ar ? a.name_ar : a.name_en}</span>
                    <span style={{ color: 'var(--a-text-soft)' }}>{a.price.toLocaleString(ar ? 'ar-SA' : 'en-US')} {ar ? 'ر.س' : 'SAR'}</span>
                  </label>
                ))}
              </div>

              <p style={{ color: 'var(--a-text-soft)', fontSize: '0.82rem', marginBottom: 16 }}>
                {ar ? 'تقدير المبلغ قبل الضريبة: ' : 'Estimated subtotal (pre-VAT): '}
                {estSubtotal.toLocaleString(ar ? 'ar-SA' : 'en-US')} {ar ? 'ر.س' : 'SAR'}
                {' · '}{ar ? 'يُحتسب الإجمالي النهائي عند التأكيد.' : 'Final total is confirmed on submit.'}
              </p>

              {!otpSent ? (
                <button onClick={onRequestOtp} disabled={changeBusy} style={primaryBtn(!changeBusy)}>
                  {changeBusy ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'إرسال رمز التحقق' : 'Send verification code')}
                </button>
              ) : (
                <>
                  <p style={{ color: 'var(--a-text-soft)', fontSize: '0.85rem', marginBottom: 10 }}>
                    {ar ? 'أرسلنا رمز التحقق إلى بريدك الإلكتروني المسجّل. تحقّقي من صندوق الوارد (والبريد المزعج).' : 'We emailed a verification code to the address on file. Check your inbox (and spam).'}
                  </p>
                  <input value={otpCode} inputMode="numeric" placeholder="------"
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--a-border)', background: 'var(--a-surface)', color: 'var(--a-text)', letterSpacing: '0.5em', width: 160, marginBottom: 12 }} />
                  <div>
                    <button onClick={onConfirmChange} disabled={changeBusy || otpCode.length < 6}
                      style={primaryBtn(!changeBusy && otpCode.length >= 6)}>
                      {changeBusy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'تأكيد التعديل' : 'Confirm change')}
                    </button>
                  </div>
                </>
              )}
              {changeError && <p style={{ color: '#c98b8b', fontSize: '0.82rem', marginTop: 12 }}>{changeError}</p>}
            </>
          )}
        </div>
      </div>
      <SiteFooter lang={lang} />
    </div>
  );
}
