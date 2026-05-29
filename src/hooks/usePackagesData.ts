import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface Package {
  id: number;
  name_ar: string;
  name_en: string;
  price: number;
  duration_hours: number;
  edited_photos: number;
  album: string | null;
  video: boolean;
  description: string | null;
  /** Default (Arabic) feature list — present on every package. */
  features: string[] | null;
  /** Optional English feature list — added by the audit migration.
   *  When absent, the renderer falls back to `features` (Arabic). */
  features_en?: string[] | null;
  badge: string | null;
  is_popular: boolean;
  active: boolean;
  included_addon_ids: string[] | null;
}

/** Return the feature list in the bride's chosen language. Falls back
 *  to the always-present (Arabic) `features` array when no English
 *  variant exists on this row. */
export function getLocalizedFeatures(
  pkg: { features: string[] | null; features_en?: string[] | null } | null | undefined,
  lang: 'ar' | 'en',
): string[] {
  if (!pkg) return [];
  if (lang === 'en' && pkg.features_en && pkg.features_en.length > 0) {
    return pkg.features_en;
  }
  return pkg.features ?? [];
}

// Fallback catalogue — mirrors database/seed-packages-2026-05.sql so the site
// renders the same offering even when Supabase is unreachable.
const DEMO: Package[] = [
  { id: 1, name_ar: 'باقة الخطوبة',     name_en: 'Engagement Session', price: 2400,  duration_hours: 2, edited_photos: 30,  album: null,
    video: false, description: 'جلسة خطوبة رومانسية بأسلوب راقٍ — مثالية لإعلان البداية.',
    features: ['ساعتان من التصوير الاحترافي', '٣٠ صورة معدّلة بعناية', 'اختيار أجمل اللقطات', 'وحدة تخزين باسم العروسين', 'تصميم Save the Date رقمي هدية'],
    badge: null, is_popular: false, active: true, included_addon_ids: [] },

  // id=2 is the Customise-tab foundation — hidden from the Ready Packages
  // grid because the booking page filters out the cheapest active package
  // (see src/pages/BookingPage.tsx — predefinedPackages).
  { id: 2, name_ar: 'الباقة الأساسية',  name_en: 'Base',               price: 1800,  duration_hours: 2, edited_photos: 30,  album: null,
    video: false, description: 'الأساس الذي تُبنى عليه باقتك المخصّصة — اختاري الإضافات حسب يومك.',
    features: ['ساعتان من التصوير', '٣٠ صورة معدّلة', 'وحدة تخزين رقمية', 'أساس مرن لإضافة ما تشائين'],
    badge: 'الأساسي', is_popular: false, active: true, included_addon_ids: [] },

  { id: 3, name_ar: 'الباقة الكلاسيكية', name_en: 'Classic',            price: 4200,  duration_hours: 4, edited_photos: 300, album: 'ألبوم A4 ١٥ صفحة',
    video: false, description: 'الباقة المثالية للمناسبات الخاصة — ألبوم فاخر وذكريات تبقى.',
    features: ['٤ ساعات تغطية شاملة للحفل', 'ألبوم A4 بـ ١٥ صفحة', '٥ صور عائلية معدّلة', 'وحدة تخزين بجميع الصور المعدّلة'],
    badge: null, is_popular: false, active: true, included_addon_ids: [] },

  { id: 4, name_ar: 'الباقة الملكية',   name_en: 'Royal',              price: 6900,  duration_hours: 5, edited_photos: 400, album: 'ألبوم A4 + ميني ألبوم',
    video: true,  description: 'تجربة تصوير ملكية مع فيديو سينمائي قصير وألبومين فاخرين.',
    features: ['٥ ساعات تغطية شاملة للحفل', 'فيديو سينمائي قصير (٣–٥ دقائق)', 'ألبوم A4 بـ ١٥ صفحة', 'ميني ألبوم عائلي', 'وحدة تخزين باسم العروسين', 'معاينة في نفس اليوم (٥ صور مختارة)'],
    badge: 'الأكثر طلباً', is_popular: true, active: true, included_addon_ids: [] },

  { id: 5, name_ar: 'باقة التوقيع',     name_en: 'Signature',          price: 8500,  duration_hours: 6, edited_photos: 500, album: 'ألبوم فاخر A3 ١٢ صفحة + ميني',
    video: true,  description: 'الباقة الاحترافية الشاملة — فيديو سينمائي كامل وألبوم A3 فاخر.',
    features: ['٦ ساعات تغطية شاملة للحفل', 'فيديو سينمائي كامل', 'جلسة تصوير تحضيرات العروس', 'ألبوم فاخر A3 بـ ١٢ صفحة', 'ميني ألبوم عائلي', 'وحدة تخزين منقوشة بالاسم', 'معاينة في نفس اليوم (٥ صور مختارة)'],
    badge: 'فاخر', is_popular: false, active: true, included_addon_ids: [] },

  { id: 6, name_ar: 'ATEMA Couture',    name_en: 'ATEMA Couture',      price: 14000, duration_hours: 8, edited_photos: 700, album: 'ألبوم فاخر A3 ٢٠ صفحة + ميني + لوحة جدارية',
    video: true,  description: 'تجربة الفخامة الكاملة — كل تفاصيل اليوم بتوقيع كوتور حصري.',
    features: ['تغطية شاملة كاملة للحفل', 'فيديو سينمائي فاخر', 'جلسة تحضيرات العروس', 'تغطية ليلة الحناء', 'ألبوم فاخر A3 بـ ٢٠ صفحة', 'ميني ألبوم فاخر', 'لوحة جدارية فنية مؤطرة', 'وحدة تخزين فاخرة بالاسم', 'معاينة في نفس اليوم (١٠ صور مختارة)', 'خدمة عملاء ومتابعة خاصة'],
    badge: 'الأفخم', is_popular: true, active: true, included_addon_ids: [] },
];

export function usePackagesData() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true); setError(null);
    if (!supabase) { setPackages(DEMO); setLoading(false); return; }
    const { data, error: err } = await supabase.from('packages').select('*').order('id');
    if (err) {
      setError(err.message);
      setPackages(DEMO);
    } else if (!data || data.length === 0) {
      // DB reachable but seed-packages-2026-05.sql has not been run yet
      // (or all rows are inactive). Keep the booking flow usable — show the
      // canonical 6-tier catalogue so brides can still complete a booking.
      setPackages(DEMO);
    } else {
      setPackages(data as Package[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const updatePackage = async (pkg: Package): Promise<boolean> => {
    if (!supabase) { setPackages(p => p.map(x => x.id === pkg.id ? pkg : x)); return true; }
    const { error: err } = await supabase.from('packages').update(pkg).eq('id', pkg.id);
    if (err) { setError(err.message); return false; }
    setPackages(p => p.map(x => x.id === pkg.id ? pkg : x));
    return true;
  };

  const createPackage = async (pkg: Omit<Package, 'id'>): Promise<Package | null> => {
    if (!supabase) {
      const newPkg = { ...pkg, id: Math.max(0, ...packages.map(p => p.id)) + 1 };
      setPackages(p => [...p, newPkg]); return newPkg;
    }
    const { data, error: err } = await supabase.from('packages').insert(pkg).select().single();
    if (err) { setError(err.message); return null; }
    const created = data as Package;
    setPackages(p => [...p, created]); return created;
  };

  const deletePackage = async (id: number): Promise<boolean> => {
    if (!supabase) { setPackages(p => p.filter(x => x.id !== id)); return true; }
    const { error: err } = await supabase.from('packages').delete().eq('id', id);
    if (err) { setError(err.message); return false; }
    setPackages(p => p.filter(x => x.id !== id)); return true;
  };

  return { packages, loading, error, fetchPackages, updatePackage, createPackage, deletePackage };
}
