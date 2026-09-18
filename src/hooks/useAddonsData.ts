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

// Fallback add-ons — the catalogue the booking page shows when Supabase is
// unreachable. Re-synced to production on 2026-09-18 from
// database/backups/catalogue-2026-09-18.sql, alongside
// migrations-2026-09-addons-cleanup.sql.
//
// Only rows with active = true live here: an inactive row can never be bought,
// so offering one during an outage would quote a service the studio retired.
// Retired in that migration and deliberately absent: second-photog (renamed,
// then superseded by second-photographer), express-48h, photo-pack-50,
// same-day-preview, videography. `save-date` is also absent — inactive, and
// bundled into باقة الخطوبة as a gift rather than sold.
//
// NOTE the two timestamp-looking ids: the admin "new add-on" form derives an
// id from the name with /[^\w-]/g stripped, which erases Arabic entirely and
// leaves just a hyphen plus Date.now(). They are the live ids for «تغطية جوال»
// and «وصيفة» and must be kept verbatim; the generator is worth fixing before
// the next Arabic-named add-on is created.
//
// Like the package DEMO, this does NOT follow the admin panel automatically —
// re-check it whenever the live add-ons change (CLAUDE.md §6).
const FALLBACK: Addon[] = [
  { id:'extra-hour',          name_ar:'ساعة تصوير إضافية',                        name_en:'Extra photo hour',                  price: 900,  active:true, sort_order: 10 },
  { id:'video-short',         name_ar:'فيديو سينمائي قصير (إضافة للكلاسيكية)',     name_en:'Short cinematic video (Classic add-on)', price:3400, active:true, sort_order: 10 },
  { id:'video-full',          name_ar:'فيديو سينمائي كامل (إضافة للكلاسيكية)',     name_en:'Full cinematic video (Classic add-on)',  price:4800, active:true, sort_order: 30 },
  { id:'henna',               name_ar:'تغطية ليلة الحناء (ساعتين)',                name_en:'Henna night coverage',              price:2400,  active:true, sort_order: 40 },
  { id:'pre-wedding-mini',    name_ar:'جلسة تصوير ما قبل الزفاف (ساعة ونصف)',      name_en:'Pre-Wedding Mini Session',          price:1200,  active:true, sort_order: 40 },
  { id:'bridal-prep',         name_ar:'تصوير تحضيرات العروس (ساعة ونصف)',          name_en:'Bridal prep session',               price:1200,  active:true, sort_order: 50 },
  { id:'kosha',               name_ar:'تصوير القاعة والضيافة قبل الحفل (٤٥ دقيقة)', name_en:'Pre-event shoot',                   price: 800,  active:true, sort_order: 50 },
  { id:'--1780506890141',     name_ar:'تغطية جوال',                                name_en:'Mobile Coverage',                   price:1000,  active:true, sort_order: 60 },
  { id:'second-photographer', name_ar:'مصورة ثانية',                               name_en:'Second Photographer',               price:1200,  active:true, sort_order: 70 },
  { id:'-1780431887832',      name_ar:'وصيفة',                                     name_en:'Bridesmaid',                        price: 700,  active:true, sort_order: 80 },
  { id:'extra-pages',         name_ar:'صفحات ألبوم إضافية (سعر الصفحة)',           name_en:'Extra album page (per page)',       price: 120,  active:true, sort_order: 90 },
  { id:'raw-files',           name_ar:'تسليم الملفات الخام',                       name_en:'Raw files delivery',                price: 900,  active:true, sort_order: 90 },
  { id:'makeup-styling',      name_ar:'تنسيق مكياج وتصفيف',                        name_en:'Makeup & Styling Coordination',     price: 700,  active:true, sort_order: 90 },
  { id:'album-upgrade',       name_ar:'ترقية الألبوم إلى A3',                      name_en:'Album upgrade to A3',               price: 800,  active:true, sort_order:100 },
  { id:'express-24h',         name_ar:'تسليم فائق السرعة (24 ساعة)',               name_en:'Express Delivery (24h)',            price: 800,  active:true, sort_order:100 },
  { id:'out-of-area-travel',  name_ar:'تغطية خارج المنطقة الشرقية',                name_en:'Out-of-Area Travel Coverage',       price: 600,  active:true, sort_order:100 },
  { id:'photo-pack-10',       name_ar:'باقة صور إضافية (10)',                      name_en:'Extra Photo Pack (10)',             price: 300,  active:true, sort_order:100 },
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
