// ATEMA STUDIO — shared editorial header used across all public routes.
// Cinzel wordmark, minimal nav, lang toggle. No FAB monogram (per brand-usage rule:
// FAB stays reserved for gifts, bags, T&C, Contract — never visible on the site shell).

import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';

type Lang = 'ar' | 'en';
const tx = (l: Lang, ar: string, en: string) => l === 'ar' ? ar : en;

interface Props {
  lang:    Lang;
  setLang: (l: Lang) => void;
  /** When true (e.g. on long-form pages), header becomes solid on scroll. */
  solidOnScroll?: boolean;
}

const NAV: Array<{ to: string; ar: string; en: string }> = [
  { to: '/',          ar: 'الرئيسية',  en: 'Home'      },
  { to: '/portfolio', ar: 'الأعمال',   en: 'Portfolio' },
  // Films nav entry disabled till further notice — see CLAUDE.md §6.
  { to: '/journal',   ar: 'اليوميات',  en: 'Journal'   },
  { to: '/book',      ar: 'الباقات',   en: 'Packages'  },
  { to: '/about',     ar: 'الاستوديو', en: 'Atelier'   },
];

export default function SiteHeader({ lang, setLang, solidOnScroll = false }: Props) {
  const { isMobile } = useBreakpoint();
  const [scrolled, setScrolled] = useState(false);
  const [open,     setOpen]     = useState(false);
  const loc = useLocation();

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const headerBg = (scrolled || solidOnScroll || open)
    ? 'rgba(11,11,11,0.92)'
    : 'transparent';

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: headerBg,
      backdropFilter: scrolled || open ? 'blur(14px)' : 'none',
      WebkitBackdropFilter: scrolled || open ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--a-border)' : '1px solid transparent',
      transition: 'background 0.35s ease, border-color 0.35s ease',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        padding: isMobile ? '14px 18px' : '18px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Wordmark */}
        <Link to="/" style={{ textDecoration: 'none', display: 'block' }}>
          <div className="atema-wordmark" style={{
            fontSize: isMobile ? '1.15rem' : '1.32rem',
          }}>
            ATEMA
          </div>
          <div className="atema-sub" style={{
            fontSize: isMobile ? '0.5rem' : '0.55rem',
            marginTop: 2, textAlign: 'center',
          }}>
            S T U D I O
          </div>
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                style={({ isActive }) => ({
                  fontFamily: "'Cinzel', serif",
                  fontSize: '0.74rem', letterSpacing: '0.26em',
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--a-gold)' : 'var(--a-text-soft)',
                  textDecoration: 'none', fontWeight: 400,
                  transition: 'color 0.25s',
                  paddingBottom: 4,
                  borderBottom: isActive ? '1px solid var(--a-gold)' : '1px solid transparent',
                })}>
                {tx(lang, item.ar, item.en)}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Right: lang toggle (desktop) / hamburger (mobile) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isMobile && (
            <div className="lang-toggle">
              <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`}
                onClick={() => setLang('ar')}>ع</button>
              <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}>EN</button>
            </div>
          )}
          {isMobile && (
            <button onClick={() => setOpen(o => !o)}
              style={{
                background: 'transparent', border: '1px solid var(--a-border-strong)',
                color: 'var(--a-gold)', padding: '8px 10px', borderRadius: 2, cursor: 'pointer',
              }}>
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {isMobile && open && (
        <div style={{
          padding: '8px 18px 22px', borderTop: '1px solid var(--a-border)',
          background: 'rgba(11,11,11,0.96)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'block', padding: '12px 6px',
                fontFamily: "'Cinzel', serif", fontSize: '0.85rem',
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: isActive ? 'var(--a-gold)' : 'var(--a-text-soft)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--a-border)',
              })}>
              {tx(lang, item.ar, item.en)}
            </NavLink>
          ))}
          <div className="lang-toggle" style={{ alignSelf: 'flex-start', marginTop: 14 }}>
            <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>عربي</button>
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
      )}
    </header>
  );
}
