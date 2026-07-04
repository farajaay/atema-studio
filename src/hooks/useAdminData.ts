import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface Booking {
  id: string;
  booking_ref: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  package_id: number;
  package_name?: string;
  addon_ids: string[];
  event_date: string;
  event_time: string;
  location?: string;
  special_requests?: string;
  subtotal: number;
  vat: number;
  total: number;
  vat_enabled?: boolean;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  // 'awaiting_transfer' is set by BankTransferPayment.tsx when the customer
  // chose bank transfer and the receipt is pending verification by Fatima.
  // Must stay in this union — its absence previously crashed AdminDashboard
  // when PAYMENT_CONFIG[status] returned undefined for the transfer flow.
  payment_status: 'unpaid' | 'awaiting_transfer' | 'paid' | 'refunded';
  /** Outstanding balance from a self-service package upgrade
      (change-booking sets it; card payments auto-clear it via
      verify-payment; transfer payments are cleared manually from the
      admin booking modal once the receipt is verified). */
  topup_amount_due?: number;
  created_at: string;
  /** Discount fields (added 2026-05-21) — present when a code was applied. */
  discount_code?:   string | null;
  discount_amount?: number | null;
  discount_kind?:   'percent' | 'flat' | null;
}

// Demo data shown when Supabase is not configured.
// Refreshed May-2026 to reflect the new pricing tier (migrations-2026-05-pricing-overhaul.sql)
// and rolled forward to plausible current/upcoming dates.
const DEMO_BOOKINGS: Booking[] = [
  { id:'1', booking_ref:'ATEMA-001', customer_name:'نورة الشمري',  customer_phone:'0501234567', customer_email:'noura@example.com', package_id:4, package_name:'الباقة الملكية',  addon_ids:['extra-hour','henna'],  event_date:'2026-07-15', event_time:'18:00', location:'قاعة الجوهرة — الجبيل', subtotal:13800, vat:2070, total:15870, status:'confirmed',  payment_status:'paid',   created_at:'2026-05-10T10:30:00Z' },
  { id:'2', booking_ref:'ATEMA-002', customer_name:'ريم المنصور',  customer_phone:'0559876543', customer_email:'reem@example.com',  package_id:5, package_name:'باقة التوقيع',   addon_ids:['extra-hour'],          event_date:'2026-08-20', event_time:'19:00', location:'فندق كراون — الدمام',  subtotal:13400, vat:2010, total:15410, status:'pending',    payment_status:'unpaid', created_at:'2026-05-12T14:00:00Z' },
  { id:'3', booking_ref:'ATEMA-003', customer_name:'سارة العتيبي', customer_phone:'0535551234',                                    package_id:3, package_name:'الباقة الكلاسيكية',addon_ids:[],                      event_date:'2026-09-05', event_time:'17:30', location:'الرياض',               subtotal:5200,  vat:780,  total:5980,  status:'pending',    payment_status:'unpaid', created_at:'2026-05-14T09:15:00Z' },
  { id:'4', booking_ref:'ATEMA-004', customer_name:'هنود القحطاني',customer_phone:'0512223344', customer_email:'h@example.com',    package_id:6, package_name:'ATEMA Couture',   addon_ids:['bridal-prep','kosha'], event_date:'2026-04-30', event_time:'20:00', location:'قصر الأميرة — جدة',    subtotal:21500, vat:3225, total:24725, status:'completed',  payment_status:'paid',   created_at:'2026-03-20T11:00:00Z' },
  { id:'5', booking_ref:'ATEMA-005', customer_name:'لمى الزهراني', customer_phone:'0501112233',                                    package_id:1, package_name:'باقة الخطوبة',  addon_ids:['save-date'],            event_date:'2026-10-10', event_time:'16:00', location:'الخبر',                subtotal:3200,  vat:480,  total:3680,  status:'cancelled',  payment_status:'refunded',created_at:'2026-05-01T16:45:00Z' },
];

export function useAdminData() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    if (supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) setError(error.message);
      else setBookings(data || []);
    } else {
      await new Promise(r => setTimeout(r, 600));
      setBookings(DEMO_BOOKINGS);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function updateBooking(id: string, updates: Partial<Booking>): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('bookings').update(updates).eq('id', id);
      if (error) { setError(error.message); return false; }
    }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    return true;
  }

  async function deleteBooking(id: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) { setError(error.message); return false; }
    }
    setBookings(prev => prev.filter(b => b.id !== id));
    return true;
  }

  const stats = {
    total:     bookings.length,
    pending:   bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    revenue:   bookings.filter(b => b.payment_status === 'paid').reduce((s, b) => s + b.total, 0),
    pending_revenue: bookings.filter(b => b.payment_status === 'unpaid' && b.status !== 'cancelled').reduce((s, b) => s + b.total, 0),
  };

  return { bookings, loading, error, stats, fetchBookings, updateBooking, deleteBooking };
}
