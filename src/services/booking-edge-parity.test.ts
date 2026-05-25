import { describe, it, expect } from 'vitest';

// Client copy — what the booking form runs in the browser.
import * as client from '../utils/validation';
// Edge copy — what the create-booking Edge Function runs server-side.
// Importable because _shared/validation.ts is dependency-free (no Deno
// globals beyond `crypto`, no remote imports).
import * as edge from '../../supabase/functions/_shared/validation';

// ── Shared fixtures ──────────────────────────────────────────────────────
// One input list, run through BOTH implementations. If the client and the
// Edge Function ever disagree on what a valid phone / email / date is, a
// customer could pass client validation only to be rejected by the server
// (or vice versa) — so these MUST stay in lockstep.

const PHONES = [
  '+966512345678', '966512345678', '00966512345678', '0512345678', '512345678',
  '05 12-34 56 78', '+966 (51) 234-5678',
  '', '0412345678', '051234567', '05123456789', '+14155550123', 'not a phone',
];

const EMAILS = [
  '', 'fatima@example.com', 'a.b+tag@sub.domain.sa',
  'no-at-sign', 'two@@at.com', 'missing@tld', 'has space@x.com',
  '@nolocal.com', 'trailing@dot.', 'lead@.dot', 'x'.repeat(255) + '@x.com',
];

const DATES = [
  '', 'not-a-date', '2000-01-01', '2999-01-01',
  // today, computed locally
  (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })(),
];

const CLAMP_CASES: Array<[string, number]> = [
  ['', 10], ['  hello  ', 100], ['abcdef', 3], ['   trimme   ', 4],
];

describe('client ↔ edge validator parity', () => {
  it('normalizeSaudiMobile agrees on every fixture input', () => {
    for (const p of PHONES) {
      expect(edge.normalizeSaudiMobile(p)).toBe(client.normalizeSaudiMobile(p));
    }
  });

  it('validEmail agrees on every fixture input', () => {
    for (const e of EMAILS) {
      expect(edge.validEmail(e)).toBe(client.validEmail(e));
    }
  });

  it('isFutureOrToday agrees on every fixture input', () => {
    for (const d of DATES) {
      expect(edge.isFutureOrToday(d)).toBe(client.isFutureOrToday(d));
    }
  });

  it('clampText agrees on every fixture input', () => {
    for (const [raw, max] of CLAMP_CASES) {
      expect(edge.clampText(raw, max)).toBe(client.clampText(raw, max));
    }
  });
});

describe('edge booking primitives', () => {
  it('bookingRef matches the ATEMA-YYMMDD-XXXXXXXX Crockford format', () => {
    const ref = edge.bookingRef();
    expect(ref).toMatch(/^ATEMA-\d{6}-[0-9A-Z]{8}$/);
    expect(ref.slice(-8)).not.toMatch(/[ILOU]/); // Crockford excludes I/L/O/U
  });

  it('bookingRef is unique across many calls', () => {
    const seen = new Set(Array.from({ length: 500 }, () => edge.bookingRef()));
    expect(seen.size).toBe(500);
  });

  it('CITY_FEES matches the BookingPage CITIES fee contract', () => {
    // Mirror of the `fee` values in src/pages/BookingPage.tsx CITIES.
    // If the studio changes a city fee, both this map and CITIES must move.
    expect(edge.CITY_FEES).toEqual({
      jubail: 0, dammam: 200, khobar: 200, qatif: 200, ahsa: 450,
      riyadh: 0, other: 0,
    });
  });
});
