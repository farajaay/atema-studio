// ATEMA STUDIO — Stationery palette.
//
// The single source of truth for every artifact the bride receives in
// printable/sendable form: contract, tax invoice, booking-confirmation
// email, and the public /policy page. Independent of the in-app screen
// theme toggle (noir / ivory) — stationery always wears the same dress.
//
// Inspired by the brand's couture line: cream paper, deep umber ink,
// champagne accents, noir header gradient. Optimised for print
// (high contrast on cream, no dark backgrounds bleeding ink).
//
// MIRROR in supabase/functions/_shared/stationery.ts (Deno copy for the
// email Edge Function). When you change a value here, change it there.

export const STATIONERY = {
  // ── Surfaces ─────────────────────────────────────────────────────────────
  paper:         '#F9F5F0',  // page background + nested inner panels on cream
  paperAlt:      '#FBF6EE',  // slightly-lifted inner panel
  paperWarn:     '#FFF8F0',  // "deposit non-refundable" inset
  card:          '#FFFFFF',  // main document container card

  // ── Ink ──────────────────────────────────────────────────────────────────
  ink:           '#2C2218',  // body text, deep umber (NOT pure black)
  inkSoft:       '#4A3728',  // sub-body, h3, secondary
  inkMuted:      '#8C6B4F',  // warm-brown gold — h2, links, labels
  inkFaint:      '#B09880',  // tertiary labels, placeholders

  // ── Accents ──────────────────────────────────────────────────────────────
  goldChampagne: '#C9B393',  // signature champagne — frame borders, stamps
  goldDeep:      '#8C6B4F',  // warm brown gold (= inkMuted)
  goldHi:        '#E8D9C5',  // pale champagne, used on noir backgrounds
  borderHair:    '#E8D9C5',  // hairline divider on cream
  borderDash:    '#D6BFA3',  // dashed accents (QR section, etc.)

  // ── Noir (header gradient + CTA pills) ───────────────────────────────────
  noir:          '#1A1A1A',
  noirMid:       '#2C2C2C',
  noirWarm:      '#4A3728',
  noirGrad:      'linear-gradient(135deg,#1A1A1A,#2C2C2C,#4A3728)',

  // ── Warning callout ("deposit non-refundable") ───────────────────────────
  warnInk:       '#5C3D1E',  // text inside the highlighted inset
  warnAccent:    '#8C6B4F',  // 3px side-border on the inset (= goldDeep)

  // ── Status badges (replaces off-brand Tailwind greens/yellows) ───────────
  okBg:          '#EAF2EC',
  okInk:         '#3F6B53',
  okBorder:      '#B7CFC0',
  warnBg:        '#FBF1E5',
  warnIn:        '#A07043',
  warnBorder:    '#DFC0A0',

  // ── Shadows ──────────────────────────────────────────────────────────────
  shadow:        '0 4px 24px rgba(0,0,0,0.08)',
  cardShadow:    '0 6px 32px rgba(26,26,26,0.08)',

  // ── Fonts ────────────────────────────────────────────────────────────────
  // Brand wordmark ("ATEMA STUDIO") always renders in Amiri regardless of
  // script — the spaced-letter serif IS the wordmark.
  fontDisplayAr: "'Amiri', serif",
  fontDisplayEn: "'Cormorant Garamond', serif",
  fontWordmark:  "'Amiri', serif",
  fontBody:      "'Tajawal', sans-serif",
} as const;

/**
 * The single @import url(...) line for the stationery font set.
 * Inline this in any document HTML that needs to register webfonts.
 */
export const STATIONERY_FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cormorant+Garamond:wght@400;500;600&family=Tajawal:wght@300;400;600;700&display=swap');";
