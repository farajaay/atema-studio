import { describe, it, expect } from 'vitest';
import { resilientInsert, extractCityKey } from './booking';

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
