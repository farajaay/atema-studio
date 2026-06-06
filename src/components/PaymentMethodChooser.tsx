// ATEMA STUDIO — Payment Method Chooser
// Lets the customer pick between online card payment (Moyasar) and bank transfer

import { CreditCard, Building2, ArrowLeft } from 'lucide-react';

type Lang = 'ar' | 'en';
const tx = (l: Lang, ar: string, en: string) => l === 'ar' ? ar : en;

// Theme-aware tokens — values resolve from the document CSS custom properties.
const C = {
  ivory:     'var(--a-surface)',
  sand:      'var(--a-border-strong)',
  champagne: 'var(--a-surface-alt)',
  bronze:    'var(--a-gold)',
  taupe:     'var(--a-text-soft)',
  mocha:     'var(--a-text)',
  black:     'var(--a-heading)',
};
const ICON_GOLD = '#D4AF7A';
const ICON_CHAMPAGNE = '#EFE3D1';

export type PaymentMethod = 'card' | 'transfer';

interface Props {
  lang:              Lang;
  depositSAR:        number;
  moyasarEnabled:    boolean;
  transferEnabled?:  boolean;
  /** Display names for enabled online methods (e.g. 'فيزا · مدى · Apple Pay'). */
  onlineSubtitle?:   { ar: string; en: string };
  onSelect:          (m: PaymentMethod) => void;
}

export default function PaymentMethodChooser({ lang, depositSAR, moyasarEnabled, transferEnabled = true, onlineSubtitle, onSelect }: Props) {
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{ padding:'24px 22px', background:'var(--a-surface)', fontFamily:'Tajawal,sans-serif' }}>

      <div style={{ textAlign:'center', marginBottom:'22px' }}>
        <div style={{ fontSize:'0.7rem', letterSpacing:'0.18em', color: C.bronze,
          fontFamily:"'Cormorant Garamond',serif", textTransform:'uppercase',
          marginBottom:'8px' }}>
          {tx(lang,'اختاري طريقة الدفع','SELECT PAYMENT METHOD')}
        </div>
        <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.25rem', color: C.black,
          marginBottom:'4px' }}>
          {tx(lang,`دفعة أولى ${depositSAR.toLocaleString()} ر.س`,
                   `${depositSAR.toLocaleString()} SAR Deposit`)}
        </div>
        <div style={{ fontSize:'0.78rem', color: C.taupe }}>
          {tx(lang,'٥٠٪ من الإجمالي لتأكيد حجزُكِ','50% of total to confirm your booking')}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

        {/* Online card payment */}
        {moyasarEnabled && (
          <button onClick={() => onSelect('card')}
            style={{
              display:'flex', alignItems:'center', gap:'14px', padding:'18px 18px',
              borderRadius:'14px', cursor:'pointer', textAlign:'right',
              background:`linear-gradient(135deg, ${C.black}, #2C2C2C, #4A3728)`,
              color: C.champagne, border:'none',
              boxShadow:`0 8px 24px rgba(140,107,79,0.22)`,
              fontFamily:'Tajawal,sans-serif', transition:'transform 0.18s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
            onMouseUp={(e)   => (e.currentTarget.style.transform = 'scale(1)')}
            >
            <div style={{
              width:'46px', height:'46px', borderRadius:'12px',
              background:'rgba(232,217,197,0.14)', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              border:`1px solid ${C.bronze}`,
            }}>
              <CreditCard size={22} color={ICON_CHAMPAGNE} />
            </div>
            <div style={{ flex:1, minWidth:0, textAlign: lang==='ar'?'right':'left' }}>
              <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.05rem', color: C.champagne,
                marginBottom:'3px' }}>
                {tx(lang,'الدفع الإلكتروني','Online Card Payment')}
              </div>
              <div style={{ fontSize:'0.74rem', color: C.sand, opacity:0.85, lineHeight:1.6 }}>
                {onlineSubtitle
                  ? (lang === 'ar' ? onlineSubtitle.ar : onlineSubtitle.en)
                  : tx(lang,'فيزا · ماستركارد · STC Pay','Visa · Mastercard · STC Pay')}
              </div>
              <div style={{
                display:'inline-block', marginTop:'7px',
                fontSize:'0.65rem', letterSpacing:'0.1em', color: C.champagne,
                background:'rgba(232,217,197,0.16)', padding:'2px 8px', borderRadius:'6px',
                fontFamily:"'Inter',sans-serif",
              }}>
                {tx(lang,'تأكيد فوري ✓','INSTANT CONFIRMATION ✓')}
              </div>
            </div>
            <ArrowLeft size={18} style={{
              color: C.sand,
              transform: lang==='ar' ? 'none' : 'rotate(180deg)',
              flexShrink:0,
            }} />
          </button>
        )}

        {/* Bank transfer */}
        {transferEnabled && <button onClick={() => onSelect('transfer')}
          style={{
            display:'flex', alignItems:'center', gap:'14px', padding:'18px 18px',
            borderRadius:'14px', cursor:'pointer', textAlign:'right',
            background:'white', color: C.black,
            border:`1.5px solid ${C.sand}`,
            fontFamily:'Tajawal,sans-serif', transition:'all 0.18s',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
          onMouseUp={(e)   => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.ivory; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
          >
          <div style={{
            width:'46px', height:'46px', borderRadius:'12px',
            background: C.ivory, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:`1px solid ${C.champagne}`,
          }}>
            <Building2 size={22} color={ICON_GOLD} />
          </div>
          <div style={{ flex:1, minWidth:0, textAlign: lang==='ar'?'right':'left' }}>
            <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.05rem', color: C.black,
              marginBottom:'3px' }}>
              {tx(lang,'تحويل بنكي','Bank Transfer')}
            </div>
            <div style={{ fontSize:'0.74rem', color: C.taupe, lineHeight:1.6 }}>
              {tx(lang,'بنك الراجحي — تأكيد الحجز عند استلام الحوالة',
                       'Al Rajhi Bank — Booking confirmed upon receipt')}
            </div>
            <div style={{
              display:'inline-block', marginTop:'7px',
              fontSize:'0.65rem', letterSpacing:'0.1em', color: C.bronze,
              background: C.champagne, padding:'2px 8px', borderRadius:'6px',
              fontFamily:"'Inter',sans-serif",
            }}>
              {tx(lang,'مع إرفاق صورة الحوالة','RECEIPT REQUIRED')}
            </div>
          </div>
          <ArrowLeft size={18} style={{
            color: C.bronze,
            transform: lang==='ar' ? 'none' : 'rotate(180deg)',
            flexShrink:0,
          }} />
        </button>}
      </div>

      {!moyasarEnabled && (
        <div style={{
          marginTop:'16px', padding:'10px 14px', borderRadius:'10px',
          background: C.ivory, fontSize:'0.72rem', color: C.taupe,
          textAlign:'center', lineHeight:1.6,
        }}>
          ℹ {tx(lang,'الدفع الإلكتروني سيُفعَّل قريباً — التحويل البنكي متاح حالياً',
                       'Online payment activating soon — bank transfer available now')}
        </div>
      )}
    </div>
  );
}
