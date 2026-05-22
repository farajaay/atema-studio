// Small editorial share-to-WhatsApp button.
//
// WhatsApp is the primary distribution channel in KSA (95%+ open rates,
// 86%+ penetration — see docs/marketing-proposal-2026-05). Surfacing a
// one-tap share at the end of each long-form surface (journal posts,
// portfolio lightbox, booking confirmation) reclaims free, high-trust
// reach into private family groups — the exact moment a bride is most
// likely to forward a vendor recommendation.

interface Props {
  /** Optional pre-fill text — defaults to a bilingual one-liner. */
  text?: string;
  /** Optional URL — defaults to the current page (window.location.href). */
  url?:  string;
  /** UI language; controls the visible button label only. */
  lang:  'ar' | 'en';
  /** Visual variant. `compact` is icon-style for grids/lightboxes. */
  size?: 'default' | 'compact';
}

export default function ShareToWhatsApp({ text, url, lang, size = 'default' }: Props) {
  const handleClick = () => {
    const target = url ?? (typeof window !== 'undefined' ? window.location.href : 'https://atemastudio.xyz/');
    const message = `${text ?? (lang === 'ar' ? 'شاهدي هذه من ATEMA STUDIO' : 'Saw this on ATEMA STUDIO')}\n${target}`;
    const href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(href, '_blank', 'noopener');
  };

  if (size === 'compact') {
    return (
      <button
        onClick={handleClick}
        aria-label={lang === 'ar' ? 'شاركي على واتساب' : 'Share on WhatsApp'}
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: '#25D366', color: '#0B0B0B', border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(37,211,102,0.35)',
        }}
      >
        <WaGlyph />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: '#25D366', color: '#0B0B0B', border: 'none',
        padding: '11px 22px', borderRadius: 2, cursor: 'pointer',
        fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Cinzel', serif",
        fontSize: '0.82rem', fontWeight: 500,
        letterSpacing: lang === 'ar' ? '0.05em' : '0.18em',
        textTransform: lang === 'ar' ? 'none' : 'uppercase',
        boxShadow: '0 4px 18px rgba(37,211,102,0.32)',
      }}
    >
      <WaGlyph />
      {lang === 'ar' ? 'شاركي على واتساب' : 'Share on WhatsApp'}
    </button>
  );
}

function WaGlyph() {
  // Minimal inline SVG so the button works without lucide-react.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A9.95 9.95 0 0012 2C6.48 2 2 6.48 2 12c0 1.76.46 3.47 1.34 4.99L2 22l5.16-1.36A9.95 9.95 0 0012 22c5.52 0 10-4.48 10-10 0-2.67-1.04-5.18-2.95-7.09zM12 20.13c-1.55 0-3.07-.42-4.4-1.2l-.32-.19-3.06.8.82-2.98-.21-.34A8.13 8.13 0 013.87 12c0-4.48 3.65-8.13 8.13-8.13 2.17 0 4.21.85 5.74 2.39A8.07 8.07 0 0120.13 12c0 4.48-3.65 8.13-8.13 8.13zm4.45-6.06c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.02-.37.1-.49.1-.1.24-.27.36-.4.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.41-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.83-.84 2.02 0 1.19.86 2.34.98 2.5.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z" />
    </svg>
  );
}
