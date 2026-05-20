// ATEMA STUDIO — Studio-wide P&L dashboard
//
// Lives inside AdminDashboard.tsx as a section-tab ("الأرباح والخسائر").
// Aggregates all booking rows that meet the P&L revenue rule
// (see src/services/pnl.ts → isPLRevenueBooking) into monthly / quarterly
// / yearly buckets, with a per-package breakdown inside each bucket.
//
// Output:
//   - 4 KPI cards (grand totals across the selected scope)
//   - CSS-only stacked bar chart of revenue + true profit per bucket
//   - Bucket table with click-to-expand per-package rows
//   - All-time per-package summary at the bottom

import { useMemo, useState } from 'react';
import {
  CalendarRange, Calendar as CalIcon, ChevronDown, ChevronUp,
  Coins, Loader2, Package as PackageIcon, TrendingUp,
} from 'lucide-react';
import type { Booking } from '../hooks/useAdminData';
import { ATEMA_COLORS } from '../config/constants';
import {
  aggregateMonthly, labelForPeriod, PACKAGE_NAME_AR, PACKAGE_NAME_EN,
  rollupBy, totalSummary,
  type Period, type PeriodAggregate,
} from '../services/pnl';

const sar = (n: number) =>
  `${Math.round(n).toLocaleString('ar-SA')} ر.س`;

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

// Colour ramp for margin %: red < 0, amber 0..15, green > 15
function marginColour(p: number): string {
  if (p < 0)   return '#dc2626';
  if (p < 15)  return '#d97706';
  return '#059669';
}

// ── KPI card ───────────────────────────────────────────────────────────
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

// ── Two-bar chart (revenue + true profit, side-by-side per bucket) ─────
function Chart({ rows }: { rows: PeriodAggregate[] }) {
  const max = Math.max(1, ...rows.map(r => Math.max(r.revenueExVat, Math.abs(r.trueProfit))));
  if (rows.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--a-text-muted)', fontSize: 13 }}>
        لا توجد بيانات لعرضها
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 12,
      padding: '20px 0 10px', minHeight: 200, overflowX: 'auto',
    }}>
      {rows.map(r => {
        const revH    = Math.max(2, (r.revenueExVat / max) * 170);
        const profH   = Math.max(2, (Math.abs(r.trueProfit) / max) * 170);
        const profNeg = r.trueProfit < 0;
        return (
          <div key={r.period} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minWidth: 56, flex: '0 0 auto',
          }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 170 }}>
              <div title={`الإيرادات ${sar(r.revenueExVat)}`}
                style={{
                  width: 18, height: revH,
                  background: 'linear-gradient(to top, #8C6B4F, #D4AF7A)',
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 0.3s ease',
                }} />
              <div title={`الربح الحقيقي ${sar(r.trueProfit)}`}
                style={{
                  width: 18, height: profH,
                  background: profNeg
                    ? 'linear-gradient(to top, #fecaca, #fca5a5)'
                    : 'linear-gradient(to top, #047857, #059669)',
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 0.3s ease',
                }} />
            </div>
            <div style={{
              fontSize: 9, color: 'var(--a-text-muted)', marginTop: 6,
              writingMode: 'horizontal-tb', textAlign: 'center',
              lineHeight: 1.2, fontFamily: 'Inter, sans-serif',
            }}>
              {r.period.replace(/^\d{4}-/, '').replace(/^Q/, 'Q')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Bucket-row with expand-on-click for per-package breakdown ──────────
function BucketRow({ row, expanded, onToggle }: {
  row: PeriodAggregate; expanded: boolean; onToggle: () => void;
}) {
  const colorM = marginColour(row.marginPct);
  const packageRows = Object.values(row.byPackage)
    .sort((a, b) => b.revenueExVat - a.revenueExVat);

  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer', borderTop: '1px solid var(--a-border)' }}>
        <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--a-text)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <strong>{labelForPeriod(row.period, 'ar')}</strong>
          </span>
        </td>
        <td style={tdCenter}>{row.bookingCount}</td>
        <td style={tdRight}>{sar(row.revenueExVat)}</td>
        <td style={tdRightMuted}>({sar(row.totalDirectCost)})</td>
        <td style={{ ...tdRight, color: colorM, fontWeight: 700 }}>{sar(row.trueProfit)}</td>
        <td style={{ ...tdCenter, color: colorM, fontWeight: 700, fontSize: 13 }}>
          {pct(row.marginPct)}
        </td>
      </tr>
      {expanded && packageRows.map(p => {
        const pc = marginColour(p.marginPct);
        return (
          <tr key={p.packageId} style={{ background: 'var(--a-surface-alt)' }}>
            <td style={{ ...tdSub, paddingInlineStart: 36 }}>
              <span style={{ color: 'var(--a-text-soft)' }}>
                {PACKAGE_NAME_AR[p.packageId] ?? `باقة #${p.packageId}`}
                {' · '}
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, opacity: 0.7 }}>
                  {PACKAGE_NAME_EN[p.packageId] ?? '—'}
                </span>
              </span>
            </td>
            <td style={tdCenterSub}>{p.bookingCount}</td>
            <td style={tdRightSub}>{sar(p.revenueExVat)}</td>
            <td style={tdRightMutedSub}>({sar(p.totalDirectCost)})</td>
            <td style={{ ...tdRightSub, color: pc, fontWeight: 600 }}>{sar(p.trueProfit)}</td>
            <td style={{ ...tdCenterSub, color: pc, fontWeight: 600 }}>{pct(p.marginPct)}</td>
          </tr>
        );
      })}
    </>
  );
}

const tdBase: React.CSSProperties = {
  padding: '12px 14px', fontSize: 13, color: 'var(--a-text)',
  fontFamily: 'Inter, sans-serif',
};
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: 'center' };
const tdRight:  React.CSSProperties = { ...tdBase, textAlign: 'end', fontVariantNumeric: 'tabular-nums' };
const tdRightMuted: React.CSSProperties = { ...tdRight, color: 'var(--a-text-muted)' };

const tdSub:        React.CSSProperties = { ...tdBase, padding: '9px 14px', fontSize: 12 };
const tdCenterSub:  React.CSSProperties = { ...tdSub, textAlign: 'center' };
const tdRightSub:   React.CSSProperties = { ...tdSub, textAlign: 'end', fontVariantNumeric: 'tabular-nums' };
const tdRightMutedSub: React.CSSProperties = { ...tdRightSub, color: 'var(--a-text-muted)' };

// ── Main dashboard ─────────────────────────────────────────────────────
interface Props {
  bookings: Booking[];
  loading?: boolean;
}

export default function StudioPLDashboard({ bookings, loading }: Props) {
  const [period, setPeriod]     = useState<Period>('month');
  const [expanded, setExpanded] = useState<string | null>(null);

  // 1. Always aggregate monthly first (cheap); then roll up.
  const monthly = useMemo(() => aggregateMonthly(bookings), [bookings]);
  const rows    = useMemo(() => rollupBy(period, monthly), [period, monthly]);
  const total   = useMemo(() => totalSummary(rows), [rows]);

  // Per-package across the whole visible scope
  const allTimePackages = useMemo(() => {
    return Object.values(total.byPackage).sort((a, b) => b.revenueExVat - a.revenueExVat);
  }, [total]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--a-text-muted)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: 10, fontSize: 13 }}>جاري حساب الأرباح…</div>
      </div>
    );
  }

  const periodLabels: Record<Period, string> = {
    month:   'شهري',
    quarter: 'ربع سنوي',
    year:    'سنوي',
  };

  return (
    <div>
      {/* Top bar — period toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          display: 'flex', gap: 6, background: 'var(--a-surface-alt)',
          borderRadius: 10, padding: 4,
        }}>
          {(['month', 'quarter', 'year'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '7px 16px', borderRadius: 7,
              border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              background: period === p ? 'var(--a-gold)' : 'transparent',
              color:      period === p ? '#0B0B0B'       : 'var(--a-text-soft)',
              boxShadow:  period === p ? '0 2px 6px rgba(212,175,122,0.35)' : 'none',
              transition: 'all 0.15s',
            }}>{periodLabels[p]}</button>
          ))}
        </div>
        <div style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--a-text-muted)' }}>
          الحجوزات المحتسبة: مؤكّدة + مكتملة + كل دفعة (مدفوع/في انتظار التحويل)
        </div>
      </div>

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        <KPI label="عدد الحجوزات"
          value={total.bookingCount.toString()}
          sub={periodLabels[period]}
          icon={<CalIcon size={18} color={ATEMA_COLORS.deepBronze} />}
          color={ATEMA_COLORS.champagne} />
        <KPI label="الإيرادات (بدون VAT)"
          value={sar(total.revenueExVat)}
          sub={`+ ${sar(total.vat)} ضريبة`}
          icon={<Coins size={18} color="#8C6B4F" />}
          color="#8C6B4F" />
        <KPI label="الربح الحقيقي"
          value={sar(total.trueProfit)}
          sub={`بعد تعويض وقت المالكة`}
          icon={<TrendingUp size={18} color={marginColour(total.marginPct)} />}
          color={marginColour(total.marginPct)} />
        <KPI label="الهامش"
          value={pct(total.marginPct)}
          sub="ربح حقيقي / إيرادات"
          icon={<CalendarRange size={18} color={marginColour(total.marginPct)} />}
          color={marginColour(total.marginPct)} />
      </div>

      {/* Chart */}
      <div style={{
        background: 'var(--a-surface)', borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--a-border)',
        padding: '18px 22px', marginBottom: 24,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 6,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
            color: ATEMA_COLORS.champagne, textTransform: 'uppercase',
          }}>
            الإيرادات والربح — لكل فترة
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--a-text-soft)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, background: ATEMA_COLORS.champagne, borderRadius: 2 }} />
              الإيرادات
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, background: '#059669', borderRadius: 2 }} />
              الربح الحقيقي
            </span>
          </div>
        </div>
        <Chart rows={rows} />
      </div>

      {/* Bucket table */}
      <div style={{
        background: 'var(--a-surface)', borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--a-border)',
        overflow: 'hidden', marginBottom: 24,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--a-surface-alt)' }}>
              <th style={thStart}>الفترة</th>
              <th style={thCenter}>#</th>
              <th style={thEnd}>الإيرادات</th>
              <th style={thEnd}>تكاليف مباشرة</th>
              <th style={thEnd}>الربح الحقيقي</th>
              <th style={thCenter}>الهامش</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{
                  padding: 30, textAlign: 'center',
                  color: 'var(--a-text-muted)', fontSize: 13,
                }}>
                  لا توجد حجوزات تستوفي شروط الاحتساب في هذه الفترة
                </td>
              </tr>
            )}
            {rows.map(r => (
              <BucketRow key={r.period} row={r}
                expanded={expanded === r.period}
                onToggle={() => setExpanded(expanded === r.period ? null : r.period)} />
            ))}
            {rows.length > 0 && (
              <tr style={{
                borderTop: '2px solid var(--a-border)',
                background: 'var(--a-surface-alt)', fontWeight: 700,
              }}>
                <td style={tdBase}>الإجمالي</td>
                <td style={tdCenter}>{total.bookingCount}</td>
                <td style={tdRight}>{sar(total.revenueExVat)}</td>
                <td style={tdRightMuted}>({sar(total.totalDirectCost)})</td>
                <td style={{ ...tdRight, color: marginColour(total.marginPct) }}>
                  {sar(total.trueProfit)}
                </td>
                <td style={{ ...tdCenter, color: marginColour(total.marginPct) }}>
                  {pct(total.marginPct)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* All-time per-package summary */}
      {allTimePackages.length > 0 && (
        <div style={{
          background: 'var(--a-surface)', borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--a-border)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 20px',
            background: 'var(--a-surface-alt)',
            fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
            color: ATEMA_COLORS.champagne, textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <PackageIcon size={13} /> أداء الباقات — الفترة المعروضة
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'transparent' }}>
                <th style={thStart}>الباقة</th>
                <th style={thCenter}>#</th>
                <th style={thEnd}>الإيرادات</th>
                <th style={thEnd}>الربح الحقيقي</th>
                <th style={thCenter}>الهامش</th>
              </tr>
            </thead>
            <tbody>
              {allTimePackages.map(p => {
                const pc = marginColour(p.marginPct);
                return (
                  <tr key={p.packageId} style={{ borderTop: '1px solid var(--a-border)' }}>
                    <td style={tdBase}>
                      <strong>{PACKAGE_NAME_AR[p.packageId] ?? `باقة #${p.packageId}`}</strong>
                      <span style={{ marginInlineStart: 8, fontSize: 11, color: 'var(--a-text-muted)',
                        fontFamily: 'Inter, sans-serif' }}>
                        {PACKAGE_NAME_EN[p.packageId] ?? ''}
                      </span>
                    </td>
                    <td style={tdCenter}>{p.bookingCount}</td>
                    <td style={tdRight}>{sar(p.revenueExVat)}</td>
                    <td style={{ ...tdRight, color: pc, fontWeight: 600 }}>{sar(p.trueProfit)}</td>
                    <td style={{ ...tdCenter, color: pc, fontWeight: 700 }}>{pct(p.marginPct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Helper hint */}
      <div style={{
        marginTop: 16, fontSize: 11, color: 'var(--a-text-muted)',
        textAlign: 'center', lineHeight: 1.6,
      }}>
        الأرقام تستخدم نفس محرك الأرباح المستخدم في تبويب الأرباح والخسائر داخل كل حجز.
        <br />
        التكاليف الافتراضية ومعدّل وقت المالكة قابلة للتعديل من
        <code style={{ background: 'var(--a-surface-alt)', padding: '0 4px', margin: '0 4px', borderRadius: 3 }}>
          src/services/pl/config.ts
        </code>
        — انظري دليل التشغيل، القسم 10.
      </div>
    </div>
  );
}

const thBase: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11,
  fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
  color: ATEMA_COLORS.champagne, fontFamily: 'inherit',
};
const thStart:  React.CSSProperties = { ...thBase, textAlign: 'start' };
const thCenter: React.CSSProperties = { ...thBase, textAlign: 'center' };
const thEnd:    React.CSSProperties = { ...thBase, textAlign: 'end' };
