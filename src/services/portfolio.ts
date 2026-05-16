// ATEMA STUDIO — Portfolio service.
// Public-readable, admin-writable. Images live in Supabase Storage bucket `portfolio`.

import { supabase } from './supabase';

export type PortfolioCategory = 'bride' | 'family' | 'maternity' | 'couture' | 'editorial';

export interface PortfolioItem {
  id:           string;
  title_ar:     string;
  title_en:     string;
  category:     PortfolioCategory;
  image_url:    string;        // public Supabase Storage URL
  caption_ar?:  string;
  caption_en?:  string;
  sort_order:   number;
  published:    boolean;
  created_at?:  string;
}

export const CATEGORIES: Array<{ key: PortfolioCategory; ar: string; en: string }> = [
  { key: 'bride',     ar: 'العروس',    en: 'Bride'     },
  { key: 'family',    ar: 'العائلة',   en: 'Family'    },
  { key: 'maternity', ar: 'الأمومة',   en: 'Maternity' },
  { key: 'couture',   ar: 'كوتور',     en: 'Couture'   },
  { key: 'editorial', ar: 'تحريري',    en: 'Editorial' },
];

/** Public list — only published items, ordered by sort_order. */
export async function fetchPortfolio(): Promise<PortfolioItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('portfolio_items')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchPortfolio:', error.message); return []; }
  return (data ?? []) as PortfolioItem[];
}

/** Admin list — all items, regardless of publish state. */
export async function fetchPortfolioAll(): Promise<PortfolioItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('portfolio_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchPortfolioAll:', error.message); return []; }
  return (data ?? []) as PortfolioItem[];
}

export async function upsertPortfolioItem(item: Partial<PortfolioItem> & { id?: string }): Promise<boolean> {
  if (!supabase) return false;
  const { error } = item.id
    ? await supabase.from('portfolio_items').update(item).eq('id', item.id)
    : await supabase.from('portfolio_items').insert(item);
  if (error) { console.error('upsertPortfolioItem:', error.message); return false; }
  return true;
}

export async function deletePortfolioItem(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('portfolio_items').delete().eq('id', id);
  if (error) { console.error('deletePortfolioItem:', error.message); return false; }
  return true;
}

/** Upload an image to the `portfolio` bucket and return its public URL. */
export async function uploadPortfolioImage(file: File): Promise<string | null> {
  if (!supabase) return null;
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await supabase.storage.from('portfolio').upload(path, file, {
    cacheControl: '3600', upsert: false,
  });
  if (error) { console.error('uploadPortfolioImage:', error.message); return null; }
  const { data } = supabase.storage.from('portfolio').getPublicUrl(path);
  return data.publicUrl ?? null;
}
