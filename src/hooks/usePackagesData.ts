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
  features: string[] | null;
  badge: string | null;
  is_popular: boolean;
  active: boolean;
  included_addon_ids: string[] | null;
}

const DEMO: Package[] = [
  { id: 1, name_ar: 'المخصّصة',   name_en: 'Customise',  price: 2200, duration_hours: 3, edited_photos: 150, album: null,           video: false, description: 'جلسة تصوير مخصصة حسب الطلب',          features: ['١٥٠ صورة معدّلة', '٣ ساعات تصوير', 'تسليم خلال ١٤ يوماً'], badge: null, is_popular: false, active: true, included_addon_ids: [] },
  { id: 2, name_ar: 'الكلاسيكية', name_en: 'Classic',    price: 4200, duration_hours: 4, edited_photos: 300, album: 'A4 10 pages',  video: false, description: 'الباقة المثالية للمناسبات الخاصة',      features: ['٣٠٠ صورة معدّلة', '٤ ساعات تصوير', 'ألبوم A4 ١٠ صفحات', 'USB', 'تسليم خلال ٢١ يوماً'], badge: null, is_popular: true, active: true, included_addon_ids: [] },
  { id: 3, name_ar: 'الملكية',    name_en: 'Royal',      price: 6900, duration_hours: 5, edited_photos: 400, album: 'A4 + mini',   video: true,  description: 'تجربة تصوير متكاملة مع فيديو سينمائي',  features: ['٤٠٠ صورة معدّلة', '٥ ساعات تصوير', 'ألبوم A4 + ميني ألبوم', 'فيديو قصير', 'مساعد', 'USB'], badge: 'الأكثر طلباً', is_popular: true, active: true, included_addon_ids: [] },
  { id: 4, name_ar: 'التوقيع',    name_en: 'Signature',  price: 8500, duration_hours: 6, edited_photos: 500, album: 'A3 12 pages', video: true,  description: 'الباقة الاحترافية الشاملة للأفراح الكبرى', features: ['٥٠٠ صورة معدّلة', '٦ ساعات تصوير', 'ألبوم A3 ١٢ صفحة + ميني', 'فيديو سينمائي كامل', 'مساعد', 'USB'], badge: 'VIP', is_popular: false, active: true, included_addon_ids: [] },
  { id: 5, name_ar: 'الخطوبة',    name_en: 'Engagement', price: 1800, duration_hours: 2, edited_photos: 100, album: null,           video: false, description: 'جلسة خطوبة رومانسية وأنيقة',            features: ['١٠٠ صورة معدّلة', '٢ ساعات تصوير', 'تسليم خلال ٧ أيام'], badge: null, is_popular: false, active: true, included_addon_ids: [] },
];

export function usePackagesData() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true); setError(null);
    if (!supabase) { setPackages(DEMO); setLoading(false); return; }
    const { data, error: err } = await supabase.from('packages').select('*').order('id');
    if (err) { setError(err.message); setPackages(DEMO); }
    else setPackages((data ?? []) as Package[]);
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
