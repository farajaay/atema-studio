// ATEMA STUDIO — failed outbound-message visibility for the admin dashboard.
//
// The confirmation email and the WhatsApp sends are fire-and-forget by
// design; failures land in the email_messages / wa_messages audit tables
// (status='failed') and were previously invisible unless someone queried
// them by hand. This hook surfaces a 7-day failure count so a broken SMTP
// password or an expired Meta token shows up as a banner, not as silence.

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const WINDOW_DAYS = 7;

export interface FailedSends {
  email: number;
  wa:    number;
  total: number;
}

export function useFailedSends(): FailedSends {
  const [counts, setCounts] = useState<FailedSends>({ email: 0, wa: 0, total: 0 });

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
      const [e, w] = await Promise.all([
        supabase.from('email_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed').gte('created_at', since),
        supabase.from('wa_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed').gte('created_at', since),
      ]);
      // Either table may not exist yet (migration pending) — count stays 0.
      const email = e.error ? 0 : (e.count ?? 0);
      const wa    = w.error ? 0 : (w.count ?? 0);
      if (!cancelled) setCounts({ email, wa, total: email + wa });
    })();
    return () => { cancelled = true; };
  }, []);

  return counts;
}
