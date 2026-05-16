// ATEMA STUDIO — Theme tokens for Couture Noir (default) + Atelier Ivory.
// Both palettes are sourced from the ATEMA Master Brand Guidelines:
//   - Couture Noir: Saint Laurent silk — black silk, champagne gold
//   - Atelier Ivory: Ivory champagne, soft glow, feminine elegance

export type ThemeName = 'noir' | 'ivory';

export interface ThemeTokens {
  // Surface
  bg:           string;  // page background
  surface:      string;  // primary card / panel
  surfaceAlt:   string;  // raised / hover card
  ivory:        string;  // accent backing (always warm cream)
  // Ink
  text:         string;  // body
  textSoft:     string;  // secondary
  textMuted:    string;  // tertiary / placeholders
  heading:      string;  // display + h*
  // Accents
  gold:         string;  // champagne gold — the signature accent
  goldDeep:     string;  // bronze — hover / active
  border:       string;  // hairline dividers
  borderStrong: string;  // visible borders
  // Misc
  shadow:       string;  // box-shadow rgba
  overlay:      string;  // modal overlay
  scrollbar:    string;
  scrollbarHover: string;
}

// Couture Noir — Saint Laurent inspired. Default.
export const noir: ThemeTokens = {
  bg:           '#0B0B0B',
  surface:      '#141414',
  surfaceAlt:   '#1C1C1C',
  ivory:        '#EFE3D1',
  text:         '#D8CDB9',
  textSoft:     '#9C8E76',
  textMuted:    '#6B5F4E',
  heading:      '#EFE3D1',
  gold:         '#D4AF7A',
  goldDeep:     '#BB864B',
  border:       'rgba(212,175,122,0.14)',
  borderStrong: 'rgba(212,175,122,0.35)',
  shadow:       '0 24px 64px rgba(0,0,0,0.55)',
  overlay:      'rgba(0,0,0,0.78)',
  scrollbar:    '#1C1C1C',
  scrollbarHover:'#D4AF7A',
};

// Atelier Ivory — current style, retained as alternative.
export const ivory: ThemeTokens = {
  bg:           '#F5EDE4',
  surface:      '#FFFFFF',
  surfaceAlt:   '#FBF6EE',
  ivory:        '#F5EDE4',
  text:         '#4A3728',
  textSoft:     '#6B5440',
  textMuted:    '#A89376',
  heading:      '#1A1A1A',
  gold:         '#8C6B4F',
  goldDeep:     '#6B5440',
  border:       'rgba(214,191,163,0.4)',
  borderStrong: 'rgba(140,107,79,0.45)',
  shadow:       '0 18px 50px rgba(61,46,31,0.10)',
  overlay:      'rgba(20,13,8,0.55)',
  scrollbar:    '#D6BFA3',
  scrollbarHover:'#8C6B4F',
};

export const THEMES: Record<ThemeName, ThemeTokens> = { noir, ivory };

/** Apply a theme by writing CSS custom properties on the document root. */
export function applyTheme(name: ThemeName) {
  const t = THEMES[name];
  const root = document.documentElement;
  Object.entries(t).forEach(([k, v]) => {
    root.style.setProperty(`--a-${kebab(k)}`, v as string);
  });
  root.setAttribute('data-theme', name);
}

function kebab(s: string) {
  return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

// ─── Legacy booking palette ──────────────────────────────────────────────────
// BookingPage / AdminDashboard / AdminLogin were authored against a flat
// ivory-tinted token map (T.pearl, T.coffee, T.sand…). To make those screens
// theme-aware without rewriting every inline style, we expose a palette of
// the same shape, derived from the active ThemeTokens.

export interface BookingPalette {
  pearl: string; ivory: string; cream: string; dune: string;
  champagne: string; sand: string; sandLt: string;
  gold: string; goldLt: string; taupe: string; mocha: string;
  coffee: string; espresso: string; rose: string; blush: string;
  // gradient endpoints for package cards
  gradA: string; gradB: string; gradC: string; gradD: string;
  // surfaces
  panel: string; panelAlt: string; border: string; borderStrong: string;
  // editorial blacks (used for dark CTA pills)
  ctaBg: string; ctaText: string; ctaBorder: string;
  // booking hero banner gradient + active-tab pill gradient
  heroGrad: string; tabActiveGrad: string; tabActiveText: string;
  // misc surfaces used in modals / list rows
  rowAlt: string;        // alt-row background (e.g. accordions)
  popupBg: string;       // popup body background
  popupBorder: string;
  popupClose: string;
}

export function getBookingPalette(name: ThemeName): BookingPalette {
  if (name === 'noir') {
    return {
      // pearl serves as the noir-page + base-card surface (#141414). Lift
      // comes from gold-tinted hairline borders, not from card-vs-page color
      // delta. ivory/cream step further up for nested panels (summary, modals).
      pearl: '#141414',     ivory: '#1C1C1C',     cream: '#231D14',     dune: '#2A2418',
      champagne: '#2A2418', sand: '#3D3320',      sandLt: '#1C1C1C',
      gold: '#D4AF7A',      goldLt: '#BB864B',    taupe: '#9C8E76',     mocha: '#D8CDB9',
      coffee: '#EFE3D1',    espresso: '#EFE3D1',  rose: '#1C1C1C',      blush: '#0B0B0B',
      gradA: '#141414',     gradB: '#1C1C1C',     gradC: '#2A2418',     gradD: '#0B0B0B',
      panel: '#141414',     panelAlt: '#1C1C1C',
      border: 'rgba(212,175,122,0.22)',
      borderStrong: 'rgba(212,175,122,0.55)',
      ctaBg: '#D4AF7A',     ctaText: '#0B0B0B',   ctaBorder: '#D4AF7A',
      heroGrad: 'linear-gradient(160deg,#0B0B0B 0%,#1A1610 45%,#0B0B0B 100%)',
      tabActiveGrad: 'linear-gradient(135deg,#D4AF7A,#BB864B)',
      tabActiveText: '#0B0B0B',
      rowAlt: '#1C1C1C',
      popupBg: '#141414',
      popupBorder: 'rgba(212,175,122,0.22)',
      popupClose: '#9C8E76',
    };
  }
  // ivory (current style)
  return {
    pearl: '#F5EDE4',     ivory: '#EDE4D8',     cream: '#E8D9C5',     dune: '#D6BFA3',
    champagne: '#E8D9C5', sand: '#D6BFA3',      sandLt: '#E8D9C5',
    gold: '#8C6B4F',      goldLt: '#A07E62',    taupe: '#6B5440',     mocha: '#4A3728',
    coffee: '#1A1A1A',    espresso: '#1A1A1A',  rose: '#F0E6DA',      blush: '#F5EDE4',
    gradA: '#F0E6DA',     gradB: '#E8D9C5',     gradC: '#EDE4D8',     gradD: '#D6BFA3',
    panel: '#FFFFFF',     panelAlt: '#FBF6EE',
    border: 'rgba(214,191,163,0.4)',
    borderStrong: 'rgba(140,107,79,0.45)',
    ctaBg: '#1A1A1A',     ctaText: '#E8D9C5',   ctaBorder: '#1A1A1A',
    heroGrad: 'linear-gradient(160deg,#C9B393 0%,#BEA882 40%,#C9B393 100%)',
    tabActiveGrad: 'linear-gradient(135deg,#1A1A1A,#2C2C2C)',
    tabActiveText: '#E8D9C5',
    rowAlt: '#FAFAFA',
    popupBg: '#FFFFFF',
    popupBorder: '#E8D9C5',
    popupClose: '#8C6B4F',
  };
}
