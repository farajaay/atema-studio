// Admin trigger for the photographer-briefs Edge Function — re-sends the
// internal photographer brief for bookings created in the last N days.
import { supabase } from './supabase';

export interface BriefsResult {
  ok: boolean; total?: number; sent?: number; failed?: number; skipped?: number;
  capped?: boolean; error?: string;
}

export async function resendPhotographerBriefs(days = 7): Promise<BriefsResult> {
  if (!supabase) return { ok: false, error: 'supabase_unconfigured' };
  const { data, error } = await supabase.functions.invoke('photographer-briefs', { body: { days } });
  if (error) {
    // Pull the function's own error code out of a non-2xx response.
    let code = error.message;
    try { code = (await (error as { context?: Response }).context?.json())?.error ?? code; } catch { /* keep */ }
    return { ok: false, error: code };
  }
  return data as BriefsResult;
}
