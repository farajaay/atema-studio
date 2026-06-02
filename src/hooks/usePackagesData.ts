import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface Package {
  id: number;
  name_ar: string;
  name_en: string;
  price: number;
  duration_hours: number;
  /** Count of basic-edited photos: lighting correction + colour balance +
   *  JPG conversion from RAW. The bulk deliverable on every package. */
  edited_photos: number;
  /** Count of editorial-retouched photos: advanced retouching (skin work,
   *  dodge-and-burn, cinematic colour grade). High-end tiers only. Must be
   *  a non-negative multiple of 4 (enforced at the DB layer). */
  editorial_photos?: number;
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
  /** Marks the singleton "Custom Foundation" base used by the
   *  "Design Your Package" tab. The Ready Packages tab filters this row out.
   *  Enforced unique at the DB layer via a partial index. */
  is_custom_base?: boolean;
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

// Fallback catalogue — mirrors database/seed-packages-2026-05.sql + the
// pricing-overhaul + custom-base migrations so the site renders the same
// offering even when Supabase is unreachable.
const DEMO: Package[] = [
  { id: 1, name_ar: 'باقة الخطوبة',     name_en: 'Engagement Session', price: 2500,  duration_hours: 2, edited_photos: 30,  editorial_photos: 0, album: null,
    video: false, description: 'جلسة خطوبة رومانسية بأسلوب راقٍ — مثالية لإعلان البداية.',
    features: ['ساعتان من التصوير الاحترافي', '٣٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)', 'اختيار أجمل اللقطات', 'وحدة تخزين باسم العروسين', 'تصميم Save the Date رقمي هدية'],
    badge: 'الأساسي', is_popular: false, active: true, included_addon_ids: ['save-date'], is_custom_base: false },

  // The Custom Foundation — singleton base used ONLY by the "Design Your
  // Package" tab. Filtered OUT of the Ready Packages list. See
  // migrations-2026-05-custom-base.sql.
  { id: 2, name_ar: 'الأساس المرن',     name_en: 'Custom Foundation',  price: 1800,  duration_hours: 1, edited_photos: 20,  editorial_photos: 0, album: null,
    video: false, description: 'الأساس المرن لباقتك المخصّصة — ابدئي من هنا وأضيفي ما يلائم مناسبتك.',
    features: ['ساعة واحدة من التصوير الاحترافي', '٢٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)', 'وحدة تخزين رقمية', 'أضيفي ساعات، فيديو، ألبوم، أو ليلة الحناء حسب احتياجك'],
    badge: null, is_popular: false, active: true, included_addon_ids: [], is_custom_base: true },

  { id: 3, name_ar: 'الباقة الكلاسيكية', name_en: 'Classic',            price: 5200,  duration_hours: 4, edited_photos: 300, editorial_photos: 0, album: 'ألبوم A4 ١٥ صفحة',
    video: false, description: 'الباقة المثالية للمناسبات الخاصة — ألبوم فاخر وذكريات تبقى، بفريق نسائي كامل.',
    features: ['٤ ساعات تغطية شاملة للحفل', 'مصوّرة رئيسية + مساعدة (فريق نسائي)', '٣٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)', 'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة', '٥ صور عائلية معدّلة', 'وحدة تخزين بجميع الصور المعدّلة'],
    badge: null, is_popular: false, active: true, included_addon_ids: ['second-photog'], is_custom_base: false },

  { id: 4, name_ar: 'الباقة الملكية',   name_en: 'Royal',              price: 10500, duration_hours: 5, edited_photos: 400, editorial_photos: 4, album: 'ألبوم A4 + ميني ألبوم',
    video: true,  description: 'تجربة تصوير ملكية مع فيديو سينمائي قصير وألبومين فاخرين — الأكثر طلباً.',
    features: ['٥ ساعات تغطية شاملة للحفل', 'مصوّرة رئيسية + مساعدة (فريق نسائي)', '٤٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)', '٤ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)', 'فيديو سينمائي قصير (٣–٥ دقائق)', 'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة', 'ميني ألبوم عائلي', 'وحدة تخزين باسم العروسين', 'معاينة في نفس اليوم (٥ صور مختارة)'],
    badge: 'الأكثر طلباً', is_popular: true, active: true, included_addon_ids: ['second-photog', 'video-short'], is_custom_base: false },

  { id: 5, name_ar: 'باقة التوقيع',     name_en: 'Signature',          price: 12500, duration_hours: 6, edited_photos: 500, editorial_photos: 8, album: 'ألبوم فاخر A3 ١٢ صفحة + ميني',
    video: true,  description: 'الباقة الاحترافية الشاملة — فيديو سينمائي كامل، ألبوم A3 فاخر، وجلسة تحضيرات العروس.',
    features: ['٦ ساعات تغطية شاملة للحفل', 'مصوّرة رئيسية + مساعدة (فريق نسائي)', '٥٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)', '٨ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)', 'فيديو سينمائي كامل', 'جلسة تصوير تحضيرات العروس', 'ألبوم فاخر A3 بـ ١٢ صفحة', 'ميني ألبوم عائلي', 'وحدة تخزين منقوشة بالاسم', 'معاينة في نفس اليوم (٥ صور مختارة)'],
    badge: 'فاخر', is_popular: false, active: true, included_addon_ids: ['second-photog', 'video-full', 'bridal-prep', 'album-upgrade'], is_custom_base: false },

  { id: 6, name_ar: 'ATEMA Couture',    name_en: 'ATEMA Couture',      price: 19500, duration_hours: 8, edited_photos: 700, editorial_photos: 12, album: 'ألبوم فاخر A3 ٢٠ صفحة + ميني + لوحة جدارية',
    video: true,  description: 'تجربة الفخامة الكاملة — كل تفاصيل اليوم بتوقيع كوتور حصري، من الحناء إلى الحفل.',
    features: ['تغطية شاملة كاملة للحفل (٨ ساعات)', 'مصوّرة رئيسية + مساعدة (فريق نسائي)', '٧٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)', '١٢ صورة بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)', 'فيديو سينمائي فاخر — تغطية كاملة + ليلة الحناء', 'جلسة تحضيرات العروس', 'تغطية ليلة الحناء', 'ألبوم فاخر A3 بـ ٢٠ صفحة', 'ميني ألبوم فاخر', 'لوحة جدارية فنية مؤطرة', 'وحدة تخزين فاخرة بالاسم', 'معاينة في نفس اليوم (١٠ صور مختارة)', 'خدمة عملاء ومتابعة خاصة'],
    badge: 'الأفخم', is_popular: true, active: true, included_addon_ids: ['second-photog', 'video-full', 'bridal-prep', 'album-upgrade', 'henna', 'kosha'], is_custom_base: false },
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
