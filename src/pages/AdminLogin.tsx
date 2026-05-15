import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { ATEMA_COLORS } from '../config/constants';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export default function AdminLogin() {
  const { user, login, loading } = useAdminAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/admin/dashboard', { replace: true });
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return; }
    setBusy(true); setError('');
    const err = await login(email, password);
    if (err) { setError(err); setBusy(false); }
    else navigate('/admin/dashboard', { replace: true });
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '12px 14px 12px 44px', border: '1.5px solid #e8e0d8',
    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', background: 'white', transition: 'border-color 0.2s',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: ATEMA_COLORS.softIvory }}>
      <Loader2 size={36} color={ATEMA_COLORS.champagne} style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${ATEMA_COLORS.softIvory} 0%, #ede5db 100%)`,
      fontFamily: 'Cairo, Tajawal, Inter, sans-serif', padding: '20px' }}>

      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '4px', color: ATEMA_COLORS.deepBronze }}>
            ATEMA STUDIO
          </div>
          <div style={{ fontSize: '13px', color: '#999', marginTop: '6px', letterSpacing: '1px' }}>
            لوحة تحكم الإدارة
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '36px 32px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px',
              background: `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: ATEMA_COLORS.editorialBlack }}>تسجيل الدخول</div>
              <div style={{ fontSize: '12px', color: '#999' }}>للمسؤولين فقط</div>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff5f5',
              border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px',
              marginBottom: '20px', fontSize: '13px', color: '#dc2626' }}>
              <AlertCircle size={15} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600,
                color: '#555', marginBottom: '7px' }}>البريد الإلكتروني</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#bbb" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@atemastudio.com" dir="ltr" style={{ ...input, paddingRight: '44px', paddingLeft: '14px' }} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600,
                color: '#555', marginBottom: '7px' }}>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#bbb" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" dir="ltr" style={{ ...input, paddingRight: '44px', paddingLeft: '44px' }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showPw ? <EyeOff size={15} color="#bbb" /> : <Eye size={15} color="#bbb" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy} style={{
              width: '100%', padding: '13px',
              background: busy ? '#e0c9b8' : `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
              color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px',
              fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {busy ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />جاري الدخول...</> : 'دخول'}
            </button>
          </form>
        </div>

        {/* Demo hint */}
        {!import.meta.env.VITE_SUPABASE_URL && (
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#aaa' }}>
            وضع العرض · admin@atemastudio.com / Atema@2024
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <a href="#/" style={{ fontSize: '13px', color: ATEMA_COLORS.champagne, textDecoration: 'none' }}>
            ← العودة للموقع
          </a>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
