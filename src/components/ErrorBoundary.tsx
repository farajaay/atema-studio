// ATEMA STUDIO — last line of defence for the render tree.
//
// Without a boundary React unmounts the whole tree on any throw, and since
// <body> carries the theme background the result is a silent black page —
// indistinguishable from a dead site. This catches the throw and says what
// happened, in the Atelier voice, with the one action that usually fixes it.

import React from 'react';

interface Props  { children: React.ReactNode }
interface State  { error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Production is console-stripped; this survives only in dev builds, which
    // is where a developer is actually watching.
    console.error('[ATEMA] render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div dir="rtl" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '18px',
        padding: '32px', textAlign: 'center',
        background: 'var(--a-bg)', color: 'var(--a-text)',
        fontFamily: 'Tajawal, sans-serif',
      }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.8rem',
          letterSpacing: '0.3em', color: 'var(--a-gold)' }}>
          ATEMA STUDIO
        </div>
        <div style={{ fontFamily: "'Amiri', serif", fontSize: '1.15rem',
          color: 'var(--a-heading)', lineHeight: 1.9, maxWidth: '30rem' }}>
          تعذّر عرض هذه الصفحة.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--a-text-soft)',
          lineHeight: 1.9, maxWidth: '28rem' }}>
          غالباً نسخة قديمة محفوظة في المتصفّح. أعيدي التحميل — ستُجلب النسخة
          الحالية من الموقع.
        </div>
        <button onClick={() => window.location.reload()}
          style={{
            padding: '11px 26px', borderRadius: '9px', cursor: 'pointer',
            background: 'var(--a-gold)', color: '#0B0B0B', border: 'none',
            fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: '0.9rem',
          }}>
          إعادة التحميل
        </button>
        <div style={{ fontSize: '0.7rem', color: 'var(--a-text-muted)',
          fontFamily: "'Inter', monospace", direction: 'ltr', maxWidth: '32rem',
          wordBreak: 'break-word' }}>
          {this.state.error.message}
        </div>
      </div>
    );
  }
}
