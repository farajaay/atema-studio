// ATEMA STUDIO — Visitor analytics ("الزيارات") admin view.
//
// Lives inside AdminDashboard.tsx as a section-tab, the same shape as the
// P&L dashboard. Reads public.site_visits (first-party, privacy-first —
// see src/services/analytics.ts) and shows:
//   - KPI strip: pageviews, sessions, sessions that reached /book (+% of
//     sessions), bookings created in the period (conversion of book-reachers)
//   - CSS bar chart of daily visits (same idiom as StudioPLDashboard.Chart)
//   - Tables: top pages, departure (exit) pages, referrer hosts
// Shows a setup banner until migrations-2026-07-analytics.sql is applied.

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck, Eye, Loader2, LogIn, TrendingUp, Users,
} from 'lucide-react';
import type { Booking } from '../hooks/useAdminData';
import {
  aggregateVisits, fetchVisits, pathLabel,
  type CountEntry, type VisitRow,
} from '../services/analytics';

const num = (n: number) => n.toLocaleString('ar-SA');
const pctOf = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}٪` : '—';

// ── KPI card (mirrors StudioPLDashboard.KPI) ───────────────────────────────
function KPI({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div style={{
      background: 'var(--a-surface)', borderRadius: 12,
      padding: '18px 20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid var(--a-border)',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--a-text-soft)', marginBottom: 8, fontWeight: 500 }}>
            {label}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--a-heading)', lineHeight: 1.05 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 11, color: 'var(--a-text-muted)', marginTop: 6 }}>{sub}</div>
          )}
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: color + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
      </div>
    </div>
  );
}

// ── Daily-visits bar chart (single series — same idiom as the P&L chart) ──
function DailyChart({ daily }: { daily: { date: string; views: number }[] }) {
  const max = Math.max(1, ...daily.map(d => d.views));
  const total = daily.reduce((s, d) => s + d.views, 0);
  if (total === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--a-text-muted)', fontSize: 13 }}>
        لا توجد زيارات مسجّلة في هذه الفترة بعد
      </div>
    );
  }
  // 90 days won't fit labeled 56px columns — thin the labels, keep the bars.
  const labelEvery = daily.length > 35 ? 7 : daily.length > 10 ? 2 : 1;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: daily.length > 35 ? 3 : 8,
      padding: '20px 0 10px', minHeight: 200, overflowX: 'auto',
    }}>
      {daily.map((d, i) => {
        const h = Math.max(2, (d.views / max) * 170);
        return (
          <div key={d.date} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minWidth: daily.length > 35 ? 8 : 26, flex: '1 0 auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 170, width: '100%' }}>
              <div title={`${d.date} — ${num(d.views)} مشاهدة`}
                style={{
                  width: '100%', height: h,
                  background: 'linear-gradient(to top, #8C6B4F, #D4AF7A)',
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 0.3s ease',
                }} />
            </div>
            <div style={{
              fontSize: 9, color: 'var(--a-text-muted)', marginTop: 6,
              textAlign: 'center', lineHeight: 1.2, fontFamily: 'Inter, sans-serif',
              visibility: i % labelEvery === 0 ? 'visible' : 'hidden',
              whiteSpace: 'nowrap',
            }}>
              {d.date.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Ranked count table (top pages / exit pages / referrers) ───────────────
function RankTable({ title, entries, total, labelFor, emptyText }: {
  title: string; entries: CountEntry[]; total: number;
  labelFor?: (key: string) => string; emptyText: string;
}) {
  const top = entries.slice(0, 8);
  return (
    <div style={{
      background: 'var(--a-surface)', borderRadius: 12, padding: '18px 20px',
      border: '1px solid var(--a-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-heading)', marginBottom: 12 }}>
        {title}
      </div>
      {top.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--a-text-muted)', padding: '12px 0' }}>{emptyText}</div>
      ) : top.map(e => {
        const share = total > 0 ? e.count / total : 0;
        return (
          <div key={e.key} style={{ marginBottom: 10 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, color: 'var(--a-text)', marginBottom: 4,
            }}>
              <span>{labelFor ? labelFor(e.key) : e.key}
                <span style={{ color: 'var(--a-text-muted)', fontSize: 10, marginInlineStart: 6, fontFamily: 'Inter, sans-serif' }}>
                  {labelFor ? e.key : ''}
                </span>
              </span>
              <span style={{ fontWeight: 700 }}>{num(e.count)}
                <span style={{ color: 'var(--a-text-muted)', fontWeight: 400, marginInlineStart: 4 }}>
                  ({Math.round(share * 100)}٪)
                </span>
              </span>
            </div>
            <div style={{ height: 5, background: 'var(--a-surface-alt)', borderRadius: 3 }}>
              <div style={{
                height: 5, width: `${Math.max(2, share * 100)}%`,
                background: 'linear-gradient(to left, #8C6B4F, #D4AF7A)',
                borderRadius: 3, transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────
const PERIODS = [
  { days: 7,  label: '٧ أيام'  },
  { days: 30, label: '٣٠ يوماً' },
  { days: 90, label: '٩٠ يوماً' },
] as const;

export default function VisitorAnalytics({ bookings }: { bookings: Booking[] }) {
  const [days, setDays] = useState<number>(30);
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchVisits(days).then(res => {
      if (cancelled) return;
      setRows(res.rows);
      setConfigured(res.configured);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [days]);

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => aggregateVisits(rows, days, today), [rows, days, today]);

  const bookingsInPeriod = useMemo(() => {
    const since = Date.now() - days * 86400_000;
    return bookings.filter(b => new Date(b.created_at).getTime() >= since).length;
  }, [bookings, days]);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={28} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      {!configured && (
        <div style={{
          background: 'rgba(212,175,122,0.12)', border: '1px solid var(--a-gold)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          fontSize: 13, color: 'var(--a-text)', lineHeight: 1.9,
        }}>
          <strong>تتبّع الزيارات غير مفعّل بعد.</strong>{' '}
          شغّلي ملف <code dir="ltr" style={{ fontFamily: 'Inter, monospace', fontSize: 12 }}>
          database/migrations-2026-07-analytics.sql</code> في محرّر SQL في Supabase
          (أو عبر workflow «supabase-migrations») وستبدأ الإحصاءات بالتجمّع تلقائياً.
          الموقع يعمل كالمعتاد في الحالتين.
        </div>
      )}

      {/* Period pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {PERIODS.map(p => {
          const active = days === p.days;
          return (
            <button key={p.days} onClick={() => setDays(p.days)} style={{
              padding: '7px 16px', borderRadius: 20,
              border: active ? '1px solid transparent' : '1px solid var(--a-border)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              background: active ? 'var(--a-gold)' : 'var(--a-surface-alt)',
              color: active ? '#0B0B0B' : 'var(--a-text-soft)',
              boxShadow: active ? '0 2px 8px rgba(212,175,122,0.35)' : 'none',
              transition: 'all 0.2s',
            }}>{p.label}</button>
          );
        })}
      </div>

      {/* KPI strip */}
      <div style={{
        display: 'grid', gap: 14, marginBottom: 20,
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      }}>
        <KPI label="المشاهدات" value={num(stats.views)}
          sub="إجمالي مرات فتح الصفحات"
          icon={<Eye size={18} color="#D4AF7A" />} color="#D4AF7A" />
        <KPI label="الجلسات" value={num(stats.sessions)}
          sub="زيارات مميزة (لكل تبويب متصفح)"
          icon={<Users size={18} color="#2563eb" />} color="#2563eb" />
        <KPI label="وصلن لصفحة الحجز" value={num(stats.bookSessions)}
          sub={`${pctOf(stats.bookSessions, stats.sessions)} من الجلسات`}
          icon={<LogIn size={18} color="#7c3aed" />} color="#7c3aed" />
        <KPI label="حجوزات الفترة" value={num(bookingsInPeriod)}
          sub={stats.bookSessions > 0
            ? `تحويل ${pctOf(bookingsInPeriod, stats.bookSessions)} ممن وصلن للحجز`
            : 'لا جلسات حجز في الفترة'}
          icon={<CalendarCheck size={18} color="#059669" />} color="#059669" />
      </div>

      {/* Daily visits chart */}
      <div style={{
        background: 'var(--a-surface)', borderRadius: 12, padding: '18px 20px',
        border: '1px solid var(--a-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        marginBottom: 20,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--a-heading)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <TrendingUp size={15} color="#D4AF7A" /> المشاهدات اليومية
        </div>
        <DailyChart daily={stats.daily} />
      </div>

      {/* Ranked tables */}
      <div style={{
        display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      }}>
        <RankTable title="أكثر الصفحات زيارة" entries={stats.topPages}
          total={stats.views} labelFor={pathLabel}
          emptyText="لا بيانات بعد" />
        <RankTable title="صفحات المغادرة" entries={stats.exitPages}
          total={stats.sessions} labelFor={pathLabel}
          emptyText="لا بيانات بعد" />
        <RankTable title="مصادر الزيارات" entries={stats.referrers}
          total={stats.referrers.reduce((s, r) => s + r.count, 0)}
          emptyText="كل الزيارات مباشرة حتى الآن" />
      </div>

      {/* Privacy footnote — what this table does and doesn't collect */}
      <div style={{
        fontSize: 11, color: 'var(--a-text-muted)', marginTop: 16, lineHeight: 1.9,
      }}>
        إحصاءات ذاتية الاستضافة: بدون عناوين IP، بدون بصمات أجهزة، بدون كوكيز —
        فقط مسار الصفحة (روابط العميلات الخاصة تُحفظ كنوع الصفحة دون الرمز السري)،
        ومصدر الزيارة كاسم نطاق. تصفّحك وأنتِ مسجّلة الدخول لا يُحتسب.
      </div>
    </div>
  );
}
