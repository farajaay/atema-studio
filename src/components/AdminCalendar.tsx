// ATEMA STUDIO — Admin Monthly Calendar
// Shows all bookings on their dates + admin-blocked dates.
// Click empty cell -> block dialog; click blocked cell -> unblock.

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Ban, Calendar, X, Loader2 } from 'lucide-react';
// Admin surface — uses the authenticated path so booking_ref + customer_name
// are included for the tooltip/expanded view.
import {
  fetchAdminBookedDates, fetchBlockedDates, blockDate, unblockDate,
  isoDate, monthRange,
} from '../services/calendar';
import type { BookedDate, BlockedDate } from '../services/calendar';

// Theme-aware tokens — values resolve from document CSS custom properties.
const C = {
  ivory:     'var(--a-surface-alt)',
  sand:      'var(--a-border-strong)',
  champagne: 'var(--a-border)',
  bronze:    'var(--a-gold)',
  taupe:     'var(--a-text-soft)',
  mocha:     'var(--a-text)',
  black:     'var(--a-heading)',
};
const ICON_GOLD = '#D4AF7A';

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DAYS_AR   = ['أحد','اثن','ثلا','أرب','خمي','جمع','سبت'];

const STATUS_COLOR: Record<string, string> = {
  pending:   '#d97706',
  confirmed: '#059669',
  completed: '#2563eb',
};

export default function AdminCalendar() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [booked,  setBooked]  = useState<BookedDate[]>([]);
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ date: string; existing?: BlockedDate; bookings?: BookedDate[] } | null>(null);

  async function reload() {
    setLoading(true);
    const { from, to } = monthRange(cursor.year, cursor.month);
    const [bk, bl] = await Promise.all([
      fetchAdminBookedDates(from, to),
      fetchBlockedDates(from, to),
    ]);
    setBooked(bk);
    setBlocked(bl);
    setLoading(false);
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [cursor.year, cursor.month]);

  // Index for fast lookup
  const bookedMap = useMemo(() => {
    const m = new Map<string, BookedDate[]>();
    booked.forEach(b => {
      const arr = m.get(b.date) ?? [];
      arr.push(b);
      m.set(b.date, arr);
    });
    return m;
  }, [booked]);

  const blockedMap = useMemo(
    () => new Map(blocked.map(b => [b.date, b])),
    [blocked]
  );

  const cells = useMemo(() => {
    const first  = new Date(cursor.year, cursor.month, 1);
    const days   = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const offset = first.getDay();
    const arr: (string | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(isoDate(new Date(cursor.year, cursor.month, d)));
    return arr;
  }, [cursor.year, cursor.month]);

  function go(delta: number) {
    setCursor(c => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function openCell(date: string) {
    const existing = blockedMap.get(date);
    const bks = bookedMap.get(date);
    setModal({ date, existing, bookings: bks });
  }

  const today = isoDate(new Date());

  return (
    <div dir="rtl" style={{
      background: 'var(--a-surface)', borderRadius: '14px', padding: '20px 22px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '24px',
      fontFamily: 'Tajawal, Cairo, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.champagne,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} color={ICON_GOLD} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.black, fontSize: '15px' }}>التقويم الشهري</div>
            <div style={{ fontSize: '11px', color: '#888' }}>الحجوزات + الأيام المحجوبة</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => go(-1)} style={navBtn}><ChevronRight size={16} /></button>
          <div style={{
            minWidth: 140, textAlign: 'center', fontFamily: "'Cormorant Garamond', serif",
            color: C.black, fontSize: '1.05rem', fontWeight: 600,
          }}>
            {MONTHS_AR[cursor.month]} {cursor.year}
          </div>
          <button onClick={() => go(1)} style={navBtn}><ChevronLeft size={16} /></button>
          <button onClick={() => setCursor(() => {
            const d = new Date();
            return { year: d.getFullYear(), month: d.getMonth() };
          })} style={{ ...navBtn, width: 'auto', padding: '0 10px', fontSize: '11px' }}>
            اليوم
          </button>
        </div>
      </div>

      {/* Day header */}
      <div style={grid7}>
        {DAYS_AR.map(d => (
          <div key={d} style={{
            fontSize: '11px', color: C.taupe, textAlign: 'center', padding: '6px 0',
            letterSpacing: '0.04em', fontWeight: 600,
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ ...grid7, marginTop: '4px', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
            borderRadius: 8,
          }}>
            <Loader2 size={20} color={ICON_GOLD} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ minHeight: 64 }} />;
          const bks      = bookedMap.get(d);
          const isBlock  = blockedMap.has(d);
          const isToday  = d === today;
          const dayNum   = parseInt(d.slice(-2), 10);
          return (
            <button key={d} onClick={() => openCell(d)}
              style={{
                minHeight: 64, padding: '6px', borderRadius: 10,
                background: isBlock ? 'rgba(220,38,38,0.10)' : bks ? C.ivory : 'var(--a-surface)',
                border: isToday ? `2px solid ${C.bronze}` : `1px solid ${isBlock ? 'rgba(220,38,38,0.35)' : C.champagne}`,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
                display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                transition: 'transform 0.1s, box-shadow 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(140,107,79,0.18)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>

              <div style={{
                fontSize: '13px', fontWeight: 700,
                color: isToday ? C.bronze : isBlock ? '#fca5a5' : C.black,
                marginBottom: '4px',
              }}>{dayNum}</div>

              {isBlock && (
                <div style={{
                  fontSize: '9px', color: '#fca5a5', display: 'flex',
                  alignItems: 'center', gap: 3,
                }}>
                  <Ban size={9} />محجوب
                </div>
              )}

              {bks && bks.slice(0, 2).map(b => (
                <div key={b.booking_ref} style={{
                  fontSize: '9px', color: STATUS_COLOR[b.status] ?? C.taupe,
                  background: 'var(--a-surface)', borderRadius: 4, padding: '1px 4px',
                  marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', border: `1px solid ${(STATUS_COLOR[b.status] ?? C.taupe) + '40'}`,
                }}>
                  ● {b.customer_name}
                </div>
              ))}
              {bks && bks.length > 2 && (
                <div style={{ fontSize: '9px', color: C.taupe }}>+{bks.length - 2}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '12px', paddingTop: '12px', borderTop: `1px dashed ${C.sand}`,
        display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', color: C.taupe,
      }}>
        <span><span style={dot('#d97706')} />قيد الانتظار</span>
        <span><span style={dot('#059669')} />مؤكد</span>
        <span><span style={dot('#2563eb')} />مكتمل</span>
        <span><span style={dot('#DC2626')} />محجوب</span>
        <span style={{ marginInlineStart: 'auto', color: '#888' }}>
          اضغطي على أي يوم لإدارته
        </span>
      </div>

      {modal && (
        <CellModal date={modal.date} existing={modal.existing} bookings={modal.bookings}
          onClose={() => setModal(null)}
          onChanged={async () => { await reload(); setModal(null); }} />
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Cell modal ─────────────────────────────────────────────────────────────────

function CellModal({ date, existing, bookings, onClose, onChanged }: {
  date: string; existing?: BlockedDate; bookings?: BookedDate[];
  onClose: () => void; onChanged: () => void;
}) {
  const [reason, setReason]   = useState('');
  const [busy,   setBusy]     = useState(false);
  const [err,    setErr]      = useState('');

  async function doBlock() {
    if (!reason.trim()) { setErr('الرجاء إدخال السبب'); return; }
    setBusy(true); setErr('');
    const ok = await blockDate(date, reason.trim());
    setBusy(false);
    if (!ok) { setErr('فشل في حجب التاريخ'); return; }
    onChanged();
  }

  async function doUnblock() {
    setBusy(true); setErr('');
    const ok = await unblockDate(date);
    setBusy(false);
    if (!ok) { setErr('فشل في إلغاء الحجب'); return; }
    onChanged();
  }

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('ar-SA', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div dir="rtl" onClick={e => e.stopPropagation()} style={{
        background: 'var(--a-surface)', borderRadius: 14, padding: '22px 22px',
        border: '1px solid var(--a-border-strong)',
        boxShadow: 'var(--a-shadow)',
        width: '100%', maxWidth: 420, fontFamily: 'Tajawal, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: C.bronze, letterSpacing: '0.1em', marginBottom: 4 }}>
              إدارة اليوم
            </div>
            <div style={{ fontFamily: "'Amiri', serif", fontSize: '1.1rem', color: C.black }}>
              {dateLabel}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.taupe }}><X size={18} /></button>
        </div>

        {/* Bookings on this date */}
        {bookings && bookings.length > 0 && (
          <div style={{ marginBottom: 16, background: C.ivory, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: C.bronze, marginBottom: 8, fontWeight: 700 }}>
              الحجوزات في هذا اليوم ({bookings.length})
            </div>
            {bookings.map(b => (
              <div key={b.booking_ref} style={{
                fontSize: 12, color: C.mocha, padding: '5px 0',
                borderBottom: `1px dashed ${C.sand}`,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{b.customer_name}</span>
                <span style={{ color: STATUS_COLOR[b.status] ?? C.taupe, fontSize: 10 }}>
                  ● {b.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {existing ? (
          <>
            <div style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.35)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 4, fontWeight: 700 }}>
                هذا اليوم محجوب
              </div>
              <div style={{ fontSize: 13, color: C.mocha }}>السبب: {existing.reason}</div>
            </div>
            <button onClick={doUnblock} disabled={busy} style={{
              width: '100%', padding: '12px', background: C.bronze, color: '#0B0B0B',
              border: 'none', borderRadius: 10, fontFamily: 'inherit', fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', fontSize: 13,
            }}>
              {busy ? 'جارٍ...' : 'إلغاء الحجب'}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: C.taupe,
                marginBottom: 6, fontWeight: 600 }}>سبب الحجب</label>
              <input value={reason} onChange={e => setReason(e.target.value)}
                placeholder="إجازة، صيانة، إلخ..." style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: `1.5px solid ${C.sand}`, fontSize: 13,
                  fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
                }} />
            </div>
            {err && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>{err}</div>}
            <button onClick={doBlock} disabled={busy} style={{
              width: '100%', padding: '12px', background: C.bronze, color: '#0B0B0B',
              border: 'none', borderRadius: 10, fontFamily: 'inherit', fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Ban size={14} />{busy ? 'جارٍ...' : 'حجب هذا اليوم'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.sand}`,
  background: 'var(--a-surface)', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', color: C.bronze,
  fontFamily: 'inherit', fontWeight: 600, padding: 0,
};

const grid7: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px',
};

function dot(color: string): React.CSSProperties {
  return {
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: color, marginInlineEnd: 4, verticalAlign: 'middle',
  };
}
