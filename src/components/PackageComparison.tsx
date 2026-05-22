// ATEMA STUDIO — Side-by-side package comparison (audit append, 2026-05)
//
// Addresses §6.2 of the audit: brides comparing tiers should be able to see
// the differences at a glance instead of clicking each card. The card view
// stays the default; this is opt-in via a toggle.
//
// Theme: --a-* CSS custom properties.
// VAT/ZATCA itemisation is intentionally NOT shown — the studio is not
// currently ZATCA-registered and the live site shows plain SAR.

import { Check, Minus, Film, Clock, Image as ImageIcon, BookOpen, Crown } from 'lucide-react';
import type { Package } from '../hooks/usePackagesData';

interface Props {
  packages: Package[];
  lang: 'ar' | 'en';
  vatEnabled: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

interface Row {
  label_ar: string;
  label_en: string;
  Icon?: typeof Clock;
  render: (p: Package, lang: 'ar' | 'en') => React.ReactNode;
}

const ROWS: Row[] = [
  {
    label_ar: 'مدة التصوير',
    label_en: 'Session length',
    Icon: Clock,
    render: (p, lang) => p.duration_hours > 0
      ? (lang === 'ar' ? `${p.duration_hours} ساعات` : `${p.duration_hours}h`)
      : '—',
  },
  {
    label_ar: 'صور معدّلة',
    label_en: 'Edited photos',
    Icon: ImageIcon,
    render: (p) => p.edited_photos > 0 ? p.edited_photos.toLocaleString() : '—',
  },
  {
    label_ar: 'ألبوم',
    label_en: 'Album',
    Icon: BookOpen,
    render: (p) => p.album ?? <Minus size={14} aria-hidden style={{ opacity: 0.4 }} />,
  },
  {
    label_ar: 'فيديو',
    label_en: 'Video',
    Icon: Film,
    render: (p) => p.video
      ? <Check size={16} aria-label="Yes" style={{ color: 'var(--a-gold)' }} />
      : <Minus size={14} aria-label="No" style={{ opacity: 0.4 }} />,
  },
];

export default function PackageComparison({
  packages, lang, vatEnabled, selectedId, onSelect,
}: Props) {
  if (!packages.length) return null;

  const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '18px 12px',
    verticalAlign: 'top',
    minWidth: '140px',
  };
  const rowLabelStyle: React.CSSProperties = {
    textAlign: lang === 'ar' ? 'right' : 'left',
    padding: '14px 12px',
    fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : 'inherit',
    fontSize: '0.8rem',
    color: 'var(--a-text-soft)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--a-border)',
  };
  const cellStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '14px 12px',
    fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : 'inherit',
    fontSize: '0.85rem',
    color: 'var(--a-text)',
    borderBottom: '1px solid var(--a-border)',
  };

  return (
    <div style={{
      background: 'var(--a-surface)',
      border: '1px solid var(--a-border)',
      borderRadius: '14px',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label={lang === 'ar' ? 'مقارنة الباقات' : 'Package comparison'}
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}
        >
          <thead>
            <tr style={{ background: 'var(--a-surface-alt)' }}>
              <th scope="col" style={{
                ...rowLabelStyle,
                textAlign: lang === 'ar' ? 'right' : 'left',
                fontFamily: "'Cinzel', serif",
                fontSize: '0.7rem',
                letterSpacing: '0.32em',
                color: 'var(--a-gold)',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--a-border-strong)',
              }}>
                {lang === 'ar' ? 'الميزة' : 'Feature'}
              </th>
              {packages.map(p => {
                const isSelected = selectedId === p.id;
                return (
                  <th key={p.id} scope="col" style={{
                    ...headerStyle,
                    borderBottom: '1px solid var(--a-border-strong)',
                    background: isSelected
                      ? 'color-mix(in srgb, var(--a-gold) 8%, transparent)'
                      : 'transparent',
                  }}>
                    {p.is_popular && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontFamily: "'Cinzel', serif",
                        fontSize: '0.58rem',
                        letterSpacing: '0.24em',
                        color: 'var(--a-gold)',
                        marginBottom: '6px',
                      }}>
                        <Crown size={11} aria-hidden /> {lang === 'ar' ? 'الأكثر طلباً' : 'Most Popular'}
                      </div>
                    )}
                    <div style={{
                      fontFamily: "'Amiri', serif",
                      fontStyle: lang === 'ar' ? 'normal' : 'italic',
                      fontSize: '1.05rem',
                      color: 'var(--a-heading)',
                      lineHeight: 1.2,
                      marginBottom: '6px',
                    }}>
                      {lang === 'ar' ? p.name_ar : p.name_en}
                    </div>
                    <div style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '1.4rem',
                      color: 'var(--a-gold)',
                      lineHeight: 1,
                    }}>
                      {p.price.toLocaleString()}
                    </div>
                    <div style={{
                      fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : 'inherit',
                      fontSize: '0.66rem',
                      color: 'var(--a-text-muted)',
                      marginTop: '3px',
                    }}>
                      {vatEnabled
                        ? (lang === 'ar' ? 'ر.س بدون VAT' : 'SAR excl. VAT')
                        : (lang === 'ar' ? 'ر.س' : 'SAR')}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={ri}>
                <th scope="row" style={rowLabelStyle}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}>
                    {row.Icon && <row.Icon size={13} aria-hidden style={{ color: 'var(--a-text-muted)' }} />}
                    {lang === 'ar' ? row.label_ar : row.label_en}
                  </span>
                </th>
                {packages.map(p => (
                  <td key={p.id} style={cellStyle}>{row.render(p, lang)}</td>
                ))}
              </tr>
            ))}

            {/* CTA row */}
            <tr>
              <th scope="row" style={{ ...rowLabelStyle, borderBottom: 'none' }} />
              {packages.map(p => {
                const isSelected = selectedId === p.id;
                return (
                  <td key={p.id} style={{ ...cellStyle, borderBottom: 'none', paddingTop: '20px', paddingBottom: '22px' }}>
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      aria-pressed={isSelected}
                      style={{
                        border: '1px solid var(--a-gold)',
                        background: isSelected ? 'var(--a-gold)' : 'transparent',
                        color: isSelected ? 'var(--a-bg)' : 'var(--a-gold)',
                        padding: '8px 18px',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        fontFamily: "'Cinzel', serif",
                        fontSize: '0.66rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        transition: 'background 0.2s, color 0.2s',
                      }}
                    >
                      {isSelected
                        ? (lang === 'ar' ? 'مختارة' : 'Selected')
                        : (lang === 'ar' ? 'اختيار' : 'Select')}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
