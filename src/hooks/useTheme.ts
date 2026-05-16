// Read theme from app_settings and apply it as CSS custom properties.
// Falls back to 'noir' before settings load so the first paint is never wrong.

import { useEffect } from 'react';
import { applyTheme } from '../theme/themes';
import type { ThemeName } from '../theme/themes';
import { useAppSettings } from './useAppSettings';

const STORAGE_KEY = 'atema:theme';

/** Reads the cached theme synchronously (used by main.tsx to avoid first-paint flash). */
export function getInitialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'noir';
  const cached = window.localStorage.getItem(STORAGE_KEY);
  return cached === 'ivory' ? 'ivory' : 'noir';
}

/** Reactively keeps the document theme in sync with admin settings. */
export function useTheme() {
  const { settings } = useAppSettings();
  useEffect(() => {
    const name: ThemeName = settings.theme === 'ivory' ? 'ivory' : 'noir';
    applyTheme(name);
    try { window.localStorage.setItem(STORAGE_KEY, name); } catch { /* ignore */ }
  }, [settings.theme]);
}
