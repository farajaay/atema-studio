// Interpreting a Supabase write — why `error === null` is not "it saved".
//
// Every admin table (packages, addons, bookings, …) is RLS-on: anon may read,
// only `authenticated` may write. When the admin's JWT is missing or expired,
// PostgREST does NOT reject the UPDATE. Row-level security simply narrows the
// set of visible rows to zero, so the statement legitimately matches nothing
// and comes back **HTTP 200 with an empty array and no error**. Verified
// against production on 2026-08-04:
//
//   PATCH /rest/v1/packages?id=eq.1  →  200  []
//
// A caller that only checks `error` therefore reports success for a write that
// never happened. That is how a price edit "saved" in the admin panel and
// reappeared at the old value on reload.
//
// The fix is to ask the write to return its rows (`.select()`) and treat an
// empty result as failure. Pure + unit-tested so the rule can't drift.

export interface RawWriteResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export interface WriteOutcome<T> {
  ok: boolean;
  /** The affected rows, when the write actually landed. */
  rows: T[];
  /** Operator-facing message, Arabic-first. Present only when `ok` is false. */
  message?: string;
}

/** Shown when the write was accepted but changed nothing — almost always an
 *  expired admin session, since RLS hides the rows rather than erroring. */
export const NO_ROWS_WRITTEN =
  'لم يُحفَظ التعديل — انتهت جلسة الدخول على الأرجح. سجّلي الخروج ثم الدخول مرة أخرى وأعيدي الحفظ. '
  + '(write affected 0 rows — check the admin session)';

/**
 * Turn a Supabase write response into a verdict.
 *
 * Pass the result of a write that ends in `.select()`, so the affected rows
 * come back and "changed nothing" is distinguishable from "changed something".
 */
export function interpretWrite<T>(result: RawWriteResult<T>): WriteOutcome<T> {
  if (result.error) {
    return { ok: false, rows: [], message: result.error.message };
  }
  const rows = result.data ?? [];
  if (rows.length === 0) {
    return { ok: false, rows: [], message: NO_ROWS_WRITTEN };
  }
  return { ok: true, rows };
}
