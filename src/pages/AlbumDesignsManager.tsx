// ATEMA STUDIO — Admin: album cover palette manager (/admin/album-designs).
//
// CRUD over album_designs — the curated cover skins (fabric F-series + croc
// leather E-series) the bride picks from post-event. Mirrors the other admin
// managers' chrome (auth guard, header nav, logout). Phase 1 of the album
// feature — see docs/plans/album-selection.md.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { ATEMA_COLORS } from '../config/constants';
import {
  fetchAllDesigns, saveDesign, deleteDesign,
  type AlbumDesign, type DesignDraft, type AlbumMaterial, type AlbumTexture,
} from '../services/album';
import {
  LayoutDashboard, LogOut, RefreshCw, Plus, Save, Trash2, X,
  Loader2, Eye, EyeOff, BookOpen, Check,
} from 'lucide-react';

const BLANK: DesignDraft = {
  code: '', material: 'fabric', texture: 'linen',
  name_ar: '', name_en: '', blurb_ar: '', blurb_en: '',
  swatch_hex: '#B08A57', preview_url: null, active: true, sort_order: 0,
};

export default function AlbumDesignsManager() {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAdminAuth();
  const { isMobile } = useBreakpoint();

  const [designs, setDesigns] = useState<AlbumDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DesignDraft | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !user) navigate('/admin', { replace: true }); }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setDesigns(await fetchAllDesigns());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  async function onSave() {
    if (!editing) return;
    if (!editing.code.trim() || !editing.name_ar.trim() || !editing.name_en.trim()) {
      flash('الكود والاسم (عربي/إنجليزي) مطلوبة'); return;
    }
    setSaving(true);
    const saved = await saveDesign(editing);
    setSaving(false);
    if (saved) { setEditing(null); flash('تم الحفظ'); load(); }
    else flash('تعذّر الحفظ — تحقّقي أن الكود غير مكرّر');
  }

  async function onDelete(d: AlbumDesign) {
    if (!confirm(`حذف التصميم ${d.code}؟`)) return;
    if (await deleteDesign(d.id)) { flash('تم الحذف'); load(); }
    else flash('تعذّر الحذف');
  }

  async function toggleActive(d: AlbumDesign) {
    await saveDesign({ ...d, active: !d.active }); load();
  }

  if (authLoading || !user) return null;

  const fabric  = designs.filter(d => d.material === 'fabric');
  const leather = designs.filter(d => d.material === 'leather');

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--a-bg)', fontFamily: 'Tajawal, sans-serif' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--a-border)', background: 'var(--a-surface)',
        position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={20} color={ATEMA_COLORS.champagne} />
          <span style={{ fontWeight: 700, color: 'var(--a-text)', fontSize: 15 }}>لوحة أغلفة الألبوم</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <NavBtn icon={<RefreshCw size={14} />} label={isMobile ? '' : 'تحديث'} onClick={load} />
          <NavBtn icon={<LayoutDashboard size={14} />} label={isMobile ? '' : 'الحجوزات'} onClick={() => navigate('/admin/dashboard')} />
          <NavBtn icon={<LogOut size={14} />} label={isMobile ? '' : 'خروج'} onClick={async () => { await logout(); navigate('/admin'); }} />
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 18px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ color: 'var(--a-text-muted)', fontSize: 13, margin: 0, maxWidth: 560, lineHeight: 1.7 }}>
            الأغلفة التي تختار منها العروس بعد المناسبة. عائلتان: قماش كتّان (F) وجلد مطبوع (E / NERO).
          </p>
          <button onClick={() => setEditing({ ...BLANK, sort_order: (designs.at(-1)?.sort_order ?? 0) + 10 })}
            style={primaryBtn}>
            <Plus size={15} /> إضافة غلاف
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={30} className="spin" color={ATEMA_COLORS.champagne} /></div>
        ) : (
          <>
            <MaterialGroup title="قماش كتّان — F-Series" items={fabric}
              onEdit={setEditing} onDelete={onDelete} onToggle={toggleActive} />
            <MaterialGroup title="جلد مطبوع — Leather" items={leather}
              onEdit={setEditing} onDelete={onDelete} onToggle={toggleActive} />
          </>
        )}
      </main>

      {editing && (
        <EditPanel draft={editing} setDraft={setEditing} onSave={onSave} saving={saving}
          onClose={() => setEditing(null)} />
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, insetInline: 0, textAlign: 'center', zIndex: 100 }}>
          <span style={{ background: 'var(--a-gold)', color: '#0B0B0B', padding: '10px 22px', borderRadius: 10,
            fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>{toast}</span>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function NavBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
      border: '1px solid var(--a-border)', background: 'none', borderRadius: 8, cursor: 'pointer',
      color: 'var(--a-text)', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' }}>
      {icon}{label}
    </button>
  );
}

function MaterialGroup({ title, items, onEdit, onDelete, onToggle }: {
  title: string; items: AlbumDesign[];
  onEdit: (d: AlbumDesign) => void; onDelete: (d: AlbumDesign) => void; onToggle: (d: AlbumDesign) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginBottom: 30 }}>
      <h3 style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--a-text-muted)',
        textTransform: 'uppercase', marginBottom: 12 }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {items.map(d => (
          <div key={d.id} style={{ border: '1px solid var(--a-border)', borderRadius: 12, overflow: 'hidden',
            background: 'var(--a-surface)', opacity: d.active ? 1 : 0.5 }}>
            <div style={{ height: 84, background: d.preview_url ? `center/cover url(${d.preview_url})` : d.swatch_hex,
              position: 'relative' }}>
              <span style={{ position: 'absolute', top: 8, insetInlineStart: 8, background: 'rgba(0,0,0,0.55)',
                color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, letterSpacing: '0.05em' }}>
                {d.code}
              </span>
            </div>
            <div style={{ padding: '9px 11px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-text)' }}>{d.name_ar}</div>
              <div style={{ fontSize: 11, color: 'var(--a-text-muted)', marginBottom: 8 }}>{d.name_en}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <IconBtn onClick={() => onEdit(d)} title="تعديل"><Save size={13} /></IconBtn>
                <IconBtn onClick={() => onToggle(d)} title={d.active ? 'إخفاء' : 'تفعيل'}>
                  {d.active ? <Eye size={13} /> : <EyeOff size={13} />}
                </IconBtn>
                <IconBtn onClick={() => onDelete(d)} title="حذف" danger><Trash2 size={13} /></IconBtn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} style={{ flex: 1, display: 'flex', justifyContent: 'center',
      padding: '6px 0', border: '1px solid var(--a-border)', borderRadius: 7, cursor: 'pointer',
      background: 'none', color: danger ? '#c0392b' : 'var(--a-text-muted)' }}>
      {children}
    </button>
  );
}

function EditPanel({ draft, setDraft, onSave, saving, onClose }: {
  draft: DesignDraft; setDraft: (d: DesignDraft) => void; onSave: () => void; saving: boolean; onClose: () => void;
}) {
  const set = (patch: Partial<DesignDraft>) => setDraft({ ...draft, ...patch });
  const field: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 8,
    border: '1px solid var(--a-border)', background: 'var(--a-bg)', color: 'var(--a-text)', fontSize: 13, fontFamily: 'inherit' };
  const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--a-text-muted)', marginBottom: 5, display: 'block' };
  const materials: AlbumMaterial[] = ['fabric', 'leather'];
  const textures: AlbumTexture[] = ['plain', 'linen', 'croc'];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ width: '100%', maxWidth: 440, maxHeight: '90vh',
        overflowY: 'auto', background: 'var(--a-surface)', borderRadius: 16, border: '1px solid var(--a-border)', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, color: 'var(--a-text)', fontSize: 15 }}>{draft.id ? 'تعديل غلاف' : 'غلاف جديد'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}><X size={18} /></button>
        </div>

        {/* Live swatch preview */}
        <div style={{ height: 70, borderRadius: 10, marginBottom: 16, background: draft.swatch_hex,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700,
          textShadow: '0 1px 4px rgba(0,0,0,0.5)', letterSpacing: '0.05em' }}>{draft.code || '—'}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>الكود</label><input style={field} value={draft.code} onChange={e => set({ code: e.target.value.toUpperCase() })} placeholder="F334 / NERO" /></div>
          <div><label style={lbl}>لون الشريحة</label>
            <input type="color" style={{ ...field, height: 38, padding: 3 }} value={draft.swatch_hex} onChange={e => set({ swatch_hex: e.target.value })} />
          </div>
          <div><label style={lbl}>الخامة</label>
            <select style={field} value={draft.material} onChange={e => set({ material: e.target.value as AlbumMaterial })}>
              {materials.map(m => <option key={m} value={m}>{m === 'fabric' ? 'قماش' : 'جلد'}</option>)}
            </select>
          </div>
          <div><label style={lbl}>الملمس</label>
            <select style={field} value={draft.texture} onChange={e => set({ texture: e.target.value as AlbumTexture })}>
              {textures.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label style={lbl}>الاسم (عربي)</label><input style={field} value={draft.name_ar} onChange={e => set({ name_ar: e.target.value })} /></div>
          <div><label style={lbl}>الاسم (إنجليزي)</label><input style={field} value={draft.name_en} onChange={e => set({ name_en: e.target.value })} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>وصف قصير (عربي)</label><input style={field} value={draft.blurb_ar ?? ''} onChange={e => set({ blurb_ar: e.target.value })} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>وصف قصير (إنجليزي)</label><input style={field} value={draft.blurb_en ?? ''} onChange={e => set({ blurb_en: e.target.value })} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>رابط صورة (اختياري)</label><input style={field} value={draft.preview_url ?? ''} onChange={e => set({ preview_url: e.target.value || null })} placeholder="/photos/..." /></div>
          <div><label style={lbl}>الترتيب</label><input type="number" style={field} value={draft.sort_order} onChange={e => set({ sort_order: Number(e.target.value) })} /></div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--a-text)' }}>
              <input type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} /> مُفعّل
            </label>
          </div>
        </div>

        <button onClick={onSave} disabled={saving} style={{ ...primaryBtn, width: '100%', marginTop: 18, justifyContent: 'center' }}>
          {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />} حفظ
        </button>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none',
  background: 'var(--a-gold)', color: '#0B0B0B', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
