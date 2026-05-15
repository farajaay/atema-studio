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
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  created_at: string;
}

// Demo data shown when Supabase is not configured
const DEMO_BOOKINGS: Booking[] = [
  { id:'1', booking_ref:'ATEMA-001', customer_name:'نورة الشمري',  customer_phone:'0501234567', customer_email:'noura@example.com', package_id:4, package_name:'الباقة الملكية',  addon_ids:['drone','album-print'], event_date:'2024-06-15', event_time:'18:00', location:'قاعة الجوهرة — الجبيل', subtotal:8500, vat:1275, total:9775, status:'confirmed',  payment_status:'paid',   created_at:'2024-05-10T10:30:00Z' },
  { id:'2', booking_ref:'ATEMA-002', customer_name:'ريم المنصور',  customer_phone:'0559876543', customer_email:'reem@example.com',  package_id:5, package_name:'باقة التوقيع',   addon_ids:['extra-hour'],          event_date:'2024-07-20', event_time:'19:00', location:'فندق كراون — الدمام',  subtotal:9000, vat:1350, total:10350,status:'pending',   payment_status:'unpaid', created_at:'2024-05-12T14:00:00Z' },
  { id:'3', booking_ref:'ATEMA-003', customer_name:'سارة العتيبي', customer_phone:'0535551234',                                    package_id:3, package_name:'الباقة الكلاسيكية',addon_ids:[],                      event_date:'2024-08-05', event_time:'17:30', location:'الرياض',               subtotal:4200, vat:630,  total:4830, status:'pending',   payment_status:'unpaid', created_at:'2024-05-14T09:15:00Z' },
  { id:'4', booking_ref:'ATEMA-004', customer_name:'هنود القحطاني',customer_phone:'0512223344', customer_email:'h@example.com',    package_id:6, package_name:'ATEMA Couture',   addon_ids:['drone','extra-video'],   event_date:'2024-05-30', event_time:'20:00', location:'قصر الأميرة — جدة',   subtotal:16500,vat:2475,total:18975,status:'completed', payment_status:'paid',   created_at:'2024-04-20T11:00:00Z' },
  { id:'5', booking_ref:'ATEMA-005', customer_name:'لمى الزهراني', customer_phone:'0501112233',                                    package_id:1, package_name:'جلسة الخطوبة',  addon_ids:['express-delivery'],     event_date:'2024-09-10', event_time:'16:00', location:'الخبر',               subtotal:2155, vat:323,  total:2478, status:'cancelled', payment_status:'refunded',created_at:'2024-05-01T16:45:00Z' },
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
