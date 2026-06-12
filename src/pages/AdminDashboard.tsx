import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminData } from '../hooks/useAdminData';
import type { Booking } from '../hooks/useAdminData';
import { ATEMA_COLORS } from '../config/constants';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { PLTab } from '../components/PLTab';
import MoodBoardComposer from '../components/MoodBoardComposer';
import StudioPLDashboard from '../components/StudioPLDashboard';
import AdminCalendar from '../components/AdminCalendar';
import AppSettingsPanel from '../components/AppSettingsPanel';
import { useAppSettings } from '../hooks/useAppSettings';
import { useFailedSends } from '../hooks/useFailedSends';
import {
  regenerateDocuments, fetchLatestDocuments, type LatestDocuments,
} from '../services/documents';
import { openDocumentInNewTab, downloadDocument } from '../services/invoice';
import type { AppSettings } from '../services/settings';
import {
  LayoutDashboard, CalendarDays, Package, LogOut, RefreshCw,
  Search, Eye, Trash2, CheckCircle2,
  Clock, XCircle, CircleDollarSign, Users, AlertCircle,
  Loader2, X, Phone, Mail, MapPin, StickyNote, Save, TrendingUp, Layers,
  Image as ImageIcon, BookOpen, Sparkles, BarChart3, Tag, Sliders,
  FileText, Receipt, Undo2
} from 'lucide-react';

// ── Status badge ──────────────────────────────────────────────────────────────
// Default fallback for any status the DB returns that we haven't mapped yet.
// Prevents a single bad row from white-screening the entire admin dashboard
// (the bug that caused "Cannot read properties of undefined (reading 'bg')"
// when a booking landed with payment_status='awaiting_transfer').
const STATUS_DEFAULT  = { label: '—',  bg: '#f3f4f6', color: '#6b7280', Icon: Clock };
const PAYMENT_DEFAULT = { label: '—',  bg: '#f3f4f6', color: '#6b7280' };

const STATUS_CONFIG: Record<string, typeof STATUS_DEFAULT> = {
  pending:   { label: 'قيد الانتظار', bg: '#fef3c7', color: '#d97706', Icon: Clock },
  confirmed: { label: 'مؤكد',         bg: '#d1fae5', color: '#059669', Icon: CheckCircle2 },
  completed: { label: 'مكتمل',        bg: '#dbeafe', color: '#2563eb', Icon: CheckCircle2 },
  cancelled: { label: 'ملغي',         bg: '#fee2e2', color: '#dc2626', Icon: XCircle },
};
const PAYMENT_CONFIG: Record<string, typeof PAYMENT_DEFAULT> = {
  unpaid:             { label: 'غير مدفوع',          bg: '#fef3c7', color: '#d97706' },
  // Bank-transfer flow: customer chose transfer + receipt not yet verified.
  // Set by BankTransferPayment.tsx; previously absent here, causing crash.
  awaiting_transfer:  { label: 'بانتظار التحويل',    bg: '#fde68a', color: '#b45309' },
  paid:               { label: 'مدفوع',              bg: '#d1fae5', color: '#059669' },
  refunded:           { label: 'مُسترد',             bg: '#f3e8ff', color: '#7c3aed' },
};

function StatusBadge({ status }: { status: Booking['status'] }) {
  const c = STATUS_CONFIG[status] ?? { ...STATUS_DEFAULT, label: status || '—' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <c.Icon size={11} />{c.label}
    </span>
  );
}
function PayBadge({ status }: { status: Booking['payment_status'] }) {
  const c = PAYMENT_CONFIG[status] ?? { ...PAYMENT_DEFAULT, label: status || '—' };
  return (
    <span style={{ display: 'inline-block', background: c.bg, color: c.color,
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
      {c.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  // For hex semantic colors (#d97706 etc.) append 20 hex alpha (~12%).
  // For CSS-var colors (var(--a-gold)) use a translucent gold tint instead.
  const isHex = color.startsWith('#');
  const tint = isHex ? color + '20' : 'rgba(212,175,122,0.12)';
  return (
    <div style={{ background: 'var(--a-surface)', borderRadius: '12px', padding: '20px 22px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid var(--a-border)',
      borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--a-text-soft)', marginBottom: '8px', fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--a-heading)', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '6px' }}>{sub}</div>}
        </div>
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: tint,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      </div>
    </div>
  );
}

// ── Documents (contract + invoice) — view / download / regenerate ────────────
// The latest stored version per booking is the live artifact (append-only
// tables, migrations-2026-06-documents.sql). Regeneration rebuilds both from
// the booking's CURRENT state — the answer to "she changed her package, the
// contract is stale".
function DocumentsSection({ booking, settings }: { booking: Booking; settings: AppSettings }) {
  const [docs, setDocs]       = useState<LatestDocuments | null>(null);
  const [working, setWorking] = useState(false);
  const [outcome, setOutcome] = useState<'idle' | 'done' | 'error'>('idle');

  useEffect(() => {
    let on = true;
    fetchLatestDocuments(booking.id).then(d => { if (on) setDocs(d); });
    return () => { on = false; };
  }, [booking.id]);

  async function handleRegenerate() {
    setWorking(true); setOutcome('idle');
    const res = await regenerateDocuments(booking, settings);
    setWorking(false);
    if (!res) { setOutcome('error'); return; }
    setOutcome('done');
    const now = new Date().toISOString();
    setDocs({
      contract: { content_html: res.contractHTML, created_at: now },
      invoice:  { content_html: res.invoiceHTML, invoice_number: res.invoiceNumber, created_at: now },
    });
  }

  const docRow = (
    icon: React.ReactNode, label: string,
    doc: { content_html: string; created_at: string } | null,
    filename: string,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0',
      borderBottom: '1px solid var(--a-border)', fontSize: '13px' }}>
      <span style={{ color: 'var(--a-text-muted)' }}>{icon}</span>
      <span style={{ fontWeight: 600, color: 'var(--a-text)', flex: 1 }}>
        {label}
        <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--a-text-muted)', marginRight: '8px' }}>
          {doc ? `آخر إصدار ${doc.created_at.slice(0, 10)}` : 'لا توجد نسخة محفوظة'}
        </span>
      </span>
      <button disabled={!doc} onClick={() => doc && openDocumentInNewTab(doc.content_html, label)}
        style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--a-border)',
          background: 'var(--a-surface)', cursor: doc ? 'pointer' : 'not-allowed',
          color: doc ? 'var(--a-text)' : 'var(--a-text-muted)', fontSize: '12px', fontFamily: 'inherit' }}>
        عرض
      </button>
      <button disabled={!doc} onClick={() => doc && downloadDocument(doc.content_html, filename)}
        style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--a-border)',
          background: 'var(--a-surface)', cursor: doc ? 'pointer' : 'not-allowed',
          color: doc ? 'var(--a-text)' : 'var(--a-text-muted)', fontSize: '12px', fontFamily: 'inherit' }}>
        تحميل
      </button>
    </div>
  );

  return (
    <div style={{ background: 'var(--a-surface-alt)', borderRadius: '10px', padding: '16px 18px', marginBottom: '20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: ATEMA_COLORS.champagne, marginBottom: '6px',
        textTransform: 'uppercase', letterSpacing: '1px' }}>المستندات</div>
      {docRow(<FileText size={14} />, 'العقد', docs?.contract ?? null, `ATEMA-Contract-${booking.booking_ref}`)}
      {docRow(<Receipt size={14} />, 'الفاتورة الضريبية', docs?.invoice ?? null, `ATEMA-Invoice-${booking.booking_ref}`)}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
        <button onClick={handleRegenerate} disabled={working}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
            borderRadius: '8px', border: `1.5px solid ${ATEMA_COLORS.champagne}`,
            background: 'var(--a-surface)', color: ATEMA_COLORS.champagne, fontWeight: 600,
            cursor: working ? 'wait' : 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
          {working
            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />جاري الإنشاء…</>
            : <><RefreshCw size={13} />إعادة إنشاء المستندات بالبيانات الحالية</>}
        </button>
        {outcome === 'done'  && <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>✓ تم — هذه هي النسخة المعتمدة الآن</span>}
        {outcome === 'error' && <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>تعذّر الإنشاء — تحقّقي من الاتصال</span>}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '8px', lineHeight: 1.7 }}>
        استخدميها بعد أي تعديل على الباقة أو الإضافات (من العميلة أو من هنا) — تُبنى نسخة جديدة
        من بيانات الحجز الحالية مع رقم فاتورة جديد، وتبقى النسخ السابقة محفوظة للسجل.
      </div>
    </div>
  );
}

// ── Booking Detail Modal ──────────────────────────────────────────────────────
function BookingModal({ booking, onClose, onSave, globalVatEnabled, settings }: {
  booking: Booking; onClose: () => void; onSave: (id: string, updates: Partial<Booking>) => Promise<boolean>;
  globalVatEnabled: boolean; settings: AppSettings;
}) {
  const [tab, setTab]         = useState<'details' | 'pl' | 'mood'>('details');
  const [status, setStatus]   = useState<Booking['status']>(booking.status);
  const [payment, setPayment] = useState<Booking['payment_status']>(booking.payment_status);
  const [notes, setNotes]     = useState(booking.special_requests || '');
  const [vatOn, setVatOn]     = useState<boolean>(globalVatEnabled && booking.vat_enabled !== false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [refundArmed, setRefundArmed] = useState(false);
  const [refunding, setRefunding]     = useState(false);

  // Effective VAT respects global setting: if VAT is disabled globally, per-booking toggle is ignored.
  const effectiveVatOn  = globalVatEnabled && vatOn;
  const recomputedVat   = effectiveVatOn ? Math.round(booking.subtotal * 0.15) : 0;
  const recomputedTotal = booking.subtotal + recomputedVat;

  async function handleSave() {
    setSaving(true);
    const ok = await onSave(booking.id, {
      status, payment_status: payment, special_requests: notes,
      vat_enabled: effectiveVatOn, vat: recomputedVat, total: recomputedTotal,
    });
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 1000); }
  }

  const row = (icon: React.ReactNode, label: string, value?: string) =>
    value ? (
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', fontSize: '14px' }}>
        <span style={{ color: 'var(--a-text-muted)', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
        <div><span style={{ color: 'var(--a-text-soft)', marginLeft: '6px' }}>{label}:</span>
          <span style={{ fontWeight: 600, color: ATEMA_COLORS.editorialBlack }}> {value}</span></div>
      </div>
    ) : null;

  const sel: React.CSSProperties = {
    padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--a-border)',
    fontSize: '13px', fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
    background: 'var(--a-surface)',
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--a-surface)', borderRadius: '16px',
        maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)', fontFamily: 'Cairo, Tajawal, Inter, sans-serif' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--a-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: ATEMA_COLORS.deepBronze }}>
              تفاصيل الحجز
            </div>
            <div style={{ fontSize: '12px', color: 'var(--a-text-muted)', marginTop: '2px' }}>{booking.booking_ref}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--a-border)', padding: '0 24px' }}>
          {([
            { key: 'details', label: 'التفاصيل',       icon: <Package size={14} /> },
            { key: 'pl',      label: 'الأرباح والخسائر', icon: <TrendingUp size={14} /> },
            { key: 'mood',    label: 'لوحة المزاج',     icon: <Sparkles size={14} /> },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', border: 'none',
                background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                color: tab === t.key ? 'var(--a-gold)' : 'var(--a-text-muted)',
                borderBottom: tab === t.key ? `2px solid ${ATEMA_COLORS.champagne}` : '2px solid transparent',
                marginBottom: '-1px', transition: 'all 0.2s' }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {tab === 'pl' && <PLTab booking={booking} />}
          {tab === 'mood' && <MoodBoardComposer booking={booking} />}
          {tab === 'details' && <>
          {/* Customer Info */}
          <div style={{ background: ATEMA_COLORS.softIvory, borderRadius: '10px', padding: '16px 18px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: ATEMA_COLORS.champagne, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>بيانات العميل</div>
            {row(<Users size={14} />,    'الاسم',             booking.customer_name)}
            {row(<Phone size={14} />,    'الجوال',            booking.customer_phone)}
            {row(<Mail size={14} />,     'البريد',            booking.customer_email)}
            {row(<MapPin size={14} />,   'الموقع',            booking.location)}
            {row(<CalendarDays size={14} />, 'التاريخ',       `${booking.event_date} الساعة ${booking.event_time}`)}
            {row(<Package size={14} />,  'الباقة',            booking.package_name || `باقة رقم ${booking.package_id}`)}
          </div>

          {/* Discount applied — only when this booking used a code */}
          {booking.discount_code && (booking.discount_amount ?? 0) > 0 && (
            <div style={{
              background: '#FFF8E8', border: '1px solid #E8D9A8',
              borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '13px', color: '#5C3D1E',
            }}>
              <Tag size={15} color="#8C6B4F" />
              <div>
                <span style={{ fontWeight: 700, letterSpacing: 1, fontFamily: "'Inter', monospace" }}>
                  {booking.discount_code}
                </span>
                <span style={{ marginInlineStart: 10, color: 'var(--a-text-soft)' }}>
                  {booking.discount_kind === 'percent' ? 'خصم نسبة' : 'خصم مبلغ'}
                </span>
                <span style={{ marginInlineStart: 10, fontWeight: 700, color: ATEMA_COLORS.deepBronze }}>
                  −{(booking.discount_amount ?? 0).toLocaleString()} ر.س
                </span>
              </div>
            </div>
          )}

          {/* Financials */}
          <div style={{ background: 'var(--a-surface-alt)', borderRadius: '10px', padding: '16px 18px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: ATEMA_COLORS.champagne,
                textTransform: 'uppercase', letterSpacing: '1px' }}>المالية</div>

              {/* VAT toggle — locked off when global VAT is disabled */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px',
                cursor: globalVatEnabled ? 'pointer' : 'not-allowed',
                fontSize: '12px', color: globalVatEnabled ? 'var(--a-text)' : 'var(--a-text-muted)', fontWeight: 600,
                opacity: globalVatEnabled ? 1 : 0.55 }}>
                <span>تطبيق ضريبة القيمة المضافة (15%)</span>
                <span style={{
                  position: 'relative', display: 'inline-block', width: 38, height: 22,
                }}>
                  <input type="checkbox" checked={effectiveVatOn} disabled={!globalVatEnabled}
                    onChange={e => setVatOn(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: 22,
                    background: effectiveVatOn ? 'var(--a-gold)' : 'var(--a-text-muted)',
                    transition: 'background 0.2s', cursor: globalVatEnabled ? 'pointer' : 'not-allowed',
                  }} />
                  <span style={{
                    position: 'absolute', top: 2, left: effectiveVatOn ? 18 : 2,
                    width: 18, height: 18, borderRadius: '50%', background: 'var(--a-surface)',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </span>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
              {[
                ['الإجمالي', booking.subtotal],
                [effectiveVatOn ? 'VAT 15%' : 'VAT (معطّل)', recomputedVat],
                ['المجموع',  recomputedTotal],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginBottom: '4px' }}>{l as string}</div>
                  <div style={{ fontWeight: 700, color: ATEMA_COLORS.champagne, fontSize: '16px' }}>{(v as number).toLocaleString()} ر.س</div>
                </div>
              ))}
            </div>
            {!globalVatEnabled && (
              <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 6,
                background: '#fee2e2', color: '#991b1b', fontSize: 11, textAlign: 'center' }}>
                ⛔ ضريبة القيمة المضافة معطّلة على مستوى النظام بأكمله — يمكن تفعيلها من إعدادات النظام
              </div>
            )}
            {globalVatEnabled && !vatOn && (
              <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 6,
                background: '#fef3c7', color: '#92400e', fontSize: 11, textAlign: 'center' }}>
                ⚠ ضريبة القيمة المضافة معطّلة لهذا الحجز — سيتم حفظ التغيير عند الضغط على حفظ
              </div>
            )}
          </div>

          {/* Documents — view / download / regenerate */}
          <DocumentsSection booking={booking} settings={settings} />

          {/* Edit status */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--a-text)', marginBottom: '7px' }}>حالة الحجز</label>
            <select value={status} onChange={e => setStatus(e.target.value as Booking['status'])} style={sel}>
              <option value="pending">قيد الانتظار</option>
              <option value="confirmed">مؤكد</option>
              <option value="completed">مكتمل</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--a-text)', marginBottom: '7px' }}>حالة الدفع</label>
            <select value={payment} onChange={e => setPayment(e.target.value as Booking['payment_status'])} style={sel}>
              <option value="unpaid">غير مدفوع</option>
              <option value="paid">مدفوع</option>
              <option value="refunded">مُسترد</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--a-text)', marginBottom: '7px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><StickyNote size={13} />ملاحظات</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--a-border)', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          {/* Refund deposit — exceptional path (studio-side cancellation).
              The customer-facing policy stays "deposit non-refundable"; this
              button exists for the cases where ATEMA itself cancels. */}
          {(booking.payment_status === 'paid' || booking.payment_status === 'awaiting_transfer') && (
            <div style={{ border: '1px solid #fecaca', background: 'rgba(220,38,38,0.06)',
              borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>
                استرداد العربون
              </div>
              <div style={{ fontSize: '12px', color: 'var(--a-text-soft)', marginBottom: '10px', lineHeight: 1.7 }}>
                يُلغي الحجز ويُعلّم الدفع «مُسترد». الإجراء للحالات الاستثنائية فقط (إلغاء من الاستوديو) —
                سياسة العميلة تبقى: العربون غير قابل للاسترداد. التحويل البنكي نفسه يتم خارج النظام.
              </div>
              {!refundArmed ? (
                <button onClick={() => setRefundArmed(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                    borderRadius: '8px', border: '1px solid #fecaca', background: 'var(--a-surface)',
                    color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                  <Undo2 size={13} />استرداد العربون وإلغاء الحجز
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button disabled={refunding}
                    onClick={async () => {
                      setRefunding(true);
                      await onSave(booking.id, { status: 'cancelled', payment_status: 'refunded' });
                      setRefunding(false);
                    }}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none',
                      background: '#dc2626', color: 'white', fontWeight: 700,
                      cursor: refunding ? 'wait' : 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                    {refunding ? 'جاري…' : 'نعم — تأكيد الاسترداد والإلغاء'}
                  </button>
                  <button onClick={() => setRefundArmed(false)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--a-border)',
                      background: 'var(--a-surface)', color: 'var(--a-text)', fontWeight: 600,
                      cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                    تراجع
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '10px 22px', border: `1.5px solid ${ATEMA_COLORS.champagne}`,
              borderRadius: '8px', background: 'var(--a-surface)', color: ATEMA_COLORS.champagne,
              fontWeight: 600, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>إلغاء</button>
            <button onClick={handleSave} disabled={saving || saved} style={{
              padding: '10px 22px', background: saved ? '#059669' : ATEMA_COLORS.champagne,
              color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
              fontSize: '13px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />حفظ...</>
               : saved ? <><CheckCircle2 size={14} />تم الحفظ</>
               : <><Save size={14} />حفظ التغييرات</>}
            </button>
          </div>
          </>}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAdminAuth();
  const { bookings, loading, error, stats, fetchBookings, updateBooking, deleteBooking } = useAdminData();
  const navigate  = useNavigate();
  const { isMobile } = useBreakpoint();

  const { settings, update: updateSettings } = useAppSettings();
  const globalVatEnabled = settings.vat_enabled;
  const failedSends = useFailedSends();

  const [search,     setSearch]     = useState('');
  const [statusF,    setStatusF]    = useState<string>('all');
  const [paymentF,   setPaymentF]   = useState<string>('all');
  const [selected,   setSelected]   = useState<Booking | null>(null);
  const [deleteConf, setDeleteConf] = useState<string | null>(null);
  const [view,       setView]       = useState<'bookings' | 'calendar' | 'pnl'>('bookings');

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin', { replace: true });
  }, [user, authLoading, navigate]);

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.booking_ref.toLowerCase().includes(q)
      || b.customer_name.toLowerCase().includes(q)
      || b.customer_phone.includes(q);
    const matchStatus  = statusF  === 'all' || b.status         === statusF;
    const matchPayment = paymentF === 'all' || b.payment_status === paymentF;
    return matchSearch && matchStatus && matchPayment;
  });

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={36} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const selStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: '20px',
    border: active ? '1px solid transparent' : '1px solid var(--a-border)',
    cursor: 'pointer',
    fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
    background: active ? 'var(--a-gold)' : 'var(--a-surface-alt)',
    color: active ? '#0B0B0B' : 'var(--a-text-soft)',
    boxShadow: active ? '0 2px 8px rgba(212,175,122,0.35)' : 'none',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-bg)', fontFamily: 'Cairo, Tajawal, Inter, sans-serif', direction: 'rtl' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--a-surface)', padding: isMobile ? '12px 16px' : '14px 30px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px',
            background: `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutDashboard size={17} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: ATEMA_COLORS.deepBronze }}>ATEMA STUDIO</div>
            <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>لوحة التحكم</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
          {!isMobile && <span style={{ fontSize: '13px', color: 'var(--a-text-soft)' }}>{user?.email}</span>}
          <button onClick={() => navigate('/admin/packages')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--a-surface-alt)',
              border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'inherit', color: 'var(--a-text)', fontWeight: 600 }}>
            <Layers size={14} />{!isMobile && 'الباقات'}
          </button>
          <button onClick={() => navigate('/admin/portfolio')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--a-surface-alt)',
              border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'inherit', color: 'var(--a-text)', fontWeight: 600 }}>
            <ImageIcon size={14} />{!isMobile && 'المعرض'}
          </button>
          <button onClick={() => navigate('/admin/journal')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--a-surface-alt)',
              border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'inherit', color: 'var(--a-text)', fontWeight: 600 }}>
            <BookOpen size={14} />{!isMobile && 'اليوميات'}
          </button>
          <button onClick={() => navigate('/admin/discount-codes')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--a-surface-alt)',
              border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'inherit', color: 'var(--a-text)', fontWeight: 600 }}>
            <Tag size={14} />{!isMobile && 'الأكواد'}
          </button>
          <button onClick={() => navigate('/admin/addons')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--a-surface-alt)',
              border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'inherit', color: 'var(--a-text)', fontWeight: 600 }}>
            <Sliders size={14} />{!isMobile && 'الإضافات'}
          </button>
          <button onClick={fetchBookings} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--a-text-muted)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {!isMobile && 'تحديث'}
          </button>
          <button onClick={async () => { await logout(); navigate('/admin'); }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff5f5',
              border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px',
              padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 600 }}>
            <LogOut size={14} />{!isMobile && 'خروج'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 30px' }}>

        {/* Failed-sends alert — email/WA failures are fire-and-forget by
            design; this is the one place they become visible. */}
        {failedSends.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff5f5',
            border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 18px',
            marginBottom: '20px', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
            <AlertCircle size={16} />
            {failedSends.total} رسالة فشل إرسالها خلال آخر ٧ أيام
            ({failedSends.email} بريد، {failedSends.wa} واتساب) —
            تحقّقي من إعدادات Zoho / Meta في Supabase
          </div>
        )}

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: isMobile ? '12px' : '16px', marginBottom: '28px' }}>
          <StatCard icon={<CalendarDays size={20} color="#D4AF7A" />}
            label="إجمالي الحجوزات" value={stats.total} color="#D4AF7A" />
          <StatCard icon={<Clock size={20} color="#d97706" />}
            label="قيد الانتظار" value={stats.pending}
            sub={`${stats.pending_revenue.toLocaleString()} ر.س معلقة`} color="#d97706" />
          <StatCard icon={<CheckCircle2 size={20} color="#059669" />}
            label="مؤكد / مكتمل" value={stats.confirmed + stats.completed} color="#059669" />
          <StatCard icon={<CircleDollarSign size={20} color="#2563eb" />}
            label="الإيرادات المحصلة" value={`${stats.revenue.toLocaleString()} ر.س`} color="#2563eb" />
        </div>

        {/* Global app settings — VAT toggle, seller identity, etc. */}
        <AppSettingsPanel settings={settings} onSave={updateSettings} />

        {/* View tabs — Bookings / Calendar / P&L */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: '20px',
          flexWrap: 'wrap',
        }}>
          {([
            { key: 'bookings', label: 'الحجوزات',           icon: <CalendarDays size={14} /> },
            { key: 'calendar', label: 'التقويم',            icon: <CalendarDays size={14} /> },
            { key: 'pnl',      label: 'الأرباح والخسائر',    icon: <BarChart3 size={14} /> },
          ] as const).map(t => {
            const active = view === t.key;
            return (
              <button key={t.key} onClick={() => setView(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10,
                border: active ? '1px solid transparent' : '1px solid var(--a-border)',
                cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                background: active ? 'var(--a-gold)' : 'var(--a-surface)',
                color:      active ? '#0B0B0B'       : 'var(--a-text-soft)',
                boxShadow:  active ? '0 2px 10px rgba(212,175,122,0.35)' : 'none',
                transition: 'all 0.15s',
              }}>
                {t.icon}{t.label}
              </button>
            );
          })}
        </div>

        {/* Monthly calendar — bookings + blocked dates */}
        {view === 'calendar' && <AdminCalendar />}

        {/* Studio-wide P&L dashboard */}
        {view === 'pnl' && <StudioPLDashboard bookings={bookings} loading={loading} />}

        {/* Filters + table — only when viewing bookings */}
        {view === 'bookings' && <>
        <div style={{ background: 'var(--a-surface)', borderRadius: '12px', padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '20px',
          display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>

          {/* Search */}
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search size={14} color="#bbb" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو رقم الحجز أو الجوال..." dir="rtl"
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1.5px solid var(--a-border)',
                borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit', background: 'var(--a-surface)' }} />
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['all','الكل'],['pending','انتظار'],['confirmed','مؤكد'],['completed','مكتمل'],['cancelled','ملغي']].map(([v,l]) => (
              <button key={v} onClick={() => setStatusF(v)} style={selStyle(statusF === v)}>{l}</button>
            ))}
          </div>

          {/* Payment filter */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[['all','كل الدفعات'],['paid','مدفوع'],['unpaid','غير مدفوع']].map(([v,l]) => (
              <button key={v} onClick={() => setPaymentF(v)} style={selStyle(paymentF === v)}>{l}</button>
            ))}
          </div>

          <span style={{ fontSize: '12px', color: 'var(--a-text-muted)', marginRight: 'auto' }}>
            {filtered.length} / {bookings.length} حجز
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff5f5',
            border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px',
            marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            <AlertCircle size={15} />{error}
          </div>
        )}

        {/* Table */}
        <div style={{ background: 'var(--a-surface)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <Loader2 size={32} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
              <p style={{ color: 'var(--a-text-muted)', marginTop: '12px', fontSize: '14px' }}>جاري تحميل الحجوزات...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <CalendarDays size={40} color="#ddd" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--a-text-muted)', fontSize: '14px' }}>لا توجد حجوزات مطابقة</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--a-surface-alt)', borderBottom: '2px solid var(--a-border)' }}>
                    {['رقم الحجز','العميل','الباقة','التاريخ','المجموع','الحجز','الدفع','إجراء'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700,
                        color: 'var(--a-text-soft)', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--a-border)',
                      background: i % 2 === 0 ? 'var(--a-surface)' : 'var(--a-surface-alt)',
                      transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,122,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--a-surface)' : 'var(--a-surface-alt)')}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: ATEMA_COLORS.deepBronze, whiteSpace: 'nowrap' }}>{b.booking_ref}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--a-text)' }}>{b.customer_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '2px' }}>{b.customer_phone}</div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--a-text)', whiteSpace: 'nowrap' }}>{b.package_name || `#${b.package_id}`}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--a-text)', whiteSpace: 'nowrap' }}>{b.event_date}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: ATEMA_COLORS.champagne, whiteSpace: 'nowrap' }}>{b.total.toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 14px' }}><StatusBadge status={b.status} /></td>
                      <td style={{ padding: '12px 14px' }}><PayBadge status={b.payment_status} /></td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setSelected(b)} title="عرض / تعديل"
                            style={{ background: 'rgba(37,99,235,0.14)', border: '1px solid rgba(37,99,235,0.32)', borderRadius: '6px',
                              padding: '6px 10px', cursor: 'pointer', color: '#60a5fa' }}>
                            <Eye size={14} />
                          </button>
                          <button onClick={() => setDeleteConf(b.id)} title="حذف"
                            style={{ background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.32)', borderRadius: '6px',
                              padding: '6px 10px', cursor: 'pointer', color: '#fca5a5' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!import.meta.env.VITE_SUPABASE_URL && (
          <div style={{ marginTop: '20px', padding: '12px 16px', background: '#fef3c7', border: '1px solid #fde68a',
            borderRadius: '8px', fontSize: '12px', color: '#92400e', textAlign: 'center' }}>
            ⚠️ وضع العرض — البيانات تجريبية. لتفعيل Supabase أضف VITE_SUPABASE_URL في ملف .env
          </div>
        )}
        </>}
      </div>

      {/* Booking detail modal */}
      {selected && (
        <BookingModal booking={selected} onClose={() => setSelected(null)}
          globalVatEnabled={globalVatEnabled} settings={settings}
          onSave={async (id, updates) => {
            const ok = await updateBooking(id, updates);
            if (ok) setSelected(null);
            return ok;
          }} />
      )}

      {/* Delete confirmation */}
      {deleteConf && (
        <div onClick={() => setDeleteConf(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--a-surface)', borderRadius: '14px',
            padding: '28px', maxWidth: '380px', width: '100%', textAlign: 'center',
            fontFamily: 'Cairo, Tajawal, Inter, sans-serif' }}>
            <Trash2 size={40} color="#dc2626" style={{ marginBottom: '14px' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--a-text)', marginBottom: '8px' }}>حذف الحجز؟</h3>
            <p style={{ fontSize: '13px', color: 'var(--a-text-soft)', marginBottom: '22px' }}>هذا الإجراء لا يمكن التراجع عنه.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConf(null)} style={{ padding: '10px 24px', border: '1.5px solid var(--a-border)',
                borderRadius: '8px', background: 'var(--a-surface)', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', fontWeight: 600 }}>إلغاء</button>
              <button onClick={async () => { await deleteBooking(deleteConf!); setDeleteConf(null); }}
                style={{ padding: '10px 24px', background: '#dc2626', color: 'white', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', fontWeight: 700 }}>نعم، احذف</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
