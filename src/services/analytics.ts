// ATEMA STUDIO — First-party visitor analytics.
//
// Two halves:
//   1. The tracker (recordVisit) — called from <RouteTracker/> on every
//      route change. Privacy-first by construction: paths are reduced to
//      route TEMPLATES before leaving the browser (capability tokens for
//      /board, /manage, /album never reach the wire), referrer is hostname
//      only, no IP/UA/fingerprint is collected, and the session id is a
//      random per-tab value that dies with the tab. Admin routes and the
//      owner's own logged-in browsing are never recorded.
//   2. The admin read side (fetchVisits) + pure aggregators — the
//      «الزيارات» dashboard tab. "Departure page" = the last pageview of a
//      session, computed at read time; no unload beacons needed.
//
// Table: public.site_visits (database/migrations-2026-07-analytics.sql).
// Anon may only INSERT (bounded), only the admin may SELECT.

import { supabase } from './supabase';

export interface VisitRow {
  session_id: string;
  path: string;
  referrer: string | null;
  device: string | null;
  created_at: string;
}

// ── Path sanitization (pure — security-critical, unit-tested) ─────────────

// Static public routes we track verbatim. Anything not matched below is
// dropped entirely (admin, payment callbacks, typos → wildcard redirect).
const STATIC_PATHS = new Set([
  '/', '/book', '/portfolio', '/journal', '/about', '/policy', '/films',
]);

/** Reduce a location.pathname to a storable route template, or null to skip. */
export function sanitizePath(pathname: string): string | null {
  if (!pathname.startsWith('/')) return null;
  // Normalize trailing slash ("/book/" → "/book"); keep bare "/".
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (p.startsWith('/admin')) return null;
  if (STATIC_PATHS.has(p)) return p;
  // Token-bearing capability links — template only, never the secret.
  if (p.startsWith('/board/'))   return '/board/:token';
  if (p.startsWith('/manage/'))  return '/manage/:token';
  if (p.startsWith('/album/'))   return '/album/:token';
  // Journal slugs are public but high-cardinality — bucket them.
  if (p.startsWith('/journal/')) return '/journal/:slug';
  return null;
}

/** Extract just the hostname from document.referrer (never the full URL). */
export function referrerHost(referrer: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname;
    // Self-referrals carry no information.
    if (typeof window !== 'undefined' && host === window.location.hostname) return null;
    return host || null;
  } catch {
    return null;
  }
}

// ── Session id — random, per-tab, no cookie ───────────────────────────────

const SID_KEY = 'atema:sid';

function getSessionId(): string {
  try {
    const cached = window.sessionStorage.getItem(SID_KEY);
    if (cached) return cached;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const sid = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    window.sessionStorage.setItem(SID_KEY, sid);
    return sid;
  } catch {
    // Storage blocked (private mode edge cases) — untrackable, and that's fine.
    return '';
  }
}

/** The owner's own browsing must not pollute the stats. */
function adminSessionPresent(): boolean {
  try {
    if (window.localStorage.getItem('atema_admin')) return true; // demo mode
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i) ?? '';
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch { /* ignore */ }
  return false;
}

// ── Tracker ───────────────────────────────────────────────────────────────

let lastTrackedPath: string | null = null;

/** Fire-and-forget pageview write. Never throws, never blocks the visitor. */
export function recordVisit(pathname: string): void {
  if (!supabase) return;
  const path = sanitizePath(pathname);
  if (!path || path === lastTrackedPath) return;
  if (adminSessionPresent()) return;
  const session_id = getSessionId();
  if (!session_id) return;
  lastTrackedPath = path;

  supabase.from('site_visits').insert({
    session_id,
    path,
    referrer: referrerHost(document.referrer),
    device: window.innerWidth < 768 ? 'mobile' : 'desktop',
    lang: document.documentElement.lang === 'en' ? 'en' : 'ar',
  }).then(({ error }) => {
    if (error) console.warn('[analytics] visit not recorded:', error.message);
  });
}

/** Test hook — reset the consecutive-path dedupe between test cases. */
export function _resetTracker(): void { lastTrackedPath = null; }

// ── Admin read side ───────────────────────────────────────────────────────

export interface VisitsLoad {
  rows: VisitRow[];
  configured: boolean; // false → migration not applied yet
}

const PAGE = 1000;      // supabase-js caps a single request at 1000 rows
const HARD_CAP = 20000; // sanity ceiling for a boutique studio's traffic

export async function fetchVisits(days: number): Promise<VisitsLoad> {
  if (!supabase) return { rows: [], configured: false };
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows: VisitRow[] = [];
  for (let from = 0; from < HARD_CAP; from += PAGE) {
    const { data, error } = await supabase
      .from('site_visits')
      .select('session_id, path, referrer, device, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      // 42P01 = table missing → the migration hasn't been applied yet.
      const missing = (error as { code?: string }).code === '42P01';
      if (!missing) console.error('[analytics] fetchVisits:', error.message);
      return { rows: [], configured: !missing };
    }
    rows.push(...(data ?? []) as VisitRow[]);
    if (!data || data.length < PAGE) break;
  }
  return { rows, configured: true };
}

// ── Pure aggregation (unit-tested) ────────────────────────────────────────

export interface CountEntry { key: string; count: number }

export interface VisitStats {
  views: number;                          // total pageviews
  sessions: number;                       // distinct session ids
  bookSessions: number;                   // sessions that reached /book
  daily: { date: string; views: number }[]; // one bucket per day, gap-filled
  topPages: CountEntry[];
  exitPages: CountEntry[];                // departure page per session
  referrers: CountEntry[];
}

const dayOf = (iso: string) => iso.slice(0, 10);

function toSortedEntries(m: Map<string, number>): CountEntry[] {
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Aggregate raw visit rows into everything the dashboard shows.
 * `days` gap-fills the daily series back from `today` (ISO date) so quiet
 * days render as empty bars instead of vanishing from the timeline.
 */
export function aggregateVisits(rows: VisitRow[], days: number, today: string): VisitStats {
  const pageCounts = new Map<string, number>();
  const dailyCounts = new Map<string, number>();
  const refCounts = new Map<string, number>();
  // Rows arrive ordered ascending; the last write per session wins → exit page.
  const lastPathBySession = new Map<string, string>();
  const bookSessions = new Set<string>();

  for (const r of rows) {
    pageCounts.set(r.path, (pageCounts.get(r.path) ?? 0) + 1);
    const day = dayOf(r.created_at);
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
    if (r.referrer) refCounts.set(r.referrer, (refCounts.get(r.referrer) ?? 0) + 1);
    lastPathBySession.set(r.session_id, r.path);
    if (r.path === '/book') bookSessions.add(r.session_id);
  }

  const exitCounts = new Map<string, number>();
  for (const path of lastPathBySession.values()) {
    exitCounts.set(path, (exitCounts.get(path) ?? 0) + 1);
  }

  // Gap-filled daily series ending at `today`.
  const end = new Date(`${today}T00:00:00Z`).getTime();
  const daily: { date: string; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end - i * 86400_000).toISOString().slice(0, 10);
    daily.push({ date, views: dailyCounts.get(date) ?? 0 });
  }

  return {
    views: rows.length,
    sessions: lastPathBySession.size,
    bookSessions: bookSessions.size,
    daily,
    topPages: toSortedEntries(pageCounts),
    exitPages: toSortedEntries(exitCounts),
    referrers: toSortedEntries(refCounts),
  };
}

/** Bilingual-ish display label for a stored route template (admin UI is AR). */
export function pathLabel(path: string): string {
  const labels: Record<string, string> = {
    '/': 'الرئيسية',
    '/book': 'الحجز',
    '/portfolio': 'الأعمال',
    '/journal': 'اليوميات',
    '/journal/:slug': 'مقال يوميات',
    '/about': 'الاستوديو',
    '/policy': 'السياسات',
    '/films': 'الأفلام',
    '/board/:token': 'لوحة مزاج',
    '/manage/:token': 'إدارة حجز',
    '/album/:token': 'اختيار ألبوم',
  };
  return labels[path] ?? path;
}
