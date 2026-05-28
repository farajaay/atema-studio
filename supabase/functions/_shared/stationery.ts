// ATEMA STUDIO — Stationery palette (Deno mirror).
//
// MIRROR of src/theme/stationery.ts. Deno Edge Functions can't import from
// the Vite source tree, so the same constant lives here twice. When you
// change a value, change both. The mirror is intentional — keeps the
// stationery font/colour decisions out of the client bundle and out of the
// SMTP path's dependency graph.

export const STATIONERY = {
  paper:         '#F9F5F0',
  paperAlt:      '#FBF6EE',
  paperWarn:     '#FFF8F0',
  card:          '#FFFFFF',

  ink:           '#2C2218',
  inkSoft:       '#4A3728',
  inkMuted:      '#8C6B4F',
  inkFaint:      '#B09880',

  goldChampagne: '#C9B393',
  goldDeep:      '#8C6B4F',
  goldHi:        '#E8D9C5',
  borderHair:    '#E8D9C5',
  borderDash:    '#D6BFA3',

  noir:          '#1A1A1A',
  noirMid:       '#2C2C2C',
  noirWarm:      '#4A3728',
  noirGrad:      'linear-gradient(135deg,#1A1A1A,#2C2C2C,#4A3728)',

  warnInk:       '#5C3D1E',
  warnAccent:    '#8C6B4F',

  okBg:          '#EAF2EC',
  okInk:         '#3F6B53',
  okBorder:      '#B7CFC0',
  warnBg:        '#FBF1E5',
  warnIn:        '#A07043',
  warnBorder:    '#DFC0A0',

  shadow:        '0 4px 24px rgba(0,0,0,0.08)',
  cardShadow:    '0 6px 32px rgba(26,26,26,0.08)',

  fontDisplayAr: "'Amiri', serif",
  fontDisplayEn: "'Cormorant Garamond', serif",
  fontWordmark:  "'Amiri', serif",
  fontBody:      "'Tajawal', sans-serif",
} as const;

export const STATIONERY_FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cormorant+Garamond:wght@400;500;600&family=Tajawal:wght@300;400;600;700&display=swap');";
