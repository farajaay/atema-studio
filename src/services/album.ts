// ATEMA STUDIO — Album selection service (Phase 1).
//
// Single source of truth for the album-cover palette + the post-event
// selection flow. Mirrors moodboard.ts: admin CRUD talks to the album_designs
// table directly (RLS: authenticated full access); the public page reads/writes
// through SECURITY DEFINER RPCs so anon never touches the bookings table.
//
// Plan: docs/plans/album-selection.md · Migration: migrations-2026-07-album.sql

import { supabase } from './supabase';

export type AlbumMaterial = 'fabric' | 'leather';
export type AlbumTexture  = 'plain' | 'linen' | 'croc';

export interface AlbumDesign {
  id:          string;
  code:        string;
  material:    AlbumMaterial;
  texture:     AlbumTexture;
  name_ar:     string;
  name_en:     string;
  blurb_ar:    string | null;
  blurb_en:    string | null;
  swatch_hex:  string;
  preview_url: string | null;
  /** Photographic mockup of the finished album (…-album.jpg); page falls
      back to the CSS book mock when null. */
  example_url: string | null;
  /** Photographic mockup of the presentation box (…-box.jpg). */
  box_url:     string | null;
  active:      boolean;
  sort_order:  number;
}

export type AlbumSelectionStatus =
  | 'not_found' | 'not_ready' | 'ready' | 'selected';

export interface AlbumSelectionState {
  status:           AlbumSelectionStatus;
  event_date?:      string;
  chosen_design_id?: string | null;
  note?:            string | null;
  selected_at?:     string | null;
}

// ── Palette reads ─────────────────────────────────────────────────────────
/** Admin view — every design incl. inactive (needs an authenticated session). */
export async function fetchAllDesigns(): Promise<AlbumDesign[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('album_designs').select('*').order('sort_order');
  return (data as AlbumDesign[] | null) ?? [];
}

/** Public view — active designs only (anon-safe). */
export async function fetchActiveDesigns(): Promise<AlbumDesign[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('album_designs').select('*').eq('active', true).order('sort_order');
  return (data as AlbumDesign[] | null) ?? [];
}

// ── Admin CRUD ────────────────────────────────────────────────────────────
export type DesignDraft = Omit<AlbumDesign, 'id'> & { id?: string };

export async function saveDesign(d: DesignDraft): Promise<AlbumDesign | null> {
  if (!supabase) return null;
  const row = {
    code: d.code, material: d.material, texture: d.texture,
    name_ar: d.name_ar, name_en: d.name_en,
    blurb_ar: d.blurb_ar, blurb_en: d.blurb_en,
    swatch_hex: d.swatch_hex, preview_url: d.preview_url,
    example_url: d.example_url, box_url: d.box_url,
    active: d.active, sort_order: d.sort_order,
  };
  if (d.id) {
    const { data } = await supabase
      .from('album_designs').update(row).eq('id', d.id).select('*').maybeSingle();
    return (data as AlbumDesign | null) ?? null;
  }
  const { data } = await supabase
    .from('album_designs').insert(row).select('*').maybeSingle();
  return (data as AlbumDesign | null) ?? null;
}

export async function deleteDesign(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('album_designs').delete().eq('id', id);
  return !error;
}

// ── Admin: release + read a booking's album state ─────────────────────────
/** Open selection for a booking (sets album_released_at). Authenticated only. */
export async function releaseAlbum(bookingId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('bookings')
    .update({ album_released_at: new Date().toISOString() })
    .eq('id', bookingId);
  return !error;
}

/** Admin read of the album fields for a booking (authenticated bookings SELECT). */
export async function getBookingAlbum(bookingId: string): Promise<{
  album_token: string | null;
  album_design_id: string | null;
  album_note: string | null;
  album_selected_at: string | null;
  album_released_at: string | null;
} | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('bookings')
    .select('album_token, album_design_id, album_note, album_selected_at, album_released_at')
    .eq('id', bookingId).maybeSingle();
  return (data as never) ?? null;
}

// ── Public page (anon) — token RPCs ───────────────────────────────────────
export async function getAlbumSelectionByToken(token: string): Promise<AlbumSelectionState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .rpc('get_album_selection_by_token', { p_token: token });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as AlbumSelectionState) ?? null;
}

export type SelectResult = 'ok' | 'not_found' | 'not_ready' | 'locked' | 'invalid_design' | 'error';

export async function selectAlbumDesign(
  token: string, designId: string, note?: string,
): Promise<SelectResult> {
  if (!supabase) return 'error';
  const { data, error } = await supabase.rpc('select_album_design', {
    p_token: token, p_design_id: designId, p_note: note ?? null,
  });
  if (error) return 'error';
  return (data as SelectResult) ?? 'error';
}

// ── URL helper ────────────────────────────────────────────────────────────
export function buildAlbumUrl(token: string): string {
  return `${window.location.origin}/#/album/${token}`;
}
