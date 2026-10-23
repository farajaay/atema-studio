// Whether the public Films page is switched on (app_settings.films_enabled,
// admin «إعدادات النظام»). `null` while loading, so the /films route can wait
// instead of bouncing a visitor home before the flag arrives.
import { useEffect, useState } from 'react';
import { fetchSettingsOnce } from '../services/settings';

export function useFilmsEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetchSettingsOnce().then(s => { if (alive) setOn(s.films_enabled); });
    return () => { alive = false; };
  }, []);
  return on;
}
