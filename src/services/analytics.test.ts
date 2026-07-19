import { describe, it, expect } from 'vitest';
import {
  aggregateVisits,
  referrerHost,
  sanitizePath,
  type VisitRow,
} from './analytics';

// ── sanitizePath — the security-critical redaction layer ──────────────────

describe('sanitizePath', () => {
  it('passes known static routes through verbatim', () => {
    for (const p of ['/', '/book', '/portfolio', '/journal', '/about', '/policy']) {
      expect(sanitizePath(p)).toBe(p);
    }
  });

  it('normalizes trailing slashes', () => {
    expect(sanitizePath('/book/')).toBe('/book');
    expect(sanitizePath('/about//')).toBe('/about');
  });

  it('redacts capability tokens — the raw secret must never survive', () => {
    const token = 'V6ZJ0Q8XK2M4P7R9T1W3Y5A6B8C0D2E4';
    expect(sanitizePath(`/board/${token}`)).toBe('/board/:token');
    expect(sanitizePath(`/manage/${token}`)).toBe('/manage/:token');
    expect(sanitizePath(`/album/${token}`)).toBe('/album/:token');
    for (const out of [
      sanitizePath(`/board/${token}`),
      sanitizePath(`/manage/${token}`),
      sanitizePath(`/album/${token}`),
    ]) {
      expect(out).not.toContain(token);
    }
  });

  it('buckets journal slugs', () => {
    expect(sanitizePath('/journal/light-of-the-first-look')).toBe('/journal/:slug');
  });

  it('never tracks admin routes', () => {
    expect(sanitizePath('/admin')).toBeNull();
    expect(sanitizePath('/admin/dashboard')).toBeNull();
    expect(sanitizePath('/admin/films')).toBeNull();
  });

  it('drops unknown paths instead of storing junk', () => {
    expect(sanitizePath('/definitely-not-a-route')).toBeNull();
    expect(sanitizePath('not-even-a-path')).toBeNull();
  });
});

// ── referrerHost ──────────────────────────────────────────────────────────

describe('referrerHost', () => {
  it('keeps only the hostname, never path or query', () => {
    expect(referrerHost('https://www.instagram.com/atema.studio?igsh=abc123'))
      .toBe('www.instagram.com');
  });

  it('returns null for empty or malformed referrers', () => {
    expect(referrerHost('')).toBeNull();
    expect(referrerHost('not a url')).toBeNull();
  });
});

// ── aggregateVisits ───────────────────────────────────────────────────────

const row = (session_id: string, path: string, created_at: string, referrer: string | null = null): VisitRow =>
  ({ session_id, path, referrer, device: 'mobile', created_at });

const TODAY = '2026-07-19';

describe('aggregateVisits', () => {
  it('counts views, sessions, and sessions that reached /book', () => {
    const rows = [
      row('s1', '/', '2026-07-19T10:00:00Z'),
      row('s1', '/book', '2026-07-19T10:01:00Z'),
      row('s1', '/book', '2026-07-19T10:02:00Z'), // repeat view, same session
      row('s2', '/', '2026-07-19T11:00:00Z'),
      row('s2', '/about', '2026-07-19T11:01:00Z'),
      row('s3', '/portfolio', '2026-07-19T12:00:00Z'),
    ];
    const s = aggregateVisits(rows, 7, TODAY);
    expect(s.views).toBe(6);
    expect(s.sessions).toBe(3);
    expect(s.bookSessions).toBe(1); // only s1, counted once
  });

  it('derives the departure page as the last pageview per session', () => {
    const rows = [
      row('s1', '/', '2026-07-19T10:00:00Z'),
      row('s1', '/book', '2026-07-19T10:05:00Z'),
      row('s2', '/', '2026-07-19T11:00:00Z'),
      row('s2', '/portfolio', '2026-07-19T11:02:00Z'),
      row('s2', '/', '2026-07-19T11:04:00Z'),
    ];
    const s = aggregateVisits(rows, 7, TODAY);
    expect(s.exitPages).toEqual([
      { key: '/', count: 1 },      // s2 ended back on the home page
      { key: '/book', count: 1 },  // s1 departed from booking
    ]);
  });

  it('gap-fills the daily series so quiet days render as empty bars', () => {
    const rows = [
      row('s1', '/', '2026-07-17T09:00:00Z'),
      row('s2', '/', '2026-07-19T09:00:00Z'),
      row('s3', '/', '2026-07-19T10:00:00Z'),
    ];
    const s = aggregateVisits(rows, 5, TODAY);
    expect(s.daily).toEqual([
      { date: '2026-07-15', views: 0 },
      { date: '2026-07-16', views: 0 },
      { date: '2026-07-17', views: 1 },
      { date: '2026-07-18', views: 0 },
      { date: '2026-07-19', views: 2 },
    ]);
  });

  it('ranks top pages and referrers by count', () => {
    const rows = [
      row('s1', '/', '2026-07-19T10:00:00Z', 'instagram.com'),
      row('s1', '/book', '2026-07-19T10:01:00Z'),
      row('s2', '/', '2026-07-19T11:00:00Z', 'instagram.com'),
      row('s3', '/', '2026-07-19T12:00:00Z', 'google.com'),
    ];
    const s = aggregateVisits(rows, 7, TODAY);
    expect(s.topPages[0]).toEqual({ key: '/', count: 3 });
    expect(s.referrers).toEqual([
      { key: 'instagram.com', count: 2 },
      { key: 'google.com', count: 1 },
    ]);
  });

  it('handles an empty range', () => {
    const s = aggregateVisits([], 7, TODAY);
    expect(s.views).toBe(0);
    expect(s.sessions).toBe(0);
    expect(s.bookSessions).toBe(0);
    expect(s.daily).toHaveLength(7);
    expect(s.exitPages).toEqual([]);
  });
});
