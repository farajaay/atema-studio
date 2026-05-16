// ATEMA STUDIO — shared editorial footer.

import { Link } from 'react-router-dom';

type Lang = 'ar' | 'en';
const tx = (l: Lang, ar: string, en: string) => l === 'ar' ? ar : en;

interface Props { lang: Lang; }

export default function SiteFooter({ lang }: Props) {
  return (
    <footer style={{
      borderTop: '1px solid var(--a-border)',
      padding: '50px 32px 30px',
      background: 'var(--a-surface)',
      textAlign: 'center',
    }}>
      <div className="atema-wordmark" style={{ fontSize: '1.1rem', marginBottom: 6 }}>ATEMA</div>
      <div className="atema-sub" style={{ marginBottom: 22 }}>S T U D I O</div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
        gap: 30, marginBottom: 22,
      }}>
        {([
          ['/',           'الرئيسية',  'Home'],
          ['/portfolio',  'الأعمال',   'Portfolio'],
          ['/journal',    'اليوميات',  'Journal'],
          ['/book',       'الباقات',   'Packages'],
          ['/about',      'الاستوديو', 'Atelier'],
        ] as const).map(([to, ar, en]) => (
          <Link key={to} to={to} style={{
            fontFamily: "'Cinzel', serif", fontSize: '0.7rem',
            letterSpacing: '0.26em', textTransform: 'uppercase',
            color: 'var(--a-text-soft)', textDecoration: 'none',
          }}>
            {tx(lang, ar, en)}
          </Link>
        ))}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'center', gap: 26, flexWrap: 'wrap',
        marginBottom: 20, fontSize: '0.78rem',
      }}>
        <a href="tel:+966548323496"
          style={{ color: 'var(--a-gold)', textDecoration: 'none', direction: 'ltr' }}>
          +966 54 832 3496
        </a>
        <a href="https://instagram.com/atema.studio" target="_blank" rel="noreferrer"
          style={{ color: 'var(--a-gold)', textDecoration: 'none' }}>
          @atema.studio
        </a>
        <span style={{ color: 'var(--a-text-muted)' }}>
          {tx(lang, 'الجبيل، المملكة العربية السعودية', 'Jubail, Saudi Arabia')}
        </span>
      </div>

      <p style={{ fontSize: '0.66rem', color: 'var(--a-text-muted)',
        letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        © 2026 ATEMA Studio — {tx(lang, 'جميع الحقوق محفوظة', 'All Rights Reserved')}
      </p>
    </footer>
  );
}
