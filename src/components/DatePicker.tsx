// ATEMA STUDIO — Customer Date Picker
// Month-grid calendar that disables past, booked, and admin-blocked dates.
// Bilingual (ar/en). Brand-aligned styling, no external deps.

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { fetchBookedDates, fetchBlockedDates, isoDate } from '../services/calendar';

type Lang = 'ar' | 'en';
const tx = (l: Lang, ar: string, en: string) => l === 'ar' ? ar : en;

const C = {
  ivory:'#F5EDE4', sand:'#D6BFA3', champagne:'#E8D9C5',
  bronze:'#8C6B4F', taupe:'#6B5440', mocha:'#4A3728', black:'#1A1A1A',
};

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_AR   = ['أحد','اثن','ثلا','أرب','خمي','جمع','سبت'];
const DAYS_EN   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

interface Props {
  lang:      Lang;
  value:     string;                    // 'YYYY-MM-DD' or ''
  onChange:  (date: string) => void;
  minDate?:  string;                    // default = today
  className?: string;
  placeholder?: string;
}

export default function DatePicker({ lang, value, onChange, minDate, placeholder }: Props) {
  const today = isoDate(new Date());
  const minD  = minDate ?? today;

  const [open, setOpen]   = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [bookedSet,  setBookedSet]  = useState<Set<string>>(new Set());
  const [blockedMap, setBlockedMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch booked + blocked dates for the visible month (and a window around it)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const start = new Date(cursor.year, cursor.month - 1, 1);
    const end   = new Date(cursor.year, cursor.month + 2, 0);
    Promise.all([
      fetchBookedDates(isoDate(start), isoDate(end)),
      fetchBlockedDates(isoDate(start), isoDate(end)),
    ]).then(([booked, blocked]) => {
      if (!alive) return;
      setBookedSet(new Set(booked.map(b => b.date)));
      setBlockedMap(new Map(blocked.map(b => [b.date, b.reason])));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [cursor.year, cursor.month]);

  const monthsNames = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const dayNames    = lang === 'ar' ? DAYS_AR   : DAYS_EN;

  // Build calendar grid cells (leading blanks + days of month)
  const cells = useMemo(() => {
    const first  = new Date(cursor.year, cursor.month, 1);
    const days   = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const offset = first.getDay(); // 0..6 (Sunday=0)
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

  function pick(d: string | null) {
    if (!d) return;
    if (d < minD) return;
    if (bookedSet.has(d) || blockedMap.has(d)) return;
    onChange(d);
    setOpen(false);
  }

  // Trigger button display value
  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB',
        { day: '2-digit', month: 'short', year: 'numeric' })
    : (placeholder ?? tx(lang, 'اختاري التاريخ', 'Select date'));

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="atema-input atema-input-ltr"
        style={{
          width: '100%', textAlign: lang === 'ar' ? 'right' : 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'white', cursor: 'pointer', color: value ? C.black : '#999',
          gap: '8px', fontFamily: 'inherit',
        }}>
        <span>{display}</span>
        <CalendarIcon size={16} color={C.bronze} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'transparent' }} />

          {/* Popover */}
          <div dir={lang === 'ar' ? 'rtl' : 'ltr'}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)',
              left: lang === 'ar' ? 'auto' : 0,
              right: lang === 'ar' ? 0 : 'auto',
              zIndex: 999, background: 'white',
              borderRadius: '14px', padding: '14px',
              boxShadow: '0 12px 36px rgba(140,107,79,0.22)',
              border: `1px solid ${C.sand}`,
              width: '320px', maxWidth: 'calc(100vw - 24px)',
            }}>

            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '10px' }}>
              <button type="button" onClick={() => go(-1)}
                style={navBtn}>{lang === 'ar' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', color: C.black,
                fontWeight: 600,
              }}>
                {monthsNames[cursor.month]} {cursor.year}
              </div>
              <button type="button" onClick={() => go(1)}
                style={navBtn}>{lang === 'ar' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>
            </div>

            {/* Day header */}
            <div style={gridCss}>
              {dayNames.map(d => (
                <div key={d} style={{
                  fontSize: '0.66rem', textAlign: 'center', color: C.taupe,
                  letterSpacing: '0.06em', padding: '4px 0', textTransform: 'uppercase',
                }}>{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div style={{ ...gridCss, marginTop: '4px' }}>
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const past    = d < minD;
                const booked  = bookedSet.has(d);
                const blocked = blockedMap.has(d);
                const sel     = d === value;
                const disabled = past || booked || blocked;
                const day = parseInt(d.slice(-2), 10);
                return (
                  <button key={d} type="button" onClick={() => pick(d)} disabled={disabled}
                    title={blocked ? blockedMap.get(d) : booked ? tx(lang, 'محجوز', 'Booked') : ''}
                    style={{
                      ...dayBtn,
                      background: sel ? C.bronze : disabled ? '#FAFAFA' : 'white',
                      color: sel ? 'white' : past ? '#CCC' : (booked || blocked) ? '#BBB' : C.black,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      textDecoration: (booked || blocked) ? 'line-through' : 'none',
                      border: sel
                        ? `1px solid ${C.bronze}`
                        : booked ? `1px dashed #E5B8B8`
                        : blocked ? `1px dashed ${C.sand}`
                        : `1px solid transparent`,
                    }}>
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              marginTop: '10px', paddingTop: '10px', borderTop: `1px dashed ${C.sand}`,
              display: 'flex', gap: '12px', justifyContent: 'center',
              fontSize: '0.66rem', color: C.taupe, flexWrap: 'wrap',
            }}>
              <span><span style={legendDot(C.bronze)} />{tx(lang, 'مختار', 'Selected')}</span>
              <span><span style={legendDot('#E5B8B8', true)} />{tx(lang, 'محجوز', 'Booked')}</span>
              <span><span style={legendDot(C.sand, true)} />{tx(lang, 'غير متاح', 'Blocked')}</span>
            </div>

            {loading && (
              <div style={{
                position: 'absolute', top: 8, left: 12, right: 12, textAlign: 'center',
                fontSize: '0.65rem', color: C.taupe,
              }}>{tx(lang, 'جارٍ التحميل...', 'Loading...')}</div>
            )}

            <button type="button" onClick={() => setOpen(false)}
              style={{ position: 'absolute', top: 8, left: lang === 'ar' ? 8 : 'auto',
                right: lang === 'ar' ? 'auto' : 8,
                background: 'none', border: 'none', cursor: 'pointer', color: C.taupe, padding: 2 }}>
              <X size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.sand}`,
  background: 'white', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', color: C.bronze,
};

const gridCss: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px',
};

const dayBtn: React.CSSProperties = {
  height: 34, borderRadius: 8, fontSize: '0.82rem', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s, transform 0.1s',
};

function legendDot(color: string, dashed = false): React.CSSProperties {
  return {
    display: 'inline-block', width: 8, height: 8, borderRadius: 2,
    background: dashed ? 'transparent' : color,
    border: dashed ? `1px dashed ${color}` : 'none',
    marginInlineEnd: 4, verticalAlign: 'middle',
  };
}
