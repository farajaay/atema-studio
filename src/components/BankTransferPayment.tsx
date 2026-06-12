// ATEMA STUDIO — Bank Transfer Payment Flow
// — Shown when user picks bank transfer or when Moyasar isn't configured
// — Provides bank account details, copy buttons, contract & invoice download

import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Copy, Check, FileText, Receipt, MessageCircle, Building2, Hash, User as UserIcon, Clock, Eye, Download } from 'lucide-react';
import { openDocumentInNewTab, downloadDocument } from '../services/invoice';

type Lang = 'ar' | 'en';
const tx = (l: Lang, ar: string, en: string) => l === 'ar' ? ar : en;

// Theme-aware tokens — values resolve from document CSS custom properties.
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

// Bank details (Al Rajhi — Fatima Bohassan)
const BANK = {
  name:    'بنك الراجحي',
  nameEn:  'Al Rajhi Bank',
  iban:    'SA0380000000329608010885626',
  account: '329608010885626',
  holder:  'فاطمة بوحسن',
  holderEn:'Fatima Bohassan',
};

const WHATSAPP_NUMBER = '966548323496';

interface Props {
  lang:           Lang;
  bookingRef:     string;
  bookingId:      string;
  depositSAR:     number;
  totalSAR:       number;
  contractHTML?:  string;
  invoiceHTML?:   string;
  onClose:        () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={(e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }} style={{
      display:'flex', alignItems:'center', gap:'5px', padding:'5px 10px',
      borderRadius:'6px', border:`1px solid ${copied ? '#059669' : C.sand}`,
      background: copied ? 'rgba(5,150,105,0.15)' : 'var(--a-surface-alt)', color: copied ? '#34d399' : C.bronze,
      cursor:'pointer', fontSize:'0.7rem', fontFamily:'Tajawal,sans-serif',
      fontWeight:600, transition:'all 0.18s', flexShrink:0,
    }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'تم النسخ' : 'نسخ'}
    </button>
  );
}

function DocumentTile({ icon, label, viewLabel, downloadLabel, onView, onDownload }: {
  icon: React.ReactNode; label: string; viewLabel: string; downloadLabel: string;
  onView: () => void; onDownload: () => void;
}) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:'10px',
      padding:'14px 8px', borderRadius:'12px',
      background:'var(--a-surface)', border:`1.5px solid ${C.sand}`, color: C.bronze,
      fontFamily:'Tajawal,sans-serif',
    }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
        {icon}
        <div style={{ fontWeight:600, fontSize:'0.78rem' }}>{label}</div>
      </div>
      <div style={{ display:'flex', gap:'6px', width:'100%' }}>
        <button onClick={onView}
          style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'4px',
            padding:'7px 6px', borderRadius:'8px', cursor:'pointer',
            background:'var(--a-surface)', border:`1px solid ${C.sand}`, color: C.bronze,
            fontFamily:'Tajawal,sans-serif', fontWeight:600, fontSize:'0.7rem',
            transition:'all 0.18s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.ivory; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}>
          <Eye size={12} />{viewLabel}
        </button>
        <button onClick={onDownload}
          style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'4px',
            padding:'7px 6px', borderRadius:'8px', cursor:'pointer',
            background: C.bronze, border:`1px solid ${C.bronze}`, color: '#0B0B0B',
            fontFamily:'Tajawal,sans-serif', fontWeight:600, fontSize:'0.7rem',
            transition:'all 0.18s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.taupe; e.currentTarget.style.borderColor = C.taupe; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = C.bronze; e.currentTarget.style.borderColor = C.bronze; }}>
          <Download size={12} />{downloadLabel}
        </button>
      </div>
    </div>
  );
}

function BankRow({ icon, label, value, copyable = true }: {
  icon: React.ReactNode; label: string; value: string; copyable?: boolean;
}) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'12px',
      padding:'12px 14px', borderBottom:`1px solid ${C.champagne}`,
    }}>
      <div style={{
        width:'32px', height:'32px', borderRadius:'8px',
        background: C.ivory, display:'flex', alignItems:'center', justifyContent:'center',
        color: C.bronze, flexShrink:0,
      }}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.7rem', color: C.taupe, marginBottom:'2px',
          letterSpacing:'0.06em', fontFamily:'Tajawal,sans-serif' }}>{label}</div>
        <div style={{
          fontFamily:"'Inter',monospace", fontSize:'0.88rem', color: C.black, fontWeight:600,
          direction:'ltr', textAlign:'left', wordBreak:'break-all',
        }}>{value}</div>
      </div>
      {copyable && <CopyButton text={value} />}
    </div>
  );
}

export default function BankTransferPayment({
  lang, bookingRef, bookingId, depositSAR, totalSAR, contractHTML, invoiceHTML, onClose,
}: Props) {

  const [marked, setMarked] = useState(false);

  // Mark booking as awaiting transfer in DB
  async function markAwaitingTransfer() {
    if (supabase && !marked) {
      await supabase.from('bookings')
        .update({ payment_status: 'awaiting_transfer', payment_method: 'bank_transfer' })
        .eq('id', bookingId);
    }
    setMarked(true);
  }

  // Open WhatsApp with prefilled receipt-upload message
  const waMessage = encodeURIComponent(
    `السلام عليكم،\n\nأرسل صورة الحوالة لتأكيد الحجز:\n\n• رقم الحجز: ${bookingRef}\n• الدفعة الأولى: ${depositSAR.toLocaleString()} ر.س\n\nشكراً لكِ 🌸`
  );
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`;

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{ fontFamily:'Tajawal,sans-serif', background:'var(--a-surface)' }}>

      {/* Status banner */}
      <div style={{
        background:`linear-gradient(135deg, ${C.ivory}, ${C.champagne})`,
        padding:'14px 22px', borderBottom:`1px solid ${C.champagne}`,
        display:'flex', alignItems:'center', gap:'10px',
      }}>
        <Clock size={16} color={ICON_GOLD} />
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Amiri',serif", fontSize:'0.95rem', color: C.black }}>
            {tx(lang,'في انتظار استلام التحويل','Awaiting Bank Transfer')}
          </div>
          <div style={{ fontSize:'0.72rem', color: C.taupe, marginTop:'2px' }}>
            {tx(lang,'سيُؤكَّد حجزُكِ فور استلام صورة الحوالة','Your booking will be confirmed once we receive your transfer receipt')}
          </div>
        </div>
      </div>

      <div style={{ padding:'22px' }}>

        {/* Amount due */}
        <div style={{
          background:'linear-gradient(135deg, #1A1610, #2C2418, #3D2E1F)',
          borderRadius:'14px', padding:'20px 22px', color:'#EFE3D1',
          textAlign:'center', marginBottom:'22px',
          boxShadow:`0 8px 24px rgba(140,107,79,0.25)`,
        }}>
          <div style={{ fontSize:'0.7rem', letterSpacing:'0.18em', opacity:0.7,
            fontFamily:"'Inter',sans-serif", marginBottom:'6px' }}>
            {tx(lang,'المبلغ المطلوب الآن (٥٠٪)','AMOUNT DUE NOW (50%)')}
          </div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2.8rem',
            color: C.champagne, lineHeight:1 }}>
            {depositSAR.toLocaleString()}
            <span style={{ fontSize:'0.95rem', marginRight:'6px',
              color: C.sand, fontFamily:'Tajawal,sans-serif' }}>
              {tx(lang,'ر.س','SAR')}
            </span>
          </div>
          <div style={{ fontSize:'0.7rem', color: C.sand, marginTop:'8px',
            opacity:0.85 }}>
            {tx(lang,`الإجمالي: ${totalSAR.toLocaleString()} ر.س — يُسدَّد المتبقي قبل المناسبة بيوم`,
                     `Total: ${totalSAR.toLocaleString()} SAR — Remainder due day before event`)}
          </div>
        </div>

        {/* Bank details card */}
        <div style={{
          border:`1.5px solid ${C.sand}`, borderRadius:'14px',
          background:'var(--a-surface)', overflow:'hidden', marginBottom:'18px',
        }}>
          <div style={{
            background: C.ivory, padding:'12px 16px',
            borderBottom:`1px solid ${C.champagne}`,
            display:'flex', alignItems:'center', gap:'10px',
          }}>
            <Building2 size={15} color={ICON_GOLD} />
            <div style={{ fontFamily:"'Amiri',serif", fontSize:'0.95rem', color: C.black }}>
              {tx(lang,'تفاصيل التحويل البنكي','Bank Transfer Details')}
            </div>
          </div>
          <BankRow icon={<Building2 size={14} />} label="البنك / Bank"
            value={BANK.name} copyable={false} />
          <BankRow icon={<UserIcon size={14} />} label="اسم المستفيد / Beneficiary"
            value={BANK.holder} copyable={false} />
          <BankRow icon={<Hash size={14} />} label="رقم الآيبان / IBAN"
            value={BANK.iban} />
          <BankRow icon={<Hash size={14} />} label="رقم الحساب / Account"
            value={BANK.account} />
          <div style={{
            padding:'12px 16px', background: C.ivory,
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px',
          }}>
            <div style={{ fontSize:'0.75rem', color: C.taupe }}>
              {tx(lang,'استخدمي رقم الحجز كمرجع','Use booking ref as reference')}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <code style={{
                background:'var(--a-surface)', border:`1px solid ${C.sand}`, padding:'4px 10px',
                borderRadius:'6px', fontFamily:"'Inter',monospace", fontSize:'0.78rem',
                color: C.bronze, fontWeight:600,
              }}>{bookingRef}</code>
              <CopyButton text={bookingRef} />
            </div>
          </div>
        </div>

        {/* Action — WhatsApp receipt */}
        <a href={waLink} target="_blank" rel="noreferrer"
          onClick={markAwaitingTransfer}
          style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
            background:'#25D366', color:'white', padding:'14px',
            borderRadius:'12px', textDecoration:'none', fontWeight:700,
            fontSize:'0.95rem', marginBottom:'18px',
            boxShadow:'0 6px 18px rgba(37,211,102,0.32)',
            transition:'transform 0.18s',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
          <MessageCircle size={18} />
          {tx(lang,'أرسلي صورة الحوالة عبر واتساب','Send Receipt via WhatsApp')}
        </a>

        {/* Document downloads */}
        {(contractHTML || invoiceHTML) && (
          <div style={{ marginBottom:'14px' }}>
            <div style={{
              fontSize:'0.72rem', letterSpacing:'0.14em', color: C.bronze,
              fontFamily:"'Cormorant Garamond',serif", textTransform:'uppercase',
              marginBottom:'10px', textAlign:'center',
            }}>
              {tx(lang,'مستنداتُكِ','YOUR DOCUMENTS')}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {contractHTML && (
                <DocumentTile
                  icon={<FileText size={20} />}
                  label={tx(lang,'العقد','Contract')}
                  viewLabel={tx(lang,'عرض','View')}
                  downloadLabel={tx(lang,'تحميل','Download')}
                  onView={() => openDocumentInNewTab(contractHTML, `Contract — ${bookingRef}`)}
                  onDownload={() => downloadDocument(contractHTML, `ATEMA-Contract-${bookingRef}`)}
                />
              )}
              {invoiceHTML && (
                <DocumentTile
                  icon={<Receipt size={20} />}
                  label={tx(lang,'الفاتورة الضريبية','Tax Invoice')}
                  viewLabel={tx(lang,'عرض','View')}
                  downloadLabel={tx(lang,'تحميل','Download')}
                  onView={() => openDocumentInNewTab(invoiceHTML, `Invoice — ${bookingRef}`)}
                  onDownload={() => downloadDocument(invoiceHTML, `ATEMA-Invoice-${bookingRef}`)}
                />
              )}
            </div>
          </div>
        )}

        {/* Footnote */}
        <div style={{
          background: C.ivory, borderRadius:'10px', padding:'12px 14px',
          fontSize:'0.72rem', color: C.mocha, lineHeight:1.7,
        }}>
          ✓ {tx(lang,'ستصلكِ رسالة تأكيد فور التحقق من التحويل (عادةً خلال ساعة)',
                       'You\'ll receive confirmation as soon as the transfer is verified (usually within an hour)')}
          <br/>
          ⚠ {tx(lang,'الدفعة الأولى ٥٠٪ غير قابلة للاسترداد بعد التأكيد',
                       '50% deposit is non-refundable after confirmation')}
          <br/>
          🛡 {tx(lang,'هذا هو الآيبان الرسمي الوحيد لاستوديو ATEMA ولا يتغيّر — تجدينه دائماً في صفحة السياسات على موقعنا',
                       'This is ATEMA’s only official IBAN and it never changes — it is always listed on our policies page')}
        </div>

        {/* Close */}
        <button onClick={onClose}
          style={{
            width:'100%', marginTop:'14px', padding:'10px',
            background:'transparent', border:`1px solid ${C.sand}`,
            borderRadius:'8px', color: C.taupe, cursor:'pointer',
            fontFamily:'Tajawal,sans-serif', fontSize:'0.82rem',
          }}>
          {tx(lang,'إغلاق','Close')}
        </button>
      </div>
    </div>
  );
}
