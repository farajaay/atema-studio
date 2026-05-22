// PLTab — per-booking P&L view (spec Section 10.2)
// Embedded in the booking detail modal. All values in SAR.

import { useState } from 'react';
import type { Booking } from '../hooks/useAdminData';
import { calculateBookingPL } from '../services/pl/engine';
import { DEFAULT_COST_CONFIG, PACKAGE_DEFAULTS, DEFAULT_PACKAGE_INPUTS } from '../services/pl/config';
import { PACKAGE_KEY_BY_ID } from '../services/pnl';
import type { BookingCostInputs } from '../services/pl/types';
import { ATEMA_COLORS } from '../config/constants';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── Warning messages (bilingual) ──────────────────────────────────────────────
const WARNING_COPY: Record<string, { ar: string; en: string; color: string }> = {
  hourly_rate_below_target: {
    ar: 'هذا الحجز لا يكفي لتعويض وقتك — الربح الحقيقي سالب',
    en: 'Booking does not cover owner time — true profit is negative',
    color: '#dc2626',
  },
  thin_margin: {
    ar: 'هامش ضعيف جداً — أقل من ١٠٪ ربح حقيقي',
    en: 'Thin margin — less than 10% true profit',
    color: '#d97706',
  },
  not_covering_overhead: {
    ar: 'الإيرادات لا تغطي المصاريف الثابتة',
    en: 'Revenue does not cover fixed overhead',
    color: '#d97706',
  },
  below_direct_cost: {
    ar: 'الإيرادات أقل من التكاليف المباشرة',
    en: 'Revenue is below direct costs',
    color: '#dc2626',
  },
};

// ── Number formatter ─────────────────────────────────────────────────────────
const sar = (n: number) => `${Math.round(n).toLocaleString('ar-SA')} ر.س`;
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

// ── Stacked bar chart ─────────────────────────────────────────────────────────
function MarginBar({ label, labelEn, value, total, color }: {
  label: string; labelEn: string; value: number; total: number; color: string;
}) {
  const width = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  const isNeg = value < 0;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px' }}>
        <span style={{ color: 'var(--a-text)', fontWeight: 600 }}>{label} <span style={{ color: 'var(--a-text-muted)', fontWeight: 400, fontSize: '11px' }}>({labelEn})</span></span>
        <span style={{ fontWeight: 700, color: isNeg ? '#dc2626' : color }}>
          {sar(value)} ({pct(value / (total || 1) * 100)})
        </span>
      </div>
      <div style={{ height: '10px', background: 'var(--a-surface-alt)', borderRadius: '5px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, background: isNeg ? '#fecaca' : color, borderRadius: '5px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Cost row ─────────────────────────────────────────────────────────────────
function CostRow({ label, value, indent = false, bold = false, separator = false }: {
  label: string; value: number; indent?: boolean; bold?: boolean; separator?: boolean;
}) {
  if (separator) return (
    <tr><td colSpan={2} style={{ borderTop: '1px solid var(--a-border)', padding: '4px 0' }} /></tr>
  );
  return (
    <tr>
      <td style={{ padding: '4px 0', paddingRight: indent ? '16px' : '0', color: bold ? '#333' : '#666', fontWeight: bold ? 700 : 400, fontSize: '13px' }}>{label}</td>
      <td style={{ padding: '4px 0', textAlign: 'left', fontWeight: bold ? 700 : 400, fontSize: '13px',
        color: value < 0 ? '#dc2626' : bold ? '#333' : '#555', whiteSpace: 'nowrap' }}>
        {value < 0 ? `(${sar(Math.abs(value))})` : sar(value)}
      </td>
    </tr>
  );
}

// ── Checkbox input ────────────────────────────────────────────────────────────
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', cursor: 'pointer', color: 'var(--a-text)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: '15px', height: '15px', accentColor: ATEMA_COLORS.champagne, cursor: 'pointer' }} />
      {label}
    </label>
  );
}

// ── Main PLTab ────────────────────────────────────────────────────────────────
export function PLTab({ booking }: { booking: Booking }) {
  // PACKAGE_DEFAULTS is keyed by name ('engagement', 'classic', …); booking
  // rows carry the numeric package_id. Route through PACKAGE_KEY_BY_ID so
  // the defaults table is actually consulted (previously every booking
  // silently fell through to DEFAULT_PACKAGE_INPUTS — 4h, no album, no
  // assistant — regardless of which tier was actually sold).
  const pkgKey      = PACKAGE_KEY_BY_ID[booking.package_id] ?? '';
  const pkgDefaults = PACKAGE_DEFAULTS[pkgKey] ?? DEFAULT_PACKAGE_INPUTS;

  const [inputs, setInputs] = useState<BookingCostInputs>({
    packageId: booking.package_id,
    revenueExVat: booking.subtotal,
    travelDistanceKm: 0,
    travelFeeCharged: 0,
    includesVideo:        pkgDefaults.includesVideo,
    includesAssistant:    pkgDefaults.includesAssistant,
    includesVideographer: pkgDefaults.includesVideographer,
    coverageHours:        pkgDefaults.coverageHours,
    prepHours:            pkgDefaults.prepHours,
    albumIncluded:        pkgDefaults.albumIncluded,
    albumSize:            pkgDefaults.albumSize,
    albumPages:           pkgDefaults.albumPages,
    miniFamilyAlbum:      pkgDefaults.miniFamilyAlbum,
    extraStorageUnits:    0,
  });

  const [ownerRate, setOwnerRate] = useState(150);

  const cfg = { ...DEFAULT_COST_CONFIG, ownerHourlyRate: ownerRate };
  const pl = calculateBookingPL(inputs, cfg);

  const set = <K extends keyof BookingCostInputs>(k: K, v: BookingCostInputs[K]) =>
    setInputs(prev => ({ ...prev, [k]: v }));

  const statusColor = pl.status === 'profitable' ? '#059669' : pl.status === 'break-even' ? '#d97706' : '#dc2626';
  const StatusIcon = pl.status === 'profitable' ? TrendingUp : pl.status === 'break-even' ? Minus : TrendingDown;
  const statusLabel = pl.status === 'profitable' ? 'مربحة' : pl.status === 'break-even' ? 'عند نقطة التعادل' : 'خاسرة';

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1.5px solid var(--a-border)', borderRadius: '7px',
    fontSize: '13px', fontFamily: 'inherit', outline: 'none',
    background: 'white', width: '90px', textAlign: 'center',
  };

  return (
    <div style={{ fontFamily: 'Cairo, Tajawal, Inter, sans-serif' }}>

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px',
        background: statusColor + '15', border: `1px solid ${statusColor}40`,
        borderRadius: '10px', padding: '12px 16px' }}>
        <StatusIcon size={18} color={statusColor} />
        <span style={{ fontWeight: 700, fontSize: '14px', color: statusColor }}>{statusLabel}</span>
        <span style={{ marginRight: 'auto', fontSize: '12px', color: '#888' }}>
          ربح حقيقي: {sar(pl.ownerCompensatedMargin)} ({pct(pl.ownerCompensatedMarginPct)})
        </span>
      </div>

      {/* Warnings */}
      {pl.warnings.map(w => {
        const copy = WARNING_COPY[w];
        if (!copy) return null;
        return (
          <div key={w} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '10px',
            background: copy.color + '10', border: `1px solid ${copy.color}30`,
            borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: copy.color }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div><strong>{copy.ar}</strong><br /><span style={{ opacity: 0.8 }}>{copy.en}</span></div>
          </div>
        );
      })}

      {/* Three margin bars */}
      <div style={{ marginBottom: '20px' }}>
        <MarginBar label="الهامش المباشر"    labelEn="Direct margin"    value={pl.directMargin}          total={pl.revenueExVat} color="#2563eb" />
        <MarginBar label="الهامش التشغيلي"   labelEn="Operating margin" value={pl.operatingMargin}       total={pl.revenueExVat} color="#7c3aed" />
        <MarginBar label="الربح الحقيقي"     labelEn="True profit"      value={pl.ownerCompensatedMargin} total={pl.revenueExVat} color={statusColor} />
      </div>

      {/* P&L breakdown table */}
      <div style={{ background: 'var(--a-surface-alt)', borderRadius: '10px', padding: '16px 18px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ATEMA_COLORS.champagne, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>تفاصيل الحساب</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <CostRow label="الإيرادات (بدون VAT)" value={pl.revenueExVat} bold />
            <CostRow label="VAT 15%" value={pl.vat} indent />
            <CostRow label="الإجمالي شامل VAT" value={pl.totalIncVat} indent bold />
            <CostRow separator label="" value={0} />

            <CostRow label="التكاليف المباشرة" value={-pl.totalDirectCost} bold />
            {pl.costAssistant > 0    && <CostRow label="  المساعد"        value={-pl.costAssistant}    indent />}
            {pl.costVideographer > 0 && <CostRow label="  مصور الفيديو"   value={-pl.costVideographer} indent />}
            {pl.costAlbumPrint > 0   && <CostRow label="  طباعة الألبوم"  value={-pl.costAlbumPrint}   indent />}
            {pl.costAlbumPackaging > 0 && <CostRow label="  التغليف"      value={-pl.costAlbumPackaging} indent />}
            <CostRow label="  التخزين (USB)"  value={-pl.costStorage}       indent />
            {pl.costTravel > 0       && <CostRow label="  السفر والوقود"  value={-pl.costTravel}       indent />}
            <CostRow label="  متفرقات"        value={-pl.costMiscellaneous} indent />
            <CostRow separator label="" value={0} />

            <CostRow label="الهامش المباشر"   value={pl.directMargin}    bold />
            <CostRow label="  إهلاك المعدات"  value={-pl.allocatedDepreciation} indent />
            <CostRow label="  اشتراكات البرامج" value={-pl.allocatedSoftware} indent />
            <CostRow separator label="" value={0} />

            <CostRow label="الهامش التشغيلي"  value={pl.operatingMargin} bold />
            <CostRow label={`  وقت المالكة (${pl.ownerHours.toFixed(1)} ساعة × ${ownerRate} ر.س)`} value={-pl.ownerCompensation} indent />
            <CostRow separator label="" value={0} />

            <CostRow label="الربح الحقيقي"    value={pl.ownerCompensatedMargin} bold />
          </tbody>
        </table>
      </div>

      {/* Inputs panel */}
      <div style={{ background: ATEMA_COLORS.softIvory, borderRadius: '10px', padding: '16px 18px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ATEMA_COLORS.champagne, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>تعديل مدخلات الحساب</div>

        {/* Owner hourly rate slider */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--a-text)', marginBottom: '8px' }}>
            سعر ساعة المالكة: <strong style={{ color: ATEMA_COLORS.deepBronze }}>{ownerRate} ر.س/ساعة</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ rate: 100, label: 'الكفاف' }, { rate: 150, label: 'عادل' }, { rate: 250, label: 'مميز' }].map(({ rate, label }) => (
              <button key={rate} onClick={() => setOwnerRate(rate)}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                  background: ownerRate === rate ? ATEMA_COLORS.champagne : 'white',
                  color: ownerRate === rate ? 'white' : '#666',
                  boxShadow: ownerRate === rate ? '0 2px 8px rgba(212,181,160,0.4)' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                {label}<br /><span style={{ fontSize: '11px', opacity: 0.8 }}>{rate} ر.س</span>
              </button>
            ))}
          </div>
          <input type="range" min={50} max={400} step={10} value={ownerRate}
            onChange={e => setOwnerRate(Number(e.target.value))}
            style={{ width: '100%', marginTop: '10px', accentColor: ATEMA_COLORS.champagne }} />
        </div>

        {/* Coverage hours + Travel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '5px' }}>ساعات التغطية</div>
            <input type="number" min={1} max={24} value={inputs.coverageHours}
              onChange={e => set('coverageHours', Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '5px' }}>مسافة السفر (كم ذهاباً وإياباً)</div>
            <input type="number" min={0} max={2000} value={inputs.travelDistanceKm}
              onChange={e => set('travelDistanceKm', Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '5px' }}>ساعات التحضير الإضافية</div>
            <input type="number" min={0} max={12} value={inputs.prepHours}
              onChange={e => set('prepHours', Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '5px' }}>وحدات تخزين إضافية</div>
            <input type="number" min={0} max={10} value={inputs.extraStorageUnits}
              onChange={e => set('extraStorageUnits', Number(e.target.value))} style={inputStyle} />
          </div>
        </div>

        {/* Flags */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <Check label="يشمل مساعداً"       checked={inputs.includesAssistant}    onChange={v => set('includesAssistant', v)} />
          <Check label="يشمل مصور فيديو"    checked={inputs.includesVideographer} onChange={v => set('includesVideographer', v)} />
          <Check label="يشمل فيديو (تعديل)" checked={inputs.includesVideo}        onChange={v => set('includesVideo', v)} />
          <Check label="يشمل ميني ألبوم"    checked={inputs.miniFamilyAlbum}     onChange={v => set('miniFamilyAlbum', v)} />
        </div>

        {/* Album */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Check label="يشمل ألبوماً" checked={inputs.albumIncluded} onChange={v => set('albumIncluded', v)} />
          {inputs.albumIncluded && (
            <>
              <select value={inputs.albumSize} onChange={e => set('albumSize', e.target.value as 'A4' | 'A3')}
                style={{ ...inputStyle, width: 'auto' }}>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--a-text)' }}>
                صفحات:
                <input type="number" min={10} max={40} value={inputs.albumPages}
                  onChange={e => set('albumPages', Number(e.target.value))} style={{ ...inputStyle, width: '70px' }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
