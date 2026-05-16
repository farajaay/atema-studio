// ATEMA STUDIO — The Atelier (about) page.
// Story of the studio, philosophy, and a private invitation.

import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';

const tx = (l: 'ar' | 'en', ar: string, en: string) => l === 'ar' ? ar : en;

export default function AboutPage() {
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();

  return (
    <div style={{ background: 'var(--a-bg)', color: 'var(--a-text)', minHeight: '100vh' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '140px 24px 60px' : '180px 60px 80px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 20%, rgba(212,175,122,0.08), transparent 65%)',
          pointerEvents: 'none',
        }} />
        <FadeUp>
          <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>
            {tx(lang,'الاستوديو','The Atelier')}
          </div>
        </FadeUp>
        <FadeUp delay={120}>
          <h1 className="display-serif" style={{
            fontSize: isMobile ? '2.3rem' : 'clamp(2.8rem, 5vw, 4.2rem)',
            color: 'var(--a-ivory)', marginBottom: 22, fontWeight: 300,
            maxWidth: 900, margin: '0 auto', lineHeight: 1.18,
          }}>
            {tx(lang,
              'استوديو نسائي للضوء والذاكرة.',
              'A feminine atelier of light and memory.'
            )}
          </h1>
        </FadeUp>
        <FadeUp delay={240}>
          <p style={{
            maxWidth: 640, margin: '28px auto 0',
            fontSize: isMobile ? '0.96rem' : '1.05rem',
            lineHeight: 1.9, color: 'var(--a-text-soft)',
            fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
            fontWeight: 300,
          }}>
            {tx(lang,
              'في قلب الجبيل، تُصاغ كل صورة كقطعةٍ من كوتور — بصمت، وبصبر، وبدقّة.',
              'In the heart of Jubail, every photograph is composed like a couture piece — quietly, patiently, precisely.'
            )}
          </p>
        </FadeUp>
      </section>

      {/* ── Founder / Story ─────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '60px 24px 80px' : '80px 60px 120px',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 40 : 80, alignItems: 'center',
        }}>
          <FadeUp>
            <div className="ornament" style={{ marginBottom: 24 }}>
              <span>{tx(lang,'المؤسِّسة','The Founder')}</span>
            </div>
            <h2 className="display-serif" style={{
              fontSize: isMobile ? '1.9rem' : '2.4rem',
              color: 'var(--a-ivory)', marginBottom: 22, fontWeight: 300, lineHeight: 1.25,
            }}>
              {tx(lang,'فاطمة بوحسن','Fatima Bohassan')}
            </h2>
            <p style={{
              fontSize: '0.98rem', lineHeight: 1.9, color: 'var(--a-text)',
              fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
              marginBottom: 18, fontWeight: 300,
            }}>
              {tx(lang,
                'بدأ المشروع كحوار خاص بين امرأة وكاميرتها — مساحة آمنة تُصاغ فيها اللحظات الأولى للعروس، الأمومة، والعائلات الصغيرة.',
                'The studio began as a private conversation between a woman and her camera — a safe space in which to compose the first frames of brides, mothers-to-be, and small families.'
              )}
            </p>
            <p style={{
              fontSize: '0.98rem', lineHeight: 1.9, color: 'var(--a-text-soft)',
              fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
              fontWeight: 300,
            }}>
              {tx(lang,
                'كل جلسة هي عمل مُعدّ بعناية: من المشاورة، إلى الإضاءة، إلى آخر صورة مطبوعة بأيدٍ حِرَفية.',
                'Each session is a piece prepared with care: from the consultation, to the lighting, to the very last frame printed by hand.'
              )}
            </p>
          </FadeUp>

          <FadeUp delay={120}>
            <div style={{
              aspectRatio: '3 / 4', background: 'var(--a-surface)',
              border: '1px solid var(--a-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div aria-hidden style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, rgba(212,175,122,0.06), transparent 60%)',
              }} />
              <div className="display-serif" style={{
                fontSize: isMobile ? '2.2rem' : '3rem',
                color: 'var(--a-gold)', letterSpacing: '0.05em',
              }}>
                ATEMA
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Philosophy ──────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '80px 24px' : '120px 60px',
        background: 'var(--a-surface)',
        borderTop: '1px solid var(--a-border)',
        borderBottom: '1px solid var(--a-border)',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <FadeUp>
            <div className="ornament"><span>{tx(lang,'الفلسفة','Philosophy')}</span></div>
          </FadeUp>
          <FadeUp delay={120}>
            <h2 className="display-serif" style={{
              fontSize: isMobile ? '1.9rem' : '2.6rem',
              color: 'var(--a-ivory)', textAlign: 'center',
              maxWidth: 820, margin: '0 auto 60px', lineHeight: 1.25,
            }}>
              {tx(lang,'الجمال يُبنى ببطء.','Beauty is built slowly.')}
            </h2>
          </FadeUp>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? 24 : 32,
          }}>
            {[
              { ar: 'الخصوصية', en: 'Discretion',
                arBody: 'فريقٌ نسائي كامل، استوديو خاص، وضمان مطلق لراحتكِ وكرامتكِ.',
                enBody: 'An all-female team, a private studio, and absolute assurance of your comfort and dignity.' },
              { ar: 'الحِرفة', en: 'Craft',
                arBody: 'إضاءة سينمائية، تركيب يدوي، وطباعة على ورق أرشيفي يدوم.',
                enBody: 'Cinematic lighting, hand-bound albums, and archival printing made to last.' },
              { ar: 'الذاكرة', en: 'Memory',
                arBody: 'ليست صوراً فحسب — هي إرثٌ بصري يُسلَّم للأجيال.',
                enBody: 'Not merely photographs — a visual inheritance for generations to come.' },
            ].map((v, i) => (
              <FadeUp key={v.en} delay={i * 120}>
                <div style={{
                  border: '1px solid var(--a-border)',
                  background: 'var(--a-surface-alt)',
                  padding: isMobile ? '28px 24px' : '36px 30px',
                  height: '100%',
                }}>
                  <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="display-serif" style={{
                    fontSize: '1.35rem', color: 'var(--a-ivory)',
                    marginBottom: 12, fontWeight: 300,
                  }}>
                    {tx(lang, v.ar, v.en)}
                  </h3>
                  <p style={{
                    fontSize: '0.9rem', lineHeight: 1.85,
                    color: 'var(--a-text-soft)',
                    fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                  }}>
                    {tx(lang, v.arBody, v.enBody)}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
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
        <FadeUp delay={120}>
          <h2 className="display-serif" style={{
            fontSize: isMobile ? '2rem' : '2.8rem', color: 'var(--a-ivory)',
            maxWidth: 720, margin: '0 auto 30px', lineHeight: 1.25, fontWeight: 300,
          }}>
            {tx(lang,
              'احجزي مشاورة خاصة — لنبدأ معاً.',
              'Reserve a private consultation — let’s begin.'
            )}
          </h2>
        </FadeUp>
        <FadeUp delay={240}>
          <div style={{
            display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Link to="/book" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ width: 'auto', padding: '14px 32px' }}>
                {tx(lang,'احجزي جلستك','Reserve a Session')}
              </button>
            </Link>
            <Link to="/portfolio" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost">
                {tx(lang,'تصفّحي الأعمال','Browse Portfolio')}
              </button>
            </Link>
          </div>
        </FadeUp>
      </section>

      <SiteFooter lang={lang} />
    </div>
  );
}
