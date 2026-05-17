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

export async function createBooking(payload: CreateBookingRequest): Promise<BookingResponse> {
  const bookingRef = ref();

  // Real Supabase call
  if (supabase) {
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

  // Mock fallback
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

export async function getPackages() {
  if (!supabase) return null;
  const { data } = await supabase.from('packages').select('*').order('price');
  return data;
}
