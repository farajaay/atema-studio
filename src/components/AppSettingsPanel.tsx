// ATEMA STUDIO — Admin App Settings Panel
// Global VAT toggle + seller VAT# / CR# (required when enabling).

import { useState } from 'react';
import { Settings, Receipt, Building, X, Save, AlertCircle, CheckCircle2, Loader2, Palette } from 'lucide-react';
import type { AppSettings, ThemeName } from '../services/settings';

// Theme-aware tokens — values resolve from document CSS custom properties.
const C = {
  ivory:     'var(--a-surface)',
  sand:      'var(--a-border-strong)',
  champagne: 'var(--a-surface-alt)',
  bronze:    'var(--a-gold)',
  taupe:     'var(--a-text-soft)',
  mocha:     'var(--a-text)',
  black:     'var(--a-heading)',
};
const ICON_GOLD = '#D4AF7A';

export default function AppSettingsPanel({ settings, onSave }: {
  settings: AppSettings;
  onSave: (patch: Partial<AppSettings>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);

  const vatBadge = settings.vat_enabled ? (
    <span style={pill('#059669')}>
      <CheckCircle2 size={11} /> مفعّلة (15%)
    </span>
  ) : (
    <span style={pill('#dc2626')}>
      <X size={11} /> معطّلة
    </span>
  );

  return (
    <div dir="rtl" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.champagne,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={18} color={ICON_GOLD} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.black, fontSize: 15 }}>
              إعدادات النظام
            </div>
            <div style={{ fontSize: 11, color: 'var(--a-text-soft)' }}>
              ضريبة القيمة المضافة · معلومات البائع
            </div>
          </div>
        </div>
        <button onClick={() => setEditing(true)} style={editBtn}>
          تعديل
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12, fontSize: 13 }}>
        <Field icon={<Receipt size={14} />} label="ضريبة القيمة المضافة" valueNode={vatBadge} />
        <Field icon={<Building size={14} />} label="الرقم الضريبي"
          value={settings.vat_number || '—'} mono />
        <Field icon={<Building size={14} />} label="السجل التجاري"
          value={settings.cr_number || '—'} mono />
        <Field icon={<Building size={14} />} label="اسم البائع"
          value={settings.seller_name_ar} />
        <Field icon={<Palette size={14} />} label="ثيم الموقع"
          value={settings.theme === 'noir' ? 'Couture Noir (أسود فاخر)' : 'Atelier Ivory (عاجي كلاسيكي)'} />
      </div>

      {!settings.vat_enabled && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: '#fef3c7', color: '#92400e', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} />
          ضريبة القيمة المضافة معطّلة على مستوى النظام — جميع الفواتير والباقات تُعرض بدون ضريبة
        </div>
      )}

      {editing && (
        <SettingsEditModal initial={settings}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            const ok = await onSave(patch);
            if (ok) setEditing(false);
            return ok;
          }} />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function SettingsEditModal({ initial, onClose, onSave }: {
  initial: { vat_enabled: boolean; vat_number: string; cr_number: string;
             seller_name_ar: string; seller_name_en: string; theme: ThemeName };
  onClose: () => void;
  onSave: (patch: Partial<typeof initial>) => Promise<boolean>;
}) {
  const [vatOn,     setVatOn]     = useState(initial.vat_enabled);
  const [vatNum,    setVatNum]    = useState(initial.vat_number);
  const [crNum,     setCrNum]     = useState(initial.cr_number);
  const [nameAr,    setNameAr]    = useState(initial.seller_name_ar);
  const [nameEn,    setNameEn]    = useState(initial.seller_name_en);
  const [theme,     setTheme]     = useState<ThemeName>(initial.theme);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  async function handleSave() {
    setErr('');
    if (vatOn) {
      if (!vatNum.trim() || vatNum.trim().length < 10) {
        setErr('الرقم الضريبي مطلوب ويجب أن يكون 15 رقمًا (يبدأ بـ 3)'); return;
      }
      if (!/^[3]\d{14}$/.test(vatNum.trim())) {
        setErr('الرقم الضريبي يجب أن يبدأ بالرقم 3 ويتكوّن من 15 رقمًا'); return;
      }
      if (!crNum.trim()) {
        setErr('السجل التجاري مطلوب لتفعيل ضريبة القيمة المضافة'); return;
      }
    }
    setSaving(true);
    const ok = await onSave({
      vat_enabled:    vatOn,
      vat_number:     vatNum.trim(),
      cr_number:      crNum.trim(),
      seller_name_ar: nameAr.trim(),
      seller_name_en: nameEn.trim(),
      theme,
    });
    setSaving(false);
    if (!ok) setErr('فشل في حفظ الإعدادات');
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div dir="rtl" onClick={e => e.stopPropagation()} style={{
        background: 'var(--a-surface)', borderRadius: 14, width: '100%', maxWidth: 520,
        border: '1px solid var(--a-border-strong)',
        boxShadow: 'var(--a-shadow)',
        fontFamily: 'Tajawal, sans-serif', maxHeight: '92vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${C.champagne}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: "'Amiri', serif", fontSize: '1.1rem', color: C.black }}>
              تعديل إعدادات النظام
            </div>
            <div style={{ fontSize: 11, color: C.taupe, marginTop: 2 }}>
              ضريبة القيمة المضافة + معلومات البائع
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.taupe }}><X size={18} /></button>
        </div>

        <div style={{ padding: 22 }}>
          {/* VAT toggle */}
          <div style={{
            background: vatOn ? '#ecfdf5' : '#fef3c7',
            border: `1px solid ${vatOn ? '#86efac' : '#fcd34d'}`,
            borderRadius: 12, padding: '14px 16px', marginBottom: 18,
          }}>
            <label style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 700, color: C.black, fontSize: 14, marginBottom: 4 }}>
                  ضريبة القيمة المضافة (15%)
                </div>
                <div style={{ fontSize: 12, color: C.taupe }}>
                  {vatOn
                    ? 'سيتم احتساب 15% على جميع الحجوزات الجديدة'
                    : 'لن يتم احتساب أي ضريبة — تأكدي قبل التعطيل'}
                </div>
              </div>
              <Toggle on={vatOn} onChange={setVatOn} />
            </label>
          </div>

          {/* VAT details (only required when enabled) */}
          {vatOn && (
            <div style={{
              padding: '14px 16px', borderRadius: 12, background: C.ivory,
              border: `1px solid ${C.sand}`, marginBottom: 18,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.bronze,
                marginBottom: 12, letterSpacing: '0.05em' }}>
                البيانات الضريبية (مطلوبة)
              </div>

              <FieldInput label="الرقم الضريبي (15 رقم — يبدأ بـ 3)"
                value={vatNum} onChange={setVatNum}
                placeholder="3xxxxxxxxxxxxxx" mono />
              <FieldInput label="السجل التجاري"
                value={crNum} onChange={setCrNum}
                placeholder="رقم السجل التجاري" mono />
            </div>
          )}

          {/* Theme picker */}
          <div style={{
            padding: '14px 16px', borderRadius: 12, background: C.ivory,
            border: `1px solid ${C.sand}`, marginBottom: 18,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.bronze,
              marginBottom: 10, letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Palette size={13} /> ثيم الموقع (يُطبَّق فور الحفظ)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ThemeCard name="noir" active={theme === 'noir'} onClick={() => setTheme('noir')}
                titleAr="Couture Noir" subAr="أسود فاخر · ذهبي شمبانيا"
                swatches={['#0B0B0B', '#D4AF7A', '#EFE3D1']} />
              <ThemeCard name="ivory" active={theme === 'ivory'} onClick={() => setTheme('ivory')}
                titleAr="Atelier Ivory" subAr="عاجي كلاسيكي · برونزي"
                swatches={['#F5EDE4', '#D4B5A0', '#8C6B4F']} />
            </div>
          </div>

          {/* Seller name */}
          <FieldInput label="اسم البائع (عربي) — يظهر على الفاتورة"
            value={nameAr} onChange={setNameAr} />
          <FieldInput label="Seller Name (English)"
            value={nameEn} onChange={setNameEn} />

          {err && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, background: '#fee2e2',
              color: '#991b1b', fontSize: 12, marginTop: 8, marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertCircle size={14} />{err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={onClose} style={btnSecondary}>إلغاء</button>
            <button onClick={handleSave} disabled={saving} style={btnPrimary}>
              {saving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ الحفظ...</>
                : <><Save size={14} /> حفظ الإعدادات</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── tiny presentational helpers ────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 46, height: 26, flexShrink: 0 }}>
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 26,
        background: on ? '#059669' : '#cbd5e1', transition: 'background 0.2s', cursor: 'pointer',
      }} />
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 20, height: 20, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </span>
  );
}

function ThemeCard({ name, active, onClick, titleAr, subAr, swatches }: {
  name: ThemeName; active: boolean; onClick: () => void;
  titleAr: string; subAr: string; swatches: string[];
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      data-theme={name}
      style={{
        textAlign: 'right', cursor: 'pointer',
        padding: '10px 12px', borderRadius: 10,
        background: 'var(--a-surface-alt)',
        border: `2px solid ${active ? C.bronze : C.champagne}`,
        boxShadow: active ? `0 4px 12px ${C.bronze}25` : 'none',
        fontFamily: 'inherit', transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {swatches.map(s => (
          <span key={s} style={{
            width: 22, height: 22, borderRadius: 4,
            background: s, border: '1px solid rgba(0,0,0,0.08)',
          }} />
        ))}
      </div>
      <div style={{ fontWeight: 700, color: C.black, fontSize: 13 }}>{titleAr}</div>
      <div style={{ fontSize: 11, color: C.taupe }}>{subAr}</div>
      {active && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.bronze,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <CheckCircle2 size={11} /> الثيم النشط
        </div>
      )}
    </button>
  );
}

function Field({ icon, label, value, valueNode, mono }: {
  icon: React.ReactNode; label: string; value?: string; valueNode?: React.ReactNode; mono?: boolean;
}) {
  return (
    <div style={{ background: C.ivory, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: C.taupe, marginBottom: 4,
        display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.05em' }}>
        <span style={{ color: C.bronze }}>{icon}</span>{label}
      </div>
      {valueNode ?? (
        <div style={{
          fontWeight: 600, color: C.black, fontSize: 13,
          fontFamily: mono ? "'Inter', monospace" : 'inherit',
          wordBreak: 'break-all',
        }}>{value}</div>
      )}
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
        color: C.taupe, marginBottom: 6 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: `1.5px solid ${C.sand}`, fontSize: 13, fontFamily: mono ? "'Inter', monospace" : 'inherit',
          boxSizing: 'border-box', outline: 'none',
        }} />
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--a-surface)', borderRadius: 14, padding: '20px 22px',
  border: '1px solid var(--a-border)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.18)', marginBottom: 24,
  fontFamily: 'Tajawal, Cairo, sans-serif',
};

const editBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${C.champagne}`,
  background: 'var(--a-surface-alt)', color: C.bronze, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12,
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 22px', background: C.bronze, color: '#0B0B0B', border: 'none',
  borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 22px', background: 'var(--a-surface-alt)', color: C.taupe,
  border: `1.5px solid ${C.sand}`, borderRadius: 8, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
};

function pill(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
    fontWeight: 700, padding: '3px 10px', borderRadius: 12,
    background: color + '15', color, border: `1px solid ${color}40`,
  };
}
