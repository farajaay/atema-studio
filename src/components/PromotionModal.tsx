// ATEMA STUDIO — Landing-page promotion modal.
// Renders Promotion.PNG as a full-bleed editorial overlay. Tapping the image
// routes the visitor to /book?tab=custom (Design Your Package). The X chip
// dismisses it; dismissal is remembered for the browser session so the popup
// does not re-fire on every internal navigation.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

const STORAGE_KEY   = 'atema:promo-dismissed';
const BASE          = import.meta.env.BASE_URL;
const PROMO_IMAGE   = `${BASE}photos/promo-card.png`;
const REVEAL_DELAY_MS = 700;

export default function PromotionModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setOpen(true), REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // ESC key to dismiss
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
  }

  function go() {
    close();
    navigate('/book', { state: { tab: 'custom' } });
  }

  if (!open) return null;

  return (
    <div onClick={close} role="dialog" aria-label="عرض ترويجي" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      animation: 'promo-fade-in 0.45s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        // Mobile: portrait image fills viewport height. Desktop: landscape capped at 960px.
        position: 'relative',
        maxWidth: 'min(960px, 96vw)',
        maxHeight: '92vh',
        width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'promo-pop-in 0.55s cubic-bezier(0.22,0.61,0.36,1)',
      }}>
        {/* Close pill */}
        <button onClick={close} aria-label="إغلاق" style={{
          position: 'absolute', top: '14px', right: '14px', zIndex: 5,
          width: '38px', height: '38px', borderRadius: '50%',
          border: '1px solid rgba(212,175,122,0.55)',
          background: 'rgba(11,11,11,0.62)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          color: '#EFE3D1', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,122,0.32)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(11,11,11,0.62)'; }}>
          <X size={18} />
        </button>

        {/* Clickable promotion image — vertical poster, suits all viewports */}
        <button onClick={go} aria-label="صمّمي باقتك / Design Your Package" style={{
          display: 'block', width: 'auto', maxWidth: '100%',
          padding: 0, border: 'none',
          background: 'transparent', cursor: 'pointer',
          borderRadius: '14px', overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(212,175,122,0.22)',
        }}>
          <img src={PROMO_IMAGE}
            alt="ATEMA Studio — Design Your Package promotion"
            decoding="async"
            fetchPriority="high"
            style={{
              display: 'block',
              width: 'auto', maxWidth: '100%',
              height: 'auto', maxHeight: '82vh',
              objectFit: 'contain',
            }} />
        </button>

        {/* Hint pill below image */}
        <div style={{
          textAlign: 'center', marginTop: '14px',
          fontSize: '0.72rem', letterSpacing: '0.32em',
          color: 'rgba(212,175,122,0.85)',
          fontFamily: "'Cinzel', serif", textTransform: 'uppercase',
        }}>
          TAP TO START · انقري للبدء
        </div>
      </div>

      <style>{`
        @keyframes promo-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes promo-pop-in {
          from { opacity: 0; transform: scale(0.94) translateY(8px) }
          to   { opacity: 1; transform: scale(1)    translateY(0)   }
        }
      `}</style>
    </div>
  );
}
