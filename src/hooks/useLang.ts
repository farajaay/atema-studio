// Persistent UI language preference, shared across routes.

import { useEffect, useState, useCallback } from 'react';

export type Lang = 'ar' | 'en';
const STORAGE_KEY = 'atema:lang';

export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'ar';
    const cached = window.localStorage.getItem(STORAGE_KEY);
    return cached === 'en' ? 'en' : 'ar';
  });

  // Sync document direction so every page gets the correct flow without per-page wiring.
  useEffect(() => {
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  return { lang, setLang };
}
