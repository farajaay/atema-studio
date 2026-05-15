import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

function write(p, c) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, c, 'utf8');
  console.log('wrote:', p);
}

const BASE = 'C:/Users/Ahmad/Downloads/Project Photography/_deploy/atema-studio/src';

// ─── PackageCard ────────────────────────────────────────────────────────────
write(`${BASE}/components/PackageCard.tsx`, `import React from 'react';
import type { Package } from '../types';
import { ATEMA_COLORS } from '../config/constants';
import { useAppContext } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Heart, Camera, Image, Gem, Star, Crown, Clock, CheckCircle2, Video } from 'lucide-react';

interface PackageCardProps { package: Package; design: 1 | 2; }

function PackageIcon({ nameAr, size = 36 }: { nameAr: string; size?: number }) {
  const c = ATEMA_COLORS.champagne;
  if (nameAr === 'جلسة الخطوبة')      return <Heart   size={size} color={c} strokeWidth={1.5} />;
  if (nameAr === 'الباقة المخصصة')    return <Camera  size={size} color={c} strokeWidth={1.5} />;
  if (nameAr === 'الباقة الكلاسيكية') return <Image   size={size} color={c} strokeWidth={1.5} />;
  if (nameAr === 'الباقة الملكية')    return <Gem     size={size} color={c} strokeWidth={1.5} />;
  if (nameAr === 'باقة التوقيع')      return <Star    size={size} color={c} strokeWidth={1.5} />;
  return <Crown size={size} color={c} strokeWidth={1.5} />;
}

const PackageCard: React.FC<PackageCardProps> = ({ package: pkg, design }) => {
  const { selectedPackage, selectPackage } = useAppContext();
  const { isMobile } = useBreakpoint();
  const isSelected = selectedPackage?.id === pkg.id;
  const shadow   = isSelected ? '0 16px 40px rgba(212,181,160,0.28)' : '0 2px 8px rgba(0,0,0,0.05)';
  const lift     = isSelected ? 'translateY(-8px)' : 'translateY(0)';
  const onEnter  = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(212,181,160,0.22)'; };
  const onLeave  = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = lift; e.currentTarget.style.boxShadow = shadow; };

  const Features = () => (
    <div style={{ marginBottom: '20px' }}>
      {pkg.features.map((f, i) => (
        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'8px', fontSize:'13px', color:'#555' }}>
          <CheckCircle2 size={14} color={ATEMA_COLORS.champagne} style={{ marginTop:'2px', flexShrink:0 }} />
          <span>{f}</span>
        </div>
      ))}
      {pkg.video && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:ATEMA_COLORS.deepBronze, fontWeight:600, marginTop:'4px' }}>
          <Video size={14} color={ATEMA_COLORS.deepBronze} style={{ flexShrink:0 }} />
          <span>يشمل فيديو سينمائي</span>
        </div>
      )}
    </div>
  );

  const base: React.CSSProperties = {
    background:'white', borderRadius:'12px', cursor:'pointer', transition:'all 0.3s ease',
    transform: lift, position:'relative', overflow:'hidden', boxShadow: shadow,
    padding: isMobile ? '22px 18px' : '34px 28px',
  };

  if (design === 1) return (
    <div onClick={() => selectPackage(pkg)} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{ ...base, border: \`2px solid \${isSelected ? ATEMA_COLORS.champagne : '#eee'}\`, textAlign:'center' }}>
      {pkg.badge && <div style={{ position:'absolute', top:'12px', right:'12px',
        background:\`linear-gradient(135deg, \${ATEMA_COLORS.champagne}, \${ATEMA_COLORS.warmSand})\`,
        color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'10px', fontWeight:700 }}>{pkg.badge}</div>}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:'14px' }}><PackageIcon nameAr={pkg.nameAr} size={38} /></div>
      <h3 style={{ fontSize:'16px', fontWeight:700, color:ATEMA_COLORS.deepBronze, marginBottom:'6px' }}>{pkg.nameAr}</h3>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', fontSize:'12px', color:'#aaa', marginBottom:'14px' }}>
        <Clock size={12} color='#ccc' />{pkg.durationHours} ساعات
      </div>
      <div style={{ fontSize:'30px', color:ATEMA_COLORS.champagne, fontWeight:700 }}>{pkg.price.toLocaleString()}</div>
      <div style={{ fontSize:'11px', color:'#bbb', marginBottom:'16px' }}>ر.س شامل VAT</div>
      <Features />
      <button style={{ background: isSelected ? ATEMA_COLORS.deepBronze : ATEMA_COLORS.champagne,
        color:'white', border:'none', padding:'11px', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:600, width:'100%' }}>
        {isSelected ? '✓ تم الاختيار' : 'اختري الآن'}
      </button>
    </div>
  );

  return (
    <div onClick={() => selectPackage(pkg)} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{ ...base, borderLeft: \`4px solid \${isSelected ? ATEMA_COLORS.deepBronze : ATEMA_COLORS.champagne}\` }}>
      {pkg.badge && <div style={{ display:'inline-block',
        background:\`linear-gradient(135deg, \${ATEMA_COLORS.champagne}, \${ATEMA_COLORS.warmSand})\`,
        color:'white', padding:'4px 12px', borderRadius:'12px', fontSize:'11px', fontWeight:700, marginBottom:'12px' }}>{pkg.badge}</div>}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
        <PackageIcon nameAr={pkg.nameAr} size={30} />
        <h3 style={{ fontSize:'17px', fontWeight:700, color:ATEMA_COLORS.deepBronze, margin:0 }}>{pkg.nameAr}</h3>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', color:'#aaa', marginBottom:'14px' }}>
        <Clock size={12} color='#ccc' />{pkg.durationHours} ساعات
      </div>
      <div style={{ fontSize:'32px', color:ATEMA_COLORS.champagne, fontWeight:700 }}>{pkg.price.toLocaleString()}</div>
      <div style={{ fontSize:'11px', color:'#bbb', marginBottom:'16px' }}>ر.س شامل VAT</div>
      <Features />
      <button style={{ background:\`linear-gradient(135deg, \${ATEMA_COLORS.champagne}, \${ATEMA_COLORS.warmSand})\`,
        color:'white', border:'none', padding:'12px', borderRadius:'8px', cursor:'pointer', fontWeight:600, width:'100%', fontSize:'14px' }}>
        {isSelected ? '✓ تم الاختيار' : 'اختري الآن'}
      </button>
    </div>
  );
};

export default PackageCard;
`);

// ─── BookingSummary ──────────────────────────────────────────────────────────
write(`${BASE}/components/BookingSummary.tsx`, `import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ATEMA_COLORS } from '../config/constants';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { ClipboardList, Package, PlusCircle, ReceiptText, Percent, CircleDollarSign, ArrowRight } from 'lucide-react';

const Row = ({ icon, label, value, bold }: { icon: React.ReactNode; label: string; value: string; bold?: boolean }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'11px 0', borderBottom:'1px solid #f5f0ec', fontSize:'13px' }}>
    <span style={{ display:'flex', alignItems:'center', gap:'7px', color:'#777' }}>
      {icon}{label}
    </span>
    <span style={{ fontWeight: bold ? 700 : 500, color: bold ? ATEMA_COLORS.editorialBlack : '#555' }}>{value}</span>
  </div>
);

const BookingSummary: React.FC = () => {
  const { selectedPackage, selectedAddOns, subtotal, vat, total } = useAppContext();
  const { isMobile } = useBreakpoint();

  return (
    <aside style={{
      position: isMobile ? 'static' : 'sticky',
      top: '90px',
      background: 'white',
      padding: isMobile ? '22px 18px' : '28px 24px',
      borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.09)',
      width: isMobile ? '100%' : '340px',
      boxSizing: 'border-box',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
        <ClipboardList size={18} color={ATEMA_COLORS.deepBronze} />
        <h3 style={{ fontSize:'15px', fontWeight:700, color:ATEMA_COLORS.deepBronze, margin:0 }}>ملخص حجزك</h3>
      </div>

      <Row icon={<Package size={13} color='#bbb' />} label='الباقة المختارة'
        value={selectedPackage?.nameAr || 'لم تختر بعد'} bold />
      <Row icon={<ReceiptText size={13} color='#bbb' />} label='سعر الباقة'
        value={selectedPackage ? \`\${selectedPackage.price.toLocaleString()} ر.س\` : '0'} bold />
      <Row icon={<PlusCircle size={13} color='#bbb' />} label='الإضافات'
        value={selectedAddOns.length > 0 ? \`\${selectedAddOns.length} خدمة\` : 'لا توجد'} />
      <Row icon={<ReceiptText size={13} color='#bbb' />} label='سعر الإضافات'
        value={selectedAddOns.length > 0
          ? \`\${selectedAddOns.reduce((s, a) => s + a.price, 0).toLocaleString()} ر.س\` : '0'} />

      <div style={{ height:'1px', background: ATEMA_COLORS.champagne + '40', margin:'14px 0' }} />

      <Row icon={<ReceiptText size={13} color='#bbb' />} label='الإجمالي قبل VAT'
        value={\`\${subtotal.toLocaleString()} ر.س\`} />
      <Row icon={<Percent size={13} color='#bbb' />} label='VAT 15%'
        value={\`\${vat.toLocaleString()} ر.س\`} />

      <div style={{ height:'1px', background: ATEMA_COLORS.champagne + '40', margin:'14px 0' }} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'12px 0', fontSize:'17px', fontWeight:700, color:ATEMA_COLORS.deepBronze }}>
        <span style={{ display:'flex', alignItems:'center', gap:'7px' }}>
          <CircleDollarSign size={17} color={ATEMA_COLORS.champagne} />المجموع النهائي
        </span>
        <span style={{ color: ATEMA_COLORS.champagne }}>{total.toLocaleString()} ر.س</span>
      </div>

      <button
        disabled={!selectedPackage}
        style={{
          width:'100%', background: selectedPackage ? ATEMA_COLORS.champagne : '#ccc',
          color:'white', border:'none', padding:'14px', borderRadius:'8px',
          fontSize:'14px', fontWeight:700, cursor: selectedPackage ? 'pointer' : 'not-allowed',
          marginTop:'16px', transition:'all 0.2s',
          display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'
        }}
      >
        متابعة الحجز <ArrowRight size={16} />
      </button>
    </aside>
  );
};

export default BookingSummary;
`);

// ─── App.tsx ─────────────────────────────────────────────────────────────────
write(`${BASE}/App.tsx`, `import React from 'react';
import { useAppContext } from './context/AppContext';
import { PACKAGES, ADDONS, ATEMA_COLORS } from './config/constants';
import Header from './components/Header';
import PackageCard from './components/PackageCard';
import BookingSummary from './components/BookingSummary';
import { useBreakpoint } from './hooks/useBreakpoint';
import { Clock, Timer, Zap, Mic2, BookOpen, Film, Phone, Mail, MapPin } from 'lucide-react';

function AddonIcon({ id }: { id: string }) {
  const s = 20; const c = ATEMA_COLORS.champagne;
  if (id === 'extra-hour')       return <Timer   size={s} color={c} />;
  if (id === 'extra-photos')     return <Clock   size={s} color={c} />;
  if (id === 'drone')            return <Mic2    size={s} color={c} />;
  if (id === 'express-delivery') return <Zap     size={s} color={c} />;
  if (id === 'album-print')      return <BookOpen size={s} color={c} />;
  if (id === 'extra-video')      return <Film    size={s} color={c} />;
  return <Clock size={s} color={c} />;
}

const App: React.FC = () => {
  const { design, selectedAddOns, toggleAddOn, language } = useAppContext();
  const { isMobile, isTablet } = useBreakpoint();

  const cols = isMobile ? 1 : isTablet ? 2 : 3;
  const addonCols = isMobile ? 2 : isTablet ? 3 : 6;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{ background: ATEMA_COLORS.softIvory, fontFamily: 'Cairo, Tajawal, Inter, sans-serif', minHeight:'100vh' }}>
      <Header />

      <div style={{ maxWidth:'1400px', margin:'0 auto', padding: isMobile ? '24px 16px' : '40px 30px' }}>

        {/* Hero Banner — Design 2 only */}
        {design === 2 && (
          <div style={{ background:\`linear-gradient(135deg, \${ATEMA_COLORS.deepBronze}, \${ATEMA_COLORS.champagne})\`,
            padding: isMobile ? '40px 24px' : '60px', borderRadius:'16px', color:'white',
            marginBottom:'40px', textAlign:'center',
            boxShadow:\`0 15px 40px rgba(140,107,79,0.3)\` }}>
            <h2 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight:700, marginBottom:'12px' }}>احجزي حفلتك الآن</h2>
            <p style={{ fontSize:'16px', opacity:0.9 }}>باقات احترافية مصممة لكل مناسبة</p>
          </div>
        )}

        {/* Design 1 hero */}
        {design === 1 && (
          <div style={{ textAlign:'center', marginBottom: isMobile ? '40px' : '70px',
            padding: isMobile ? '30px 0' : '50px 0' }}>
            <div style={{ fontSize: isMobile ? '36px' : '56px', letterSpacing:'8px',
              color: ATEMA_COLORS.champagne, fontWeight:300, marginBottom:'16px' }}>ATEMA</div>
            <p style={{ fontSize:'16px', color:'#888', letterSpacing:'1px', fontWeight:300 }}>
              PROFESSIONAL PHOTOGRAPHY SERVICES
            </p>
          </div>
        )}

        {/* Main layout: packages + summary */}
        <div style={{ display:'flex', gap: isMobile ? '24px' : '32px',
          flexDirection: isMobile ? 'column' : 'row', alignItems:'flex-start' }}>

          {/* Package grid */}
          <div style={{ flex:1 }}>
            <div style={{ display:'grid',
              gridTemplateColumns:\`repeat(\${cols}, 1fr)\`,
              gap: isMobile ? '16px' : '24px', marginBottom:'40px' }}>
              {PACKAGES.map(pkg => <PackageCard key={pkg.id} package={pkg} design={design} />)}
            </div>

            {/* Add-ons */}
            <div style={{ marginTop:'10px', paddingTop:'32px', borderTop:\`1px solid rgba(212,181,160,0.25)\` }}>
              <h3 style={{ fontSize:'20px', fontWeight:700, color:ATEMA_COLORS.deepBronze,
                marginBottom:'24px', textAlign:'center' }}>خدمات إضافية اختيارية</h3>
              <div style={{ display:'grid',
                gridTemplateColumns:\`repeat(\${addonCols}, 1fr)\`,
                gap: isMobile ? '12px' : '16px' }}>
                {ADDONS.map(addon => {
                  const isSel = selectedAddOns.some(a => a.id === addon.id);
                  return (
                    <div key={addon.id} onClick={() => toggleAddOn(addon)}
                      style={{ background: isSel ? 'rgba(212,181,160,0.1)' : 'white',
                        padding: isMobile ? '16px 12px' : '20px',
                        borderRadius:'10px',
                        border:\`2px solid \${isSel ? ATEMA_COLORS.champagne : '#f0f0f0'}\`,
                        cursor:'pointer', transition:'all 0.2s', textAlign:'center' }}>
                      <div style={{ display:'flex', justifyContent:'center', marginBottom:'10px' }}>
                        <AddonIcon id={addon.id} />
                      </div>
                      <div style={{ fontSize:'12px', fontWeight:700, color:ATEMA_COLORS.deepBronze, marginBottom:'6px' }}>
                        {addon.nameAr}
                      </div>
                      <div style={{ fontSize:'13px', color:ATEMA_COLORS.champagne, fontWeight:700 }}>
                        {addon.price} ر.س
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Booking Summary */}
          <BookingSummary />
        </div>
      </div>

      {/* Footer */}
      <footer style={{ marginTop:'80px', padding: isMobile ? '30px 20px' : '40px 30px',
        background:'white', textAlign:'center', borderTop:'1px solid #f0f0f0' }}>
        <p style={{ fontSize:'13px', color:'#999', marginBottom:'16px' }}>
          © 2024 ATEMA STUDIO — جميع الحقوق محفوظة
        </p>
        <div style={{ display:'flex', justifyContent:'center', gap: isMobile ? '16px' : '30px',
          flexWrap:'wrap' }}>
          {[
            { Icon: Phone,  text: '+966 54 832 3496' },
            { Icon: Mail,   text: 'info@atemastudio.com' },
            { Icon: MapPin, text: 'الجبيل — السعودية' },
          ].map(({ Icon, text }) => (
            <span key={text} style={{ display:'flex', alignItems:'center', gap:'6px',
              fontSize:'13px', color:ATEMA_COLORS.deepBronze, fontWeight:600 }}>
              <Icon size={14} color={ATEMA_COLORS.champagne} />{text}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default App;
`);

// ─── Supabase client ─────────────────────────────────────────────────────────
write(`${BASE}/services/supabase.ts`, `import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('[Supabase] Missing env vars — running in mock mode');
}

export const supabase = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;
`);

// ─── booking service (real + mock fallback) ──────────────────────────────────
write(`${BASE}/services/booking.ts`, `import type { CreateBookingRequest, BookingResponse } from '../types';
import { supabase } from './supabase';

function ref(): string {
  return \`ATEMA-\${Date.now()}-\${Math.random().toString(36).substr(2,9).toUpperCase()}\`;
}

export async function createBooking(payload: CreateBookingRequest): Promise<BookingResponse> {
  // Real Supabase call
  if (supabase) {
    const { data, error } = await supabase
      .from('bookings')
      .insert([{
        package_id:       payload.packageId,
        addon_ids:        payload.addOnIds,
        event_date:       payload.eventDate,
        event_time:       payload.eventTime,
        customer_name:    payload.customerName,
        customer_phone:   payload.customerPhone,
        customer_email:   payload.customerEmail,
        location:         payload.location,
        special_requests: payload.specialRequests,
        subtotal:         payload.subtotal,
        vat:              payload.vat,
        total:            payload.total,
        status:           'pending',
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      id:         data.id,
      bookingRef: data.booking_ref,
      status:     data.status,
      createdAt:  data.created_at,
      eventDate:  data.event_date,
      total:      data.total,
    };
  }

  // Mock fallback
  await new Promise(r => setTimeout(r, 800));
  return {
    id: \`mock_\${Date.now()}\`,
    bookingRef: ref(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    eventDate: payload.eventDate,
    total: payload.total,
  };
}

export async function getPackages() {
  if (!supabase) return null;
  const { data } = await supabase.from('packages').select('*').order('price');
  return data;
}
`);

// ─── Raed payment (production-ready) ─────────────────────────────────────────
write(`${BASE}/services/raed/client.ts`, `import type { RaedPaymentResponse } from '../../types';

const RAED = {
  apiKey:     import.meta.env.VITE_RAED_API_KEY     as string || '',
  merchantId: import.meta.env.VITE_RAED_MERCHANT_ID  as string || '',
  baseUrl:    import.meta.env.VITE_RAED_BASE_URL     as string || 'https://api.raed.sa/api/v1',
  mode:       (import.meta.env.VITE_RAED_MODE        as 'sandbox' | 'production') || 'sandbox',
};

function orderId() {
  return \`ATEMA-\${Date.now()}-\${Math.random().toString(36).substr(2,9).toUpperCase()}\`;
}

function normPhone(phone: string): string {
  let c = phone.replace(/\\D/g, '');
  if (c.startsWith('0')) c = c.substring(1);
  if (c.length === 9) c = '966' + c;
  return \`+\${c}\`;
}

function validPhone(phone: string): boolean {
  return /^(\\+966|00966|0)?5[0-9]{8}$/.test(phone.replace(/\\s/g, ''));
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
      const res = await fetch(\`\${RAED.baseUrl}/payments/create\`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': \`Bearer \${RAED.apiKey}\`,
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
          success_url:    \`\${window.location.origin}/booking/success?ref=\${data.bookingRef}\`,
          failure_url:    \`\${window.location.origin}/booking/failure?ref=\${data.bookingRef}\`,
          cancel_url:     \`\${window.location.origin}/booking/cancel?ref=\${data.bookingRef}\`,
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
    transactionId: \`TXN-\${Date.now()}\`,
    paymentUrl:    \`https://checkout.raed.sa/pay?order_id=\${oid}&mode=sandbox\`,
    message: 'Sandbox payment intent created',
  };
}

export function isValidPaymentResponse(r: RaedPaymentResponse): boolean {
  return r.status === 'success' && !!r.transactionId && !!r.paymentUrl;
}

export { RAED as RAED_CONFIG };
`);

console.log('All files written.');
