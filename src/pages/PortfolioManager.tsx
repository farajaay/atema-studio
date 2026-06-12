// ATEMA STUDIO — Admin Portfolio Manager.
// Upload, edit, sort, publish/unpublish, delete portfolio items.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { ATEMA_COLORS } from '../config/constants';
import {
  fetchPortfolioAll, upsertPortfolioItem, deletePortfolioItem, uploadPortfolioImage,
  CATEGORIES,
} from '../services/portfolio';
import type { PortfolioItem, PortfolioCategory } from '../services/portfolio';
import {
  LogOut, RefreshCw, Plus, Save, Trash2, Loader2,
  Eye, EyeOff, X, Image as ImageIcon, ChevronLeft,
} from 'lucide-react';

type Draft = Partial<PortfolioItem> & { id?: string };

export default function PortfolioManager() {
  const { user, loading: authLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  const [items, setItems]     = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit]       = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [filter, setFilter]   = useState<PortfolioCategory | 'all'>('all');

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin');
  }, [authLoading, user, navigate]);

  async function load() {
    setLoading(true);
    setItems(await fetchPortfolioAll());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleFile(file: File) {
    setUploading(true);
    const url = await uploadPortfolioImage(file);
    setUploading(false);
    if (url) setEdit(e => ({ ...(e ?? {}), image_url: url }));
    else alert('فشل رفع الصورة');
  }

  async function save() {
    if (!edit) return;
    if (!edit.image_url) { alert('يرجى رفع صورة'); return; }
    if (!edit.title_ar || !edit.title_en) { alert('العنوان مطلوب (عربي / إنجليزي)'); return; }
    setSaving(true);
    const ok = await upsertPortfolioItem({
      ...edit,
      category:   (edit.category   ?? 'bride') as PortfolioCategory,
      sort_order: edit.sort_order  ?? 100,
      published:  edit.published   ?? true,
    });
    setSaving(false);
    if (!ok) { alert('فشل الحفظ'); return; }
    setEdit(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا العنصر؟')) return;
    const ok = await deletePortfolioItem(id);
    if (!ok) { alert('فشل الحذف'); return; }
    load();
  }

  async function togglePublished(it: PortfolioItem) {
    const ok = await upsertPortfolioItem({ id: it.id, published: !it.published });
    if (ok) load();
  }

  const visible = filter === 'all' ? items : items.filter(i => i.category === filter);

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
            <ImageIcon size={17} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: ATEMA_COLORS.deepBronze }}>المعرض</div>
            <div style={{ fontSize: 11, color: 'var(--a-text-muted)' }}>Portfolio Manager</div>
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

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 30px' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12,
          alignItems: 'center', marginBottom: 20,
        }}>
          <button onClick={() => setEdit({
            title_ar: '', title_en: '', category: 'bride',
            image_url: '', sort_order: 100, published: true,
          })} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: ATEMA_COLORS.champagne, color: '#0B0B0B',
            border: 'none', borderRadius: 8, padding: '9px 18px',
            cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 13,
          }}>
            <Plus size={15} /> عنصر جديد
          </button>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginRight: 'auto' }}>
            {([{ key: 'all', ar: 'الكل' }, ...CATEGORIES] as const).map(c => (
              <button key={c.key} onClick={() => setFilter(c.key as PortfolioCategory | 'all')} style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                background: filter === c.key ? ATEMA_COLORS.champagne : 'var(--a-surface-alt)',
                color: filter === c.key ? '#0B0B0B' : 'var(--a-text-soft)',
                border: `1.5px solid ${filter === c.key ? ATEMA_COLORS.champagne : 'var(--a-border)'}`,
              }}>
                {c.ar}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--a-text-muted)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : visible.length === 0 ? (
          <div style={{
            background: 'var(--a-surface)', borderRadius: 12, padding: 60,
            textAlign: 'center', color: 'var(--a-text-muted)',
          }}>
            لا توجد عناصر — أضف أوّل صورة باستخدام «عنصر جديد».
          </div>
        ) : (
          <div style={{
            display: 'grid', gap: 14,
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          }}>
            {visible.map(it => (
              <div key={it.id} style={{
                background: 'var(--a-surface)', borderRadius: 12, overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                opacity: it.published ? 1 : 0.55,
              }}>
                <div style={{ aspectRatio: '3 / 4', overflow: 'hidden', background: '#eee' }}>
                  <img src={it.image_url} alt="" loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{
                    fontSize: 10, color: ATEMA_COLORS.champagne,
                    textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4,
                  }}>
                    {CATEGORIES.find(c => c.key === it.category)?.ar}
                  </div>
                  <div style={{
                    fontSize: 13, color: 'var(--a-text)', fontWeight: 600,
                    marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {it.title_ar}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--a-text-muted)', marginBottom: 8 }}>
                    ترتيب: {it.sort_order}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setEdit(it)} style={iconBtn('#a8a8a8')}>
                      تعديل
                    </button>
                    <button onClick={() => togglePublished(it)} title={it.published ? 'إخفاء' : 'نشر'}
                      style={iconBtn(it.published ? '#34d399' : '#a8a8a8')}>
                      {it.published ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button onClick={() => remove(it.id)} title="حذف"
                      style={iconBtn('#fca5a5')}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {edit && (
        <div onClick={() => setEdit(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--a-surface)', borderRadius: 14, padding: '24px 28px',
            maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20,
            }}>
              <h2 style={{ fontSize: 17, color: ATEMA_COLORS.deepBronze, margin: 0 }}>
                {edit.id ? 'تعديل العنصر' : 'عنصر جديد'}
              </h2>
              <button onClick={() => setEdit(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)',
              }}>
                <X size={20} />
              </button>
            </div>

            {/* Image */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>الصورة</label>
              {edit.image_url ? (
                <div style={{ position: 'relative' }}>
                  <img src={edit.image_url} alt=""
                    style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 8 }} />
                  <button onClick={() => setEdit(e => ({ ...(e ?? {}), image_url: '' }))}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)', color: 'white',
                      border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                    }}>
                    <X size={12} /> تغيير
                  </button>
                </div>
              ) : (
                <label style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '32px 16px', border: '1.5px dashed var(--a-border-strong)',
                  borderRadius: 8, cursor: 'pointer', color: 'var(--a-text-soft)',
                }}>
                  {uploading ? (
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <ImageIcon size={22} />
                      <span style={{ fontSize: 13 }}>اختر صورة للرفع</span>
                    </>
                  )}
                  <input type="file" accept="image/*" hidden
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </label>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>العنوان (عربي)</label>
                <input value={edit.title_ar ?? ''}
                  onChange={e => setEdit(s => ({ ...(s ?? {}), title_ar: e.target.value }))}
                  style={inp} dir="rtl" />
              </div>
              <div>
                <label style={lbl}>Title (English)</label>
                <input value={edit.title_en ?? ''}
                  onChange={e => setEdit(s => ({ ...(s ?? {}), title_en: e.target.value }))}
                  style={inp} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>الفئة</label>
                <select value={edit.category ?? 'bride'}
                  onChange={e => setEdit(s => ({ ...(s ?? {}), category: e.target.value as PortfolioCategory }))}
                  style={inp}>
                  {CATEGORIES.map(c => (
                    <option key={c.key} value={c.key}>{c.ar} — {c.en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>ترتيب العرض</label>
                <input type="number" value={edit.sort_order ?? 100}
                  onChange={e => setEdit(s => ({ ...(s ?? {}), sort_order: Number(e.target.value) }))}
                  style={inp} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>تعليق (عربي) — اختياري</label>
              <textarea value={edit.caption_ar ?? ''}
                onChange={e => setEdit(s => ({ ...(s ?? {}), caption_ar: e.target.value }))}
                style={{ ...inp, minHeight: 60, resize: 'vertical' }} dir="rtl" />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Caption (English) — optional</label>
              <textarea value={edit.caption_en ?? ''}
                onChange={e => setEdit(s => ({ ...(s ?? {}), caption_en: e.target.value }))}
                style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10,
              marginTop: 16, fontSize: 13, color: 'var(--a-text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={edit.published ?? true}
                onChange={e => setEdit(s => ({ ...(s ?? {}), published: e.target.checked }))} />
              منشور (مرئي للعملاء)
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={save} disabled={saving} style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                background: ATEMA_COLORS.champagne, color: '#0B0B0B',
                border: 'none', cursor: saving ? 'wait' : 'pointer',
                fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {saving
                  ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Save size={15} />}
                حفظ
              </button>
              <button onClick={() => setEdit(null)} style={{
                padding: '10px 18px', borderRadius: 8,
                background: 'var(--a-surface-alt)', color: 'var(--a-text)', border: 'none',
                cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
              }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--a-text)', marginBottom: 6,
};
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--a-border)',
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', background: 'var(--a-surface)', color: 'var(--a-text)',
};
function iconBtn(color: string): React.CSSProperties {
  return {
    flex: 1, padding: '6px 8px', borderRadius: 6,
    background: 'var(--a-surface-alt)', color, border: `1px solid ${color}33`,
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  };
}
