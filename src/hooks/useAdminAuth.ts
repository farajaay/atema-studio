import { useState, useEffect } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export interface AdminUser { email: string; id: string; }

/**
 * Translate Supabase auth errors into actionable Arabic copy.
 * Falls back to the raw English message for anything we haven't classified
 * — better to show real text than a useless generic.
 */
function translateAuthError(error: AuthError): string {
  const msg  = (error.message || '').toLowerCase();
  const code = ((error as { code?: string }).code || '').toLowerCase();

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'بيانات الدخول غير صحيحة. تأكد من البريد وكلمة المرور، أو من إنشاء المستخدم في Supabase Authentication → Users.';
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'الحساب لم يُؤكَّد بعد. افتح Supabase → Authentication → Users → اضغط على الحساب → Confirm.';
  }
  if (code === 'user_not_found' || msg.includes('user not found')) {
    return 'لا يوجد مستخدم بهذا البريد. أنشئ الحساب من Supabase → Authentication → Add user.';
  }
  if (msg.includes('rate limit') || code === 'over_request_rate_limit') {
    return 'محاولات كثيرة متتالية. انتظر دقيقة ثم أعد المحاولة.';
  }
  if (msg.includes('invalid api key') || msg.includes('invalid jwt')) {
    return 'مفتاح Supabase غير صالح. تحقق من VITE_SUPABASE_ANON_KEY في ملف .env (نسخه من Supabase → Settings → API).';
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'تعذّر الاتصال بـ Supabase. تأكد من أن المشروع نشط (ليس Paused) وأن VITE_SUPABASE_URL صحيح.';
  }
  return `خطأ من Supabase: ${error.message}`;
}

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
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Always log the raw error for DevTools debugging.
          console.error('[admin login] supabase auth error', {
            status: error.status,
            name:   error.name,
            code:   (error as { code?: string }).code,
            message: error.message,
          });
          return translateAuthError(error);
        }
        if (!data.session) {
          // No error but no session either — typically means email-confirm pending.
          return 'لم يتم تأكيد البريد الإلكتروني للحساب بعد. تحقق من إعدادات Supabase Auth أو فعّل الحساب من لوحة Supabase.';
        }
        return null;
      } catch (e: unknown) {
        // Network / CORS / project-paused failures land here.
        console.error('[admin login] network / unexpected error', e);
        const msg = e instanceof Error ? e.message : String(e);
        return `تعذّر الاتصال بالخادم. تحقّق من اتصال الإنترنت ومن أن مشروع Supabase نشط. (${msg})`;
      }
    }
    // Demo mode (no Supabase env vars at build time)
    if (email === 'admin@atemastudio.com' && password === 'Atema@2024') {
      const u = { email, id: 'demo' };
      localStorage.setItem('atema_admin', JSON.stringify(u));
      setUser(u);
      return null;
    }
    return 'وضع العرض: استخدم admin@atemastudio.com / Atema@2024';
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('atema_admin');
    setUser(null);
  }

  return { user, loading, login, logout };
}
