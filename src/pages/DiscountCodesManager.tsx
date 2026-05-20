// ATEMA STUDIO — Admin Discount Codes Manager.
// CRUD for promotional / partner discount codes. Lives at /admin/discount-codes.
// Design: docs/integrations/discount-codes.md.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, RefreshCw, Plus, Save, Trash2, Loader2, X, ChevronLeft,
  Tag, Play, Pause,
} from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { ATEMA_COLORS } from '../config/constants';
import {
  listDiscountCodes, upsertDiscountCode,
  setDiscountCodeActive, deleteDiscountCode,
  type DiscountCode, type DiscountKind,
} from '../services/discount';

interface Draft {
  isNew?:         boolean;
  code?:          string;
  description?:   string;
  kind?:          DiscountKind;
  value?:         number | '';
  max_discount?:  number | '' | null;
  min_subtotal?:  number | '';
  valid_from?:    string | '';
  valid_to?:      string | '';
  max_uses?:      number | '' | null;
  active?:        boolean;
}

const fmt = (n: number) => n.toLocaleString('ar-SA');

function asDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function DiscountCodesManager() {
  const { user, loading: authLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  const [items, setItems]     = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit]       = useState<Draft | null>(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin');
  }, [authLoading, user, navigate]);

  async function load() {
    setLoading(true);
    setItems(await listDiscountCodes());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setEdit({
      isNew:        true,
      code:         '',
      description:  '',
      kind:         'percent',
      value:        10,
      max_discount: null,
      min_subtotal: 0,
      valid_from:   '',
      valid_to:     '',
      max_uses:     null,
      active:       true,
    });
  }

  function startEdit(it: DiscountCode) {
    setEdit({
      isNew:        false,
      code:         it.code,
      description:  it.description ?? '',
      kind:         it.kind,
      value:        it.value,
      max_discount: it.max_discount,
      min_subtotal: it.min_subtotal,
      valid_from:   asDate(it.valid_from),
      valid_to:     asDate(it.valid_to),
      max_uses:     it.max_uses,
      active:       it.active,
    });
  }

  async function save() {
    if (!edit) return;
    const code = (edit.code ?? '').trim().toUpperCase();
    if (code.length < 2 || code.length > 32) {
      alert('الكود يجب أن يكون بين حرفين و٣٢ حرفاً');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      alert('الكود يقبل الحروف الكبيرة والأرقام و - و _ فقط');
      return;
    }
    const valNum = typeof edit.value === 'number' ? edit.value : Number(edit.value);
    if (!valNum || valNum <= 0) {
      alert('قيمة الخصم مطلوبة');
      return;
    }
    if (edit.kind === 'percent' && (valNum < 1 || valNum > 100)) {
      alert('الخصم المئوي يجب أن يكون بين ١ و ١٠٠');
      return;
    }
    setSaving(true);
    const saved = await upsertDiscountCode({
      code,
      description:  (edit.description ?? '') || null,
      kind:         edit.kind ?? 'percent',
      value:        valNum,
      max_discount: edit.max_discount === '' ? null : (edit.max_discount ?? null),
      min_subtotal: typeof edit.min_subtotal === 'number' ? edit.min_subtotal : Number(edit.min_subtotal) || 0,
      valid_from:   edit.valid_from ? new Date(edit.valid_from + 'T00:00:00').toISOString() : null,
      valid_to:     edit.valid_to   ? new Date(edit.valid_to + 'T23:59:59').toISOString()   : null,
      max_uses:     edit.max_uses === '' ? null : (edit.max_uses ?? null),
      active:       edit.active ?? true,
    });
    setSaving(false);
    if (!saved) { alert('فشل الحفظ — قد يكون الكود مكرراً'); return; }
    setEdit(null);
    load();
  }

  async function remove(code: string, usedCount: number) {
    if (usedCount > 0) {
      alert('لا يمكن حذف كود استُخدم — يمكن إيقافه فقط');
      return;
    }
    if (!confirm(`حذف الكود ${code}؟`)) return;
    const ok = await deleteDiscountCode(code);
    if (!ok) { alert('فشل الحذف'); return; }
    load();
  }

  async function togglePaused(it: DiscountCode) {
    const ok = await setDiscountCodeActive(it.code, !it.active);
    if (ok) load();
  }

  if (authLoading) {
    return <div style={{ padding: 80, textAlign: 'center' }}>...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-bg)', fontFamily: 'inherit' }}>
      {/* Top bar */}
      <div style={{
        background: 'var(--a-surface)', padding: isMobile ? '12px 16px' : '14px 30px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/admin/dashboard')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, color: 'var(--a-text-soft)',
          }}>
            <ChevronLeft size={18} /> {!isMobile && 'لوحة التحكم'}
          </button>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Tag size={16} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: ATEMA_COLORS.deepBronze }}>أكواد الخصم</div>
            <div style={{ fontSize: 11, color: 'var(--a-text-muted)' }}>Discount Codes</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
          <button onClick={load} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--a-text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
          }}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {!isMobile && 'تحديث'}
          </button>
          <button onClick={async () => { await logout(); navigate('/admin'); }} style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(220,38,38,0.10)',
            border: '1px solid rgba(220,38,38,0.32)', color: '#fca5a5', borderRadius: 8,
            padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <LogOut size={14} />{!isMobile && 'خروج'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 30px' }}>

        {/* Header + New */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 18, flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h2 style={{ fontFamily: "'Amiri', serif", fontSize: '1.4rem', margin: 0, color: 'var(--a-heading)' }}>
              أكواد الخصم
            </h2>
            <p style={{ fontSize: 12, color: 'var(--a-text-muted)', margin: '4px 0 0' }}>
              للحملات الموسمية، المؤثّرات، والتعويضات. الإجمالي: {items.length}
            </p>
          </div>
          <button onClick={startNew} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: ATEMA_COLORS.champagne, color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>
            <Plus size={14} /> كود جديد
          </button>
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--a-surface)', borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} color={ATEMA_COLORS.champagne} />
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center', color: 'var(--a-text-muted)', fontSize: 13 }}>
              لا توجد أكواد بعد. ابدئي بإضافة الكود الأول.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--a-surface-alt)', borderBottom: '2px solid var(--a-border)' }}>
                    {['الكود','النوع','القيمة','حد أدنى','الاستخدام','حتى','الحالة','إجراء'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700,
                        color: 'var(--a-text-soft)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.code} style={{
                      borderBottom: '1px solid var(--a-border)',
                      background: i % 2 === 0 ? 'var(--a-surface)' : 'var(--a-surface-alt)',
                      opacity: it.active ? 1 : 0.55,
                    }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700,
                        fontFamily: "'Inter', monospace", letterSpacing: 1,
                        color: ATEMA_COLORS.deepBronze }}>
                        {it.code}
                        {it.description && (
                          <div style={{ fontSize: 11, fontWeight: 400, fontFamily: 'inherit',
                            color: 'var(--a-text-muted)', letterSpacing: 'normal', marginTop: 2 }}>
                            {it.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--a-text)' }}>
                        {it.kind === 'percent' ? 'نسبة' : 'مبلغ'}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--a-text)' }}>
                        {it.kind === 'percent' ? `${it.value}٪` : `${fmt(it.value)} ر.س`}
                        {it.kind === 'percent' && it.max_discount && (
                          <div style={{ fontSize: 11, color: 'var(--a-text-muted)' }}>
                            بحد أقصى {fmt(it.max_discount)} ر.س
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--a-text-soft)' }}>
                        {it.min_subtotal > 0 ? `${fmt(it.min_subtotal)} ر.س` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--a-text)' }}>
                        <strong>{it.used_count}</strong>
                        {' / '}
                        {it.max_uses ?? '∞'}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--a-text-soft)', fontSize: 12 }}>
                        {asDate(it.valid_to) || '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                          background: it.active ? 'rgba(5,150,105,0.15)' : 'rgba(120,120,120,0.15)',
                          color: it.active ? '#059669' : '#888',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {it.active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => startEdit(it)} title="تعديل" style={{
                            background: 'rgba(37,99,235,0.14)',
                            border: '1px solid rgba(37,99,235,0.32)',
                            borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                            color: '#60a5fa',
                          }}>
                            <Save size={14} />
                          </button>
                          <button onClick={() => togglePaused(it)}
                            title={it.active ? 'إيقاف' : 'تشغيل'} style={{
                            background: 'rgba(212,175,122,0.14)',
                            border: '1px solid rgba(212,175,122,0.32)',
                            borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                            color: ATEMA_COLORS.deepBronze,
                          }}>
                            {it.active ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          {it.used_count === 0 && (
                            <button onClick={() => remove(it.code, it.used_count)} title="حذف" style={{
                              background: 'rgba(220,38,38,0.14)',
                              border: '1px solid rgba(220,38,38,0.32)',
                              borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                              color: '#fca5a5',
                            }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {edit && (
        <div onClick={() => !saving && setEdit(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, zIndex: 200,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--a-surface)', borderRadius: 14,
            maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid var(--a-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontWeight: 700, color: ATEMA_COLORS.deepBronze }}>
                {edit.isNew ? 'كود جديد' : 'تعديل الكود'}
              </div>
              <button onClick={() => !saving && setEdit(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)',
              }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 22, display: 'grid', gap: 12 }}>
              <Field label="الكود (يُكتب كبيراً)">
                <input
                  value={edit.code ?? ''}
                  onChange={e => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
                  disabled={!edit.isNew}
                  maxLength={32}
                  placeholder="RAMADAN25"
                  style={inp}
                />
              </Field>
              <Field label="وصف (للمشرف فقط)">
                <input
                  value={edit.description ?? ''}
                  onChange={e => setEdit({ ...edit, description: e.target.value })}
                  maxLength={120}
                  placeholder="حملة رمضان ٢٠٢٦"
                  style={inp}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="نوع الخصم">
                  <select
                    value={edit.kind ?? 'percent'}
                    onChange={e => setEdit({ ...edit, kind: e.target.value as DiscountKind })}
                    style={inp}>
                    <option value="percent">نسبة مئوية</option>
                    <option value="flat">مبلغ ثابت (ر.س)</option>
                  </select>
                </Field>
                <Field label={edit.kind === 'percent' ? 'النسبة (١–١٠٠)' : 'المبلغ (ر.س)'}>
                  <input
                    type="number"
                    value={edit.value ?? ''}
                    onChange={e => setEdit({ ...edit, value: e.target.value === '' ? '' : Number(e.target.value) })}
                    min={1}
                    style={inp}
                  />
                </Field>
              </div>

              {edit.kind === 'percent' && (
                <Field label="حد أقصى للخصم (ر.س — اختياري)">
                  <input
                    type="number"
                    value={edit.max_discount ?? ''}
                    onChange={e => setEdit({ ...edit, max_discount: e.target.value === '' ? null : Number(e.target.value) })}
                    min={0}
                    placeholder="بدون حد"
                    style={inp}
                  />
                </Field>
              )}

              <Field label="حد أدنى للحجز (ر.س)">
                <input
                  type="number"
                  value={edit.min_subtotal ?? ''}
                  onChange={e => setEdit({ ...edit, min_subtotal: e.target.value === '' ? 0 : Number(e.target.value) })}
                  min={0}
                  placeholder="٠"
                  style={inp}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="ساري من">
                  <input
                    type="date"
                    value={edit.valid_from ?? ''}
                    onChange={e => setEdit({ ...edit, valid_from: e.target.value })}
                    style={inp}
                  />
                </Field>
                <Field label="ساري حتى">
                  <input
                    type="date"
                    value={edit.valid_to ?? ''}
                    onChange={e => setEdit({ ...edit, valid_to: e.target.value })}
                    style={inp}
                  />
                </Field>
              </div>

              <Field label="عدد الاستخدامات الأقصى (اختياري)">
                <input
                  type="number"
                  value={edit.max_uses ?? ''}
                  onChange={e => setEdit({ ...edit, max_uses: e.target.value === '' ? null : Number(e.target.value) })}
                  min={1}
                  placeholder="بدون حد"
                  style={inp}
                />
              </Field>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                <input type="checkbox" checked={edit.active ?? true}
                  onChange={e => setEdit({ ...edit, active: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: ATEMA_COLORS.champagne }} />
                <span style={{ fontSize: 13, color: 'var(--a-text)' }}>الكود نشط</span>
              </label>
            </div>

            <div style={{
              padding: '14px 22px', borderTop: '1px solid var(--a-border)',
              display: 'flex', gap: 10, justifyContent: 'flex-end',
            }}>
              <button onClick={() => setEdit(null)} disabled={saving} style={{
                padding: '9px 18px', border: `1.5px solid ${ATEMA_COLORS.champagne}`, borderRadius: 8,
                background: 'var(--a-surface)', color: ATEMA_COLORS.champagne,
                fontWeight: 600, cursor: 'pointer', fontSize: 13,
              }}>
                إلغاء
              </button>
              <button onClick={save} disabled={saving} style={{
                padding: '9px 18px', background: ATEMA_COLORS.champagne, color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {saving
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> حفظ...</>
                  : <><Save size={14} /> حفظ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid var(--a-border)', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: 'var(--a-surface)', color: 'var(--a-text)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--a-text-soft)', marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
