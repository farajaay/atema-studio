// ATEMA STUDIO — Public Portfolio gallery.
// Editorial grid, category filter, lightbox.

import { useEffect, useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { fetchPortfolio, CATEGORIES } from '../services/portfolio';
import type { PortfolioItem, PortfolioCategory } from '../services/portfolio';
import { X } from 'lucide-react';

const tx = (l: 'ar' | 'en', ar: string, en: string) => l === 'ar' ? ar : en;

export default function PortfolioPage() {
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PortfolioCategory | 'all'>('all');
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    fetchPortfolio().then(d => { setItems(d); setLoading(false); });
  }, []);

  const visible = filter === 'all' ? items : items.filter(i => i.category === filter);

  // Hide category chips that have zero items. The portfolio seed only
  // populates bride/couture/editorial today; Family and Maternity were
  // pre-defined categories with no curated work yet, so clicking them used
  // to dead-end on an empty state. Better UX: don't advertise empty rooms.
  // The "All" chip is always shown.
  const nonEmptyCategories = CATEGORIES.filter(c =>
    items.some(i => i.category === c.key)
  );

  // If the current filter no longer has items (e.g. admin unpublished the
  // last item in that category), reset to "all" so the page doesn't stay
  // stuck on an empty filter the user can't see.
  useEffect(() => {
    if (filter !== 'all' && !items.some(i => i.category === filter)) {
      setFilter('all');
    }
  }, [filter, items]);

  return (
    <div style={{ background: 'var(--a-bg)', color: 'var(--a-text)', minHeight: '100vh' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      <section style={{ padding: isMobile ? '120px 24px 50px' : '160px 60px 60px', textAlign: 'center' }}>
        <FadeUp>
          <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
            {tx(lang,'الأعمال','Portfolio')}
          </div>
        </FadeUp>
        <FadeUp delay={120}>
          <h1 className="display-serif" style={{
            fontSize: isMobile ? '2.2rem' : '3.4rem', color: 'var(--a-ivory)',
            marginBottom: 18, fontWeight: 300,
          }}>
            {tx(lang,'مختاراتٌ من الضوء','A Selection in Light')}
          </h1>
        </FadeUp>
        <FadeUp delay={220}>
          <p style={{
            maxWidth: 580, margin: '0 auto', color: 'var(--a-text-soft)',
            fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
            fontSize: '0.96rem', lineHeight: 1.85,
          }}>
            {tx(lang,
              'كل صورة هي لحظة لن تتكرر — مختارة من جلساتنا الأخيرة بعناية.',
              'Every frame is a moment that will not return — curated from recent sessions.')}
          </p>
        </FadeUp>
      </section>

      {/* Category filter */}
      <div style={{
        display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12,
        padding: '0 24px 40px',
      }}>
        {[{ key: 'all' as const, ar: 'الكل', en: 'All' }, ...nonEmptyCategories].map(c => (
          <button key={c.key} onClick={() => setFilter(c.key as any)}
            style={{
              padding: '8px 22px', borderRadius: 2, cursor: 'pointer',
              background: filter === c.key ? 'var(--a-gold)' : 'transparent',
              color:      filter === c.key ? '#0B0B0B' : 'var(--a-text-soft)',
              border:     `1px solid ${filter === c.key ? 'var(--a-gold)' : 'var(--a-border-strong)'}`,
              fontFamily: "'Cinzel', serif", fontSize: '0.72rem',
              letterSpacing: '0.22em', textTransform: 'uppercase',
              transition: 'all 0.25s',
            }}>
            {tx(lang, c.ar, c.en)}
          </button>
        ))}
      </div>

      {/* Grid */}
      <section style={{ padding: isMobile ? '0 18px 80px' : '0 40px 120px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--a-text-muted)', padding: 60 }}>
            {tx(lang,'جارٍ التحميل...','Loading...')}
          </p>
        ) : visible.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--a-text-muted)', padding: 60 }}>
            {tx(lang,'لا توجد أعمال حالياً.','No work to display yet.')}
          </p>
        ) : (
          <div style={{
            display: 'grid', gap: isMobile ? 12 : 16,
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            maxWidth: 1280, margin: '0 auto',
          }}>
            {visible.map((it, i) => (
              <FadeUp key={it.id} delay={(i % 6) * 60}>
                <button onClick={() => setLightbox(it)} style={{
                  position: 'relative', display: 'block', width: '100%',
                  aspectRatio: '3 / 4', overflow: 'hidden', cursor: 'pointer',
                  border: '1px solid var(--a-border)', background: 'var(--a-surface)',
                  padding: 0,
                }}>
                  <img src={it.image_url} alt={tx(lang, it.title_ar, it.title_en)}
                    loading="lazy"
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      transition: 'transform 0.9s cubic-bezier(0.22,0.61,0.36,1), filter 0.5s',
                      filter: 'brightness(0.92)',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLImageElement).style.transform = 'scale(1.05)';
                      (e.target as HTMLImageElement).style.filter = 'brightness(1)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLImageElement).style.transform = 'scale(1)';
                      (e.target as HTMLImageElement).style.filter = 'brightness(0.92)';
                    }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '24px 16px 12px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                    color: 'var(--a-ivory)', textAlign: 'left',
                  }}>
                    <div className="editorial-eyebrow" style={{ fontSize: '0.55rem', marginBottom: 4 }}>
                      {CATEGORIES.find(c => c.key === it.category)?.[lang === 'ar' ? 'ar' : 'en'] ?? ''}
                    </div>
                    <div className="display-serif" style={{ fontSize: '0.92rem' }}>
                      {tx(lang, it.title_ar, it.title_en)}
                    </div>
                  </div>
                </button>
              </FadeUp>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.94)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? 16 : 48,
        }}>
          <button onClick={() => setLightbox(null)} style={{
            position: 'fixed', top: 24, right: 24, zIndex: 310,
            background: 'transparent', border: '1px solid var(--a-gold)',
            color: 'var(--a-gold)', padding: 10, cursor: 'pointer', borderRadius: 0,
          }}>
            <X size={18} />
          </button>
          <div onClick={e => e.stopPropagation()} style={{
            maxWidth: 1100, maxHeight: '90vh', display: 'flex',
            flexDirection: 'column', alignItems: 'center',
          }}>
            <img src={lightbox.image_url} alt=""
              style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain' }} />
            <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--a-ivory)' }}>
              <div className="display-serif" style={{ fontSize: '1.25rem', marginBottom: 6 }}>
                {tx(lang, lightbox.title_ar, lightbox.title_en)}
              </div>
              {(lightbox.caption_ar || lightbox.caption_en) && (
                <p style={{ fontSize: '0.85rem', color: 'var(--a-text-soft)', maxWidth: 720 }}>
                  {tx(lang, lightbox.caption_ar ?? '', lightbox.caption_en ?? '')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <SiteFooter lang={lang} />
    </div>
  );
}
