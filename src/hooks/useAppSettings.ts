// React hook for global app settings — cached for the page session.

import { useEffect, useState, useCallback } from 'react';
import { fetchSettings, saveSettings, DEFAULT_SETTINGS } from '../services/settings';
import type { AppSettings } from '../services/settings';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading,  setLoading]  = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const s = await fetchSettings();
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const ok = await saveSettings(patch);
    if (ok) setSettings(prev => ({ ...prev, ...patch }));
    return ok;
  }, []);

  return { settings, loading, reload, update };
}
