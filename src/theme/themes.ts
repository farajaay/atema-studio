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
