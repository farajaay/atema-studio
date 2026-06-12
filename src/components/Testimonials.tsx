// ATEMA STUDIO — Bilingual testimonials carousel (audit append, 2026-05)
//
// Addresses §6.6 — social proof during booking. The audit flagged absence of
// any client testimonials as the single biggest missed conversion lever for
// a boutique studio. Until real client testimonials with written consent
// are collected, this ships placeholders tagged TODO[CONTENT].
//
// Theme: --a-* CSS custom properties; no hard-coded hex.
//
// Accessibility:
//   - prefers-reduced-motion stops the auto-rotation.
//   - Manual dot navigation always works.
//   - Each card is in an aria-labelled region.

import { useEffect, useState } from 'react';
import { useLang } from '../hooks/useLang';

interface Testimonial {
  // TODO[CONTENT]: Replace with real client testimonials (with written
  // consent to publish + reference to the booking). Until then these
  // are illustrative placeholders, not real customer quotes.
  attribution_ar: string;
  attribution_en: string;
  quote_ar: string;
  quote_en: string;
  context_ar?: string;
  context_en?: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    attribution_ar: 'نورة · عروس ٢٠٢٥',
    attribution_en: 'Noura · 2025 bride',
    quote_ar: 'شعرت بأن الفريق فهم لحظتي قبل أن أصفها — صور تنبض بهدوء يومي، لا بأسلوب آخر مفروض.',
    quote_en: 'I felt the team understood my day before I described it — images that breathe the calm of who I am, not a borrowed aesthetic.',
    context_ar: 'حفل زفاف · الجبيل',
    context_en: 'Wedding · Jubail',
  },
  {
    attribution_ar: 'منى · زوجة ابن العميلة',
    attribution_en: 'Mona · mother of the bride',
    quote_ar: 'الخصوصية كانت في كل تفصيل — فريق نسائي كامل، لا كاميرات في المكان الخطأ، ولا لحظة حرج. ابنتي كانت على راحتها بالكامل.',
    quote_en: 'Discretion was woven into every detail — an all-female team, no camera in the wrong place, not one awkward moment. My daughter was entirely at ease.',
    context_ar: 'حفل ملكة · الدمام',
    context_en: 'Engagement · Dammam',
  },
  {
    attribution_ar: 'لطيفة · مصمّمة',
    attribution_en: 'Latifa · designer',
    quote_ar: 'صور المنتجات من فاطمة وفريقها أوصلت الحرفة كما أردتها — ضوء ناعم، تركيب صادق، وحس فني يحترم العمل.',
    quote_en: 'The product imagery from Fatima\'s team translated the craft exactly as I meant it — soft light, honest composition, and a sensibility that respects the work itself.',
    context_ar: 'تصوير منتجات',
    context_en: 'Product shoot',
  },
];

const ROTATE_MS = 8000; // slow, considered — not Instagram-pace

export default function Testimonials() {
  const { lang } = useLang();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // State (not a ref) so a mid-session preference change re-renders and
  // actually stops the rotation + animation.
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  // Respect prefers-reduced-motion on change (initial value comes from state init)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Auto-rotate — paused on hover, focus, or reduced-motion preference
  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = window.setInterval(() => {
      setActive(prev => (prev + 1) % TESTIMONIALS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, reducedMotion]);

  const item = TESTIMONIALS[active];
  const quote      = lang === 'ar' ? item.quote_ar       : item.quote_en;
  const attribution = lang === 'ar' ? item.attribution_ar : item.attribution_en;
  const context    = lang === 'ar' ? item.context_ar     : item.context_en;

  return (
    <section
      aria-label={lang === 'ar' ? 'شهادات العميلات' : 'Client testimonials'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: '40px 28px',
        textAlign: 'center',
      }}
    >
      <div style={{
        fontFamily: "'Cinzel', serif",
        fontSize: '0.72rem',
        letterSpacing: '0.42em',
        color: 'var(--a-gold)',
        marginBottom: '24px',
      }}>
        {lang === 'ar' ? 'كلمات من عميلاتنا' : 'IN OUR CLIENTS’ WORDS'}
      </div>

      <div
        key={active}            /* re-mount triggers a clean transition */
        aria-live="polite"
        style={{
          minHeight: '180px',
          animation: reducedMotion
            ? 'none'
            : 'atema-testimonial-fade 0.5s ease',
        }}
      >
        <blockquote style={{
          fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)',
          fontWeight: 400,
          color: 'var(--a-heading)',
          margin: '0 0 22px 0',
          lineHeight: 1.65,
          maxWidth: '60ch',
          marginInline: 'auto',
        }}>
          &ldquo;{quote}&rdquo;
        </blockquote>
        <div style={{
          fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : 'inherit',
          fontSize: '0.82rem',
          letterSpacing: '0.06em',
          color: 'var(--a-text-soft)',
          fontWeight: 500,
        }}>
          {attribution}
        </div>
        {context && (
          <div style={{
            fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : 'inherit',
            fontSize: '0.72rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--a-text-muted)',
            marginTop: '6px',
          }}>
            {context}
          </div>
        )}
      </div>

      {/* Dot navigation — accessible, always works */}
      <div style={{
        display: 'flex', gap: '10px', justifyContent: 'center',
        marginTop: '28px',
      }}>
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={
              lang === 'ar'
                ? `عرض الشهادة ${i + 1} من ${TESTIMONIALS.length}`
                : `Show testimonial ${i + 1} of ${TESTIMONIALS.length}`
            }
            aria-current={i === active ? 'true' : undefined}
            onClick={() => setActive(i)}
            style={{
              width: i === active ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              background: i === active ? 'var(--a-gold)' : 'var(--a-border-strong)',
              transition: 'width 0.3s ease, background 0.2s',
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes atema-testimonial-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
