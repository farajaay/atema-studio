// ATEMA STUDIO — Album cover example render.
//
// One presentational component that turns a palette design (material texture
// photo, or the swatch_hex fallback) into a composed mock of the finished
// album: binding-edge spine, debossed ATEMA wordmark, material-aware sheen.
// Shared by four surfaces so they can't drift:
//   • AlbumSelectionPage — hero example when the bride picks a colour,
//     and the confirmed keepsake view
//   • AlbumComposer — chosen-cover chip in the admin booking modal
//   • AlbumDesignsManager — palette cards + edit-panel live preview
//
// Pure render — no data fetching, no DB change. Textures are the existing
// /photos/album/<code>.jpg/.webp pairs. Plan: docs/plans/integration-2026-07.md §2.

import type { AlbumDesign } from '../services/album';

interface Props {
  design: AlbumDesign;
  size?: 'hero' | 'tile';
  /** Binding edge follows reading direction — Arabic albums bind on the right. */
  dir?: 'rtl' | 'ltr';
  /** Hide the ATEMA deboss on very small renders (e.g. 54px admin chips). */
  emboss?: boolean;
  /** Sizing hook — set width here; height follows the 4:5 book aspect. */
  style?: React.CSSProperties;
}

export default function AlbumCoverExample({
  design, size = 'tile', dir = 'rtl', emboss = true, style,
}: Props) {
  const hero    = size === 'hero';
  const radius  = hero ? 12 : 7;
  // Spine shading runs from the binding edge inward — physical direction
  // because gradients don't understand logical sides.
  const inward  = dir === 'rtl' ? 'left' : 'right';
  // Leather catches light harder than linen.
  const sheen   = design.material === 'leather' ? 0.14 : 0.07;
  const webpUrl = design.preview_url?.replace(/\.jpe?g$/i, '.webp');

  return (
    <div dir={dir} style={{
      position: 'relative', width: '100%', aspectRatio: '4 / 5', overflow: 'hidden',
      // Square-ish corners on the binding edge, rounded on the fore-edge.
      borderStartStartRadius: 3, borderEndStartRadius: 3,
      borderStartEndRadius: radius, borderEndEndRadius: radius,
      boxShadow: hero ? '0 22px 45px rgba(0,0,0,0.40)' : '0 6px 16px rgba(0,0,0,0.30)',
      backgroundColor: design.swatch_hex,
      ...style,
    }}>
      {/* 1 — material texture (webp + jpeg pair), or the swatch fallback */}
      {design.preview_url ? (
        <picture>
          {webpUrl && webpUrl !== design.preview_url && <source type="image/webp" srcSet={webpUrl} />}
          <img src={design.preview_url} alt={design.code} loading="lazy" decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </picture>
      ) : (
        <div style={{ position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.18), rgba(0,0,0,0.18))',
          backgroundColor: design.swatch_hex }} />
      )}

      {/* 2 — spine fold + hinge groove + sheen, one overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `
        linear-gradient(115deg, rgba(255,255,255,${sheen}) 0%, rgba(255,255,255,0) 45%),
        linear-gradient(to ${inward},
          rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.10) 7%,
          rgba(255,255,255,0.10) 9%, rgba(255,255,255,0) 13%)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 4px rgba(0,0,0,0.22)' }} />

      {/* 3 — blind-deboss frame (hero only) */}
      {hero && (
        <div style={{ position: 'absolute', inset: '7%',
          border: '1px solid rgba(0,0,0,0.22)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)' }} />
      )}

      {/* 4 — debossed wordmark */}
      {emboss && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Cinzel', 'Cormorant Garamond', serif", fontWeight: 400,
          fontSize: hero ? 15 : 8.5, letterSpacing: '0.38em', textIndent: '0.38em',
          color: 'color-mix(in srgb, var(--a-gold) 60%, transparent)',
          textShadow: '0 -1px 1px rgba(0,0,0,0.50), 0 1px 1px rgba(255,255,255,0.14)',
          userSelect: 'none', direction: 'ltr',
        }}>ATEMA</div>
      )}
    </div>
  );
}
