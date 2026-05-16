// ATEMA STUDIO — Editorial Journal service.

import { supabase } from './supabase';

export interface JournalPost {
  id:            string;
  slug:          string;
  title_ar:      string;
  title_en:      string;
  excerpt_ar:    string;
  excerpt_en:    string;
  body_ar:       string;      // markdown / plain paragraphs separated by \n\n
  body_en:       string;
  cover_url:     string;      // hero image
  published:     boolean;
  published_at?: string;      // when admin marked it published
  created_at?:   string;
}

/** Public list — only published, newest first. */
export async function fetchJournal(): Promise<JournalPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('journal_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false });
  if (error) { console.error('fetchJournal:', error.message); return []; }
  return (data ?? []) as JournalPost[];
}

/** Public single post by slug. */
export async function fetchJournalPost(slug: string): Promise<JournalPost | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('journal_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) { console.error('fetchJournalPost:', error.message); return null; }
  return (data ?? null) as JournalPost | null;
}

/** Admin list — all posts, regardless of publish state. */
export async function fetchJournalAll(): Promise<JournalPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('journal_posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchJournalAll:', error.message); return []; }
  return (data ?? []) as JournalPost[];
}

export async function upsertJournalPost(post: Partial<JournalPost> & { id?: string }): Promise<boolean> {
  if (!supabase) return false;
  // Stamp published_at when publishing for the first time.
  const payload: any = { ...post };
  if (post.published && !post.published_at) payload.published_at = new Date().toISOString();
  const { error } = post.id
    ? await supabase.from('journal_posts').update(payload).eq('id', post.id)
    : await supabase.from('journal_posts').insert(payload);
  if (error) { console.error('upsertJournalPost:', error.message); return false; }
  return true;
}

export async function deleteJournalPost(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('journal_posts').delete().eq('id', id);
  if (error) { console.error('deleteJournalPost:', error.message); return false; }
  return true;
}

export async function uploadJournalCover(file: File): Promise<string | null> {
  if (!supabase) return null;
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await supabase.storage.from('journal').upload(path, file, {
    cacheControl: '3600', upsert: false,
  });
  if (error) { console.error('uploadJournalCover:', error.message); return null; }
  const { data } = supabase.storage.from('journal').getPublicUrl(path);
  return data.publicUrl ?? null;
}

/** Generate a URL-safe slug from a title (handles Arabic by transliterating to "post-{timestamp}"). */
export function slugify(s: string): string {
  const ascii = s.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return ascii || `post-${Date.now()}`;
}
