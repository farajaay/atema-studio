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
    // Surface the real reason: our own { error } code, or the gateway's
    // { message } / { msg }, plus the HTTP status.
    let code = error.message;
    const res = (error as { context?: Response }).context;
    if (res && typeof res.text === 'function') {
      try {
        const raw = await res.text();
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(raw); } catch { /* not JSON */ }
        const msg = body.error ?? body.message ?? body.msg ?? raw.slice(0, 120);
        code = `${res.status}: ${String(msg)}`;
      } catch { /* keep generic */ }
    }
    return { ok: false, error: code };
  }
  return data as BriefsResult;
}
