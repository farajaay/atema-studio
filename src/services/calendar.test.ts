import { describe, it, expect, beforeEach, vi } from 'vitest';

// Recording mock for the Supabase client. Each call to .from() records the
// table; .select() records the projected columns. The builder is thenable so
// `await q` resolves to the configured result.
const h = vi.hoisted(() => {
  const state = {
    calls: [] as Array<{ table: string; select: string }>,
    result: { data: [] as Array<Record<string, unknown>>, error: null as unknown },
  };
  function makeBuilder(call: { table: string; select: string }) {
    const builder: Record<string, unknown> = {
      select: (cols: string) => { call.select = cols; return builder; },
      gte: () => builder,
      lte: () => builder,
      neq: () => builder,
      order: () => builder,
      then: (resolve: (v: unknown) => unknown) => resolve(state.result),
    };
    return builder;
  }
  const supabase = {
    from: (table: string) => {
      const call = { table, select: '' };
      state.calls.push(call);
      return makeBuilder(call);
    },
  };
  return { state, supabase };
});

vi.mock('./supabase', () => ({ supabase: h.supabase }));

import { fetchPublicBookedDates, fetchAdminBookedDates } from './calendar';

beforeEach(() => {
  h.state.calls = [];
  h.state.result = { data: [], error: null };
});

describe('fetchPublicBookedDates — PII boundary (CLAUDE.md §4.4)', () => {
  it('reads the public_booked_dates view, never the bookings table', async () => {
    await fetchPublicBookedDates('2026-01-01', '2026-12-31');
    expect(h.state.calls).toHaveLength(1);
    expect(h.state.calls[0].table).toBe('public_booked_dates');
    expect(h.state.calls[0].table).not.toBe('bookings');
  });

  it('projects ONLY event_date + status — no customer PII columns', async () => {
    await fetchPublicBookedDates();
    const select = h.state.calls[0].select;
    expect(select).toBe('event_date, status');
    expect(select).not.toMatch(/customer/i);
    expect(select).not.toMatch(/booking_ref/i);
    expect(select).not.toMatch(/phone|email|name/i);
  });

  it('maps rows to { date, status } and leaves PII fields undefined', async () => {
    h.state.result = {
      data: [{ event_date: '2026-06-01', status: 'paid' }],
      error: null,
    };
    const out = await fetchPublicBookedDates();
    expect(out).toEqual([{ date: '2026-06-01', status: 'paid' }]);
    expect(out[0].customer_name).toBeUndefined();
    expect(out[0].booking_ref).toBeUndefined();
  });
});

describe('fetchAdminBookedDates — full detail path', () => {
  it('reads the bookings table with PII columns for the admin surface', async () => {
    await fetchAdminBookedDates();
    expect(h.state.calls[0].table).toBe('bookings');
    expect(h.state.calls[0].select).toMatch(/customer_name/);
    expect(h.state.calls[0].select).toMatch(/booking_ref/);
  });
});
