// ATEMA STUDIO — Public Mood Board page
//
// Route: /#/board/:token (HashRouter)
//
// A noir-themed editorial page composed by Fatima from the admin panel.
// Token is the only secret guarding the page (160 bits of entropy).
// First open auto-marks viewed_at via a SECURITY DEFINER RPC.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import FadeUp from '../components/FadeUp';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';
import {
  getMoodBoardByToken,
  markMoodBoardViewed,
  type MoodBoard,
} from '../services/moodboard';

export default function MoodBoardPage() {
  const { token = '' }    = useParams<{ token: string }>();
  const { lang, setLang } = useLang();
  const { isMobile }      = useBreakpoint();
  const [board,    setBoard]    = useState<MoodBoard | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setNotFound(true); setLoading(false); return; }
      const b = await getMoodBoardByToken(token);
      if (cancelled) return;
      if (!b) { setNotFound(true); setLoading(false); return; }
      setBoard(b);
      setLoading(false);
      // Fire-and-forget — best-effort, the page renders either way
      markMoodBoardViewed(token);
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--a-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--a-gold)', fontFamily: "'Cinzel', serif",
        letterSpacing: '0.3em', fontSize: '0.8rem',
      }}>
        ATEMA · LOADING
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────
  if (notFound || !board) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--a-bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, color: 'var(--a-text-soft)',
        fontFamily: 'Inter, sans-serif', textAlign: 'center', padding: 40,
      }}>
        <div style={{
          fontFamily: "'Cinzel', serif", letterSpacing: '0.3em',
          fontSize: '1rem', color: 'var(--a-gold)',
        }}>ATEMA</div>
        <div style={{ fontSize: '1rem', lineHeight: 1.7 }} dir="rtl">
          هذا الرابط لم يعد متاحًا.
          <br />
          <span style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
            fontSize: '0.95rem', opacity: 0.7, direction: 'ltr', display: 'inline-block',
          }}>
            This invitation has gently expired.
          </span>
        </div>
        <Link to="/" style={{ color: 'var(--a-gold)', textDecoration: 'underline', fontSize: '0.9rem' }}>
          atemastudio.xyz
        </Link>
      </div>
    );
  }

  // ── Page ───────────────────────────────────────────────────────────────
  const titleAr = board.title_ar || 'هكذا نراها';
  const titleEn = board.title_en || 'This is how we see her';
  const subAr   = lang === 'ar' ? 'لوحةُ المزاج · من أتيلييه أتيما' : 'MOOD BOARD · من أتيلييه أتيما';
  const subEn   = 'MOOD BOARD · FROM THE ATEMA ATELIER';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-bg)', color: 'var(--a-text)' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      {/* Hero */}
      <section style={{
        padding: isMobile ? '120px 24px 40px' : '160px 80px 60px',
        textAlign: 'center', maxWidth: 900, margin: '0 auto',
      }}>
        <FadeUp>
          <div style={{
            fontFamily: "'Cinzel', serif", letterSpacing: '0.4em',
            fontSize: '0.72rem', color: 'var(--a-gold)', marginBottom: 26,
          }}>
            {lang === 'ar' ? subAr : subEn}
          </div>
        </FadeUp>

        <FadeUp delay={120}>
          {lang === 'ar' ? (
            <h1 className="display-serif" dir="rtl" style={{
              fontFamily: "'Amiri', 'Tajawal', serif", fontStyle: 'italic',
              fontSize: isMobile ? '2rem' : '3rem', lineHeight: 1.3, fontWeight: 400,
              color: 'var(--a-heading)', margin: '0 0 18px',
            }}>{titleAr}</h1>
          ) : (
            <h1 className="display-serif" style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: isMobile ? '2.4rem' : '3.6rem', lineHeight: 1.15,
              fontWeight: 400, color: 'var(--a-heading)',
              margin: '0 0 18px', letterSpacing: '0.01em',
            }}>{titleEn}</h1>
          )}
        </FadeUp>

        <FadeUp delay={220}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
            fontSize: isMobile ? '1.05rem' : '1.25rem',
            color: 'var(--a-text-soft)', margin: '0 0 28px', opacity: 0.85,
          }}>
            {lang === 'ar' ? titleEn : titleAr}
          </div>
          <div style={{ width: 60, height: 1, background: 'var(--a-gold)', margin: '0 auto' }} />
        </FadeUp>
      </section>

      {/* 6-image grid */}
      <section style={{
        padding: isMobile ? '20px 16px 60px' : '20px 80px 100px',
        maxWidth: 1280, margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 12 : 20,
        }}>
          {(board.image_urls || []).map((url, idx) => {
            const webp = url.replace(/\.jpe?g$/i, '.webp');
            return (
              <FadeUp key={idx} delay={idx * 60}>
                <div style={{
                  position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden',
                  borderRadius: 2, background: 'var(--a-surface-alt)',
                }}>
                  <picture>
                    <source srcSet={webp} type="image/webp" />
                    <img src={url} alt="" loading="lazy" decoding="async"
                      width={800} height={1067}
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover', display: 'block',
                      }} />
                  </picture>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </section>

      {/* Letter from the atelier */}
      {(board.caption_ar || board.caption_en) && (
        <section style={{
          padding: isMobile ? '40px 24px 60px' : '80px 80px 120px',
          maxWidth: 760, margin: '0 auto', textAlign: 'center',
        }}>
          <FadeUp>
            <div style={{
              fontFamily: "'Cinzel', serif", letterSpacing: '0.4em',
              fontSize: '0.7rem', color: 'var(--a-gold)', marginBottom: 32,
            }}>
              A LETTER FROM THE ATELIER
            </div>

            {board.caption_ar && (
              <p dir="rtl" style={{
                fontFamily: "'Amiri', serif", fontStyle: 'italic',
                fontSize: isMobile ? '1.15rem' : '1.4rem', lineHeight: 1.7,
                color: 'var(--a-text)', margin: '0 0 28px',
              }}>
                {board.caption_ar}
              </p>
            )}

            {board.caption_en && (
              <p style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
                fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.7,
                color: 'var(--a-text-soft)', margin: '0 0 36px',
              }}>
                {board.caption_en}
              </p>
            )}

            <div style={{ width: 60, height: 1, background: 'var(--a-gold)', margin: '0 auto 24px' }} />
            <div style={{
              fontFamily: "'Cinzel', serif", letterSpacing: '0.3em',
              fontSize: '0.7rem', color: 'var(--a-text-muted)',
            }}>
              FATIMA · ATEMA STUDIO
            </div>
          </FadeUp>
        </section>
      )}

      <SiteFooter lang={lang} />
    </div>
  );
}
