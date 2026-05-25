import { describe, it, expect, afterEach } from 'vitest';
import { parseMoyasarCallback } from './moyasar';

const original = (globalThis as { window?: unknown }).window;

function setSearch(search: string) {
  (globalThis as { window?: unknown }).window = { location: { search } };
}

afterEach(() => {
  (globalThis as { window?: unknown }).window = original;
});

describe('parseMoyasarCallback', () => {
  it('parses a full paid callback, mapping snake_case params', () => {
    setSearch('?id=pay_123&status=paid&message=Approved&booking_id=b-1&booking_ref=ATEMA-260101-ABCDEFGH');
    expect(parseMoyasarCallback()).toEqual({
      id: 'pay_123',
      status: 'paid',
      message: 'Approved',
      bookingId: 'b-1',
      bookingRef: 'ATEMA-260101-ABCDEFGH',
    });
  });

  it('defaults optional params to empty strings', () => {
    setSearch('?id=pay_9&status=failed');
    expect(parseMoyasarCallback()).toEqual({
      id: 'pay_9',
      status: 'failed',
      message: '',
      bookingId: '',
      bookingRef: '',
    });
  });

  it('returns null when id or status is missing', () => {
    setSearch('?status=paid');
    expect(parseMoyasarCallback()).toBeNull();
    setSearch('?id=pay_1');
    expect(parseMoyasarCallback()).toBeNull();
    setSearch('');
    expect(parseMoyasarCallback()).toBeNull();
  });
});
