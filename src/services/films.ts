// ATEMA STUDIO - Films curation service.
// Machine stream facts stay in /public/videos/hls/manifest.json. Human
// curation can now be managed from Supabase, with the committed registry as a
// fallback until the films migration is applied.

import { FILMS } from '../content/films';
import type { FilmChapterKey, FilmCuration } from '../content/films';
import { supabase } from './supabase';

export interface FilmRendition {
  label: string;
  width: number;
  height: number;
  bandwidth: number;
}

export interface FilmManifestItem {
  id: string;
  order: number;
  title: string;
  duplicateOf: string | null;
  hls: string;
  poster: string;
  duration: number;
  width: number;
  height: number;
  renditions: FilmRendition[];
}

export interface FilmsManifest {
  player: 'hls';
  items: FilmManifestItem[];
}

export interface FilmAdminLoad {
  items: FilmCuration[];
  configured: boolean;
}

interface FilmEntryRow {
  manifest_id: string;
  slug: string;
  order_index: number;
  chapter: FilmChapterKey;
  title_ar: string;
  title_en: string;
  caption_ar: string;
  caption_en: string;
  published: boolean;
  featured: boolean;
  deleted_at?: string | null;
}

// ── Stream hosting ──────────────────────────────────────────────────────────
// The HLS ladders are moving OFF GitHub Pages (the ~200 MB payload was making
// Pages' own deploy-sync step fail intermittently) into the public Supabase
// Storage bucket `videos` (same folder shape: videos/hls/<clip>/…).
// Load order: Storage first, repo-local /videos/ as fallback — so the site
// works identically before, during, and after the one-time upload
// (.github/workflows/supabase-videos-sync.yml).
const SUPABASE_URL_ENV = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const STORAGE_VIDEOS_BASE = SUPABASE_URL_ENV
  ? `${SUPABASE_URL_ENV.replace(/\/$/, '')}/storage/v1/object/public/videos`
  : '';
const LOCAL_VIDEOS_BASE = '/videos';

export const FILMS_MANIFEST_URL = '/videos/hls/manifest.json';

/** Resolve a manifest-relative path (e.g. "videos/hls/clip-01/poster.jpg")
 *  against the base that actually served the manifest. */
function resolveStreamUrl(base: string, path: string): string {
  return `${base}/${path.replace(/^\/?videos\//, '')}`;
}

async function tryManifest(base: string): Promise<FilmsManifest | null> {
  try {
    const response = await fetch(`${base}/hls/manifest.json`, { cache: 'no-store' });
    if (!response.ok) return null;
    const manifest = await response.json() as FilmsManifest;
    return {
      ...manifest,
      items: (manifest.items ?? []).map(item => ({
        ...item,
        hls:    resolveStreamUrl(base, item.hls),
        poster: resolveStreamUrl(base, item.poster),
      })),
    };
  } catch {
    return null;
  }
}

function toRow(film: FilmCuration): FilmEntryRow {
  return {
    manifest_id: film.manifestId,
    slug: film.slug,
    order_index: film.order,
    chapter: film.chapter,
    title_ar: film.title_ar,
    title_en: film.title_en,
    caption_ar: film.caption_ar,
    caption_en: film.caption_en,
    published: film.published !== false,
    featured: film.featured === true,
    deleted_at: null,
  };
}

function fromRow(row: FilmEntryRow): FilmCuration {
  return {
    manifestId: row.manifest_id,
    slug: row.slug,
    order: row.order_index,
    chapter: row.chapter,
    title_ar: row.title_ar,
    title_en: row.title_en,
    caption_ar: row.caption_ar,
    caption_en: row.caption_en,
    published: row.published,
    featured: row.featured,
  };
}

function fallbackFilms(publishedOnly: boolean) {
  const items = publishedOnly ? FILMS.filter(film => film.published !== false) : FILMS;
  return [...items].sort((a, b) => a.order - b.order);
}

export async function fetchFilmsManifest(): Promise<FilmsManifest | null> {
  if (STORAGE_VIDEOS_BASE) {
    const fromStorage = await tryManifest(STORAGE_VIDEOS_BASE);
    if (fromStorage) return fromStorage;
  }
  const fromLocal = await tryManifest(LOCAL_VIDEOS_BASE);
  if (!fromLocal) throw new Error('Films manifest failed on both storage and local hosts');
  return fromLocal;
}

export async function fetchPublishedFilmCurations(): Promise<FilmCuration[]> {
  if (!supabase) return fallbackFilms(true);

  const { data, error } = await supabase
    .from('film_entries')
    .select('*')
    .eq('published', true)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('fetchPublishedFilmCurations:', error.message);
    return fallbackFilms(true);
  }

  return ((data ?? []) as FilmEntryRow[]).map(fromRow);
}

export async function fetchFilmCurationsAll(): Promise<FilmAdminLoad> {
  if (!supabase) return { items: fallbackFilms(false), configured: false };

  const { data, error } = await supabase
    .from('film_entries')
    .select('*')
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('fetchFilmCurationsAll:', error.message);
    return { items: fallbackFilms(false), configured: false };
  }

  return { items: ((data ?? []) as FilmEntryRow[]).map(fromRow), configured: true };
}

export async function upsertFilmCuration(film: FilmCuration): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('film_entries')
    .upsert(toRow(film), { onConflict: 'manifest_id' });
  if (error) {
    console.error('upsertFilmCuration:', error.message);
    return false;
  }
  return true;
}

export async function syncDefaultFilmCurations(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('film_entries')
    .upsert(FILMS.map(toRow), { onConflict: 'manifest_id' });
  if (error) {
    console.error('syncDefaultFilmCurations:', error.message);
    return false;
  }
  return true;
}

export async function deleteFilmCuration(manifestId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('film_entries')
    .update({ published: false, deleted_at: new Date().toISOString() })
    .eq('manifest_id', manifestId);
  if (error) {
    console.error('deleteFilmCuration:', error.message);
    return false;
  }
  return true;
}
