import React, { useState } from 'react';
import { ATEMA_COLORS, CITIES } from '../config/constants';
import { useAppContext } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { createBooking } from '../services/booking';
import { createRaedPaymentIntent } from '../services/raed/client';
import type { BookingFormData } from '../types';
import {
  User, Phone, Mail, CalendarDays, Clock, MapPin,
  MessageSquare, CheckCircle2, AlertCircle, Loader2, CreditCard
} from 'lucide-react';

const Field = ({
  label, icon, error, children
}: { label: string; icon: React.ReactNode; error?: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '18px' }}>
    <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px',
      fontWeight:600, color:'#555', marginBottom:'7px' }}>
      {icon}{label}
    </label>
    {children}
    {error && (
      <div style={{ display:'flex', alignItems:'center', gap:'5px',
        fontSize:'12px', color:'#e74c3c', marginTop:'5px' }}>
        <AlertCircle size={12} />{error}
      </div>
    )}
  </div>
);

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'11px 14px', border:'1.5px solid #e8e0d8',
  borderRadius:'8px', fontSize:'14px', fontFamily:'inherit',
  outline:'none', transition:'border-color 0.2s', boxSizing:'border-box',
  background:'white'
};

type Step = 'form' | 'processing' | 'success' | 'error';

interface Props { onClose?: () => void; }

const BookingForm: React.FC<Props> = ({ onClose }) => {
  const { selectedPackage, selectedAddOns, total, subtotal, vat } = useAppContext();
  const { isMobile } = useBreakpoint();

  const [step, setStep]     = useState<Step>('form');
  const [bookingRef, setRef] = useState('');
  const [payUrl, setPayUrl]  = useState('');
  const [errMsg, setErrMsg]  = useState('');

  const [form, setForm] = useState<BookingFormData>({
    fullName:'', phone:'', email:'', eventDate:'', eventTime:'',
    city:'', location:'', specialRequests:'', agreeToTerms:false
  });
  const [errs, setErrs] = useState<Partial<BookingFormData>>({});

  const set = (k: keyof BookingFormData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  function validate(): boolean {
    const e: Partial<Record<keyof BookingFormData, string>> = {};
    if (!form.fullName.trim())  e.fullName   = 'الاسم مطلوب';
    if (!/^(\+966|00966|0)?5[0-9]{8}$/.test(form.phone.replace(/\s/g,'')))
                                e.phone      = 'رقم هاتف سعودي غير صحيح';
    if (form.email && !form.email.includes('@'))
                                e.email      = 'بريد إلكتروني غير صحيح';
    if (!form.eventDate)        e.eventDate  = 'تاريخ الحفل مطلوب';
    if (!form.eventTime)        e.eventTime  = 'وقت الحفل مطلوب';
    if (!form.city)             e.city       = 'المدينة مطلوبة';
    if (!form.agreeToTerms)     e.agreeToTerms = 'يجب الموافقة على الشروط' as any;
    setErrs(e as any);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackage) return;
    if (!validate()) return;
    setStep('processing');

    try {
      const booking = await createBooking({
        packageId:       selectedPackage.id,
        addOnIds:        selectedAddOns.map(a => a.id),
        eventDate:       form.eventDate,
        eventTime:       form.eventTime,
        customerName:    form.fullName,
        customerPhone:   form.phone,
        customerEmail:   form.email,
        location:        `${form.city}${form.location ? ' — ' + form.location : ''}`,
        specialRequests: form.specialRequests,
        subtotal, vat, total,
      });

      setRef(booking.bookingRef);

      const payment = await createRaedPaymentIntent({
        customerName:  form.fullName,
        customerEmail: form.email || `${form.phone}@atema.sa`,
        customerPhone: form.phone,
        amount:        total,
        bookingRef:    booking.bookingRef,
        description:   `ATEMA — ${selectedPackage.nameAr}`,
      });

      if (payment.status === 'success' && payment.paymentUrl) {
        setPayUrl(payment.paymentUrl);
        setStep('success');
      } else {
        throw new Error(payment.message);
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      setStep('error');
    }
  }

  const colStyle: React.CSSProperties = {
    display:'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap:'0 20px'
  };

  if (step === 'processing') return (
    <div style={{ textAlign:'center', padding:'60px 20px' }}>
      <Loader2 size={40} color={ATEMA_COLORS.champagne} style={{ animation:'spin 1s linear infinite' }} />
      <p style={{ marginTop:'20px', color:'#666', fontSize:'15px' }}>جاري معالجة طلبك...</p>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  if (step === 'success') return (
    <div style={{ textAlign:'center', padding:'50px 20px' }}>
      <CheckCircle2 size={52} color='#27ae60' style={{ marginBottom:'16px' }} />
      <h3 style={{ fontSize:'20px', fontWeight:700, color:'#27ae60', marginBottom:'10px' }}>تم تأكيد طلبك!</h3>
      <p style={{ color:'#666', marginBottom:'6px' }}>رقم الحجز: <strong style={{ color: ATEMA_COLORS.deepBronze }}>{bookingRef}</strong></p>
      <p style={{ color:'#888', fontSize:'13px', marginBottom:'28px' }}>ستصلك رسالة واتساب للتأكيد خلال دقائق</p>
      {payUrl && (
        <a href={payUrl} target='_blank' rel='noreferrer'
          style={{ display:'inline-flex', alignItems:'center', gap:'8px',
            background: ATEMA_COLORS.champagne, color:'white', textDecoration:'none',
            padding:'14px 32px', borderRadius:'8px', fontWeight:700, fontSize:'15px' }}>
          <CreditCard size={18} />متابعة الدفع
        </a>
      )}
    </div>
  );

  if (step === 'error') return (
    <div style={{ textAlign:'center', padding:'50px 20px' }}>
      <AlertCircle size={48} color='#e74c3c' style={{ marginBottom:'16px' }} />
      <h3 style={{ fontSize:'18px', fontWeight:700, color:'#e74c3c', marginBottom:'10px' }}>حدث خطأ</h3>
      <p style={{ color:'#666', marginBottom:'24px' }}>{errMsg}</p>
      <button onClick={() => setStep('form')}
        style={{ background: ATEMA_COLORS.champagne, color:'white', border:'none',
          padding:'12px 28px', borderRadius:'8px', cursor:'pointer', fontWeight:600 }}>
        حاولي مرة أخرى
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ padding: isMobile ? '20px 16px' : '32px 28px' }}>
      <h3 style={{ fontSize:'18px', fontWeight:700, color: ATEMA_COLORS.deepBronze,
        marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
        تفاصيل الحجز
      </h3>
      {selectedPackage && (
        <div style={{ background: ATEMA_COLORS.softIvory, padding:'12px 16px', borderRadius:'8px',
          marginBottom:'24px', fontSize:'13px', color:'#666' }}>
          الباقة: <strong style={{ color: ATEMA_COLORS.deepBronze }}>{selectedPackage.nameAr}</strong>
          &nbsp;·&nbsp;المجموع: <strong style={{ color: ATEMA_COLORS.champagne }}>{total.toLocaleString()} ر.س</strong>
        </div>
      )}

      <div style={colStyle}>
        <Field label='الاسم الكامل' icon={<User size={13} color='#bbb' />} error={errs.fullName as string}>
          <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
            placeholder='اسمك الكريم' style={inputStyle} />
        </Field>
        <Field label='رقم الجوال' icon={<Phone size={13} color='#bbb' />} error={errs.phone as string}>
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder='05xxxxxxxx' dir='ltr' style={inputStyle} />
        </Field>
        <Field label='البريد الإلكتروني (اختياري)' icon={<Mail size={13} color='#bbb' />} error={errs.email as string}>
          <input value={form.email} onChange={e => set('email', e.target.value)}
            placeholder='your@email.com' dir='ltr' style={inputStyle} />
        </Field>
        <Field label='المدينة' icon={<MapPin size={13} color='#bbb' />} error={errs.city as string}>
          <select value={form.city} onChange={e => set('city', e.target.value)} style={inputStyle}>
            <option value=''>اختر المدينة</option>
            {CITIES.map(c => <option key={c.code} value={c.code}>{c.nameAr}</option>)}
          </select>
        </Field>
        <Field label='تاريخ الحفل' icon={<CalendarDays size={13} color='#bbb' />} error={errs.eventDate as string}>
          <input type='date' value={form.eventDate} onChange={e => set('eventDate', e.target.value)}
            min={new Date().toISOString().split('T')[0]} style={inputStyle} />
        </Field>
        <Field label='وقت الحفل' icon={<Clock size={13} color='#bbb' />} error={errs.eventTime as string}>
          <input type='time' value={form.eventTime} onChange={e => set('eventTime', e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <Field label='موقع القاعة / المكان' icon={<MapPin size={13} color='#bbb' />}>
        <input value={form.location || ''} onChange={e => set('location', e.target.value)}
          placeholder='اسم القاعة أو العنوان التفصيلي' style={inputStyle} />
      </Field>

      <Field label='طلبات خاصة' icon={<MessageSquare size={13} color='#bbb' />}>
        <textarea value={form.specialRequests || ''} onChange={e => set('specialRequests', e.target.value)}
          placeholder='أي تفاصيل أو طلبات خاصة...' rows={3}
          style={{ ...inputStyle, resize:'vertical', lineHeight:'1.6' }} />
      </Field>

      <div style={{ display:'flex', alignItems:'flex-start', gap:'10px', margin:'20px 0' }}>
        <input type='checkbox' id='terms' checked={form.agreeToTerms}
          onChange={e => set('agreeToTerms', e.target.checked)}
          style={{ marginTop:'3px', accentColor: ATEMA_COLORS.champagne, width:'16px', height:'16px' }} />
        <label htmlFor='terms' style={{ fontSize:'13px', color:'#666', cursor:'pointer', lineHeight:'1.5' }}>
          أوافق على <span style={{ color: ATEMA_COLORS.champagne, fontWeight:600 }}>شروط وأحكام ATEMA STUDIO</span>
          &nbsp;وسياسة الخصوصية
        </label>
      </div>
      {(errs as any).agreeToTerms && (
        <div style={{ fontSize:'12px', color:'#e74c3c', marginBottom:'12px', display:'flex', gap:'5px', alignItems:'center' }}>
          <AlertCircle size={12} />{(errs as any).agreeToTerms}
        </div>
      )}

      <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'8px' }}>
        {onClose && (
          <button type='button' onClick={onClose}
            style={{ padding:'12px 24px', border:`1.5px solid ${ATEMA_COLORS.champagne}`,
              borderRadius:'8px', cursor:'pointer', background:'white',
              color: ATEMA_COLORS.champagne, fontWeight:600, fontSize:'14px', fontFamily:'inherit' }}>
            إلغاء
          </button>
        )}
        <button type='submit' disabled={!selectedPackage}
          style={{ padding:'12px 28px', background: selectedPackage ? ATEMA_COLORS.champagne : '#ccc',
            color:'white', border:'none', borderRadius:'8px', cursor: selectedPackage ? 'pointer' : 'not-allowed',
            fontWeight:700, fontSize:'14px', fontFamily:'inherit',
            display:'flex', alignItems:'center', gap:'8px' }}>
          <CreditCard size={16} />تأكيد الحجز والدفع
        </button>
      </div>
    </form>
  );
};

export default BookingForm;
