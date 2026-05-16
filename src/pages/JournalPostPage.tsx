// ATEMA STUDIO — Public single Journal entry (editorial long-form).

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { fetchJournalPost } from '../services/journal';
import type { JournalPost } from '../services/journal';
import { ArrowLeft } from 'lucide-react';

const tx = (l: 'ar' | 'en', ar: string, en: string) => l === 'ar' ? ar : en;

function formatDate(iso: string | undefined, lang: 'ar' | 'en'): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory',
  });
}

/** Render markdown-ish body: paragraphs split by blank lines. */
function renderBody(body: string, lang: 'ar' | 'en', isMobile: boolean) {
  const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map((p, i) => (
    <p key={i} style={{
      fontSize: isMobile ? '1rem' : '1.08rem',
      lineHeight: 1.95, color: 'var(--a-text)',
      fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
      marginBottom: 22, fontWeight: 300,
    }}>
      {p}
    </p>
  ));
}

export default function JournalPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();

  const [post, setPost] = useState<JournalPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    fetchJournalPost(slug).then(d => { setPost(d); setLoading(false); });
  }, [slug]);

  return (
    <div style={{ background: 'var(--a-bg)', color: 'var(--a-text)', minHeight: '100vh' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      {loading ? (
        <div style={{ padding: '200px 24px', textAlign: 'center', color: 'var(--a-text-muted)' }}>
          {tx(lang,'جارٍ التحميل...','Loading...')}
        </div>
      ) : !post ? (
        <div style={{ padding: isMobile ? '160px 24px 80px' : '200px 60px 120px', textAlign: 'center' }}>
          <FadeUp>
            <h1 className="display-serif" style={{
              fontSize: isMobile ? '1.8rem' : '2.4rem',
              color: 'var(--a-ivory)', marginBottom: 18, fontWeight: 300,
            }}>
              {tx(lang,'المنشور غير موجود','Entry not found')}
            </h1>
            <Link to="/journal" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost">
                {tx(lang,'العودة إلى اليوميات','Back to Journal')}
              </button>
            </Link>
          </FadeUp>
        </div>
      ) : (
        <article>
          {/* Hero cover */}
          {post.cover_url && (
            <div style={{
              width: '100%',
              height: isMobile ? '52vh' : '72vh',
              minHeight: isMobile ? 320 : 480,
              backgroundImage: `linear-gradient(180deg, rgba(11,11,11,0.25) 0%, rgba(11,11,11,0.75) 100%), url(${post.cover_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              padding: isMobile ? '0 24px 50px' : '0 60px 80px',
            }}>
              <div style={{ maxWidth: 820, textAlign: 'center' }}>
                <FadeUp>
                  <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
                    {formatDate(post.published_at, lang)}
                  </div>
                </FadeUp>
                <FadeUp delay={120}>
                  <h1 className="display-serif" style={{
                    fontSize: isMobile ? '2rem' : 'clamp(2.4rem, 4.5vw, 3.8rem)',
                    color: 'var(--a-ivory)', lineHeight: 1.15, fontWeight: 300,
                  }}>
                    {tx(lang, post.title_ar, post.title_en)}
                  </h1>
                </FadeUp>
              </div>
            </div>
          )}

          {/* If there is no cover, render a textual hero */}
          {!post.cover_url && (
            <section style={{
              padding: isMobile ? '140px 24px 40px' : '180px 60px 40px',
              textAlign: 'center',
            }}>
              <FadeUp>
                <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
                  {formatDate(post.published_at, lang)}
                </div>
              </FadeUp>
              <FadeUp delay={120}>
                <h1 className="display-serif" style={{
                  fontSize: isMobile ? '2.2rem' : '3.4rem',
                  color: 'var(--a-ivory)', maxWidth: 880, margin: '0 auto',
                  lineHeight: 1.18, fontWeight: 300,
                }}>
                  {tx(lang, post.title_ar, post.title_en)}
                </h1>
              </FadeUp>
            </section>
          )}

          {/* Body */}
          <section style={{
            maxWidth: 760, margin: '0 auto',
            padding: isMobile ? '50px 24px 40px' : '90px 40px 60px',
          }}>
            <FadeUp>
              <p style={{
                fontSize: isMobile ? '1.05rem' : '1.18rem',
                lineHeight: 1.85, color: 'var(--a-ivory)',
                fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                fontStyle: 'italic', fontWeight: 300, marginBottom: 36,
                paddingBottom: 28, borderBottom: '1px solid var(--a-border)',
              }}>
                {tx(lang, post.excerpt_ar, post.excerpt_en)}
              </p>
            </FadeUp>
            <FadeUp delay={120}>
              <div>
                {renderBody(tx(lang, post.body_ar, post.body_en), lang, isMobile)}
              </div>
            </FadeUp>
          </section>

          {/* Closing ornament + back link */}
          <section style={{
            padding: isMobile ? '20px 24px 100px' : '40px 60px 140px',
            textAlign: 'center',
          }}>
            <FadeUp>
              <div className="ornament"><span>ATEMA</span></div>
            </FadeUp>
            <FadeUp delay={140}>
              <Link to="/journal" style={{ textDecoration: 'none' }}>
                <button className="btn-ghost" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                }}>
                  <ArrowLeft size={14} />
                  {tx(lang,'كل المنشورات','All Entries')}
                </button>
              </Link>
            </FadeUp>
          </section>
        </article>
      )}

      <SiteFooter lang={lang} />
    </div>
  );
}
