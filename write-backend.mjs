import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

function write(p, c) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, c, 'utf8');
  console.log('wrote:', p);
}

const ROOT = 'C:/Users/Ahmad/Downloads/Project Photography/_deploy/atema-studio';
const SRC  = `${ROOT}/src`;

// ─── BookingForm component ────────────────────────────────────────────────────
write(`${SRC}/components/BookingForm.tsx`, `import React, { useState } from 'react';
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
    if (!/^(\\+966|00966|0)?5[0-9]{8}$/.test(form.phone.replace(/\\s/g,'')))
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
        location:        \`\${form.city}\${form.location ? ' — ' + form.location : ''}\`,
        specialRequests: form.specialRequests,
        subtotal, vat, total,
      });

      setRef(booking.bookingRef);

      const payment = await createRaedPaymentIntent({
        customerName:  form.fullName,
        customerEmail: form.email || \`\${form.phone}@atema.sa\`,
        customerPhone: form.phone,
        amount:        total,
        bookingRef:    booking.bookingRef,
        description:   \`ATEMA — \${selectedPackage.nameAr}\`,
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
      <style>{\`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }\`}</style>
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
            style={{ padding:'12px 24px', border:\`1.5px solid \${ATEMA_COLORS.champagne}\`,
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
`);

// ─── Database Schema ───────────────────────────────────────────────────────────
write(`${ROOT}/database/schema.sql`, `-- ============================================================
-- ATEMA STUDIO — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PACKAGES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id              SERIAL PRIMARY KEY,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  price           INTEGER NOT NULL,
  duration_hours  INTEGER NOT NULL,
  edited_photos   INTEGER NOT NULL,
  album           TEXT,
  video           BOOLEAN DEFAULT false,
  description     TEXT,
  features        TEXT[],
  badge           TEXT,
  is_popular      BOOLEAN DEFAULT false,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ADD-ONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addons (
  id         TEXT PRIMARY KEY,
  name_ar    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  price      INTEGER NOT NULL,
  active     BOOLEAN DEFAULT true
);

-- ── CUSTOMERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name    TEXT NOT NULL,
  phone        TEXT NOT NULL UNIQUE,
  email        TEXT,
  city         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── BOOKINGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref      TEXT NOT NULL UNIQUE DEFAULT
                     'ATEMA-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)),
  customer_id      UUID REFERENCES customers(id),
  package_id       INTEGER REFERENCES packages(id),
  addon_ids        TEXT[] DEFAULT '{}',
  event_date       DATE NOT NULL,
  event_time       TIME NOT NULL,
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  customer_email   TEXT,
  location         TEXT,
  special_requests TEXT,
  subtotal         INTEGER NOT NULL,
  vat              INTEGER NOT NULL,
  total            INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','completed','cancelled')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid'
                     CHECK (payment_status IN ('unpaid','paid','refunded')),
  whatsapp_sent    BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAYMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id     UUID REFERENCES bookings(id),
  booking_ref    TEXT NOT NULL,
  transaction_id TEXT UNIQUE,
  amount         INTEGER NOT NULL,
  currency       TEXT DEFAULT 'SAR',
  gateway        TEXT DEFAULT 'raed',
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','success','failed','refunded')),
  gateway_ref    JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── WHATSAPP LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref TEXT NOT NULL,
  phone       TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT DEFAULT 'sent',
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE bookings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from the booking form)
CREATE POLICY "anon_insert_bookings"  ON bookings  FOR INSERT TO anon  WITH CHECK (true);
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon  WITH CHECK (true);

-- Service role has full access (Edge Functions use service role)
CREATE POLICY "service_all_bookings"  ON bookings  FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_payments"  ON payments  FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_customers" ON customers FOR ALL TO service_role USING (true);

-- Packages & addons are public read
CREATE POLICY "public_read_packages" ON packages FOR SELECT USING (true);
CREATE POLICY "public_read_addons"   ON addons   FOR SELECT USING (true);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_ref    ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_bookings_phone  ON bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at  BEFORE UPDATE ON bookings  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`);

// ─── Supabase Edge Function: create-booking ────────────────────────────────────
write(`${ROOT}/supabase/functions/create-booking/index.ts`, `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();

    // Upsert customer
    const { data: customer } = await supabase
      .from('customers')
      .upsert({ full_name: body.customerName, phone: body.customerPhone, email: body.customerEmail, city: body.city },
               { onConflict: 'phone' })
      .select()
      .single();

    // Insert booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert([{
        customer_id:      customer?.id,
        package_id:       body.packageId,
        addon_ids:        body.addOnIds,
        event_date:       body.eventDate,
        event_time:       body.eventTime,
        customer_name:    body.customerName,
        customer_phone:   body.customerPhone,
        customer_email:   body.customerEmail,
        location:         body.location,
        special_requests: body.specialRequests,
        subtotal:         body.subtotal,
        vat:              body.vat,
        total:            body.total,
        status:           'pending',
      }])
      .select()
      .single();

    if (error) throw error;

    // Trigger WhatsApp notification (fire & forget)
    fetch(\`\${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp\`, {
      method:  'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': \`Bearer \${Deno.env.get('SUPABASE_ANON_KEY')}\` },
      body: JSON.stringify({
        phone:      body.customerPhone,
        name:       body.customerName,
        bookingRef: booking.booking_ref,
        package:    body.packageName,
        total:      body.total,
        eventDate:  body.eventDate,
      }),
    }).catch(console.error);

    return new Response(JSON.stringify(booking), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
`);

// ─── Supabase Edge Function: send-whatsapp ────────────────────────────────────
write(`${ROOT}/supabase/functions/send-whatsapp/index.ts`, `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Uses Twilio WhatsApp API — set these in Supabase Dashboard → Settings → Edge Function Secrets
const TWILIO_SID    = Deno.env.get('TWILIO_ACCOUNT_SID')  || '';
const TWILIO_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')    || '';
const TWILIO_FROM   = Deno.env.get('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886'; // Twilio sandbox

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone, name, bookingRef, package: pkg, total, eventDate } = await req.json();

    const toPhone = phone.startsWith('+') ? phone : \`+966\${phone.replace(/^0/, '')}\`;

    const message =
      \`مرحباً \${name} 👋\\n\\n\` +
      \`تم استلام طلب حجزك في *ATEMA STUDIO* بنجاح ✅\\n\\n\` +
      \`📋 رقم الحجز: *\${bookingRef}*\\n\` +
      \`📦 الباقة: *\${pkg}*\\n\` +
      \`📅 التاريخ: *\${eventDate}*\\n\` +
      \`💰 المجموع: *\${Number(total).toLocaleString()} ر.س*\\n\\n\` +
      \`سيتواصل معك فريقنا قريباً لتأكيد التفاصيل.\\n\` +
      \`للاستفسار: 📞 +966 54 832 3496\`;

    // Send via Twilio
    if (TWILIO_SID && TWILIO_TOKEN) {
      const body = new URLSearchParams({
        To:   \`whatsapp:\${toPhone}\`,
        From: TWILIO_FROM,
        Body: message,
      });

      const res = await fetch(
        \`https://api.twilio.com/2010-04-01/Accounts/\${TWILIO_SID}/Messages.json\`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(\`\${TWILIO_SID}:\${TWILIO_TOKEN}\`),
            'Content-Type':  'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Twilio error');

      return new Response(JSON.stringify({ success: true, sid: result.sid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log-only fallback (no credentials)
    console.log('[WhatsApp STUB] Would send to', toPhone, '\\n', message);
    return new Response(JSON.stringify({ success: true, mode: 'stub' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
`);

// ─── .env.example ─────────────────────────────────────────────────────────────
write(`${ROOT}/.env.example`, `# ─── Supabase ─────────────────────────────────────────────
# Get from: https://app.supabase.com → Project → Settings → API
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# ─── Raed Payment Gateway ───────────────────────────────────
# Get from: Raed merchant dashboard → API keys
VITE_RAED_API_KEY=raed_live_key_xxx
VITE_RAED_MERCHANT_ID=merchant_xxx
VITE_RAED_BASE_URL=https://api.raed.sa/api/v1
VITE_RAED_MODE=sandbox    # change to: production

# ─── Twilio WhatsApp (set in Supabase Edge Function Secrets) ─
# Get from: https://console.twilio.com
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=your_auth_token
# TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
`);

// ─── Backend README ────────────────────────────────────────────────────────────
write(`${ROOT}/BACKEND_SETUP.md`, `# ATEMA Studio — Backend Setup Guide

## 1. Supabase Database

1. Create project at https://app.supabase.com
2. Go to **SQL Editor** and run the full contents of \`database/schema.sql\`
3. Copy your **Project URL** and **anon key** into a \`.env\` file (see \`.env.example\`)

## 2. Deploy Edge Functions

\`\`\`bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy create-booking
supabase functions deploy send-whatsapp

# Set secrets for WhatsApp (Twilio)
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_token
supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
\`\`\`

## 3. Raed Payment Integration

1. Register at https://raed.sa as a merchant
2. Get your **API Key** and **Merchant ID** from the dashboard
3. Add to \`.env\`:
   \`\`\`
   VITE_RAED_API_KEY=raed_live_...
   VITE_RAED_MERCHANT_ID=merchant_...
   VITE_RAED_MODE=production
   \`\`\`

## 4. WhatsApp via Twilio

1. Create account at https://twilio.com
2. Enable WhatsApp in the Twilio Console
3. For production: apply for a **WhatsApp Business Profile**
4. Set secrets in Supabase (see step 2)

## 5. Re-deploy frontend

\`\`\`bash
# Copy .env.example to .env and fill in values, then:
npm run build && npm run deploy
\`\`\`
`);

console.log('All backend files written.');
