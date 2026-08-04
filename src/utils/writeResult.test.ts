import { describe, it, expect } from 'vitest';
import { interpretWrite, NO_ROWS_WRITTEN } from './writeResult';

describe('interpretWrite', () => {
  it('reports success when the write returns rows', () => {
    const out = interpretWrite({ data: [{ id: 1, price: 2700 }], error: null });
    expect(out.ok).toBe(true);
    expect(out.rows).toEqual([{ id: 1, price: 2700 }]);
    expect(out.message).toBeUndefined();
  });

  it('surfaces an explicit database error', () => {
    const out = interpretWrite({ data: null, error: { message: 'permission denied' } });
    expect(out.ok).toBe(false);
    expect(out.message).toBe('permission denied');
  });

  // The regression this module exists for: RLS hides the rows instead of
  // rejecting the statement, so a blocked write looks like a clean success.
  it('treats an empty result as failure, not success', () => {
    const out = interpretWrite({ data: [], error: null });
    expect(out.ok).toBe(false);
    expect(out.message).toBe(NO_ROWS_WRITTEN);
  });

  it('treats a null result with no error as failure', () => {
    const out = interpretWrite({ data: null, error: null });
    expect(out.ok).toBe(false);
    expect(out.message).toBe(NO_ROWS_WRITTEN);
  });

  it('points the operator at the session, in Arabic', () => {
    const out = interpretWrite({ data: [], error: null });
    expect(out.message).toContain('لم يُحفَظ التعديل');
  });

  it('never returns rows alongside a failure', () => {
    for (const raw of [
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: { message: 'boom' } },
    ]) {
      expect(interpretWrite(raw).rows).toEqual([]);
    }
  });
});
