// ATEMA STUDIO — Editorial home page.
// Cinematic hero → Experience scroll-story → Packages teaser → Journal preview → Portfolio preview.

import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';

const tx = (l: 'ar' | 'en', ar: string, en: string) => l === 'ar' ? ar : en;

export default function HomePage() {
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();

  return (
    <div style={{ background: 'var(--a-bg)', color: 'var(--a-text)', minHeight: '100vh' }}>
      <SiteHeader lang={lang} setLang={setLang} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '120px 24px 80px',
        backgroundImage:
          'radial-gradient(circle at 50% 30%, rgba(212,175,122,0.10), transparent 60%), linear-gradient(180deg, #0B0B0B 0%, #141414 100%)',
        overflow: 'hidden',
      }}>
        {/* Subtle silk gradient sweep */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, transparent 40%, rgba(212,175,122,0.04) 50%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <FadeUp delay={120}>
          <div className="editorial-eyebrow" style={{ marginBottom: 20 }}>
            EST. 2024 · JUBAIL, KSA
          </div>
        </FadeUp>
        <FadeUp delay={260}>
          <h1 className="display-serif" style={{
            fontSize: isMobile ? '2.4rem' : 'clamp(3.2rem, 7vw, 6rem)',
            color: 'var(--a-ivory)', lineHeight: 1.05, fontWeight: 300,
            margin: '0 auto', maxWidth: 920, letterSpacing: '0.02em',
          }}>
            {tx(lang,'لحظتُكِ، خالدةً في الضوء.','Your moment, suspended in light.')}
          </h1>
        </FadeUp>
        <FadeUp delay={400}>
          <p style={{
            maxWidth: 560, margin: '28px auto 0',
            fontSize: isMobile ? '0.92rem' : '1.05rem',
            lineHeight: 1.9, color: 'var(--a-text-soft)',
            fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
            fontWeight: 300,
          }}>
            {tx(lang,
              'استوديو فاطمة بوحسن للتصوير النسائي الحصري — لحظات حميمة، صور سينمائية، وإرث بصري يُحفظ.',
              'Fatima Bohassan’s exclusive feminine atelier — intimate frames, cinematic stillness, an heirloom for keeps.'
            )}
          </p>
        </FadeUp>
        <FadeUp delay={540}>
          <div style={{
            display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
            marginTop: 40,
          }}>
            <Link to="/book" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ width: 'auto', padding: '14px 32px' }}>
                {tx(lang,'احجزي جلستك','Reserve a Session')}
              </button>
            </Link>
            <Link to="/portfolio" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost">
                {tx(lang,'الأعمال','View Portfolio')}
              </button>
            </Link>
          </div>
        </FadeUp>

        {/* Scroll cue */}
        <div aria-hidden style={{
          position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
          fontFamily: "'Cinzel', serif", fontSize: '0.6rem',
          letterSpacing: '0.5em', color: 'var(--a-text-muted)',
          writingMode: 'vertical-rl',
        }}>
          SCROLL
        </div>
      </section>

      {/* ── The Experience ──────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '90px 24px' : '140px 60px',
        background: 'var(--a-bg)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeUp>
            <div className="ornament"><span>{tx(lang,'التجربة','The Experience')}</span></div>
          </FadeUp>
          <FadeUp delay={120}>
            <h2 className="display-serif" style={{
              fontSize: isMobile ? '1.9rem' : '2.6rem',
              color: 'var(--a-ivory)', textAlign: 'center',
              maxWidth: 820, margin: '0 auto 60px', lineHeight: 1.25,
            }}>
              {tx(lang,'أربع لحظات تصنع إرثاً.','Four moments that make an heirloom.')}
            </h2>
          </FadeUp>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? 24 : 36,
          }}>
            {[
              { ar: 'المشاورة', en: 'Consultation',
                arBody: 'حوار خاص لفهم رؤيتكِ وتنسيق كل تفصيل قبل المناسبة.',
                enBody: 'A private dialogue to understand your vision and choreograph every detail.' },
              { ar: 'الأجواء', en: 'Atmosphere',
                arBody: 'إضاءة ناعمة، تركيز مطلق على الخصوصية، وفريق نسائي كامل.',
                enBody: 'Soft directional light, absolute discretion, and an all-female team.' },
              { ar: 'الالتقاط', en: 'Capture',
                arBody: 'لحظات غير مُتدخّل بها — صور سينمائية تنبض بالشعور.',
                enBody: 'Unstaged, cinematic frames that breathe emotion.' },
              { ar: 'الإرث', en: 'Heirloom',
                arBody: 'ألبومات مطبوعة بأيدي حِرَفية وفيديو سينمائي محفور في الذاكرة.',
                enBody: 'Handbound printed albums and a cinematic film, made to outlast.' },
            ].map((m, i) => (
              <FadeUp key={m.en} delay={i * 110}>
                <div style={{
                  border: '1px solid var(--a-border)',
                  background: 'var(--a-surface)',
                  padding: isMobile ? '28px 24px' : '38px 34px',
                  position: 'relative',
                }}>
                  <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="display-serif" style={{
                    fontSize: '1.45rem', color: 'var(--a-ivory)',
                    marginBottom: 14, fontWeight: 300,
                  }}>
                    {tx(lang, m.ar, m.en)}
                  </h3>
                  <p style={{
                    fontSize: '0.92rem', lineHeight: 1.85,
                    color: 'var(--a-text-soft)',
                    fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                  }}>
                    {tx(lang, m.arBody, m.enBody)}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Editorial Cross-Sell ──────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '80px 24px' : '120px 60px',
        background: 'var(--a-surface)',
        borderTop: '1px solid var(--a-border)',
        borderBottom: '1px solid var(--a-border)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'grid', gap: 24,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        }}>
          {[
            { to: '/portfolio', ar: 'الأعمال',  en: 'Portfolio',
              arSub: 'مختارات من جلساتنا الأخيرة', enSub: 'A selection of recent sessions' },
            { to: '/journal',   ar: 'اليوميات', en: 'Journal',
              arSub: 'مقالات عن الضوء، التحضير، والذاكرة', enSub: 'Notes on light, preparation, and memory' },
            { to: '/about',     ar: 'الاستوديو',  en: 'The Atelier',
              arSub: 'رؤية الاستوديو وفلسفته',         enSub: 'Our philosophy and craft' },
          ].map(item => (
            <FadeUp key={item.to}>
              <Link to={item.to} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                <div style={{
                  border: '1px solid var(--a-border)',
                  padding: isMobile ? '32px 24px' : '44px 34px',
                  background: 'var(--a-surface-alt)',
                  transition: 'all 0.35s ease',
                  height: '100%',
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--a-gold)';
                    e.currentTarget.style.transform   = 'translateY(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--a-border)';
                    e.currentTarget.style.transform   = 'translateY(0)';
                  }}>
                  <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>
                    {tx(lang,'تصفّحي','Discover')}
                  </div>
                  <h3 className="display-serif" style={{
                    fontSize: '1.7rem', color: 'var(--a-ivory)', marginBottom: 10, fontWeight: 300,
                  }}>
                    {tx(lang, item.ar, item.en)}
                  </h3>
                  <p style={{
                    fontSize: '0.86rem', color: 'var(--a-text-soft)', lineHeight: 1.8,
                    fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                  }}>
                    {tx(lang, item.arSub, item.enSub)}
                  </p>
                  <div style={{
                    marginTop: 22, fontFamily: "'Cinzel', serif",
                    fontSize: '0.7rem', letterSpacing: '0.3em',
                    color: 'var(--a-gold)', textTransform: 'uppercase',
                  }}>
                    {tx(lang,'اكتشفي ←','Explore →')}
                  </div>
                </div>
              </Link>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '90px 24px' : '140px 60px',
        textAlign: 'center', background: 'var(--a-bg)',
      }}>
        <FadeUp>
          <div className="editorial-eyebrow" style={{ marginBottom: 18 }}>
            {tx(lang,'دعينا نلتقي','Let’s Meet')}
          </div>
        </FadeUp>
        <FadeUp delay={140}>
          <h2 className="display-serif" style={{
            fontSize: isMobile ? '2rem' : '3rem', color: 'var(--a-ivory)',
            maxWidth: 760, margin: '0 auto 30px', lineHeight: 1.2,
          }}>
            {tx(lang,'احجزي جلستكِ — مساحة محدودة.','Reserve your session — limited availability.')}
          </h2>
        </FadeUp>
        <FadeUp delay={260}>
          <Link to="/book" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ width: 'auto', padding: '16px 44px' }}>
              {tx(lang,'احجزي الآن','Reserve Now')}
            </button>
          </Link>
        </FadeUp>
      </section>

      <SiteFooter lang={lang} />
    </div>
  );
}
