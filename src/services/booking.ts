import type { CreateBookingRequest, BookingResponse } from '../types';
import { supabase } from './supabase';

function ref(): string {
  return `ATEMA-${Date.now()}-${Math.random().toString(36).substr(2,9).toUpperCase()}`;
}

export async function createBooking(payload: CreateBookingRequest): Promise<BookingResponse> {
  // Real Supabase call
  if (supabase) {
    const { data, error } = await supabase
      .from('bookings')
      .insert([{
        package_id:       payload.packageId,
        addon_ids:        payload.addOnIds,
        event_date:       payload.eventDate,
        event_time:       payload.eventTime,
        customer_name:    payload.customerName,
        customer_phone:   payload.customerPhone,
        customer_email:   payload.customerEmail,
        location:         payload.location,
        special_requests: payload.specialRequests,
        subtotal:         payload.subtotal,
        vat:              payload.vat,
        total:            payload.total,
        status:           'pending',
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      id:         data.id,
      bookingRef: data.booking_ref,
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
