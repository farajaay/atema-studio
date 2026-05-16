// ATEMA STUDIO — Public Journal list (editorial blog).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { fetchJournal } from '../services/journal';
import type { JournalPost } from '../services/journal';

const tx = (l: 'ar' | 'en', ar: string, en: string) => l === 'ar' ? ar : en;

function formatDate(iso: string | undefined, lang: 'ar' | 'en'): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory',
  });
}

export default function JournalPage() {
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();

  const [posts, setPosts] = useState<JournalPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJournal().then(d => { setPosts(d); setLoading(false); });
  }, []);

  return (
    <div style={{ background: 'var(--a-bg)', color: 'var(--a-text)', minHeight: '100vh' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      <section style={{ padding: isMobile ? '120px 24px 50px' : '160px 60px 60px', textAlign: 'center' }}>
        <FadeUp>
          <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
            {tx(lang,'اليوميات','Journal')}
          </div>
        </FadeUp>
        <FadeUp delay={120}>
          <h1 className="display-serif" style={{
            fontSize: isMobile ? '2.2rem' : '3.4rem', color: 'var(--a-ivory)',
            marginBottom: 18, fontWeight: 300,
          }}>
            {tx(lang,'ملاحظاتٌ من الاستوديو','Notes from the Atelier')}
          </h1>
        </FadeUp>
        <FadeUp delay={220}>
          <p style={{
            maxWidth: 580, margin: '0 auto', color: 'var(--a-text-soft)',
            fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
            fontSize: '0.96rem', lineHeight: 1.85,
          }}>
            {tx(lang,
              'حوارٌ هادئ عن الضوء والتحضير وفن صناعة الذاكرة.',
              'A quiet conversation about light, preparation, and the craft of memory.')}
          </p>
        </FadeUp>
      </section>

      <section style={{ padding: isMobile ? '0 20px 100px' : '0 60px 140px', maxWidth: 1200, margin: '0 auto' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--a-text-muted)', padding: 60 }}>
            {tx(lang,'جارٍ التحميل...','Loading...')}
          </p>
        ) : posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--a-text-muted)', padding: 60 }}>
            {tx(lang,'لا توجد منشورات بعد.','No entries yet.')}
          </p>
        ) : (
          <div style={{
            display: 'grid', gap: isMobile ? 30 : 50,
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          }}>
            {posts.map((p, i) => (
              <FadeUp key={p.id} delay={(i % 4) * 80}>
                <Link to={`/journal/${p.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <article style={{
                    background: 'var(--a-surface)', border: '1px solid var(--a-border)',
                    transition: 'all 0.35s', overflow: 'hidden',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--a-gold)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--a-border)'; }}>
                    {p.cover_url && (
                      <div style={{ aspectRatio: '16 / 10', overflow: 'hidden' }}>
                        <img src={p.cover_url} alt="" loading="lazy"
                          style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            filter: 'brightness(0.86)',
                            transition: 'transform 0.9s cubic-bezier(0.22,0.61,0.36,1)',
                          }} />
                      </div>
                    )}
                    <div style={{ padding: isMobile ? '24px 22px 28px' : '32px 32px 36px' }}>
                      <div className="editorial-eyebrow" style={{ marginBottom: 10 }}>
                        {formatDate(p.published_at, lang)}
                      </div>
                      <h2 className="display-serif" style={{
                        fontSize: isMobile ? '1.4rem' : '1.7rem',
                        color: 'var(--a-ivory)', marginBottom: 12, fontWeight: 300, lineHeight: 1.25,
                      }}>
                        {tx(lang, p.title_ar, p.title_en)}
                      </h2>
                      <p style={{
                        fontSize: '0.92rem', color: 'var(--a-text-soft)', lineHeight: 1.85,
                        fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                      }}>
                        {tx(lang, p.excerpt_ar, p.excerpt_en)}
                      </p>
                      <div style={{
                        marginTop: 20, fontFamily: "'Cinzel', serif",
                        fontSize: '0.7rem', letterSpacing: '0.3em',
                        color: 'var(--a-gold)', textTransform: 'uppercase',
                      }}>
                        {tx(lang,'اقرئي ←','Read →')}
                      </div>
                    </div>
                  </article>
                </Link>
              </FadeUp>
            ))}
          </div>
        )}
      </section>

      <SiteFooter lang={lang} />
    </div>
  );
}
