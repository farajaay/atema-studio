import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

// Theme-aware via document CSS vars (var(--a-*)) set by useTheme().
export default function AdminLogin() {
  const { user, login, loading } = useAdminAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

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
    width: '100%', padding: '12px 14px 12px 44px',
    border: '1.5px solid var(--a-border)',
    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: 'var(--a-surface-alt)',
    color: 'var(--a-text)',
    transition: 'border-color 0.2s',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--a-bg)' }}>
      <Loader2 size={36} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--a-bg)',
      fontFamily: 'Montserrat, Tajawal, Inter, sans-serif', padding: '20px' }}>

      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: '26px', fontWeight: 300,
            letterSpacing: '0.32em', color: 'var(--a-gold)' }}>
            ATEMA STUDIO
          </div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: '11px', color: 'var(--a-text-soft)',
            marginTop: '8px', letterSpacing: '0.42em' }}>
            ADMIN PANEL
          </div>
        </div>

        <div style={{ background: 'var(--a-surface)', borderRadius: '14px', padding: '36px 32px',
          border: '1px solid var(--a-border)',
          boxShadow: 'var(--a-shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--a-gold), var(--a-gold-deep))',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color="#0B0B0B" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--a-heading)' }}>تسجيل الدخول</div>
              <div style={{ fontSize: '12px', color: 'var(--a-text-soft)' }}>للمسؤولين فقط</div>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.32)',
              borderRadius: '8px', padding: '12px 14px',
              marginBottom: '20px', fontSize: '13px', color: '#fca5a5' }}>
              <AlertCircle size={15} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500,
                color: 'var(--a-text-soft)', marginBottom: '7px', letterSpacing: '0.04em' }}>البريد الإلكتروني</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#9C8E76" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@atemastudio.com" dir="ltr" style={{ ...input, paddingRight: '44px', paddingLeft: '14px' }} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500,
                color: 'var(--a-text-soft)', marginBottom: '7px', letterSpacing: '0.04em' }}>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#9C8E76" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" dir="ltr" style={{ ...input, paddingRight: '44px', paddingLeft: '44px' }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showPw ? <EyeOff size={15} color="#9C8E76" /> : <Eye size={15} color="#9C8E76" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy} style={{
              width: '100%', padding: '13px',
              background: busy ? 'var(--a-surface-alt)' : 'linear-gradient(135deg, var(--a-gold), var(--a-gold-deep))',
              color: busy ? 'var(--a-text-muted)' : '#0B0B0B',
              border: 'none', borderRadius: '8px', fontSize: '14px',
              fontWeight: 600, letterSpacing: '0.08em',
              cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {busy ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />جاري الدخول...</> : 'دخول'}
            </button>
          </form>
        </div>

        {/* Demo hint */}
        {!import.meta.env.VITE_SUPABASE_URL && (
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--a-text-muted)' }}>
            وضع العرض · admin@atemastudio.com / Atema@2024
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <a href="#/" style={{ fontSize: '13px', color: 'var(--a-gold)', textDecoration: 'none',
            letterSpacing: '0.04em' }}>
            ← العودة للموقع
          </a>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
