// ATEMA STUDIO — Global App Settings (singleton row)
// Controls VAT behaviour, seller identity on invoices, etc.

import { supabase } from './supabase';

export type ThemeName = 'noir' | 'ivory';

export interface AppSettings {
  vat_enabled:     boolean;
  vat_number:      string;
  cr_number:       string;
  seller_name_ar:  string;
  seller_name_en:  string;
  theme:           ThemeName;
  updated_at?:     string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  vat_enabled:    false,
  vat_number:     '',
  cr_number:      '',
  seller_name_ar: 'ATEMA Studio — فاطمة بوحسن',
  seller_name_en: 'ATEMA Studio',
  theme:          'noir',
};

export const VAT_RATE = 0.15;

/** Fetches the singleton settings row (row id = 1). Falls back to defaults. */
export async function fetchSettings(): Promise<AppSettings> {
  if (!supabase) return DEFAULT_SETTINGS;
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('fetchSettings:', error.message);
    return DEFAULT_SETTINGS;
  }
  if (!data) return DEFAULT_SETTINGS;
  return {
    vat_enabled:    !!data.vat_enabled,
    vat_number:     data.vat_number    ?? '',
    cr_number:      data.cr_number     ?? '',
    seller_name_ar: data.seller_name_ar ?? DEFAULT_SETTINGS.seller_name_ar,
    seller_name_en: data.seller_name_en ?? DEFAULT_SETTINGS.seller_name_en,
    theme:          (data.theme === 'ivory' ? 'ivory' : 'noir') as ThemeName,
    updated_at:     data.updated_at,
  };
}

/** Upserts the settings row (admin only — RLS enforces). */
export async function saveSettings(s: Partial<AppSettings>): Promise<boolean> {
  if (!supabase) return false;
  const payload = { id: 1, ...s, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('app_settings')
    .upsert(payload, { onConflict: 'id' });
  if (error) { console.error('saveSettings:', error.message); return false; }
  return true;
}

/** Compute VAT given subtotal + global + per-booking flags. */
export function computeVat(subtotal: number, globalEnabled: boolean, perBookingEnabled = true): number {
  if (!globalEnabled || !perBookingEnabled) return 0;
  return Math.round(subtotal * VAT_RATE);
}
