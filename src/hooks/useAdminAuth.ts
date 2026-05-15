import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface AdminUser { email: string; id: string; }

export function useAdminAuth() {
  const [user, setUser]       = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check Supabase session first
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          setUser({ email: data.session.user.email!, id: data.session.user.id });
        }
        setLoading(false);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ? { email: session.user.email!, id: session.user.id } : null);
      });
      return () => listener.subscription.unsubscribe();
    }

    // Demo mode: check localStorage
    const stored = localStorage.getItem('atema_admin');
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  async function login(email: string, password: string): Promise<string | null> {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    }
    // Demo mode
    if (email === 'admin@atemastudio.com' && password === 'Atema@2024') {
      const u = { email, id: 'demo' };
      localStorage.setItem('atema_admin', JSON.stringify(u));
      setUser(u);
      return null;
    }
    return 'بيانات الدخول غير صحيحة';
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('atema_admin');
    setUser(null);
  }

  return { user, loading, login, logout };
}
