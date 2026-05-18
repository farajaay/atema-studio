// ATEMA STUDIO — Luxury Booking Page
// Design: V4/V5 prototype — Cormorant Garamond · Amiri · Tajawal
// Photos: drop your images into /public/photos/ (engagement.jpg, classic.jpg, royal.jpg, signature.jpg, couture.jpg, hero.jpg)

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { usePackagesData } from '../hooks/usePackagesData';
import type { Package } from '../hooks/usePackagesData';
import { useAddonsData } from '../hooks/useAddonsData';
import type { Addon } from '../hooks/useAddonsData';
import { createBooking } from '../services/booking';
import { generateContractHTML, saveContract } from '../services/contract';
import { generateInvoiceHTML, generateInvoiceNumber, saveInvoice } from '../services/invoice';
import MoyasarForm from '../components/MoyasarForm';
import PaymentMethodChooser from '../components/PaymentMethodChooser';
import BankTransferPayment from '../components/BankTransferPayment';
import DatePicker from '../components/DatePicker';
import { useAppSettings } from '../hooks/useAppSettings';
import { computeVat } from '../services/settings';
import { X, Loader2 } from 'lucide-react';
import { useTheme, getInitialTheme } from '../hooks/useTheme';
import { useLang } from '../hooks/useLang';
import { getBookingPalette } from '../theme/themes';
import type { ThemeName } from '../theme/themes';
import {
  normalizeSaudiMobile, validEmail, isFutureOrToday, clampText,
} from '../utils/validation';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

// ── Design tokens — theme-aware, live-mutated on theme change ────────────────
// T is a module-level object that mirrors the active theme palette. The main
// BookingPage component calls syncT(theme) during render so all inner helpers
// (PkgCard, SummaryPanel, etc.) read the correct hex values without prop
// drilling. Re-render is triggered by useTheme() returning a new name.
const T = { ...getBookingPalette(getInitialTheme()) };
let activeTheme: ThemeName = getInitialTheme();
function syncT(name: ThemeName) {
  if (name === activeTheme) return;
  Object.assign(T, getBookingPalette(name));
  activeTheme = name;
}

type Lang = 'ar' | 'en';
const tx = (lang: Lang, ar: string, en: string) => lang === 'ar' ? ar : en;

// ── Visual config (gradient + photo) by package name keywords or price tier ───
// Tier 0–5 corresponds to the original ivory palette steps (lightest → darkest).
// Per-theme gradient stops below map each tier to a different visual mood.
const PKG_GRADIENTS: Record<ThemeName, string[]> = {
  ivory: [
    'linear-gradient(160deg,#F0E6DA,#E8D9C5)', // 0 engagement
    'linear-gradient(160deg,#EDE4D8,#D6BFA3)', // 1 customise
    'linear-gradient(160deg,#D6BFA3,#C4A882)', // 2 classic
    'linear-gradient(160deg,#C4A882,#8C6B4F)', // 3 royal
    'linear-gradient(160deg,#6B5440,#2C2C2C)', // 4 signature
    'linear-gradient(160deg,#1A1A1A,#2C2C2C)', // 5 couture
  ],
  noir: [
    'linear-gradient(160deg,#1F1A12,#2A2418)', // 0 engagement (warm dusk)
    'linear-gradient(160deg,#1C1C1C,#322B1E)', // 1 customise
    'linear-gradient(160deg,#2A2418,#3D3320)', // 2 classic
    'linear-gradient(160deg,#3D3320,#5C4520)', // 3 royal (gilded)
    'linear-gradient(160deg,#1A1610,#0F0D08)', // 4 signature (noir)
    'linear-gradient(160deg,#0B0B0B,#1A1610)', // 5 couture (deepest)
  ],
};
function gradFor(tier: number): string {
  const stops = PKG_GRADIENTS[activeTheme] ?? PKG_GRADIENTS.ivory;
  return stops[Math.max(0, Math.min(stops.length - 1, tier))];
}
function getVisual(pkg: Package): { gradient: string; photo: string } {
  const n = (pkg.name_ar + ' ' + pkg.name_en).toLowerCase();
  if (n.includes('خطوبة') || n.includes('engagement'))
    return { gradient: gradFor(0), photo: 'engagement.jpeg' };
  if (n.includes('مخصّص') || n.includes('مخصص') || n.includes('customis'))
    return { gradient: gradFor(1), photo: 'customise.jpeg' };
  if (n.includes('كلاسيك') || n.includes('classic'))
    return { gradient: gradFor(2), photo: 'classic.jpeg' };
  if (n.includes('ملكي') || n.includes('royal'))
    return { gradient: gradFor(3), photo: 'royal.jpeg' };
  if (n.includes('توقيع') || n.includes('signature'))
    return { gradient: gradFor(4), photo: 'signature.jpeg' };
  if (n.includes('couture') || n.includes('كوتور') || n.includes('كوتيور'))
    return { gradient: gradFor(5), photo: 'couture.jpeg' };
  // Price-tier fallback for custom packages
  if (pkg.price < 2500)  return { gradient: gradFor(0), photo: 'engagement.jpeg' };
  if (pkg.price < 5000)  return { gradient: gradFor(2), photo: 'classic.jpeg' };
  if (pkg.price < 8000)  return { gradient: gradFor(3), photo: 'royal.jpeg' };
  if (pkg.price < 12000) return { gradient: gradFor(4), photo: 'signature.jpeg' };
  return { gradient: gradFor(5), photo: 'couture.jpeg' };
}


const CITIES = [
  { value:'jubail',  ar:'الجبيل (مجاني)',              en:'Jubail (free)',           fee:0    },
  { value:'dammam',  ar:'الدمام — +٢٠٠ ر.س',          en:'Dammam — +200 SAR',       fee:200  },
  { value:'khobar',  ar:'الخبر — +٢٠٠ ر.س',           en:'Al Khobar — +200 SAR',    fee:200  },
  { value:'qatif',   ar:'القطيف — +٢٠٠ ر.س',          en:'Qatif — +200 SAR',        fee:200  },
  { value:'ahsa',    ar:'الأحساء / الهفوف — +٤٥٠ ر.س', en:'Al Ahsa — +450 SAR',     fee:450  },
  { value:'riyadh',  ar:'الرياض — يُحدد بالتواصل',     en:'Riyadh — contact us',     fee:0    },
  { value:'other',   ar:'أخرى — يُحدد بالتواصل',       en:'Other — contact us',      fee:0    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL; // '/' on the custom domain (atemastudio.xyz)

// ── Package Card ──────────────────────────────────────────────────────────────
function PkgCard({ pkg, lang, selected, onSelect, onDetails }: {
  pkg: Package; lang: Lang; selected: boolean; onSelect: () => void; onDetails: () => void;
}) {
  const [photoOk, setPhotoOk] = useState(true);
  const visual = getVisual(pkg);
  const lightCard = pkg.price < 8500;
  const textOnPhoto = lightCard ? T.espresso : '#F5EDE2';

  return (
    <div className="pkg-card-wrap" onClick={onDetails} style={{
      borderRadius:'16px', overflow:'hidden', cursor:'pointer',
      background: T.pearl,
      border: `1.5px solid ${selected ? T.sand : 'rgba(201,179,147,0.18)'}`,
      boxShadow: selected ? `0 8px 32px rgba(168,139,95,0.2)` : '0 2px 14px rgba(61,46,31,0.05)',
    }}>
      {/* Photo / gradient area */}
      <div style={{ position:'relative', height:'200px', overflow:'hidden',
        background: visual.gradient }}>
        {photoOk && (
          // <picture> serves the lightweight WebP variant to modern browsers
          // and falls back to the optimised JPEG everywhere else.
          // lazy + async decoding keeps the booking-page first paint fast —
          // package photos sit below the hero so they don't need to block.
          <picture>
            <source type="image/webp"
              srcSet={`${BASE}photos/${visual.photo.replace(/\.[^.]+$/, '.webp')}`} />
            <img src={`${BASE}photos/${visual.photo}`} alt={pkg.name_ar}
              className="pkg-photo"
              loading="lazy"
              decoding="async"
              width={400} height={200}
              style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}
              onError={() => setPhotoOk(false)} />
          </picture>
        )}
        {/* Overlay */}
        <div style={{ position:'absolute', inset:0,
          background:'linear-gradient(to bottom, transparent 40%, rgba(36,25,16,0.32) 100%)' }} />
        {/* Badge — dark brown gradient pill with bright ivory ink, readable on
            both themes (T.champagne resolves dark in noir, so we lock the
            badge text to a literal ivory). */}
        {pkg.badge && (
          <div style={{ position:'absolute', top:'12px',
            ...(lang === 'ar' ? { right:'12px' } : { left:'12px' }),
            background:'linear-gradient(135deg,#3D2E1F,#5C4520)',
            color:'#EFE3D1',
            border:'1px solid rgba(212,175,122,0.55)',
            borderRadius:'20px', padding:'4px 14px',
            fontSize:'0.7rem', fontWeight:600, fontFamily:'Tajawal, sans-serif',
            letterSpacing:'0.06em',
            boxShadow:'0 2px 8px rgba(0,0,0,0.35)' }}>
            {pkg.badge}
          </div>
        )}
        {/* Hours pill */}
        {pkg.duration_hours > 0 && (
          <div style={{ position:'absolute', bottom:'12px',
            ...(lang === 'ar' ? { left:'12px' } : { right:'12px' }),
            background:'rgba(255,255,255,0.18)', backdropFilter:'blur(8px)',
            color: textOnPhoto, borderRadius:'12px', padding:'3px 10px',
            fontSize:'0.7rem', fontFamily: lang==='ar'?'Tajawal':'Inter',
            border:'1px solid rgba(255,255,255,0.25)' }}>
            {lang==='ar' ? `${pkg.duration_hours} ساعات` : `${pkg.duration_hours}h`}
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding:'18px 18px 16px' }}>
        {/* Name */}
        <div style={{ marginBottom:'4px' }}>
          <div style={{ fontFamily:"'Amiri', serif", fontSize:'1rem',
            color: T.coffee, lineHeight:1.4 }}>
            {pkg.name_ar}
          </div>
          <div style={{ fontFamily:"'Cormorant Garamond', serif", fontWeight:300,
            fontSize:'0.78rem', letterSpacing:'0.06em', color: T.taupe }}>
            {pkg.name_en}
          </div>
        </div>

        {/* Price */}
        <div style={{ display:'flex', alignItems:'baseline', gap:'6px', margin:'12px 0' }}>
          <span style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'1.85rem',
            fontWeight:400, color: T.gold, lineHeight:1 }}>
            {pkg.price.toLocaleString()}
          </span>
          <span style={{ fontSize:'0.72rem', color: T.taupe,
            fontFamily: lang==='ar'?'Tajawal':'Inter' }}>
            {lang==='ar' ? 'ر.س' : 'SAR'}
          </span>
        </div>

        {/* Features */}
        <ul style={{ listStyle:'none', padding:0, margin:'0 0 16px', display:'flex', flexDirection:'column', gap:'5px' }}>
          {(pkg.features ?? []).map((f, i) => (
            <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px',
              fontSize:'0.8rem', color: T.mocha, lineHeight:1.5 }}>
              <span style={{ width:'4px', height:'4px', borderRadius:'50%',
                background: T.sand, marginTop:'7px', flexShrink:0 }} />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button onClick={e => { e.stopPropagation(); onSelect(); }} style={{
          width:'100%', padding:'10px', borderRadius:'8px', cursor:'pointer',
          fontFamily: lang==='ar'?'Tajawal':'Inter', fontSize:'0.85rem', fontWeight:500,
          transition:'all 0.25s', border:`1.5px solid ${T.sand}`,
          background: selected ? T.espresso : 'transparent',
          color: selected ? T.champagne : T.gold,
        }}>
          {selected ? tx(lang,'✓ تم الاختيار','✓ Selected') : tx(lang,'اختاري هذه الباقة','Choose Package')}
        </button>
      </div>
    </div>
  );
}

// ── Package Details Modal ─────────────────────────────────────────────────────
function PkgDetailsModal({ pkg, lang, selected, onSelect, onClose }: {
  pkg: Package; lang: Lang; selected: boolean; onSelect: () => void; onClose: () => void;
}) {
  const [photoOk, setPhotoOk] = useState(true);
  const visual = getVisual(pkg);

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:1100,
      background:'rgba(26,26,26,0.55)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
    }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{
        background:'white', borderRadius:'20px', width:'100%', maxWidth:'480px',
        maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 24px 64px rgba(26,26,26,0.22)',
      }}>
        {/* Photo header */}
        <div style={{ position:'relative', height:'220px', borderRadius:'20px 20px 0 0',
          overflow:'hidden', background: visual.gradient, flexShrink:0 }}>
          {photoOk && (
            <picture>
              <source type="image/webp"
                srcSet={`${BASE}photos/${visual.photo.replace(/\.[^.]+$/, '.webp')}`} />
              <img src={`${BASE}photos/${visual.photo}`} alt={pkg.name_ar}
                decoding="async"
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
                onError={() => setPhotoOk(false)} />
            </picture>
          )}
          <div style={{ position:'absolute', inset:0,
            background:'linear-gradient(to bottom, transparent 30%, rgba(26,16,8,0.52) 100%)' }} />
          {/* Close */}
          <button onClick={onClose} style={{
            position:'absolute', top:'12px', left:'12px',
            background:'rgba(255,255,255,0.18)', backdropFilter:'blur(6px)',
            border:'1px solid rgba(255,255,255,0.3)', borderRadius:'50%',
            width:'34px', height:'34px', cursor:'pointer', color:'white',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem',
          }}>×</button>
          {pkg.badge && (
            <div style={{ position:'absolute', top:'12px', right:'12px',
              background:'linear-gradient(135deg,#3D2E1F,#5C4520)',
              color:'#EFE3D1',
              border:'1px solid rgba(212,175,122,0.55)',
              borderRadius:'20px', padding:'4px 14px',
              fontSize:'0.7rem', fontWeight:600, fontFamily:'Tajawal, sans-serif',
              letterSpacing:'0.06em',
              boxShadow:'0 2px 8px rgba(0,0,0,0.35)' }}>
              {pkg.badge}
            </div>
          )}
          <div style={{ position:'absolute', bottom:'16px', right:'18px' }}>
            <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.4rem', color:'white', lineHeight:1.2 }}>
              {pkg.name_ar}
            </div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'0.85rem',
              color:'rgba(255,255,255,0.75)', letterSpacing:'0.06em' }}>
              {pkg.name_en}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:'24px 24px 28px' }}>
          {/* Price + hours */}
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between',
            marginBottom:'20px' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:'6px' }}>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2.2rem',
                color: T.gold, lineHeight:1 }}>
                {pkg.price.toLocaleString()}
              </span>
              <span style={{ fontSize:'0.8rem', color: T.taupe, fontFamily:'Tajawal,sans-serif' }}>
                {lang==='ar' ? 'ر.س' : 'SAR'}
              </span>
            </div>
            {pkg.duration_hours > 0 && (
              <div style={{ background: T.cream, borderRadius:'10px', padding:'4px 12px',
                fontSize:'0.78rem', color: T.taupe, fontFamily:'Tajawal,sans-serif' }}>
                {lang==='ar' ? `${pkg.duration_hours} ساعات تصوير` : `${pkg.duration_hours}h session`}
              </div>
            )}
          </div>

          {/* Features */}
          {(pkg.features ?? []).length > 0 && (
            <>
              <div style={{ fontSize:'0.7rem', letterSpacing:'0.18em', color: T.taupe,
                fontFamily:"'Cormorant Garamond',serif", textTransform:'uppercase',
                marginBottom:'12px' }}>
                {lang==='ar' ? 'تشمل الباقة' : 'WHAT\'S INCLUDED'}
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 24px',
                display:'flex', flexDirection:'column', gap:'8px' }}>
                {(pkg.features ?? []).map((f, i) => (
                  <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:'10px',
                    fontSize:'0.88rem', color: T.mocha, lineHeight:1.6 }}>
                    <span style={{ width:'5px', height:'5px', borderRadius:'50%', flexShrink:0,
                      background: T.gold, marginTop:'8px' }} />
                    {f}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Select button */}
          <button onClick={() => { onSelect(); onClose(); }} style={{
            width:'100%', padding:'13px', borderRadius:'10px', cursor:'pointer',
            fontFamily:'Tajawal,sans-serif', fontSize:'0.95rem', fontWeight:600,
            border:'none', transition:'all 0.25s',
            background: selected ? T.gold : T.espresso,
            color: T.champagne,
          }}>
            {selected ? tx(lang,'✓ تم اختيار هذه الباقة','✓ Package Selected') : tx(lang,'اختاري هذه الباقة','Choose This Package')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper: detect hour-quantity addons ───────────────────────────────────────
const isHourAddon = (addon: { name_ar: string; name_en: string }) => {
  const s = (addon.name_ar + ' ' + addon.name_en).toLowerCase();
  return s.includes('ساعة') || s.includes('ساعه') || s.includes('hour');
};

// ── Addon Row ─────────────────────────────────────────────────────────────────
function AddonRow({ addon, lang, active, qty, onToggle, onQtyChange }: {
  addon: Addon; lang: Lang; active: boolean; qty: number;
  onToggle: () => void; onQtyChange: (q: number) => void;
}) {
  const isHour   = isHourAddon(addon);
  const isActive = isHour ? qty > 0 : active;
  const setQty   = (v: number) => onQtyChange(Math.max(0, Math.min(12, v)));

  return (
    <div onClick={() => { if (!isHour) onToggle(); }} style={{
      display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px',
      borderRadius:'12px', cursor: isHour ? 'default' : 'pointer', transition:'all 0.22s',
      background: isActive ? 'rgba(212,175,122,0.16)' : 'var(--a-surface-alt)',
      border:`1px solid ${isActive ? 'var(--a-border-strong)' : 'var(--a-border)'}`,
    }}>
      {isHour ? (
        <div style={{ display:'flex', alignItems:'center', gap:'4px', flexShrink:0 }}>
          <button onClick={e => { e.stopPropagation(); setQty(qty + 1); }} style={{
            width:'28px', height:'28px', borderRadius:'50%', border:`1px solid ${T.sand}`,
            background: T.gold, color:'#0B0B0B', cursor:'pointer', fontSize:'1.1rem',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>+</button>
          <input type="number" min="0" max="12" value={qty}
            onClick={e => e.stopPropagation()}
            onChange={e => setQty(parseInt(e.target.value) || 0)}
            style={{ width:'36px', textAlign:'center', border:`1px solid ${T.dune}`,
              borderRadius:'6px', padding:'4px 2px', fontSize:'0.85rem',
              fontFamily:"'Cormorant Garamond',serif", color: T.coffee,
              background:'var(--a-surface)', outline:'none' }} />
          <button onClick={e => { e.stopPropagation(); setQty(qty - 1); }} style={{
            width:'28px', height:'28px', borderRadius:'50%', border:`1px solid ${T.sand}`,
            background: qty > 0 ? T.gold : 'transparent',
            color: qty > 0 ? '#0B0B0B' : T.taupe, cursor:'pointer', fontSize:'1.1rem',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>−</button>
        </div>
      ) : (
        <button className={`atema-toggle ${active ? 'on' : ''}`}
          onClick={e => { e.stopPropagation(); onToggle(); }} />
      )}

      <div style={{ flex:1 }}>
        <div style={{ fontSize:'0.88rem', fontWeight:500, color: T.coffee,
          fontFamily: lang==='ar'?'Tajawal':'Inter' }}>
          {lang==='ar' ? addon.name_ar : addon.name_en}
        </div>
        {isHour && (
          <div style={{ fontSize:'0.72rem', color: T.taupe,
            fontFamily: lang==='ar'?'Tajawal':'Inter', marginTop:'2px' }}>
            {addon.price.toLocaleString()} {lang==='ar'?'ر.س':'SAR'} / {tx(lang,'ساعة','hr')}
          </div>
        )}
      </div>

      <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'1rem',
        color: isActive ? T.gold : T.taupe, fontWeight:400, whiteSpace:'nowrap' }}>
        {isHour
          ? (qty > 0 ? (addon.price * qty).toLocaleString() : '—')
          : addon.price.toLocaleString()}
        {' '}<span style={{ fontSize:'0.7rem', color:T.taupe, fontFamily: lang==='ar'?'Tajawal':'Inter' }}>
          {isHour ? (qty > 0 ? (lang==='ar'?'ر.س':'SAR') : '') : (lang==='ar'?'ر.س':'SAR')}
        </span>
      </div>
    </div>
  );
}


// ── Summary Panel ─────────────────────────────────────────────────────────────
type AddonLine = { id: string; nameAr: string; nameEn: string; price: number };
function SummaryPanel({ lang, pkg, addonLines, subtotal, vat, total, vatEnabled, onBook }: {
  lang: Lang; pkg: Package | undefined; addonLines: AddonLine[];
  subtotal: number; vat: number; total: number; vatEnabled: boolean;
  onBook: () => void;
}) {
  return (
    <div className="glass" style={{ borderRadius:'16px', padding:'22px 20px' }}>
      <h3 style={{ fontFamily:"'Amiri', serif", fontSize:'1rem', color: T.coffee,
        marginBottom:'18px' }}>
        {tx(lang,'ملخص الطلب','Order Summary')}
      </h3>

      {pkg ? (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
            <span style={{ fontSize:'0.85rem', color: T.mocha, fontFamily:'Tajawal,sans-serif' }}>
              {lang==='ar' ? pkg.name_ar : pkg.name_en}
            </span>
            <span style={{ fontFamily:"'Cormorant Garamond',serif", color: T.gold, fontSize:'0.95rem' }}>
              {pkg.price.toLocaleString()}
            </span>
          </div>

          {addonLines.map(a => (
            <div key={a.id} style={{ display:'flex', justifyContent:'space-between',
              marginBottom:'7px', fontSize:'0.8rem' }}>
              <span style={{ color: T.taupe, fontFamily:'Tajawal,sans-serif' }}>
                + {lang==='ar' ? a.nameAr : a.nameEn}
              </span>
              <span style={{ color: T.taupe, fontFamily:"'Cormorant Garamond',serif" }}>
                {a.price.toLocaleString()}
              </span>
            </div>
          ))}

          <div style={{ height:'1px', background:'rgba(201,179,147,0.25)', margin:'14px 0' }} />

          {vatEnabled && (
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px',
              fontSize:'0.8rem' }}>
              <span style={{ color: T.taupe, fontFamily:'Tajawal,sans-serif' }}>
                {tx(lang,'المجموع (بدون VAT)','Subtotal (ex VAT)')}
              </span>
              <span style={{ color: T.mocha }}>{subtotal.toLocaleString()}</span>
            </div>
          )}
          {vatEnabled && (
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px',
              fontSize:'0.8rem' }}>
              <span style={{ color: T.taupe, fontFamily:'Tajawal,sans-serif' }}>
                {tx(lang,'VAT ١٥٪','VAT 15%')}
              </span>
              <span style={{ color: T.taupe }}>{vat.toLocaleString()}</span>
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'18px' }}>
            <span style={{ fontSize:'0.9rem', fontWeight:600, color: T.coffee,
              fontFamily:'Tajawal,sans-serif' }}>
              {tx(lang,'الإجمالي','Total')}
            </span>
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem',
              color: T.gold, fontWeight:400 }}>
              {total.toLocaleString()} <span style={{ fontSize:'0.7rem', color:T.taupe,
                fontFamily:'Tajawal' }}>{lang==='ar'?'ر.س':'SAR'}</span>
            </span>
          </div>

          <button className="btn-primary" onClick={onBook}>
            {tx(lang,'إتمام الحجز ←','Book Now →')}
          </button>
          <p style={{ textAlign:'center', fontSize:'0.72rem', color: T.taupe,
            marginTop:'10px', fontFamily:'Tajawal,sans-serif', lineHeight:1.6 }}>
            {tx(lang,'الدفعة الأولى ٥٠٪ تُؤكد الحجز','50% deposit confirms your booking')}
          </p>
        </>
      ) : (
        <p style={{ color: T.taupe, fontSize:'0.85rem', fontFamily:'Tajawal,sans-serif',
          textAlign:'center', padding:'20px 0' }}>
          {tx(lang,'اختاري باقة للبدء','Choose a package to begin')}
        </p>
      )}
    </div>
  );
}

// ── T&C / Privacy Popup ───────────────────────────────────────────────────────
const TC_CONTENT = `
<h3 style="font-family:'Amiri',serif;font-size:1.05rem;color:#8C6B4F;margin:0 0 14px">شروط الدفع</h3>
<ul style="padding-right:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:#4A3728">
  <li>الدفعة الأولى (٥٠٪) واجبة الأداء لتأكيد الحجز وإلزامه — لا يُعدّ الحجز نافذاً قبل استلامها.</li>
  <li>الدفعة الثانية تُسدَّد قبل المناسبة بيوم واحد على الأقل.</li>
  <li>التحويل إلى: بنك الراجحي — فاطمة بوحسن — رقم الحساب: 329608010885626 أو عبر سداد.</li>
  <li>الأسعار شاملة ضريبة القيمة المضافة ١٥٪.</li>
</ul>
<h3 style="font-family:'Amiri',serif;font-size:1.05rem;color:#8C6B4F;margin:0 0 14px">الإلغاء والتأجيل</h3>
<div style="background:#fff8f0;border-right:3px solid #8C6B4F;padding:10px 14px;border-radius:0 6px 6px 0;font-size:0.82rem;color:#5c3d1e;font-weight:600;margin:0 0 12px">
  الدفعة الأولى (٥٠٪) غير قابلة للاسترداد في جميع الأحوال دون استثناء.
</div>
<ul style="padding-right:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:#4A3728">
  <li>إلغاء قبل ١٤ يوماً أو أكثر: تُستردّ الدفعة الثانية إن كانت مسددة.</li>
  <li>إلغاء خلال أقل من ١٤ يوماً: لا يُستردّ أي مبلغ.</li>
  <li>الغياب دون إشعار يُعدّ إلغاءً ولا يُستردّ أي مبلغ.</li>
  <li>يُسمح بتأجيل مرة واحدة فقط خلال ٣٠ يوماً وبإشعار لا يقل عن ٧ أيام.</li>
</ul>
<h3 style="font-family:'Amiri',serif;font-size:1.05rem;color:#8C6B4F;margin:0 0 14px">مواعيد التسليم</h3>
<ul style="padding-right:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:#4A3728">
  <li>الصور المعدّلة: ١٢٠–١٨٠ يوماً من تاريخ المناسبة.</li>
  <li>الفيديو السينمائي: ١٢٠ يوماً من تاريخ المناسبة.</li>
  <li>الألبوم المطبوع: بعد اختيار الصور واعتمادها.</li>
</ul>
<h3 style="font-family:'Amiri',serif;font-size:1.05rem;color:#8C6B4F;margin:0 0 14px">الملكية الفكرية</h3>
<ul style="padding-right:18px;margin:0 0 8px;font-size:0.82rem;line-height:1.9;color:#4A3728">
  <li>تحتفظ ATEMA Studio بكامل حقوق الملكية الفكرية لجميع الصور والفيديوهات.</li>
  <li>يُمنح الطرف الثاني ترخيص استخدام شخصي غير حصري للأغراض الشخصية فقط.</li>
  <li>لا يحق نشر الصور الخام (غير المعدّلة) أو تداولها.</li>
</ul>
`;

const PDPL_CONTENT = `
<h3 style="font-family:'Amiri',serif;font-size:1.05rem;color:#8C6B4F;margin:0 0 14px">سياسة حماية البيانات الشخصية (PDPL)</h3>
<p style="font-size:0.82rem;line-height:1.9;color:#4A3728;margin:0 0 14px">
  تلتزم ATEMA Studio بمعالجة بياناتك الشخصية وفق نظام حماية البيانات الشخصية السعودي (م/٢٠):
</p>
<ul style="padding-right:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:#4A3728">
  <li><strong>الغرض من الجمع:</strong> تُستخدم بياناتك حصراً لتنفيذ عقد الخدمة والتواصل المتعلق بحجزك.</li>
  <li><strong>المشاركة:</strong> لا تُشارَك بياناتك مع أطراف ثالثة إلا بما يقتضيه النظام.</li>
  <li><strong>مدة الاحتفاظ:</strong> تُحتفظ بالبيانات ٣ سنوات من تاريخ المناسبة ثم تُحذف آمنياً.</li>
  <li><strong>حقوقك:</strong> لكِ في أي وقت حق الاطلاع على بياناتك، وطلب تصحيحها أو حذفها عبر التواصل على: 0548323496.</li>
  <li><strong>الصور:</strong> تحتفظ ATEMA Studio بحق عرض الصور لأغراض تسويقية ما لم تُبدي العميلة رغبتها في الخصوصية الكاملة كتابةً قبل المناسبة.</li>
  <li><strong>الأمان:</strong> تُطبَّق إجراءات تقنية وتنظيمية لحماية بياناتك من الوصول غير المصرح به.</li>
</ul>
<p style="font-size:0.78rem;color:#8C6B4F;border-top:1px solid #E8D9C5;padding-top:12px;margin:0">
  للاستفسار عن بياناتك: atema.studio · 0548323496 · جبيل، المملكة العربية السعودية
</p>
`;

function LegalPopup({ title, htmlContent, onClose }: {
  title: string; htmlContent: string; onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:1200,
      background:'rgba(26,26,26,0.6)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
    }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{
        background:'white', borderRadius:'16px', width:'100%', maxWidth:'520px',
        maxHeight:'80vh', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 64px rgba(26,26,26,0.25)',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 22px 16px', borderBottom:'1px solid #E8D9C5',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.1rem', color:'#1A1A1A' }}>{title}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
            color:'#8C6B4F', padding:'4px', lineHeight:1 }}>
            <X size={18} />
          </button>
        </div>
        {/* Scrollable body */}
        <div style={{ overflowY:'auto', padding:'20px 22px 24px', flexGrow:1 }}
          dangerouslySetInnerHTML={{ __html: htmlContent }} />
        {/* Footer */}
        <div style={{ padding:'12px 22px', borderTop:'1px solid #E8D9C5', flexShrink:0, textAlign:'center' }}>
          <button onClick={onClose} style={{
            background:'#1A1A1A', color:'#E8D9C5', border:'none', borderRadius:'8px',
            padding:'9px 28px', cursor:'pointer', fontFamily:'Tajawal,sans-serif',
            fontSize:'0.85rem', fontWeight:600,
          }}>
            فهمتُ وأوافق
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Booking Form Modal ────────────────────────────────────────────────────────
function BookingFormModal({ lang, pkg, total, activeAddons, addonLines, addTotal, vatEnabled, settings, onClose }: {
  lang: Lang; pkg: Package | undefined; total: number;
  activeAddons: Set<string>;
  addonLines: AddonLine[];
  addTotal: number;
  vatEnabled: boolean;
  settings: import('../services/settings').AppSettings;
  onClose: () => void;
}) {
  const [form,      setForm]      = useState({ name:'', phone:'', email:'', date:'', time:'', city:'', venue:'', notes:'' });
  const [agreed,    setAgreed]    = useState(false);
  const [pdpl,      setPdpl]      = useState(false);
  const [popup,     setPopup]     = useState<'terms'|'privacy'|null>(null);
  const [state,     setState]     = useState<'idle'|'loading'|'choose'|'card'|'transfer'|'error'>('idle');
  const [errMsg,    setErrMsg]    = useState('');
  const [booked,    setBooked]    = useState<{ id: string; ref: string; deposit: number; total: number } | null>(null);
  const [contractHTML, setContractHTML] = useState<string>('');
  const [invoiceHTML,  setInvoiceHTML]  = useState<string>('');
  // Patch H-1: in-flight guard so rapid double-click can't fire two
  // createBooking() requests before the first one updates `state`.
  const submittingRef = useRef(false);

  // Whether Moyasar is configured (real publishable key present)
  const moyasarKey = (import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY as string | undefined) ?? '';
  const moyasarEnabled = !!moyasarKey && !moyasarKey.includes('your_key_here');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const isPaymentStage = state === 'choose' || state === 'card' || state === 'transfer';

  async function handleSubmit() {
    // ── In-flight guard (Patch H-1) ────────────────────────────────────
    if (submittingRef.current) return;

    // ── Consent gates (M-7: separate messages for clarity) ──────────────
    if (!agreed)            { setErrMsg(tx(lang,'يجب الموافقة على الشروط والأحكام','Please agree to the Terms & Conditions')); return; }
    if (!pdpl)              { setErrMsg(tx(lang,'يجب الموافقة على سياسة الخصوصية','Please accept the Privacy & PDPL policy')); return; }

    // ── Field presence ─────────────────────────────────────────────────
    const name = clampText(form.name, 120);
    if (!name)              { setErrMsg(tx(lang,'الرجاء إدخال الاسم','Please enter your name')); return; }
    if (!form.phone.trim()) { setErrMsg(tx(lang,'الرجاء إدخال رقم الجوال','Please enter your phone')); return; }
    if (!form.date)         { setErrMsg(tx(lang,'الرجاء تحديد تاريخ المناسبة','Please select event date')); return; }
    if (!form.city)         { setErrMsg(tx(lang,'الرجاء اختيار المدينة','Please select city')); return; }

    // ── Field format (Patch C-2) ───────────────────────────────────────
    const normPhone = normalizeSaudiMobile(form.phone);
    if (!normPhone) {
      setErrMsg(tx(lang,
        'رقم الجوال غير صحيح — استخدمي صيغة سعودية (+9665XXXXXXXX أو 05XXXXXXXX)',
        'Invalid mobile — use Saudi format (+9665XXXXXXXX or 05XXXXXXXX)'));
      return;
    }
    if (form.email && !validEmail(form.email)) {
      setErrMsg(tx(lang,'البريد الإلكتروني غير صحيح','Invalid email address'));
      return;
    }
    if (!isFutureOrToday(form.date)) {
      setErrMsg(tx(lang,'لا يمكن حجز تاريخ ماضٍ','Cannot book a past date'));
      return;
    }

    setErrMsg(''); setState('loading');
    submittingRef.current = true;

    const cityFee  = CITIES.find(c => c.value === form.city)?.fee ?? 0;
    const subtotal = (pkg?.price ?? 0) + addTotal + cityFee;
    const vat      = computeVat(subtotal, vatEnabled);
    const fullTotal = subtotal + vat;
    const deposit   = Math.round(fullTotal * 0.5); // 50% deposit

    // All customer text fields trimmed + capped before storage
    const cleanEmail  = clampText(form.email, 254);
    const cleanVenue  = clampText(form.venue, 200);
    const cleanNotes  = clampText(form.notes, 2000);

    try {
      const response = await createBooking({
        customerName:    name,
        customerPhone:   normPhone,
        customerEmail:   cleanEmail,
        packageId:       pkg?.id ?? 'customise',
        addOnIds:        Array.from(activeAddons),
        eventDate:       form.date,
        eventTime:       form.time || '18:00',
        city:            form.city,
        location:        cleanVenue || form.city,
        specialRequests: cleanNotes,
        subtotal, vat, total: fullTotal,
      });
      setBooked({ id: response.id, ref: response.bookingRef, deposit, total: fullTotal });

      // Generate and save contract
      const cHTML = generateContractHTML({
        customerName:   name,
        customerPhone:  normPhone,
        bookingRef:     response.bookingRef,
        bookingId:      response.id,
        contractDate:   new Date().toISOString().split('T')[0],
        eventDate:      form.date,
        eventTime:      form.time || '18:00',
        packageNameAr:  pkg?.name_ar ?? 'الباقة الأساسية',
        packageNameEn:  pkg?.name_en ?? 'Base Package',
        location:       cleanVenue || form.city,
        durationHours:  pkg?.duration_hours ?? 0,
        subtotal, vat, total: fullTotal, deposit,
        remaining:      fullTotal - deposit,
        addons:         addonLines.map(l => lang === 'ar' ? l.nameAr : l.nameEn),
      });
      setContractHTML(cHTML);
      saveContract(response.id, response.bookingRef, cHTML);

      // Generate ZATCA-compliant tax invoice
      const invNumber = generateInvoiceNumber();
      const iHTML = generateInvoiceHTML({
        invoiceNumber:  invNumber,
        bookingRef:     response.bookingRef,
        bookingId:      response.id,
        issueDate:      new Date().toISOString(),
        customerName:   name,
        customerPhone:  normPhone,
        packageNameAr:  pkg?.name_ar ?? 'الباقة الأساسية',
        packageNameEn:  pkg?.name_en ?? 'Base Package',
        addons:         addonLines.map(l => ({
          name:  lang === 'ar' ? l.nameAr : l.nameEn,
          price: l.price,
        })),
        subtotal, vat, total: fullTotal,
        paymentMethod:  'pending',
        depositPaid:    0,
        settings,
      });
      setInvoiceHTML(iHTML);
      saveInvoice(response.id, response.bookingRef, invNumber, iHTML, fullTotal);

      // Transition to method chooser (auto-skip to transfer if Moyasar disabled)
      setState(moyasarEnabled ? 'choose' : 'transfer');
    } catch (err) {
      console.error('Booking error:', err);
      setState('error');
      const msg = err instanceof Error ? err.message : String(err);
      setErrMsg(tx(lang,'حدث خطأ: ','Error: ') + msg);
    } finally {
      submittingRef.current = false;
    }
  }

  const lbl: React.CSSProperties = { display:'block', fontSize:'0.8rem', fontWeight:500,
    color: T.mocha, marginBottom:'6px', fontFamily:'Tajawal,sans-serif' };
  const grp: React.CSSProperties = { display:'flex', flexDirection:'column' };

  return (
    <div className="atema-modal open" onClick={isPaymentStage ? undefined : onClose}>
      <div className="atema-modal-box" onClick={e => e.stopPropagation()}
        style={{ direction: lang==='ar'?'rtl':'ltr', fontFamily:'Tajawal,sans-serif' }}>

        {isPaymentStage && booked ? (
          <>
            {/* Payment header — booking ref + back/close */}
            <div style={{ padding:'14px 22px', borderBottom:`1px solid rgba(214,191,163,0.2)`,
              display:'flex', justifyContent:'space-between', alignItems:'center', background: getBookingPalette(activeTheme).rowAlt }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                {(state === 'card' || (state === 'transfer' && moyasarEnabled)) && (
                  <button onClick={() => setState('choose')}
                    style={{ background:'none', border:`1px solid ${T.sand}`, borderRadius:'8px',
                      padding:'5px 10px', cursor:'pointer', color: T.taupe, fontSize:'0.72rem',
                      fontFamily:'Tajawal,sans-serif' }}>
                    {tx(lang,'← رجوع','← Back')}
                  </button>
                )}
                <div>
                  <div style={{ fontSize:'0.65rem', color: T.taupe, letterSpacing:'0.08em' }}>
                    {tx(lang,'رقم الحجز','BOOKING REF')}
                  </div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", color: T.gold, fontSize:'0.95rem' }}>
                    {booked.ref}
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none',
                cursor:'pointer', color: T.taupe, padding:'4px' }}>
                <X size={18} />
              </button>
            </div>

            {state === 'choose' && (
              <PaymentMethodChooser
                lang={lang}
                depositSAR={booked.deposit}
                moyasarEnabled={moyasarEnabled}
                onSelect={(m) => setState(m === 'card' ? 'card' : 'transfer')}
              />
            )}

            {state === 'card' && (
              <div style={{ padding:'18px 24px 24px' }}>
                <div style={{ marginBottom:'14px' }}>
                  <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.1rem', color: T.coffee }}>
                    {tx(lang,'الدفعة الأولى','Deposit Payment')}
                  </div>
                  <div style={{ fontSize:'0.76rem', color: T.taupe, marginTop:'2px' }}>
                    {tx(lang,'٥٠٪ من الإجمالي لتأكيد الحجز','50% of total to confirm your booking')}
                    {' — '}
                    <strong style={{ color: T.gold, fontFamily:"'Cormorant Garamond',serif" }}>
                      {booked.deposit.toLocaleString()} {lang==='ar'?'ر.س':'SAR'}
                    </strong>
                  </div>
                </div>
                <MoyasarForm
                  depositSAR={booked.deposit}
                  description={`${tx(lang,'دفعة أولى — ATEMA Studio','Deposit — ATEMA Studio')} (${booked.ref})`}
                  bookingRef={booked.ref}
                  bookingId={booked.id}
                  lang={lang}
                />
              </div>
            )}

            {state === 'transfer' && (
              <BankTransferPayment
                lang={lang}
                bookingRef={booked.ref}
                bookingId={booked.id}
                depositSAR={booked.deposit}
                totalSAR={booked.total}
                contractHTML={contractHTML}
                invoiceHTML={invoiceHTML}
                onClose={onClose}
              />
            )}
          </>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding:'20px 24px 16px', borderBottom:`1px solid rgba(214,191,163,0.18)`,
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.15rem', color: T.coffee }}>
                  {tx(lang,'تفاصيل الحجز','Booking Details')}
                </div>
                {pkg && <div style={{ fontSize:'0.78rem', color: T.taupe, marginTop:'2px' }}>
                  {lang==='ar' ? pkg.name_ar : pkg.name_en} — {total.toLocaleString()} {lang==='ar'?'ر.س':'SAR'}
                </div>}
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none',
                cursor:'pointer', color: T.taupe, padding:'4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div style={{ padding:'22px 24px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'14px' }}>
                <div style={grp}>
                  <label style={lbl} htmlFor="bf-name">{tx(lang,'الاسم الكامل *','Full Name *')}</label>
                  <input id="bf-name" className="atema-input" value={form.name}
                    maxLength={120}
                    onChange={e => set('name', e.target.value)}
                    placeholder={tx(lang,'اسمك الكريم','Your name')} />
                </div>
                <div style={grp}>
                  <label style={lbl} htmlFor="bf-phone">{tx(lang,'رقم الجوال *','Mobile *')}</label>
                  <input id="bf-phone" className="atema-input atema-input-ltr" type="tel" value={form.phone}
                    maxLength={20} inputMode="tel" autoComplete="tel"
                    onChange={e => set('phone', e.target.value)} placeholder="+966 5X XXX XXXX" />
                </div>
                <div style={grp}>
                  <label style={lbl} htmlFor="bf-email">{tx(lang,'البريد الإلكتروني','Email')}</label>
                  <input id="bf-email" className="atema-input atema-input-ltr" type="email" value={form.email}
                    maxLength={254} autoComplete="email"
                    onChange={e => set('email', e.target.value)} placeholder="you@email.com" />
                </div>
                <div style={grp}>
                  <label style={lbl}>{tx(lang,'تاريخ المناسبة *','Event Date *')}</label>
                  <DatePicker lang={lang} value={form.date}
                    onChange={v => set('date', v)}
                    placeholder={tx(lang,'اختاري التاريخ','Select date')} />
                </div>
                <div style={grp}>
                  <label style={lbl}>{tx(lang,'وقت البدء','Start Time')}</label>
                  <input className="atema-input atema-input-ltr" type="time" value={form.time}
                    onChange={e => set('time', e.target.value)} />
                </div>
                <div style={grp}>
                  <label style={lbl}>{tx(lang,'المدينة *','City *')}</label>
                  <select className="atema-input" value={form.city}
                    onChange={e => set('city', e.target.value)}>
                    <option value="">{tx(lang,'اختاري المدينة','Select city')}</option>
                    {CITIES.map(c => (
                      <option key={c.value} value={c.value}>
                        {lang==='ar' ? c.ar : c.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom:'14px' }}>
                <label style={lbl} htmlFor="bf-venue">{tx(lang,'اسم القاعة / المكان','Venue Name')}</label>
                <input id="bf-venue" className="atema-input" value={form.venue}
                  maxLength={200}
                  onChange={e => set('venue', e.target.value)}
                  placeholder={tx(lang,'اسم القاعة والعنوان','Venue name and address')} />
              </div>

              <div style={{ marginBottom:'18px' }}>
                <label style={lbl} htmlFor="bf-notes">{tx(lang,'طلبات خاصة أو ملاحظات','Special Requests')}</label>
                <textarea id="bf-notes" className="atema-input" rows={3} value={form.notes}
                  maxLength={2000}
                  onChange={e => set('notes', e.target.value)}
                  placeholder={tx(lang,'أي تفاصيل تودّين مشاركتها...','Any details you\'d like to share...')}
                  style={{ resize:'vertical' }} />
              </div>

              {/* Consents */}
              <div style={{ background:'rgba(201,179,147,0.07)',
                border:'1px solid rgba(201,179,147,0.18)', borderRadius:'10px',
                padding:'14px 16px', marginBottom:'18px', display:'flex', flexDirection:'column', gap:'12px' }}>
                <label className="check-row" style={{ alignItems:'flex-start' }}>
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    style={{ marginTop:'3px', flexShrink:0 }} />
                  <span style={{ fontSize:'0.78rem', color: T.mocha, lineHeight:1.7 }}>
                    {tx(lang,'أوافق على ','I agree to the ')}<button type="button"
                      onClick={() => setPopup('terms')}
                      style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                        color: T.gold, fontSize:'0.78rem', fontWeight:600, fontFamily:'inherit',
                        textDecoration:'underline', lineHeight:1.7 }}>
                      {tx(lang,'الشروط والأحكام','Terms & Conditions')}
                    </button>
                    {tx(lang,' — الدفعة الأولى ٥٠٪ غير مستردة',' — 50% deposit is non-refundable')}
                  </span>
                </label>
                <label className="check-row" style={{ alignItems:'flex-start' }}>
                  <input type="checkbox" checked={pdpl} onChange={e => setPdpl(e.target.checked)}
                    style={{ marginTop:'3px', flexShrink:0 }} />
                  <span style={{ fontSize:'0.78rem', color: T.mocha, lineHeight:1.7 }}>
                    {tx(lang,'أوافق على ','I consent to ')}<button type="button"
                      onClick={() => setPopup('privacy')}
                      style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                        color: T.gold, fontSize:'0.78rem', fontWeight:600, fontFamily:'inherit',
                        textDecoration:'underline', lineHeight:1.7 }}>
                      {tx(lang,'سياسة الخصوصية وحماية البيانات (PDPL)','Privacy & Data Protection (PDPL)')}
                    </button>
                  </span>
                </label>
              </div>

              {errMsg && (
                <div role="alert" aria-live="polite"
                  style={{ background:'#fff5f5', border:'1px solid #fecaca',
                  borderRadius:'8px', padding:'10px 14px', marginBottom:'14px',
                  fontSize:'0.8rem', color:'#dc2626', fontFamily:'Tajawal,sans-serif' }}>
                  {errMsg}
                </div>
              )}

              <button className="btn-primary" onClick={handleSubmit}
                disabled={state==='loading'}>
                {state==='loading'
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                      <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} />
                      {tx(lang,'جارٍ تسجيل الحجز...','Registering booking...')}
                    </span>
                  : tx(lang,'التالي: الدفع ←','Next: Payment →')}
              </button>

              {/* Deposit note */}
              <p style={{ textAlign:'center', fontSize:'0.72rem', color: T.taupe,
                marginTop:'10px', fontFamily:'Tajawal,sans-serif', lineHeight:1.6 }}>
                {tx(lang,
                  'ستُطالَب بدفع ٥٠٪ كدفعة أولى لتأكيد الحجز',
                  'You will pay a 50% deposit to confirm your booking')}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Legal popups */}
      {popup === 'terms'   && <LegalPopup title="الشروط والأحكام" htmlContent={TC_CONTENT}   onClose={() => { setPopup(null); setAgreed(true); }} />}
      {popup === 'privacy' && <LegalPopup title="سياسة الخصوصية وحماية البيانات" htmlContent={PDPL_CONTENT} onClose={() => { setPopup(null); setPdpl(true); }} />}
    </div>
  );
}

// ── Main BookingPage ──────────────────────────────────────────────────────────
export default function BookingPage() {
  const theme = useTheme();
  syncT(theme);                                       // keep module-level T in sync
  const location = useLocation();
  const { isMobile } = useBreakpoint();
  const { packages, loading: pkgLoading } = usePackagesData();
  const { addons } = useAddonsData();
  const { settings } = useAppSettings();
  const vatEnabled = settings.vat_enabled;
  // Shared lang preference (persists across pages via localStorage + RTL/LTR sync)
  const { lang, setLang } = useLang();
  // Initial tab can be pre-selected via navigation state (e.g. the homepage
  // promotion modal routes to /book with state.tab === 'custom').
  const initialTab: 'packages' | 'custom' =
    (location.state as { tab?: 'packages' | 'custom' } | null)?.tab === 'custom'
      ? 'custom' : 'packages';
  const [activeTab,      setActiveTab]      = useState<'packages' | 'custom'>(initialTab);
  const [selectedPkg,    setSelectedPkg]    = useState<number | null>(null);
  const [detailPkg,      setDetailPkg]      = useState<Package | null>(null);
  const [activeAddons,   setActiveAddons]   = useState<Set<string>>(new Set());
  const [hourQtys,       setHourQtys]       = useState<Record<string, number>>({});
  const [showForm,       setShowForm]       = useState(false);
  const [stickyShow,     setStickyShow]     = useState(false);

  const activePackages = packages.filter(p => p.active);

  // Auto-select the most popular (or first) package once data loads
  useEffect(() => {
    if (activePackages.length > 0 && selectedPkg === null) {
      const popular = activePackages.find(p => p.is_popular) ?? activePackages[0];
      setSelectedPkg(popular.id);
    }
  }, [activePackages, selectedPkg]);

  // ── Packages tab totals ────────────────────────────────────────────────────
  const pkg      = activePackages.find(p => p.id === selectedPkg);
  const addTotal = addons.reduce((s, a) => {
    if (isHourAddon(a)) return s + a.price * (hourQtys[a.id] ?? 0);
    return activeAddons.has(a.id) ? s + a.price : s;
  }, 0);
  const subtotal = (pkg?.price ?? 0) + addTotal;
  const vat      = computeVat(subtotal, vatEnabled);
  const total    = subtotal + vat;

  const setHourQty  = (id: string, q: number) => setHourQtys(prev => ({ ...prev, [id]: Math.max(0, q) }));
  const toggleAddon = (id: string) => setActiveAddons(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Addon lines for SummaryPanel
  const addonLines: AddonLine[] = addons.flatMap(a => {
    if (isHourAddon(a)) {
      const qty = hourQtys[a.id] ?? 0;
      return qty > 0 ? [{ id: a.id, nameAr: `${a.name_ar} × ${qty}`, nameEn: `${a.name_en} × ${qty}`, price: a.price * qty }] : [];
    }
    return activeAddons.has(a.id) ? [{ id: a.id, nameAr: a.name_ar, nameEn: a.name_en, price: a.price }] : [];
  });

  // ── Custom tab totals ──────────────────────────────────────────────────────
  const basePkg        = [...activePackages].sort((a, b) => a.price - b.price)[0];
  const customSubtotal = (basePkg?.price ?? 0) + addTotal;
  const customVat      = computeVat(customSubtotal, vatEnabled);
  const customTotal    = customSubtotal + customVat;

  // Active pkg + totals for the currently visible tab (used by modal & sticky bar)
  const activePkg      = activeTab === 'packages' ? pkg   : basePkg;
  const activeTotal    = activeTab === 'packages' ? total : customTotal;
  const activeAddonSet = activeAddons;

  useEffect(() => {
    const onScroll = () => setStickyShow(window.scrollY > 380);
    window.addEventListener('scroll', onScroll, { passive:true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isRTL = lang === 'ar';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}
      style={{ minHeight:'100vh', background: T.pearl,
        fontFamily: isRTL ? "'Tajawal', sans-serif" : "'Inter', sans-serif",
        color: T.coffee, overflowX:'hidden' }}>

      {/* Shared site nav (Home / Portfolio / Journal / Packages / Atelier
          + lang toggle) — sticky, solid-on-scroll for this action-oriented page. */}
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      {/* ── HERO ── */}
      <section style={{
        background: getBookingPalette(activeTheme).heroGrad,
        minHeight:'320px', position:'relative', overflow:'hidden',
        paddingTop: '72px',   // clear the fixed SiteHeader
      }}>
        {/* Grain overlay */}
        <div style={{ position:'absolute', inset:0, opacity:0.03,
          backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize:'180px' }} />

        {/* Hero content */}
        <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column',
          alignItems:'center', textAlign:'center',
          padding: isMobile ? '24px 20px 40px' : '32px 40px 52px' }}>

          <p style={{ fontFamily:"'Tajawal',sans-serif", fontSize:'0.7rem',
            letterSpacing:'0.28em', color:'var(--a-gold)', marginBottom:'12px',
            textTransform:'uppercase', opacity:0.9 }}>
            {tx(lang,'احجزي جلستك','Book Your Session')}
          </p>

          <div className="atema-wordmark" style={{ fontSize: isMobile?'2.2rem':'3.2rem' }}>
            ATEMA
          </div>
          <div className="atema-sub" style={{ marginTop:'4px' }}>S T U D I O</div>

          <p style={{ fontFamily:"'Amiri',serif", color:'var(--a-text)',
            fontSize: isMobile?'0.95rem':'1.05rem', lineHeight:1.9, marginTop:'20px',
            maxWidth:'420px' }}>
            {tx(lang,'لحظات تستحق أن تُخلَّد','Moments worth immortalising')}
          </p>

          <p style={{ fontFamily:"'Tajawal',sans-serif", fontSize:'0.82rem',
            color:'var(--a-text-soft)', lineHeight:1.8, maxWidth:'360px',
            textAlign:'center', marginTop:'8px' }}>
            {tx(lang,
              'جلسات تصوير احترافية تُصاغ بهدوء وذوق — اختاري باقتك وأضيفي ما يكمل رؤيتكِ',
              'Professional photography sessions crafted with care — choose your package and personalise your experience')}
          </p>

          {/* Step dots */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'22px' }}>
            {['','',''].map((_, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%',
                  background: i===0 ? T.gold : 'var(--a-border-strong)',
                  transform: i===0 ? 'scale(1.5)' : 'scale(1)', transition:'all 0.35s' }} />
                {i < 2 && <div style={{ width:'32px', height:'1px', background:'var(--a-border)' }} />}
              </div>
            ))}
          </div>
          <p style={{ fontSize:'0.68rem', color:'var(--a-text-muted)',
            letterSpacing:'0.14em', marginTop:'8px', fontFamily:"'Tajawal',sans-serif" }}>
            {tx(lang,'الباقة · الإضافات · تفاصيلك','Package · Add-ons · Details')}
          </p>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <section style={{ padding: isMobile?'40px 0 36px':'52px 0 48px' }}>
        <div style={{ maxWidth:'1160px', margin:'0 auto', padding:'0 20px' }}>

          {/* ── TAB BAR ── */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:'40px' }}>
            <div style={{
              display:'inline-flex', background:'var(--a-surface-alt)',
              borderRadius:'12px', padding:'4px',
              border:'1px solid var(--a-border)',
              boxShadow:'0 2px 12px rgba(0,0,0,0.18)',
              gap:'4px',
            }}>
              {([
                { key:'packages', ar:'الباقات الجاهزة',    en:'Ready Packages'       },
                { key:'custom',   ar:'صمّمي باقتك',         en:'Design Your Package'  },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  padding: isMobile ? '9px 18px' : '10px 28px',
                  borderRadius:'9px', border:'none', cursor:'pointer',
                  fontFamily: lang==='ar'?'Tajawal':'Inter',
                  fontSize: isMobile ? '0.82rem' : '0.88rem',
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  transition:'all 0.22s',
                  background: activeTab === tab.key
                    ? getBookingPalette(activeTheme).tabActiveGrad
                    : 'transparent',
                  color: activeTab === tab.key
                    ? getBookingPalette(activeTheme).tabActiveText
                    : T.taupe,
                  boxShadow: activeTab === tab.key ? '0 2px 10px rgba(26,26,26,0.18)' : 'none',
                }}>
                  {lang==='ar' ? tab.ar : tab.en}
                </button>
              ))}
            </div>
          </div>

          {/* ── TAB: READY PACKAGES ── */}
          {activeTab === 'packages' && (<>
          <div style={{ textAlign:'center', marginBottom:'36px' }}>
            <h2 style={{ fontFamily:"'Amiri',serif", fontSize:'clamp(1.3rem,3.5vw,1.9rem)',
              color: T.coffee, margin:0 }}>
              {tx(lang,'اختاري باقتك','Choose Your Package')}
            </h2>
            <p style={{ fontSize:'0.82rem', color: T.taupe, marginTop:'8px',
              fontFamily:"'Tajawal',sans-serif" }}>
              {vatEnabled
                ? tx(lang,'جميع الأسعار بدون ضريبة القيمة المضافة ١٥٪','All prices exclude 15% VAT')
                : tx(lang,'جميع الأسعار غير شاملة الضريبة','All prices are tax-free')}
            </p>
          </div>

          {/* Desktop layout: packages + sidebar */}
          <div style={{ display:'flex', gap:'24px', alignItems:'flex-start' }}>
            <div style={{ flex:1 }}>
              <div style={{
                display:'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap:'18px',
              }}>
                {pkgLoading ? (
                  <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px 0',
                    color: T.taupe, fontFamily:'Tajawal,sans-serif', fontSize:'0.9rem' }}>
                    <Loader2 size={24} color={T.sand} style={{ animation:'spin 1s linear infinite', margin:'0 auto 12px', display:'block' }} />
                    {lang==='ar' ? 'جارٍ التحميل...' : 'Loading packages...'}
                  </div>
                ) : activePackages.map((p, i) => (
                  <div key={p.id} className="fade-up"
                    style={{ animationDelay: `${i * 0.06}s` }}>
                    <PkgCard pkg={p} lang={lang}
                      selected={selectedPkg === p.id}
                      onSelect={() => setSelectedPkg(p.id)}
                      onDetails={() => setDetailPkg(p)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop sidebar */}
            {!isMobile && (
              <div style={{ width:'300px', flexShrink:0, position:'sticky', top:'20px' }}>
                <SummaryPanel lang={lang} pkg={pkg} addonLines={addonLines}
                  subtotal={subtotal} vat={vat} total={total} vatEnabled={vatEnabled}
                  onBook={() => setShowForm(true)} />
              </div>
            )}
          </div>
          </>)} {/* end packages tab */}

          {/* ── TAB: DESIGN YOUR PACKAGE ── */}
          {activeTab === 'custom' && (<>
            <div style={{ display:'flex', gap:'24px', alignItems:'flex-start' }}>
              <div style={{ flex:1, minWidth:0 }}>

                {/* Base package card */}
                {basePkg && (
                  <div style={{ background:'var(--a-surface)', borderRadius:'14px', padding:'20px 22px',
                    border:'1px solid var(--a-border-strong)',
                    boxShadow:'0 2px 14px rgba(0,0,0,0.18)', marginBottom:'24px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                      gap:'12px', flexWrap:'wrap' }}>
                      <div>
                        <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.2rem', color: T.coffee }}>
                          {tx(lang,'الباقة الأساسية','Base Package')}
                        </div>
                        {basePkg.duration_hours > 0 && (
                          <div style={{ fontSize:'0.72rem', color: T.taupe,
                            fontFamily:'Tajawal,sans-serif', marginTop:'3px' }}>
                            {lang==='ar' ? `${basePkg.duration_hours} ساعات تصوير` : `${basePkg.duration_hours}h session`}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: lang==='ar'?'left':'right' }}>
                        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem',
                          color: T.gold, lineHeight:1 }}>
                          {basePkg.price.toLocaleString()}
                        </div>
                        <div style={{ fontSize:'0.72rem', color: T.taupe,
                          fontFamily:'Tajawal,sans-serif' }}>
                          {vatEnabled
                            ? (lang==='ar'?'ر.س بدون VAT':'SAR excl. VAT')
                            : (lang==='ar'?'ر.س':'SAR')}
                        </div>
                      </div>
                    </div>
                    {(basePkg.features ?? []).length > 0 && (
                      <ul style={{ listStyle:'none', padding:0, margin:'14px 0 0',
                        display:'flex', flexDirection:'column', gap:'5px' }}>
                        {(basePkg.features ?? []).map((f, i) => (
                          <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px',
                            fontSize:'0.8rem', color: T.mocha }}>
                            <span style={{ width:'4px', height:'4px', borderRadius:'50%',
                              background: T.sand, marginTop:'7px', flexShrink:0 }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Mobile total for custom tab */}
                {isMobile && (
                  <div style={{ marginTop:'28px', padding:'20px', background: T.cream,
                    borderRadius:'14px', textAlign:'center' }}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.6rem',
                      color: T.gold, marginBottom:'4px' }}>
                      {customTotal.toLocaleString()}
                      <span style={{ fontSize:'0.8rem', color: T.taupe,
                        fontFamily:'Tajawal', marginRight:'4px' }}>
                        {lang==='ar'?'ر.س':'SAR'}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.75rem', color: T.taupe,
                      fontFamily:'Tajawal', marginBottom:'14px' }}>
                      {vatEnabled
                  ? tx(lang,'الإجمالي شامل VAT','Total incl. VAT')
                  : tx(lang,'الإجمالي','Total')}
                    </div>
                    <button className="btn-primary" onClick={() => setShowForm(true)}>
                      {tx(lang,'إتمام الحجز ←','Complete Booking →')}
                    </button>
                  </div>
                )}
              </div>

              {/* Desktop sidebar for custom tab */}
              {!isMobile && (
                <div style={{ width:'300px', flexShrink:0, position:'sticky', top:'20px' }}>
                  <SummaryPanel lang={lang} pkg={basePkg} addonLines={addonLines}
                    subtotal={customSubtotal} vat={customVat} total={customTotal} vatEnabled={vatEnabled}
                    onBook={() => setShowForm(true)} />
                </div>
              )}
            </div>
          </>)} {/* end custom tab */}

        </div>
      </section>

      {/* ── ADD-ONS ── */}
      <section style={{ padding: isMobile?'36px 0':'48px 0',
        background:`linear-gradient(180deg, ${T.ivory}, ${T.pearl})` }}>
        <div style={{ maxWidth:'860px', margin:'0 auto', padding:'0 20px' }}>
          <div className="ornament">
            <span>{tx(lang,'خدمات إضافية','ADD-ON SERVICES')}</span>
          </div>
          <div style={{ textAlign:'center', marginBottom:'28px' }}>
            <h2 style={{ fontFamily:"'Amiri',serif",
              fontSize:'clamp(1.2rem,3vw,1.7rem)', color: T.coffee, margin:0 }}>
              {tx(lang,'خصّصي تجربتكِ','Personalise Your Experience')}
            </h2>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {addons.map(a => (
              <AddonRow key={a.id} addon={a} lang={lang}
                active={activeAddons.has(a.id)}
                qty={hourQtys[a.id] ?? 0}
                onToggle={() => toggleAddon(a.id)}
                onQtyChange={q => setHourQty(a.id, q)} />
            ))}
          </div>

          {/* Mobile book button */}
          {isMobile && pkg && (
            <div style={{ marginTop:'28px', padding:'20px', background:T.cream,
              borderRadius:'14px', textAlign:'center' }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.6rem',
                color: T.gold, marginBottom:'4px' }}>
                {activeTotal.toLocaleString()}
                <span style={{ fontSize:'0.8rem', color: T.taupe,
                  fontFamily:'Tajawal', marginRight:'4px' }}>
                  {lang==='ar'?'ر.س':'SAR'}
                </span>
              </div>
              <div style={{ fontSize:'0.75rem', color: T.taupe,
                fontFamily:'Tajawal', marginBottom:'14px' }}>
                {vatEnabled
                  ? tx(lang,'الإجمالي شامل VAT','Total incl. VAT')
                  : tx(lang,'الإجمالي','Total')}
              </div>
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                {tx(lang,'إتمام الحجز ←','Complete Booking →')}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── shared SiteFooter, consistent with the other public pages */}
      <SiteFooter lang={lang} />

      {/* ── STICKY BOTTOM BAR (mobile) ── */}
      {isMobile && (
        <div id="sticky-bar" className={stickyShow && !showForm ? 'show' : ''}>
          <div style={{ maxWidth:'1140px', margin:'0 auto', padding:'12px 20px',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:'0.68rem', color:'rgba(201,179,147,0.5)',
                fontFamily:'Tajawal', letterSpacing:'0.06em' }}>
                {vatEnabled
                  ? tx(lang,'الإجمالي شامل الضريبة','Total incl. VAT')
                  : tx(lang,'الإجمالي','Total')}
              </p>
              <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem',
                color: T.sandLt, lineHeight:1, marginTop:'2px' }}>
                {activeTotal.toLocaleString()} <span style={{ fontSize:'0.7rem',
                  color:'rgba(201,179,147,0.6)', fontFamily:'Tajawal' }}>
                  {lang==='ar'?'ر.س':'SAR'}
                </span>
              </p>
            </div>
            <button onClick={() => setShowForm(true)}
              style={{ background:'transparent', border:'1.5px solid rgba(201,179,147,0.5)',
                color: T.champagne, fontFamily:'Tajawal,sans-serif', fontSize:'0.85rem',
                padding:'9px 22px', borderRadius:'8px', cursor:'pointer',
                transition:'all 0.2s' }}>
              {tx(lang,'إتمام الحجز','Book Now')}
            </button>
          </div>
        </div>
      )}

      {/* ── WHATSAPP FLOAT ── */}
      <a className="wa-float" href="https://wa.me/966548323496" target="_blank" rel="noreferrer">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      {/* ── PACKAGE DETAILS MODAL ── */}
      {detailPkg && (
        <PkgDetailsModal lang={lang} pkg={detailPkg}
          selected={selectedPkg === detailPkg.id}
          onSelect={() => setSelectedPkg(detailPkg.id)}
          onClose={() => setDetailPkg(null)} />
      )}

      {/* ── BOOKING FORM MODAL ── */}
      {showForm && (
        <BookingFormModal lang={lang} pkg={activePkg} total={activeTotal}
          activeAddons={activeAddonSet}
          addonLines={addonLines} addTotal={addTotal}
          vatEnabled={vatEnabled} settings={settings}
          onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
