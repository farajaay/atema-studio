// ATEMA STUDIO — Admin: album-selection composer (booking-modal tab).
//
// Phase 1 of the album feature (docs/plans/album-selection.md). Lets Fatima:
//   • release the album-selection link for a booking (manual, post-event),
//   • copy / send that private link over WhatsApp or email,
//   • see the cover the bride chose (final once confirmed).
//
// The bride's page (/#/album/<token>) is Phase 2 — not built yet; this tab
// already produces a working link so the flow can be exercised end-to-end
// once the page ships.

import { useEffect, useState, useCallback } from 'react';
import type { Booking } from '../hooks/useAdminData';
import AlbumCoverExample from './AlbumCoverExample';
import {
  getBookingAlbum, releaseAlbum, fetchAllDesigns, buildAlbumUrl,
  type AlbumDesign,
} from '../services/album';
import {
  BookOpen, Link2, Copy, Check, Send, Mail, Loader2, Lock, Unlock, Clock,
} from 'lucide-react';

interface Props { booking: Booking; }

interface AlbumState {
  album_token: string | null;
  album_design_id: string | null;
  album_note: string | null;
  album_selected_at: string | null;
  album_released_at: string | null;
}

export default function AlbumComposer({ booking }: Props) {
  const [state,   setState]   = useState<AlbumState | null>(null);
  const [designs, setDesigns] = useState<AlbumDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [copied,  setCopied]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, d] = await Promise.all([getBookingAlbum(booking.id), fetchAllDesigns()]);
    setState(a as AlbumState | null);
    setDesigns(d);
    setLoading(false);
  }, [booking.id]);
  useEffect(() => { load(); }, [load]);

  const eventPassed = booking.event_date < new Date().toISOString().slice(0, 10);
  const released = !!state?.album_released_at;
  const chosen   = designs.find(d => d.id === state?.album_design_id) ?? null;
  const url      = state?.album_token ? buildAlbumUrl(state.album_token) : '';

  async function onRelease() {
    setBusy(true);
    await releaseAlbum(booking.id);
    setBusy(false);
    load();
  }

  function copyLink() {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  function sendWa() {
    const digits = (booking.customer_phone || '').replace(/\D/g, '');
    const phone  = digits.startsWith('0')   ? '966' + digits.slice(1)
                 : digits.startsWith('966') ? digits
                 : digits.startsWith('5')   ? '966' + digits : digits;
    const msg = encodeURIComponent(
      `مرحباً ${booking.customer_name} 🤍\n\n` +
      `حان وقت اختيار غلاف ألبومك. اختاري التصميم الذي يمثّلكِ من هنا:\n${url}\n\nبكل حب،\nأتيما`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener,noreferrer');
  }

  function sendEmail() {
    const subject = encodeURIComponent(`اختيار غلاف ألبومك — ${booking.booking_ref}`);
    const body = encodeURIComponent(
      `مرحباً ${booking.customer_name}،\n\n` +
      `يسعدنا أن نشاركك رابط اختيار غلاف ألبومك:\n${url}\n\n` +
      `اختاري التصميم الذي يمثّلكِ، والاختيار نهائي بعد التأكيد.\n\nبكل حب،\nأتيما`
    );
    window.open(`mailto:${booking.customer_email ?? ''}?subject=${subject}&body=${body}`, '_blank');
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={26} className="spin" color="#D4AF7A" /></div>;

  return (
    <div dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--a-text)' }}>
        <BookOpen size={16} color="#D4AF7A" />
        <span style={{ fontWeight: 700 }}>اختيار غلاف الألبوم لـ {booking.customer_name}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--a-text-muted)', lineHeight: 1.7, marginBottom: 18 }}>
        بعد المناسبة، افتحي الاختيار وأرسلي الرابط للعروس لتختار غلافها من اللوحة.
      </p>

      {/* Status chip */}
      <StatusRow eventPassed={eventPassed} released={released} chosen={!!chosen} eventDate={booking.event_date} />

      {/* Chosen design */}
      {chosen && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', border: '1px solid var(--a-border)',
          borderRadius: 12, padding: 12, margin: '14px 0', background: 'var(--a-surface-alt, var(--a-surface))' }}>
          <AlbumCoverExample design={chosen} size="tile" emboss={false}
            style={{ width: 54, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: '#D4AF7A', fontWeight: 700 }}>اختيار العروس ✓</div>
            <div style={{ fontWeight: 700, color: 'var(--a-text)' }}>{chosen.name_ar} · {chosen.code}</div>
            <div style={{ fontSize: 12, color: 'var(--a-text-muted)' }}>{chosen.name_en} — {chosen.material === 'leather' ? 'جلد' : 'قماش'}</div>
            {state?.album_note && <div style={{ fontSize: 12, color: 'var(--a-text-muted)', marginTop: 4 }}>“{state.album_note}”</div>}
          </div>
        </div>
      )}

      {/* Actions */}
      {!released ? (
        <button onClick={onRelease} disabled={busy} style={btnPrimary}>
          {busy ? <Loader2 size={15} className="spin" /> : <Unlock size={15} />}
          فتح الاختيار وإرسال الرابط
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--a-border)',
            borderRadius: 9, padding: '8px 10px', marginBottom: 10 }}>
            <Link2 size={14} color="var(--a-text-muted)" />
            <input readOnly value={url} style={{ flex: 1, border: 'none', background: 'none',
              color: 'var(--a-text)', fontSize: 12, direction: 'ltr', textAlign: 'left', outline: 'none' }} />
            <button onClick={copyLink} title="نسخ" style={iconBtn}>{copied ? <Check size={14} color="#1E7F5C" /> : <Copy size={14} />}</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={sendWa} style={{ ...btnGhost, flex: 1 }}><Send size={14} /> واتساب</button>
            <button onClick={sendEmail} disabled={!booking.customer_email} style={{ ...btnGhost, flex: 1, opacity: booking.customer_email ? 1 : 0.5 }}>
              <Mail size={14} /> بريد
            </button>
          </div>
          {!booking.customer_email && (
            <p style={{ fontSize: 11, color: 'var(--a-text-muted)', marginTop: 6 }}>لا يوجد بريد مسجّل — استخدمي واتساب.</p>
          )}
        </>
      )}

      <p style={{ fontSize: 11, color: 'var(--a-text-muted)', marginTop: 16, lineHeight: 1.7 }}>
        اللوحة تُدار من <b>الإعدادات ← أغلفة الألبوم</b>. صفحة العروس (المرحلة الثانية) قيد الإعداد؛
        الرابط جاهز ويعمل بمجرد نشر الصفحة.
      </p>
    </div>
  );
}

function StatusRow({ eventPassed, released, chosen, eventDate }: {
  eventPassed: boolean; released: boolean; chosen: boolean; eventDate: string;
}) {
  const [icon, text, color] =
    chosen        ? [<Lock size={13} key="l" />,  'تم الاختيار — نهائي', '#1E7F5C'] :
    released      ? [<Unlock size={13} key="u" />, 'مفتوح للاختيار — بانتظار العروس', '#D4AF7A'] :
    eventPassed   ? [<Clock size={13} key="c" />,  'المناسبة انقضت — جاهز للفتح', 'var(--a-text-muted)'] :
                    [<Clock size={13} key="c2" />, `يُفتح بعد المناسبة (${eventDate})`, 'var(--a-text-muted)'];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
      color: color as string, background: 'var(--a-bg)', border: '1px solid var(--a-border)',
      borderRadius: 20, padding: '5px 12px' }}>
      {icon}{text}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px',
  borderRadius: 10, border: 'none', background: 'var(--a-gold)', color: '#0B0B0B', fontWeight: 700,
  fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
};
const btnGhost: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px',
  borderRadius: 9, border: '1px solid var(--a-border)', background: 'none', color: 'var(--a-text)',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
const iconBtn: React.CSSProperties = {
  display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--a-text-muted)', padding: 3,
};
