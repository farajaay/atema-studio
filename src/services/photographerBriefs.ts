// Admin trigger for the photographer-briefs Edge Function — re-sends the
// internal photographer brief for bookings created in the last N days.
import { supabase } from './supabase';

export interface BriefsResult {
  ok: boolean; total?: number; sent?: number; failed?: number; skipped?: number;
  capped?: boolean; error?: string;
}

async function call(body: Record<string, unknown>): Promise<{ data?: Record<string, unknown>; error?: string }> {
  if (!supabase) return { error: 'supabase_unconfigured' };
  const { data, error } = await supabase.functions.invoke('photographer-briefs', { body });
  if (!error) return { data: data as Record<string, unknown> };
  // Surface the real reason: our own { error } code, or the gateway's
  // { message } / { msg }, plus the HTTP status.
  let code = error.message;
  const res = (error as { context?: Response }).context;
  if (res && typeof res.text === 'function') {
    try {
      const raw = await res.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(raw); } catch { /* not JSON */ }
      const msg = parsed.error ?? parsed.message ?? parsed.msg ?? raw.slice(0, 120);
      code = `${res.status}: ${String(msg)}`;
    } catch { /* keep generic */ }
  }
  return { error: code };
}

/** Lists the last `days` of bookings, then sends one brief per request so no
 *  single Edge invocation does more than one SMTP session. `onProgress` is
 *  called after each send. */
export async function resendPhotographerBriefs(
  days = 7, onProgress?: (done: number, total: number) => void,
): Promise<BriefsResult> {
  const list = await call({ days });
  if (list.error) return { ok: false, error: list.error };
  const ids = (list.data?.ids as string[] | undefined) ?? [];
  let sent = 0, failed = 0, skipped = 0;
  for (const [i, bookingId] of ids.entries()) {
    const r = await call({ bookingId });
    const status = r.data?.status;
    if (status === 'sent') sent++; else if (status === 'skipped') skipped++; else failed++;
    onProgress?.(i + 1, ids.length);
  }
  return { ok: true, total: ids.length, sent, failed, skipped, capped: list.data?.capped === true };
}
