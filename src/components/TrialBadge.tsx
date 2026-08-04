// ATEMA STUDIO — quiet "trial version" marker on every public surface.
//
// The studio shows the site to clients while the catalogue, payments and the
// notification channels are still settling, so visitors are told up front that
// this is a preview build rather than being left to read a rough edge as
// carelessness. Deliberately:
//   • non-interactive (pointerEvents: none) so it can never swallow a tap;
//   • z-index 90 — under the fixed header (100) and every modal (1000+), so it
//     never covers a dialog or the booking sheet;
//   • bottom-LEFT in physical coordinates (not logical), so it stays put when
//     the page flips between RTL and LTR.
// Hidden on /admin/* — the owner does not need reminding. See App.tsx.

import { useEffect, useState } from 'react';

const COPY = {
  ar: 'نسخة تجريبية',
  en: 'Trial version',
} as const;

/** Track `<html lang>`, which useLang() writes on every page. The language
 *  preference lives in per-page hook state rather than a shared context, so
 *  the document attribute is the only global signal a root-level component
 *  can read — and it updates the moment a visitor hits the ع / EN toggle. */
function useDocumentLang(): 'ar' | 'en' {
  const [lang, setLang] = useState<'ar' | 'en'>(() =>
    typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ar',
  );

  useEffect(() => {
    const el = document.documentElement;
    const read = () => setLang(el.lang === 'en' ? 'en' : 'ar');
    read(); // catch a toggle that landed between first render and this effect
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);

  return lang;
}

export default function TrialBadge() {
  const lang = useDocumentLang();

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', bottom: 14, left: 14, zIndex: 90,
        pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 12px', borderRadius: 999,
        background: 'var(--a-surface)',
        border: '1px solid var(--a-border-strong)',
        color: 'var(--a-gold)',
        boxShadow: 'var(--a-shadow)',
        fontFamily: "'Tajawal', 'Montserrat', sans-serif",
        fontWeight: 300,
        fontSize: '0.62rem',
        letterSpacing: lang === 'ar' ? '0.06em' : '0.16em',
        textTransform: lang === 'ar' ? 'none' : 'uppercase',
        whiteSpace: 'nowrap',
        opacity: 0.92,
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: 'var(--a-gold)', opacity: 0.75, flexShrink: 0,
      }} />
      {COPY[lang]}
    </div>
  );
}
