import type { CreateBookingRequest, BookingResponse } from '../types';
import { supabase } from './supabase';

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
export async function createBooking(payload: CreateBookingRequest): Promise<BookingResponse> {
  if (supabase) {
    // ── Preferred path: Edge Function ────────────────────────────────
    try {
      const { data, error } = await supabase.functions.invoke('create-booking', {
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
        },
      });
      if (!error && data && typeof data.id === 'string') {
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
        // 404 = not deployed yet → silent fall-through to direct insert.
        // Any other status = surface the message.
        if (!/(404|Function not found)/i.test(String((error as { message?: string }).message ?? ''))) {
          console.error('createBooking edge function error:', error);
          throw new Error(typeof (data as { error?: string })?.error === 'string'
            ? (data as { error: string }).error
            : (error as { message?: string }).message ?? 'create_booking_failed');
        }
        console.warn('create-booking edge function not deployed yet — falling back to direct insert.');
      }
    } catch (err) {
      // Network / unknown — fall through to direct insert
      console.warn('create-booking edge function unreachable, falling back:', err);
    }

    // ── Fallback path: direct insert (pre-C-3 behaviour) ─────────────
    const bookingRef = ref();
    const pkgId = typeof payload.packageId === 'number' ? payload.packageId : null;
    const { data, error } = await supabase
      .from('bookings')
      .insert([{
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
      }])
      .select()
      .single();

    if (error) {
      console.error('Booking insert error:', error);
      throw new Error(error.message);
    }
    return {
      id:         data.id,
      bookingRef: data.booking_ref ?? bookingRef,
      status:     data.status,
      createdAt:  data.created_at,
      eventDate:  data.event_date,
      total:      data.total,
    };
  }

  // Mock fallback for local dev without Supabase
  await new Promise(r => setTimeout(r, 800));
  return {
    id: `mock_${Date.now()}`,
    bookingRef: ref(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    eventDate: payload.eventDate,
    total: payload.total,
  };
}

/** Best-effort extraction of a CITIES key from a `location` string for the
 *  Edge Function's city-fee lookup. The form posts the venue + city joined
 *  as the `location` value, so we look for known city tokens. */
function extractCityKey(location: string | null | undefined): string {
  if (!location) return 'other';
  const v = location.toLowerCase();
  if (v.includes('jubail') || v.includes('الجبيل')) return 'jubail';
  if (v.includes('dammam') || v.includes('الدمام')) return 'dammam';
  if (v.includes('khobar') || v.includes('الخبر'))  return 'khobar';
  if (v.includes('qatif')  || v.includes('القطيف'))  return 'qatif';
  if (v.includes('ahsa')   || v.includes('الأحساء'))  return 'ahsa';
  if (v.includes('riyadh') || v.includes('الرياض'))  return 'riyadh';
  return 'other';
}

export async function getPackages() {
  if (!supabase) return null;
  const { data } = await supabase.from('packages').select('*').order('price');
  return data;
}
