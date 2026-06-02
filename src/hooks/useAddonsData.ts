import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface Addon {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
  active: boolean;
  sort_order: number;
}

// Fallback add-ons — mirrors database/seed-packages-2026-05.sql so the booking
// page always shows the catalogue from the printed price list, even when
// Supabase is unreachable.
const FALLBACK: Addon[] = [
  { id:'extra-hour',    name_ar:'ساعة تصوير إضافية',                       name_en:'Extra photo hour',                       price: 900,  active:true, sort_order: 10 },
  { id:'video-short',   name_ar:'فيديو سينمائي قصير (إضافة للكلاسيكية)',    name_en:'Short cinematic video (Classic add-on)', price:3400,  active:true, sort_order: 20 },
  { id:'video-full',    name_ar:'فيديو سينمائي كامل (إضافة للكلاسيكية)',    name_en:'Full cinematic video (Classic add-on)',  price:4800,  active:true, sort_order: 30 },
  { id:'henna',         name_ar:'تغطية ليلة الحناء',                       name_en:'Henna night coverage',                   price:2400,  active:true, sort_order: 40 },
  { id:'bridal-prep',   name_ar:'تصوير تحضيرات العروس',                    name_en:'Bridal prep session',                    price:1200,  active:true, sort_order: 50 },
  { id:'album-upgrade', name_ar:'ترقية الألبوم إلى A3',                    name_en:'Album upgrade to A3',                    price: 800,  active:true, sort_order: 60 },
  { id:'extra-pages',   name_ar:'صفحات ألبوم إضافية (سعر الصفحة)',         name_en:'Extra album page (per page)',            price: 120,  active:true, sort_order: 70 },
  { id:'raw-files',     name_ar:'تسليم الملفات الخام',                     name_en:'Raw files delivery',                     price: 900,  active:true, sort_order: 80 },
  { id:'second-photog', name_ar:'مصور ثانٍ',                               name_en:'Second photographer',                    price:1200,  active:true, sort_order: 90 },
  { id:'kosha',         name_ar:'تصوير الكوشة قبل الحفل',                   name_en:'Pre-event kosha shoot',                  price: 800,  active:true, sort_order:100 },
  { id:'save-date',     name_ar:'Save the Date',                           name_en:'Save the Date',                          price: 700,  active:true, sort_order:110 },
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
