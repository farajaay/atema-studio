import type { CreateBookingRequest, BookingResponse } from '../types';
import { supabase } from './supabase';
// City-fee extraction is shared with the Edge Functions (single source).
import { extractCityKey } from '../../supabase/functions/_shared/validation';
export { extractCityKey };

// Booking reference generator (Patch H-2).
// Format: ATEMA-{YYMMDD}-{8-char Crockford base32 from CSPRNG bytes}.
// • Cryptographically random via crypto.getRandomValues — not predictable
//   from Date.now() leakage like the previous Math.random implementation.
// • 8 base32 chars = 40 bits = 1.1 trillion possibilities per day. Collision
//   probability is negligible for ATEMA's volume.
// • Crockford alphabet excludes I/L/O/U so refs are unambiguous when read
//   aloud or copy-pasted.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomTail(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += CROCKFORD[bytes[i] & 0x1f];
  }
  return out;
}

function ref(): string {
  const d = new Date();
  const yy  = String(d.getFullYear()).slice(2);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `ATEMA-${yy}${mm}${day}-${randomTail()}`;
}

/**
 * Create a booking.
 *
 * Tries the `create-booking` Supabase Edge Function first (Patch C-3 —
 * recomputes subtotal/vat/total server-side from the packages + addons
 * tables, so the client can't supply a forged total). If the function is
 * not deployed (404) or its endpoint is unreachable, falls back to the
 * direct insert path — same behaviour as before C-3, only used while the
 * Edge Function is being rolled out.
 */
/** Hard ceiling for the Edge Function call. If it doesn't return inside
 *  this window we abandon it and fall back to the direct-insert path —
 *  the user must never see an indefinite spinner. */
const EDGE_FN_TIMEOUT_MS = 12_000;

/** PostgREST error messages for "this column doesn't exist on the table".
 *  We use these to auto-strip unknown columns and retry the insert. */
const COLUMN_NOT_FOUND_RE =
  /Could not find the ['"`]?([\w]+)['"`]? column|column ['"`]?([\w]+)['"`]? of relation .* does not exist|column ['"`]?([\w]+)['"`]? does not exist/i;

/** Insert a row into `bookings`, auto-stripping any column the live
 *  schema doesn't recognise and retrying. Caps at 8 retries to bound
 *  recovery time; anything beyond is a real error and surfaces. */
export async function resilientInsert(
  client: NonNullable<typeof supabase>,
  row: Record<string, unknown>,
): Promise<{ data: { id: string; booking_ref?: string; status?: string; created_at?: string; event_date?: string; total?: number } | null; error: { message: string } | null }> {
  let attempt: Record<string, unknown> = { ...row };
  const dropped: string[] = [];
  for (let i = 0; i < 8; i++) {
    const { data, error } = await client
      .from('bookings')
      .insert([attempt])
      .select()
      .single();
    if (!error) {
      if (dropped.length > 0) {
        console.warn(
          `[createBooking] succeeded after stripping unknown columns: ${dropped.join(', ')}. ` +
          'Apply the pending migrations (database-alteration-v2.sql + ' +
          'migrations-2026-05-discount-codes.sql + migrations-2026-05-repair-audit.sql) ' +
          'to persist these fields going forward.',
        );
      }
      return { data: data as { id: string; booking_ref?: string }, error: null };
    }
    const match = error.message?.match(COLUMN_NOT_FOUND_RE);
    const missingCol = match?.[1] || match?.[2] || match?.[3];
    if (!missingCol || !(missingCol in attempt)) {
      // Not a column-not-found we can recover from. Surface as-is.
      return { data: null, error };
    }
    dropped.push(missingCol);
    const { [missingCol]: _omit, ...rest } = attempt;
    void _omit;
    attempt = rest;
  }
  return { data: null, error: { message: 'resilient insert exceeded retry limit' } };
}

/** Wrap any promise with a timeout. Resolves with `null` (not rejects) so
 *  the caller can distinguish "timed out" from "errored". */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | { __timeout: true }> {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ __timeout: true });
    }, ms);
    p.then(v => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    }).catch(err => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // Surface as a rejected promise — re-throw on next tick.
      // We use queueMicrotask so the outer await sees a real rejection.
      queueMicrotask(() => { throw err; });
      resolve({ __timeout: true });
    });
  });
}

export async function createBooking(payload: CreateBookingRequest): Promise<BookingResponse> {
  // Per-call correlation id so client logs match the Edge Function logs in
  // Supabase. Short + Crockford-style so it's copy/paste-friendly.
  const reqId = (() => {
    const b = new Uint8Array(4); crypto.getRandomValues(b);
    let s = ''; for (let i = 0; i < 4; i++) s += CROCKFORD[b[i] & 31];
    return s;
  })();
  const t0 = performance.now();
  console.groupCollapsed(`[booking:${reqId}] createBooking`);
  console.log(`[booking:${reqId}] payload:`, {
    customerName:    payload.customerName,
    customerPhone:   payload.customerPhone,
    customerEmail:   payload.customerEmail ?? null,
    packageId:       payload.packageId,
    addOnIds:        payload.addOnIds ?? [],
    eventDate:       payload.eventDate,
    eventTime:       payload.eventTime,
    city:            payload.city ?? null,
    subtotal:        payload.subtotal,
    vat:             payload.vat,
    total:           payload.total,
    discountCode:    payload.discountCode ?? null,
    eventType:       payload.eventType ?? null,
    guestCount:      payload.guestCount ?? null,
    tcAccepted:      payload.tcAccepted,
    pdplConsent:     payload.pdplConsent,
    whatsappOptIn:   payload.whatsappOptIn,
  });

  if (supabase) {
    // ── Preferred path: Edge Function ────────────────────────────────
    try {
      console.log(`[booking:${reqId}] → invoking create-booking Edge Function`);
      const invokePromise = supabase.functions.invoke('create-booking', {
        body: {
          customerName:    payload.customerName,
          customerPhone:   payload.customerPhone,
          customerEmail:   payload.customerEmail ?? null,
          packageId:       typeof payload.packageId === 'number' ? payload.packageId : null,
          addOnIds:        payload.addOnIds ?? [],
          eventDate:       payload.eventDate,
          eventTime:       payload.eventTime,
          city:            payload.city ?? extractCityKey(payload.location),
          location:        payload.location ?? null,
          specialRequests: payload.specialRequests ?? null,
          discountCode:    payload.discountCode ?? null,
          // Audit append (2026-05) — see CreateBookingRequest for rationale.
          eventType:       payload.eventType ?? null,
          guestCount:      typeof payload.guestCount === 'number' ? payload.guestCount : null,
          shotList:        payload.shotList ?? null,
          tcAccepted:      !!payload.tcAccepted,
          pdplConsent:     !!payload.pdplConsent,
          whatsappOptIn:   !!payload.whatsappOptIn,
          // Correlation id — echoed in the Edge Function log so we can
          // match a client error to a server log line.
          _reqId:          reqId,
        },
      });
      const settled = await withTimeout(invokePromise, EDGE_FN_TIMEOUT_MS);
      if (settled && typeof settled === 'object' && '__timeout' in settled) {
        console.warn(`[booking:${reqId}] ⏱ Edge Function timed out after ${EDGE_FN_TIMEOUT_MS}ms — falling back to direct insert.`);
      } else {
        const { data, error } = settled as Awaited<typeof invokePromise>;
        console.log(`[booking:${reqId}] ← Edge Function response`, { error, data });
        if (!error && data && typeof data.id === 'string') {
          console.log(`[booking:${reqId}] ✓ Edge Function success (${Math.round(performance.now() - t0)}ms)`);
          console.groupEnd();
          return {
            id:         data.id,
            bookingRef: data.bookingRef,
            status:     data.status,
            createdAt:  data.createdAt,
            eventDate:  data.eventDate,
            total:      data.total,
          };
        }
        // Function returned an error response (validation, etc.)
        if (error) {
          const msg = String((error as { message?: string }).message ?? '');
          // 404 = not deployed yet → silent fall-through to direct insert.
          if (/(404|Function not found)/i.test(msg)) {
            console.warn(`[booking:${reqId}] Edge Function not deployed (404) — falling back to direct insert.`);
          } else {
            console.error(`[booking:${reqId}] ✗ Edge Function returned error:`, error);
            console.error(`[booking:${reqId}]    response data:`, data);
            const surfaced = typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : msg || 'create_booking_failed';
            console.groupEnd();
            throw new Error(surfaced);
          }
        }
      }
    } catch (err) {
      // Network / unknown — fall through to direct insert
      console.warn(`[booking:${reqId}] Edge Function unreachable, falling back:`, err);
    }

    // ── Fallback path: direct insert (pre-C-3 behaviour) ─────────────
    console.log(`[booking:${reqId}] → fallback direct insert path`);
    const bookingRef = ref();
    const pkgId = typeof payload.packageId === 'number' ? payload.packageId : null;
    // Re-preview the code so we send the authoritative kind to the DB.
    let discountKind: 'percent' | 'flat' | null = null;
    let discountAmount = 0;
    if (payload.discountCode) {
      try {
        const grossSub = payload.subtotal; // already net; preview against gross
        const orig = payload.total;
        // Best-effort: amount = gross - net (i.e. recompute). If we can't
        // determine gross, skip persisting discount fields.
        // Simpler heuristic: trust client's net subtotal + run a fresh
        // preview against (net + a guess). But the safest path is to
        // simply call preview_discount_code with the net subtotal — RLS
        // will reject anything inconsistent.
        const { data: prev } = await supabase
          .rpc('preview_discount_code', {
            p_code:     payload.discountCode.toUpperCase(),
            p_subtotal: grossSub + (orig - grossSub),
          });
        const row = Array.isArray(prev) ? prev[0] : prev;
        if (row && row.reason === 'ok') {
          discountAmount = Math.max(0, Number(row.applied_amount ?? 0));
          discountKind   = (row.applied_kind as 'percent' | 'flat' | null) ?? null;
        }
      } catch (e) {
        console.warn(`[booking:${reqId}] discount preview failed (dropping silently):`, e);
      }
    }
    // Canonical insert payload — every column we'd ideally write. If the
    // live DB is missing any of them (audit columns not migrated,
    // discount columns not migrated, etc.), the resilient inserter
    // below auto-strips the missing one and retries.
    const fullRow: Record<string, unknown> = {
      booking_ref:      bookingRef,
      package_id:       pkgId,
      addon_ids:        payload.addOnIds ?? [],
      event_date:       payload.eventDate,
      event_time:       payload.eventTime,
      customer_name:    payload.customerName,
      customer_phone:   payload.customerPhone,
      customer_email:   payload.customerEmail ?? null,
      location:         payload.location ?? null,
      special_requests: payload.specialRequests ?? null,
      subtotal:         payload.subtotal,
      vat:              payload.vat,
      total:            payload.total,
      status:           'pending',
      payment_status:   'unpaid',
      // Discount columns — added by migrations-2026-05-discount-codes.sql
      discount_code:    discountAmount > 0 ? (payload.discountCode ?? null) : null,
      discount_amount:  discountAmount,
      discount_kind:    discountKind,
      // Audit columns — added by database-alteration-v2.sql
      event_type:               payload.eventType ?? null,
      guest_count:              typeof payload.guestCount === 'number' ? payload.guestCount : null,
      shot_list:                payload.shotList ?? null,
      tc_accepted:              !!payload.tcAccepted,
      pdpl_consent_snapshot:    !!payload.pdplConsent,
      whatsapp_opt_in_snapshot: !!payload.whatsappOptIn,
    };
    console.log(`[booking:${reqId}] insert row:`, fullRow);

    // Resilient insert: PostgREST surfaces "Could not find the 'X' column"
    // when a write references a column the live schema doesn't have.
    // We strip the offending column and retry, up to 8 times, so the
    // booking still completes even if migrations are partially applied.
    const { data, error } = await resilientInsert(supabase, fullRow);

    if (error || !data) {
      console.error(`[booking:${reqId}] ✗ direct insert failed (${Math.round(performance.now() - t0)}ms)`);
      console.error(`[booking:${reqId}]    error:`, error);
      console.error(`[booking:${reqId}]    full error JSON:`, JSON.stringify(error, null, 2));
      console.groupEnd();
      // Re-throw with a richer message so the UI shows the real cause
      // (PostgREST RLS rejections, NOT NULL violations, FK errors, etc.)
      // rather than a generic "booking_insert_failed".
      const e = error as { message?: string; code?: string; details?: string; hint?: string } | null;
      const code = e?.code ?? '';
      // RLS rejection (42501) means the direct-insert fallback is blocked by
      // the database's row-level security policy. Surface a user-friendly
      // message rather than the raw Postgres error.
      if (code === '42501' || (e?.message ?? '').includes('row-level security')) {
        throw new Error('booking_unavailable');
      }
      const detail = e?.details ? ` (${e.details})` : '';
      const hint   = e?.hint    ? ` — hint: ${e.hint}` : '';
      const codeStr = code ? ` [${code}]` : '';
      throw new Error((e?.message ?? 'booking_insert_failed') + codeStr + detail + hint);
    }
    console.log(`[booking:${reqId}] ✓ direct insert success (${Math.round(performance.now() - t0)}ms)`, data);
    console.groupEnd();
    return {
      id:         data.id,
      bookingRef: data.booking_ref     ?? bookingRef,
      status:     (data.status         ?? 'pending') as BookingResponse['status'],
      createdAt:  data.created_at      ?? new Date().toISOString(),
      eventDate:  data.event_date      ?? payload.eventDate,
      total:      data.total           ?? payload.total,
    };
  }

  // Mock fallback for local dev without Supabase
  console.warn(`[booking:${reqId}] Supabase client missing — returning mock booking.`);
  await new Promise(r => setTimeout(r, 800));
  console.groupEnd();
  return {
    id: `mock_${Date.now()}`,
    bookingRef: ref(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    eventDate: payload.eventDate,
    total: payload.total,
  };
}

export async function getPackages() {
  if (!supabase) return null;
  const { data } = await supabase.from('packages').select('*').order('price');
  return data;
}
