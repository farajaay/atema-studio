import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { usePackagesData } from '../hooks/usePackagesData';
import type { Addon } from '../hooks/useAddonsData';
import { supabase } from '../services/supabase';
import { ATEMA_COLORS } from '../config/constants';
import { useBreakpoint } from '../hooks/useBreakpoint';
import {
  LayoutDashboard, LogOut, RefreshCw, Plus, Save, Trash2,
  CheckCircle2, Loader2, X, ChevronRight, Info, Eye, EyeOff,
  Tag, AlertTriangle, ArrowRight, Sliders, ArrowUp, ArrowDown,
  Layers,
} from 'lucide-react';

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', cursor: 'help', marginRight: '4px' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info size={13} color="#bbb" />
      {show && (
        <div style={{ position: 'absolute', bottom: '130%', right: '-8px', zIndex: 200,
          background: 'var(--a-gold)', color: '#0B0B0B', borderRadius: '9px', padding: '10px 14px',
          fontSize: '12px', width: '240px', lineHeight: 1.6, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          whiteSpace: 'normal', direction: 'rtl' }}>
          {text}
          <div style={{ position: 'absolute', bottom: '-5px', right: '12px',
            width: '10px', height: '10px', background: 'var(--a-gold)', transform: 'rotate(45deg)' }} />
        </div>
      )}
    </span>
  );
}

// ── Label row ─────────────────────────────────────────────────────────────────
function Label({ icon, text, tip }: { icon: React.ReactNode; text: string; tip: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', fontWeight: 700, color: 'var(--a-text)', marginBottom: '7px' }}>
      <span style={{ color: ATEMA_COLORS.champagne }}>{icon}</span>
      {text}
      <Tip text={tip} />
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
      <div onClick={() => onChange(!on)} style={{
        width: '44px', height: '24px', borderRadius: '12px', position: 'relative',
        background: on ? ATEMA_COLORS.champagne : '#ddd', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: '3px', right: on ? '3px' : '19px',
          width: '18px', height: '18px', borderRadius: '9px', background: 'var(--a-surface)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'right 0.2s' }} />
      </div>
      <span style={{ fontSize: '13px', color: 'var(--a-text)', fontWeight: 500 }}>{label}</span>
    </label>
  );
}

// ── Input style ───────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--a-border)',
  borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', background: 'var(--a-surface)', color: 'var(--a-text)',
};

// ── Empty state for new addon ─────────────────────────────────────────────────
const EMPTY: Omit<Addon, 'id'> = {
  name_ar: '', name_en: '', price: 500, active: true, sort_order: 100,
};

// ── Slug generator — mirrors PackagesManager's addon insert ───────────────────
function slugify(ar: string) {
  return ar.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AddonsManager() {
  const { user, loading: authLoading, logout } = useAdminAuth();
  const { packages } = usePackagesData();
  const navigate  = useNavigate();
  const { isMobile } = useBreakpoint();

  // ── Addons state ────────────────────────────────────────────────────────────
  const [addons,   setAddons]   = useState<Addon[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // ── Selection & form state ──────────────────────────────────────────────────
  const [selected,   setSelected]   = useState<Addon | null>(null);
  const [draft,      setDraft]      = useState<Addon | null>(null);
  const [isNew,      setIsNew]      = useState(false);
  const [customId,   setCustomId]   = useState('');   // editable id for new addon
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [deleteConf, setDeleteConf] = useState(false);
  const [showForm,   setShowForm]   = useState(false); // mobile panel toggle

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) navigate('/admin', { replace: true });
  }, [user, authLoading, navigate]);

  // ── Fetch ALL addons (admin view — includes inactive) ────────────────────────
  const fetchAddons = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!supabase) {
      // Supabase not configured — nothing to show in admin mode
      setAddons([]);
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('addons')
      .select('*')
      .order('sort_order');
    if (err) { setError(err.message); setAddons([]); }
    else      setAddons((data ?? []) as Addon[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAddons(); }, [fetchAddons]);

  // Auto-select first on load
  useEffect(() => {
    if (addons.length > 0 && !selected && !isNew) {
      setSelected(addons[0]);
      setDraft(addons[0]);
    }
  }, [addons]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection ───────────────────────────────────────────────────────────────
  function selectAddon(a: Addon) {
    setSelected(a); setDraft({ ...a }); setIsNew(false);
    setSaved(false); setDeleteConf(false);
    if (isMobile) setShowForm(true);
  }

  function startNew() {
    setSelected(null);
    setDraft({ id: '', ...EMPTY });
    setCustomId('');
    setIsNew(true); setSaved(false); setDeleteConf(false);
    if (isMobile) setShowForm(true);
  }

  function setField<K extends keyof Addon>(k: K, v: Addon[K]) {
    setDraft(d => d ? { ...d, [k]: v } : d);
    // Keep customId in sync when name_ar changes for new addons
    if (k === 'name_ar' && isNew && !customId) {
      // preview only — user still gets to confirm
    }
  }

  // Derived: which packages bundle this addon?
  const usedInPackages = selected
    ? packages.filter(p => (p.included_addon_ids ?? []).includes(selected.id))
    : [];

  // VAT preview
  const vatAmount   = draft ? Math.round((draft.price ?? 0) * 0.15) : 0;
  const totalIncVat = draft ? (draft.price ?? 0) + vatAmount : 0;

  // ── Save (create or update) ──────────────────────────────────────────────────
  async function handleSave() {
    if (!draft || !supabase) return;
    setSaving(true);
    setError(null);

    if (isNew) {
      const finalId = customId.trim() || slugify(draft.name_ar) + '-' + Date.now();
      const row: Addon = { ...draft, id: finalId };
      const { error: err } = await supabase.from('addons').insert(row);
      if (err) { setError(err.message); }
      else {
        await fetchAddons();
        setSaved(true);
        setIsNew(false);
        setTimeout(() => setSaved(false), 2000);
      }
    } else {
      // Update all mutable fields (id is PK — never changed for existing rows)
      const { error: err } = await supabase
        .from('addons')
        .update({
          name_ar:    draft.name_ar,
          name_en:    draft.name_en,
          price:      draft.price,
          active:     draft.active,
          sort_order: draft.sort_order,
        })
        .eq('id', draft.id);
      if (err) { setError(err.message); }
      else {
        setSelected({ ...draft });
        await fetchAddons();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    }
    setSaving(false);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selected || !supabase) return;
    setSaving(true);
    const { error: err } = await supabase.from('addons').delete().eq('id', selected.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSelected(null); setDraft(null); setDeleteConf(false); setShowForm(false);
    await fetchAddons();
  }

  // ── Sort order nudge (swap with neighbour) ────────────────────────────────────
  async function nudgeOrder(a: Addon, direction: 'up' | 'down') {
    if (!supabase) return;
    const sorted = [...addons].sort((x, y) => x.sort_order - y.sort_order);
    const idx = sorted.findIndex(x => x.id === a.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const neighbour = sorted[swapIdx];
    // Swap sort_order values
    await supabase.from('addons').update({ sort_order: neighbour.sort_order }).eq('id', a.id);
    await supabase.from('addons').update({ sort_order: a.sort_order }).eq('id', neighbour.id);
    await fetchAddons();
  }

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={36} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Top bar ─────────────────────────────────────────────────────────────────
  const TopBar = (
    <div style={{ background: 'var(--a-surface)', padding: isMobile ? '12px 16px' : '14px 30px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)', position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '8px',
          background: `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sliders size={17} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: ATEMA_COLORS.deepBronze }}>إدارة الإضافات</div>
          <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>{addons.length} إضافة</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
        <button onClick={() => navigate('/admin/packages')}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--a-surface-alt)',
            border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
            fontSize: '13px', fontFamily: 'inherit', color: 'var(--a-text)', fontWeight: 600 }}>
          <Layers size={14} />{!isMobile && 'الباقات'}
        </button>
        <button onClick={() => navigate('/admin/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--a-surface-alt)',
            border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
            fontSize: '13px', fontFamily: 'inherit', color: 'var(--a-text)', fontWeight: 600 }}>
          <LayoutDashboard size={14} />{!isMobile && 'الحجوزات'}
        </button>
        <button onClick={fetchAddons} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}>
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
        <button onClick={async () => { await logout(); navigate('/admin'); }}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(220,38,38,0.10)',
            border: '1px solid rgba(220,38,38,0.32)', color: '#fca5a5', borderRadius: '8px',
            padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 600 }}>
          <LogOut size={14} />{!isMobile && 'خروج'}
        </button>
      </div>
    </div>
  );

  // ── Addon list panel ─────────────────────────────────────────────────────────
  const AddonList = (
    <div style={{ width: isMobile ? '100%' : '300px', flexShrink: 0,
      background: 'var(--a-surface)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      overflow: 'hidden', alignSelf: 'flex-start' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--a-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--a-text)' }}>الإضافات</span>
        <button onClick={startNew} style={{ display: 'flex', alignItems: 'center', gap: '5px',
          background: ATEMA_COLORS.champagne, color: '#0B0B0B', border: 'none', borderRadius: '8px',
          padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', fontWeight: 700 }}>
          <Plus size={13} /> جديدة
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center' }}>
          <Loader2 size={24} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : addons.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--a-text-muted)', fontSize: '13px' }}>
          لا توجد إضافات — أضف أولى
        </div>
      ) : (
        addons.map((a, idx) => {
          const isActive = selected?.id === a.id && !isNew;
          return (
            <div key={a.id}
              style={{ padding: '12px 18px', cursor: 'pointer', transition: 'background 0.15s',
                borderBottom: '1px solid var(--a-border)',
                background: isActive ? 'rgba(212,175,122,0.10)' : 'var(--a-surface)',
                borderRight: isActive ? `3px solid ${ATEMA_COLORS.champagne}` : '3px solid transparent',
                display: 'flex', alignItems: 'center', gap: '8px' }}>

              {/* Sort nudge buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}
                onClick={e => e.stopPropagation()}>
                <button onClick={() => nudgeOrder(a, 'up')} disabled={idx === 0}
                  style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer',
                    color: idx === 0 ? 'var(--a-border)' : 'var(--a-text-muted)', padding: '0 2px', lineHeight: 1 }}>
                  <ArrowUp size={11} />
                </button>
                <button onClick={() => nudgeOrder(a, 'down')} disabled={idx === addons.length - 1}
                  style={{ background: 'none', border: 'none', cursor: idx === addons.length - 1 ? 'not-allowed' : 'pointer',
                    color: idx === addons.length - 1 ? 'var(--a-border)' : 'var(--a-text-muted)', padding: '0 2px', lineHeight: 1 }}>
                  <ArrowDown size={11} />
                </button>
              </div>

              {/* Row content */}
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => selectAddon(a)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: ATEMA_COLORS.deepBronze,
                      marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.name_ar}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginBottom: '3px',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.name_en}
                    </div>
                    <div style={{ fontSize: '12px', color: ATEMA_COLORS.champagne, fontWeight: 700 }}>
                      {a.price.toLocaleString()} ر.س
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginRight: '4px' }}>
                    {!a.active && (
                      <span style={{ fontSize: '10px', background: 'rgba(220,38,38,0.15)',
                        color: '#fca5a5', padding: '2px 7px', borderRadius: '8px', fontWeight: 600 }}>
                        مخفية
                      </span>
                    )}
                    {isActive && <ChevronRight size={14} color="#D4AF7A" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ── Edit / create form ───────────────────────────────────────────────────────
  const EditForm = draft ? (
    <div style={{ flex: 1, background: 'var(--a-surface)', borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: isMobile ? '20px 16px' : '28px 30px' }}>

      {/* Form header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '17px', color: ATEMA_COLORS.deepBronze }}>
            {isNew ? 'إضافة جديدة' : `تعديل: ${draft.name_ar || '—'}`}
          </div>
          {!isNew && (
            <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '2px', direction: 'ltr', textAlign: 'right' }}>
              ID: <code style={{ fontFamily: 'monospace' }}>{draft.id}</code>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Toggle on={draft.active} onChange={v => setField('active', v)}
            label={draft.active ? 'مفعّلة' : 'مخفية'} />
          {isMobile && (
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* VAT preview banner */}
      <div style={{ background: ATEMA_COLORS.softIvory, borderRadius: '10px', padding: '12px 16px',
        marginBottom: '24px', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginBottom: '3px' }}>السعر (بدون VAT)</div>
          <div style={{ fontWeight: 700, color: ATEMA_COLORS.deepBronze, fontSize: '16px' }}>{(draft.price ?? 0).toLocaleString()} ر.س</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginBottom: '3px' }}>VAT 15%</div>
          <div style={{ fontWeight: 700, color: 'var(--a-text-soft)', fontSize: '16px' }}>{vatAmount.toLocaleString()} ر.س</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginBottom: '3px' }}>إجمالي العميل</div>
          <div style={{ fontWeight: 700, color: ATEMA_COLORS.champagne, fontSize: '16px' }}>{totalIncVat.toLocaleString()} ر.س</div>
        </div>
      </div>

      {/* Main fields */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '18px', marginBottom: '18px' }}>

        <div>
          <Label icon={<Tag size={13} />} text="الاسم بالعربية *"
            tip="اسم الإضافة كما يظهر للعميلة في قائمة الإضافات أثناء الحجز. اجعله وصفياً وموجزاً." />
          <input value={draft.name_ar}
            onChange={e => {
              setField('name_ar', e.target.value);
              if (isNew && !customId) {
                // Mirror a preview into the id field hint only
              }
            }}
            style={inp} placeholder="مثال: ساعة تصوير إضافية" />
        </div>

        <div>
          <Label icon={<Tag size={13} />} text="الاسم بالإنجليزية"
            tip="Name in English — shown in booking receipts and contract." />
          <input value={draft.name_en} onChange={e => setField('name_en', e.target.value)}
            style={inp} placeholder="Example: Extra photo hour" />
        </div>

        <div>
          <Label icon={<Tag size={13} />} text="السعر (بدون VAT) — ر.س *"
            tip="سعر الإضافة قبل الضريبة. تُضاف 15% VAT تلقائياً للعميل عند إضافتها للحجز." />
          <input type="number" min={0} value={draft.price}
            onChange={e => setField('price', Number(e.target.value))} style={inp} />
        </div>

        <div>
          <Label icon={<ArrowDown size={13} />} text="ترتيب الظهور"
            tip="رقم أصغر = يظهر أعلى في القائمة. الفرق بين الأرقام لا يهم — ما يهم هو الترتيب النسبي. يمكنك أيضاً استخدام الأسهم في القائمة الجانبية لتبديل الترتيب مباشرة." />
          <input type="number" min={0} step={10} value={draft.sort_order}
            onChange={e => setField('sort_order', Number(e.target.value))} style={inp} />
        </div>

        {/* New addon: custom ID */}
        {isNew && (
          <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
            <Label icon={<Tag size={13} />} text="المعرّف (ID) — اختياري"
              tip="معرّف فريد بالإنجليزية يُستخدم داخلياً لربط الإضافة بالباقات (مثال: extra-hour). إذا تركته فارغاً، يُولَّد تلقائياً من الاسم العربي. لا يمكن تغييره بعد الحفظ — اختره بعناية." />
            <input value={customId} onChange={e => setCustomId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder={`تلقائي: ${slugify(draft.name_ar) || 'addon'}-...`}
              style={{ ...inp, fontFamily: 'monospace', direction: 'ltr' }} />
            <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '5px' }}>
              أحرف إنجليزية صغيرة وأرقام وشرطة فقط. مثال: <code>henna-night</code>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <Label icon={draft.active ? <Eye size={13} /> : <EyeOff size={13} />} text="حالة الإضافة"
              tip="الإضافات المخفية لا تظهر للعميلة في صفحة الحجز، لكنها تبقى محفوظة في النظام. مفيد للإضافات الموسمية أو التي هي قيد المراجعة." />
            <Toggle on={draft.active} onChange={v => setField('active', v)}
              label={draft.active ? 'ظاهرة في صفحة الحجز' : 'مخفية من الحجز'} />
          </div>
        </div>

      </div>

      {/* Packages that bundle this addon */}
      {!isNew && (
        <div style={{ marginBottom: '24px', borderTop: '1px solid var(--a-border)', paddingTop: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: ATEMA_COLORS.champagne }}><Layers size={13} /></span>
            الباقات التي تتضمن هذه الإضافة
            <Tip text="الباقات التي تم تحديد هذه الإضافة كـ 'مشمولة' فيها. لتعديل هذا الربط، اذهب إلى إدارة الباقات." />
          </div>
          {usedInPackages.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--a-text-muted)', padding: '8px 12px',
              background: 'var(--a-surface-alt)', borderRadius: '8px', border: '1px solid var(--a-border)' }}>
              لا توجد باقات تتضمن هذه الإضافة حالياً — يمكن للعميلة إضافتها بشكل منفرد أثناء الحجز.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {usedInPackages.map(p => (
                <span key={p.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    background: 'rgba(212,175,122,0.12)', border: `1px solid ${ATEMA_COLORS.champagne}`,
                    color: ATEMA_COLORS.deepBronze, cursor: 'pointer' }}
                  onClick={() => navigate('/admin/packages')}>
                  {p.name_ar}
                  <ArrowRight size={11} color={ATEMA_COLORS.champagne} />
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        paddingTop: '20px', borderTop: '1px solid var(--a-border)' }}>
        <button onClick={handleSave}
          disabled={saving || !supabase || !draft.name_ar.trim() || (draft.price ?? 0) <= 0}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 24px',
            background: saved ? '#059669' : ATEMA_COLORS.champagne, color: '#0B0B0B', border: 'none',
            borderRadius: '9px', fontWeight: 700, fontSize: '14px', fontFamily: 'inherit',
            transition: 'background 0.2s',
            cursor: (saving || !supabase || !draft.name_ar.trim() || (draft.price ?? 0) <= 0) ? 'not-allowed' : 'pointer',
            opacity: (!supabase || !draft.name_ar.trim() || (draft.price ?? 0) <= 0) ? 0.5 : 1 }}>
          {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />حفظ...</>
           : saved  ? <><CheckCircle2 size={15} />تم الحفظ</>
           : <><Save size={15} />{isNew ? 'إنشاء الإضافة' : 'حفظ التغييرات'}</>}
        </button>

        {!isNew && !deleteConf && (
          <button onClick={() => setDeleteConf(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 18px',
              background: 'rgba(220,38,38,0.10)', border: '1.5px solid rgba(220,38,38,0.32)', color: '#fca5a5',
              borderRadius: '9px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 600 }}>
            <Trash2 size={14} /> حذف الإضافة
          </button>
        )}

        {deleteConf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(220,38,38,0.10)', border: '1.5px solid rgba(220,38,38,0.32)',
            borderRadius: '9px', padding: '10px 14px' }}>
            <AlertTriangle size={14} color="#dc2626" />
            <span style={{ fontSize: '13px', color: '#fca5a5', fontWeight: 600 }}>
              {usedInPackages.length > 0
                ? `تنبيه: ${usedInPackages.length} باقة تتضمن هذه الإضافة. تأكيد الحذف؟`
                : 'تأكيد الحذف؟'}
            </span>
            <button onClick={handleDelete}
              style={{ background: '#dc2626', color: 'white', border: 'none',
                borderRadius: '6px', padding: '5px 14px', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'inherit', fontWeight: 700 }}>نعم</button>
            <button onClick={() => setDeleteConf(false)}
              style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)',
                borderRadius: '6px', padding: '5px 14px', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'inherit' }}>إلغاء</button>
          </div>
        )}

        {!isNew && (
          <a href="https://atemastudio.xyz/#/book" target="_blank" rel="noreferrer"
            style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', color: 'var(--a-text-muted)', textDecoration: 'none' }}>
            <ArrowRight size={12} /> معاينة الحجز
          </a>
        )}
      </div>

      {!supabase && (
        <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(217,119,6,0.14)',
          border: '1px solid rgba(217,119,6,0.32)', borderRadius: '8px', fontSize: '12px', color: '#fbbf24' }}>
          ⚠️ وضع العرض — التغييرات لن تُحفظ. أضف VITE_SUPABASE_URL لتفعيل الحفظ الحقيقي.
        </div>
      )}

      {error && (
        <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(220,38,38,0.10)',
          border: '1px solid rgba(220,38,38,0.32)', borderRadius: '8px', fontSize: '12px', color: '#fca5a5' }}>
          {error}
        </div>
      )}
    </div>
  ) : (
    <div style={{ flex: 1, background: 'var(--a-surface)', borderRadius: '12px', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '60px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', color: 'var(--a-text-muted)', flexDirection: 'column', gap: '12px' }}>
      <Sliders size={40} />
      <p style={{ fontSize: '14px' }}>اختر إضافة من القائمة أو أنشئ واحدة جديدة</p>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-bg)',
      fontFamily: 'Cairo, Tajawal, Inter, sans-serif', direction: 'rtl' }}>
      {TopBar}
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 30px' }}>
        {isMobile ? (
          showForm ? EditForm : AddonList
        ) : (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {AddonList}
            {EditForm}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
