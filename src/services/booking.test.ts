import { describe, it, expect } from 'vitest';
import { resilientInsert, extractCityKey, isTransportFailure } from './booking';

type InsertResult = { data: unknown; error: { message: string } | null };

/** Build a fake Supabase client whose insert().select().single() returns the
 *  next queued response per attempt, recording each inserted row. */
function fakeClient(responses: InsertResult[]) {
  const attempts: Array<Record<string, unknown>> = [];
  let i = 0;
  const client = {
    from: () => ({
      insert: (rows: Array<Record<string, unknown>>) => {
        attempts.push(rows[0]);
        return {
          select: () => ({
            single: async () => responses[i++] ?? { data: null, error: { message: 'no more responses' } },
          }),
        };
      },
    }),
  };
  return { client: client as unknown as Parameters<typeof resilientInsert>[0], attempts };
}

describe('resilientInsert', () => {
  it('returns immediately on first-try success without stripping', async () => {
    const { client, attempts } = fakeClient([{ data: { id: 'b1' }, error: null }]);
    const res = await resilientInsert(client, { booking_ref: 'R', discount_code: 'X' });
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ id: 'b1' });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toHaveProperty('discount_code');
  });

  it('strips an unknown column and retries until success', async () => {
    const { client, attempts } = fakeClient([
      { data: null, error: { message: "Could not find the 'discount_code' column" } },
      { data: { id: 'b2' }, error: null },
    ]);
    const res = await resilientInsert(client, { booking_ref: 'R', discount_code: 'X', total: 100 });
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ id: 'b2' });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toHaveProperty('discount_code');
    expect(attempts[1]).not.toHaveProperty('discount_code');
    expect(attempts[1]).toHaveProperty('total');
  });

  it('surfaces a non-column error without retrying', async () => {
    const { client, attempts } = fakeClient([
      { data: null, error: { message: 'duplicate key value violates unique constraint' } },
    ]);
    const res = await resilientInsert(client, { booking_ref: 'R' });
    expect(res.data).toBeNull();
    expect(res.error?.message).toMatch(/duplicate key/);
    expect(attempts).toHaveLength(1);
  });

  it('gives up after the retry cap when columns keep failing', async () => {
    // Always report a fresh missing column so the loop can never recover.
    const cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const responses: InsertResult[] = cols.map((c) => ({
      data: null,
      error: { message: `Could not find the '${c}' column` },
    }));
    const { client } = fakeClient(responses);
    const row: Record<string, unknown> = {};
    for (const c of cols) row[c] = 1;
    const res = await resilientInsert(client, row);
    expect(res.data).toBeNull();
    expect(res.error?.message).toMatch(/retry limit/);
  });
});

describe('isTransportFailure', () => {
  it('treats the FunctionsFetchError message as a transport failure (the reported bug)', () => {
    // This is the exact error the bride saw on submit — it must fall back,
    // not surface, so booking completes via the direct-insert path.
    expect(isTransportFailure({ message: 'Failed to send a request to the Edge Function' })).toBe(true);
  });

  it('matches by error name and other transport signatures', () => {
    expect(isTransportFailure({ name: 'FunctionsFetchError' })).toBe(true);
    expect(isTransportFailure({ name: 'FunctionsRelayError' })).toBe(true);
    expect(isTransportFailure({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isTransportFailure({ message: 'Function not found' })).toBe(true);
    expect(isTransportFailure({ message: 'request failed, status 404' })).toBe(true);
    expect(isTransportFailure({ message: 'NetworkError when attempting to fetch resource' })).toBe(true);
  });

  it('does NOT swallow a genuine function response error', () => {
    // The function ran and returned a real error — must surface, not fall back.
    expect(isTransportFailure({ name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code' })).toBe(false);
    expect(isTransportFailure({ message: 'validation_failed' })).toBe(false);
    expect(isTransportFailure(null)).toBe(false);
    expect(isTransportFailure(undefined)).toBe(false);
  });
});

describe('extractCityKey', () => {
  it('matches known English and Arabic city tokens', () => {
    expect(extractCityKey('Jubail Corniche Hall')).toBe('jubail');
    expect(extractCityKey('قاعة في الدمام')).toBe('dammam');
    expect(extractCityKey('Al Khobar')).toBe('khobar');
    expect(extractCityKey('حفل في القطيف')).toBe('qatif');
    expect(extractCityKey('Al Ahsa')).toBe('ahsa');
    expect(extractCityKey('الرياض')).toBe('riyadh');
  });

  it('falls back to "other" for unknown or empty locations', () => {
    expect(extractCityKey('Jeddah')).toBe('other');
    expect(extractCityKey('')).toBe('other');
    expect(extractCityKey(null)).toBe('other');
    expect(extractCityKey(undefined)).toBe('other');
  });
});
