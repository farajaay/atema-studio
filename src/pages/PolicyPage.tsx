// ATEMA STUDIO — Public Terms / Refund / PDPL page (bilingual).
//
// Required by Moyasar live-activation review and by Apple/Google policy
// reviewers. Single source of truth for the same copy lives in
// src/content/legal.ts.

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { STATIONERY } from '../theme/stationery';
import {
  TC_CONTENT_AR, TC_CONTENT_EN,
  PDPL_CONTENT_AR, PDPL_CONTENT_EN,
} from '../content/legal';

const tx = (l: 'ar' | 'en', ar: string, en: string) => l === 'ar' ? ar : en;

export default function PolicyPage() {
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();

  const tc   = lang === 'ar' ? TC_CONTENT_AR   : TC_CONTENT_EN;
  const pdpl = lang === 'ar' ? PDPL_CONTENT_AR : PDPL_CONTENT_EN;

  return (
    <div style={{ background: 'var(--a-bg)', color: 'var(--a-text)', minHeight: '100vh' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      <section style={{
        padding: isMobile ? '120px 24px 40px' : '160px 60px 50px',
        textAlign: 'center',
      }}>
        <FadeUp>
          <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
            {tx(lang, 'الشروط والسياسات', 'Terms & Policies')}
          </div>
        </FadeUp>
        <FadeUp delay={120}>
          <h1 className="display-serif" style={{
            fontSize: isMobile ? '2rem' : '3rem', color: 'var(--a-ivory)',
            marginBottom: 16, fontWeight: 300,
          }}>
            {tx(lang, 'الشروط والأحكام وحماية البيانات', 'Terms, Refunds & Data Protection')}
          </h1>
        </FadeUp>
        <FadeUp delay={220}>
          <p style={{
            maxWidth: 620, margin: '0 auto', color: 'var(--a-text-soft)',
            fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
            fontSize: '0.95rem', lineHeight: 1.85,
          }}>
            {tx(lang,
              'هذه السياسات تحكم العلاقة بينكِ وبين ATEMA Studio. آخر تحديث: ٢٠٢٦-٠٥.',
              'These policies govern your relationship with ATEMA Studio. Last updated: 2026-05.')}
          </p>
        </FadeUp>
      </section>

      {/* The legal copy lives as HTML strings — we render it on a white card
          to inherit the existing light-theme typography from the in-booking
          popup, so the two surfaces look identical. */}
      <section style={{
        padding: isMobile ? '20px 24px 80px' : '20px 60px 120px',
      }}>
        <div style={{
          maxWidth: 760, margin: '0 auto',
          display: 'grid', gap: 24,
        }}>
          <FadeUp>
            <article
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              style={{
                background: STATIONERY.paperAlt, color: STATIONERY.inkSoft, borderRadius: 8,
                padding: isMobile ? '22px 20px' : '34px 36px',
                border: `1px solid ${STATIONERY.borderHair}`,
              }}
              dangerouslySetInnerHTML={{ __html: tc }}
            />
          </FadeUp>
          <FadeUp delay={120}>
            <article
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              style={{
                background: STATIONERY.paperAlt, color: STATIONERY.inkSoft, borderRadius: 8,
                padding: isMobile ? '22px 20px' : '34px 36px',
                border: `1px solid ${STATIONERY.borderHair}`,
              }}
              dangerouslySetInnerHTML={{ __html: pdpl }}
            />
          </FadeUp>
        </div>
      </section>

      <SiteFooter lang={lang} />
    </div>
  );
}
