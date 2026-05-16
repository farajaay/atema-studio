import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface Addon {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
  active: boolean;
}

const FALLBACK: Addon[] = [
  { id:'extra-hour',    name_ar:'ساعة تصوير إضافية',            name_en:'Extra photo hour',      price:700,  active:true },
  { id:'extra-hour-av', name_ar:'ساعة فيديو+فوتو إضافية',       name_en:'Extra video+photo hour', price:1100, active:true },
  { id:'video-short',   name_ar:'فيديو سينمائي قصير',           name_en:'Short cinematic video',  price:2200, active:true },
  { id:'video-full',    name_ar:'فيديو سينمائي كامل',           name_en:'Full cinematic video',   price:3200, active:true },
  { id:'henna',         name_ar:'تغطية ليلة الحناء',             name_en:'Henna night coverage',   price:2400, active:true },
  { id:'bridal-prep',   name_ar:'تصوير تحضيرات العروسين',        name_en:'Bridal prep session',    price:1200, active:true },
  { id:'album-upgrade', name_ar:'ترقية الألبوم إلى A3',          name_en:'Album upgrade to A3',    price:800,  active:true },
  { id:'extra-pages',   name_ar:'صفحات ألبوم إضافية (٥ صفحات)', name_en:'Extra album pages (5)',  price:600,  active:true },
  { id:'raw-files',     name_ar:'تسليم الملفات الخام',           name_en:'Raw files delivery',     price:900,  active:true },
  { id:'second-photog', name_ar:'مصور ثانٍ',                    name_en:'Second photographer',    price:1200, active:true },
  { id:'kosha',         name_ar:'تصوير الكوشة قبل الحفل',        name_en:'Pre-event kosha shoot',  price:800,  active:true },
  { id:'save-date',     name_ar:'Save the Date',                name_en:'Save the Date',          price:300,  active:true },
];

export function useAddonsData() {
  const [addons, setAddons]   = useState<Addon[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const fetchAddons = useCallback(async () => {
    setLoading(true);
    if (!supabase) { setAddons(FALLBACK); setLoading(false); return; }
    const { data, error } = await supabase
      .from('addons')
      .select('*')
      .eq('active', true)
      .order('sort_order');
    if (error || !data?.length) setAddons(FALLBACK);
    else setAddons(data as Addon[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAddons(); }, [fetchAddons]);

  return { addons, loading };
}
