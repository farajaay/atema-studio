import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { usePackagesData } from '../hooks/usePackagesData';
import type { Package } from '../hooks/usePackagesData';
import { useAddonsData } from '../hooks/useAddonsData';
import type { Addon } from '../hooks/useAddonsData';
import { supabase } from '../services/supabase';
import { ATEMA_COLORS } from '../config/constants';
import { useBreakpoint } from '../hooks/useBreakpoint';
import {
  LayoutDashboard, LogOut, RefreshCw, Plus, Save, Trash2,
  CheckCircle2, Loader2, X, ChevronRight, Info, Eye, EyeOff,
  Tag, Clock, Camera, Image, Video, Star, FileText, Layers,
  AlertTriangle, ArrowRight
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

// ── Features editor ───────────────────────────────────────────────────────────
function FeaturesEditor({ features, onChange }: {
  features: string[]; onChange: (f: string[]) => void;
}) {
  const [newItem, setNewItem] = useState('');
  return (
    <div>
      {features.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
          <CheckCircle2 size={13} color="#D4AF7A" style={{ flexShrink: 0 }} />
          <input value={f} onChange={e => { const a = [...features]; a[i] = e.target.value; onChange(a); }}
            style={{ ...inp, flex: 1, padding: '7px 10px' }} />
          <button onClick={() => onChange(features.filter((_, j) => j !== i))}
            style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.28)',
              borderRadius: '6px', padding: '6px 8px',
              cursor: 'pointer', color: '#fca5a5', flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="ميزة جديدة..."
          onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { onChange([...features, newItem.trim()]); setNewItem(''); } }}
          style={{ ...inp, flex: 1, padding: '7px 10px' }} />
        <button onClick={() => { if (newItem.trim()) { onChange([...features, newItem.trim()]); setNewItem(''); } }}
          style={{ background: 'rgba(212,175,122,0.16)', border: `1px solid ${ATEMA_COLORS.champagne}`,
            borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: ATEMA_COLORS.champagne,
            fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
          + إضافة
        </button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
const EMPTY: Omit<Package, 'id'> = {
  name_ar: '', name_en: '', price: 2000, duration_hours: 3, edited_photos: 150,
  editorial_photos: 0,
  album: '', video: false, description: '', features: [], badge: '', is_popular: false, active: true,
  included_addon_ids: [],
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PackagesManager() {
  const { user, loading: authLoading, logout } = useAdminAuth();
  const { packages, loading, error, fetchPackages, updatePackage, createPackage, deletePackage } = usePackagesData();
  const { addons, loading: addonsLoading } = useAddonsData();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  const [selected,    setSelected]    = useState<Package | null>(null);
  const [draft,       setDraft]       = useState<Package | null>(null);
  const [isNew,       setIsNew]       = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [deleteConf,  setDeleteConf]  = useState(false);
  const [showForm,    setShowForm]    = useState(false);  // mobile: show list or form

  // New addon form
  const [newAddonAr,    setNewAddonAr]    = useState('');
  const [newAddonEn,    setNewAddonEn]    = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState<number>(0);
  const [savingAddon,   setSavingAddon]   = useState(false);
  const [addonSaved,    setAddonSaved]    = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin', { replace: true });
  }, [user, authLoading, navigate]);

  // Select first package on load
  useEffect(() => {
    if (packages.length > 0 && !selected && !isNew) {
      setSelected(packages[0]);
      setDraft(packages[0]);
    }
  }, [packages]);

  function selectPackage(pkg: Package) {
    setSelected(pkg); setDraft(pkg); setIsNew(false);
    setSaved(false); setDeleteConf(false);
    if (isMobile) setShowForm(true);
  }

  function startNew() {
    setSelected(null); setDraft({ ...EMPTY, id: -1 } as Package);
    setIsNew(true); setSaved(false); setDeleteConf(false);
    if (isMobile) setShowForm(true);
  }

  function setField<K extends keyof Package>(k: K, v: Package[K]) {
    setDraft(d => d ? { ...d, [k]: v } : d);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    let ok = false;
    if (isNew) {
      const { id: _id, ...rest } = draft as Package;
      const created = await createPackage(rest);
      if (created) { setSelected(created); setDraft(created); setIsNew(false); ok = true; }
    } else {
      ok = await updatePackage(draft as Package);
      if (ok) setSelected(draft);
    }
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  async function handleDelete() {
    if (!selected) return;
    setSaving(true);
    const ok = await deletePackage(selected.id);
    setSaving(false);
    if (ok) {
      setSelected(null); setDraft(null); setDeleteConf(false); setShowForm(false);
      setTimeout(() => {
        if (packages.length > 1) { const first = packages.find(p => p.id !== selected.id); if (first) selectPackage(first); }
      }, 100);
    }
  }

  async function handleSaveAddon() {
    if (!newAddonAr.trim() || newAddonPrice <= 0) return;
    setSavingAddon(true);
    const id = newAddonAr.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') + '-' + Date.now();
    if (supabase) {
      await supabase.from('addons').insert({
        id, name_ar: newAddonAr.trim(), name_en: newAddonEn.trim() || newAddonAr.trim(),
        price: newAddonPrice, active: true, sort_order: 99,
      });
    }
    setSavingAddon(false);
    setAddonSaved(true);
    setNewAddonAr(''); setNewAddonEn(''); setNewAddonPrice(0);
    setTimeout(() => setAddonSaved(false), 2000);
  }

  function toggleIncludedAddon(addonId: string) {
    if (!draft) return;
    const current = draft.included_addon_ids ?? [];
    const updated  = current.includes(addonId)
      ? current.filter(id => id !== addonId)
      : [...current, addonId];
    setDraft(d => d ? { ...d, included_addon_ids: updated } : d);
  }

  const VAT_RATE = 0.15;
  const vatAmount   = draft ? Math.round(draft.price * VAT_RATE) : 0;
  const totalIncVat = draft ? draft.price + vatAmount : 0;

  const BADGE_SUGGESTIONS = ['الأكثر طلباً', 'موصى به', 'VIP', 'جديد', 'محدود', 'الأفضل قيمة'];

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={36} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Shared top bar ──────────────────────────────────────────────────────────
  const TopBar = (
    <div style={{ background: 'var(--a-surface)', padding: isMobile ? '12px 16px' : '14px 30px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)', position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '8px',
          background: `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={17} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: ATEMA_COLORS.deepBronze }}>إدارة الباقات</div>
          <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>{packages.length} باقة</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
        <button onClick={() => navigate('/admin/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--a-surface-alt)',
            border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
            fontSize: '13px', fontFamily: 'inherit', color: 'var(--a-text)', fontWeight: 600 }}>
          <LayoutDashboard size={14} /> الحجوزات
        </button>
        <button onClick={fetchPackages} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}>
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

  // ── Package list sidebar ────────────────────────────────────────────────────
  const PackageList = (
    <div style={{ width: isMobile ? '100%' : '280px', flexShrink: 0,
      background: 'var(--a-surface)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      overflow: 'hidden', alignSelf: 'flex-start' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--a-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--a-text)' }}>الباقات</span>
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
      ) : packages.map(pkg => {
        const isActive = selected?.id === pkg.id && !isNew;
        return (
          <div key={pkg.id} onClick={() => selectPackage(pkg)}
            style={{ padding: '14px 18px', cursor: 'pointer', transition: 'background 0.15s',
              borderBottom: '1px solid var(--a-border)',
              background: isActive ? 'rgba(212,175,122,0.10)' : 'var(--a-surface)',
              borderRight: isActive ? `3px solid ${ATEMA_COLORS.champagne}` : '3px solid transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: ATEMA_COLORS.deepBronze, marginBottom: '3px' }}>
                  {pkg.name_ar}
                  {pkg.badge && <span style={{ marginRight: '6px', background: 'rgba(212,175,122,0.16)',
                    color: ATEMA_COLORS.champagne, fontSize: '10px', padding: '1px 6px',
                    borderRadius: '10px', fontWeight: 600 }}>{pkg.badge}</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>{pkg.name_en}</div>
                <div style={{ fontSize: '12px', color: ATEMA_COLORS.champagne, fontWeight: 700, marginTop: '4px' }}>
                  {pkg.price.toLocaleString()} ر.س
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                {!pkg.active && <span style={{ fontSize: '10px', background: 'rgba(220,38,38,0.15)', color: '#fca5a5', padding: '2px 7px', borderRadius: '8px', fontWeight: 600 }}>مخفية</span>}
                {pkg.is_popular && <Star size={12} color="#D4AF7A" fill="#D4AF7A" />}
                {isActive && <ChevronRight size={14} color="#D4AF7A" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Edit form ───────────────────────────────────────────────────────────────
  const EditForm = draft ? (
    <div style={{ flex: 1, background: 'var(--a-surface)', borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: isMobile ? '20px 16px' : '28px 30px' }}>

      {/* Form header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '17px', color: ATEMA_COLORS.deepBronze }}>
            {isNew ? 'باقة جديدة' : `تعديل: ${draft.name_ar || '—'}`}
          </div>
          {!isNew && <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginTop: '2px' }}>ID: {draft.id}</div>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Toggle on={draft.active} onChange={v => setField('active', v)}
            label={draft.active ? 'مفعّلة على الموقع' : 'مخفية'} />
          {isMobile && (
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)' }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* VAT preview banner */}
      <div style={{ background: ATEMA_COLORS.softIvory, borderRadius: '10px', padding: '12px 16px',
        marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginBottom: '3px' }}>السعر (بدون VAT)</div>
          <div style={{ fontWeight: 700, color: ATEMA_COLORS.deepBronze, fontSize: '16px' }}>{draft.price.toLocaleString()} ر.س</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginBottom: '3px' }}>VAT 15%</div>
          <div style={{ fontWeight: 700, color: 'var(--a-text-soft)', fontSize: '16px' }}>{vatAmount.toLocaleString()} ر.س</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', marginBottom: '3px' }}>إجمالي العميل</div>
          <div style={{ fontWeight: 700, color: ATEMA_COLORS.champagne, fontSize: '16px' }}>{totalIncVat.toLocaleString()} ر.س</div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--a-text-muted)' }}>
            هامش مباشر تقديري: ~{Math.round((draft.price * 0.75)).toLocaleString()} ر.س
          </span>
        </div>
      </div>

      {/* Two-column grid for main fields */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '18px', marginBottom: '18px' }}>

        <div>
          <Label icon={<FileText size={13} />} text="الاسم بالعربية" tip="اسم الباقة كما يظهر للعميلة على الموقع. اجعله جذاباً وموجزاً — الأسماء الملهمة تبيع أكثر من الوصفية." />
          <input value={draft.name_ar} onChange={e => setField('name_ar', e.target.value)} style={inp} placeholder="مثال: الملكية" />
        </div>

        <div>
          <Label icon={<FileText size={13} />} text="الاسم بالإنجليزية" tip="Package name in English — used in booking references and receipts. Keep it simple: Classic, Royal, Signature." />
          <input value={draft.name_en} onChange={e => setField('name_en', e.target.value)} style={inp} placeholder="Example: Royal" />
        </div>

        <div>
          <Label icon={<Tag size={13} />} text="السعر (بدون VAT) — ر.س" tip="السعر الأساسي قبل إضافة الضريبة. تُضاف ١٥٪ VAT تلقائياً للعميل. قبل تغيير السعر، راجع حاسبة الأرباح في تبويب P&L لأي حجز لتتأكد أن الهامش يغطي وقتك وتكاليفك." />
          <input type="number" min={0} value={draft.price} onChange={e => setField('price', Number(e.target.value))} style={inp} />
        </div>

        <div>
          <Label icon={<Clock size={13} />} text="ساعات التصوير" tip="عدد ساعات التصوير الفعلية على أرض الحدث. لا تشمل وقت التنقل أو التجهيز. المعيار: خطوبة ٢ساعة | كلاسيكية ٤ | ملكية ٥ | توقيع ٦ساعات." />
          <input type="number" min={1} max={24} value={draft.duration_hours} onChange={e => setField('duration_hours', Number(e.target.value))} style={inp} />
        </div>

        <div>
          <Label icon={<Camera size={13} />} text="صور بالتعديل الأساسي" tip="عدد الصور التي تُسلَّم بعد التعديل الأساسي (إضاءة + موازنة ألوان + تحويل JPG). القاعدة: ٧٠-٧٥ صورة لكل ساعة تصوير. أقل من ٦٠/ساعة يبدو قليلاً. أكثر من ٩٠/ساعة يرهق وقت التعديل بدون تسعير إضافي." />
          <input type="number" min={0} value={draft.edited_photos} onChange={e => setField('edited_photos', Number(e.target.value))} style={inp} />
        </div>

        <div>
          <Label icon={<Camera size={13} />} text="صور بالتعديل التحريري (مضاعفات الـ ٤)" tip="رتوش متقدم (تنعيم بشرة، Dodge & Burn، تدرّج سينمائي). يجب أن يكون من مضاعفات الـ ٤ (٠، ٤، ٨، ١٢). متاح في الباقات العليا فقط: الملكية ٤، التوقيع ٨، الكوتور ١٢. اتركيه ٠ في الباقات الأدنى." />
          <input type="number" min={0} step={4} value={draft.editorial_photos ?? 0}
            onChange={e => {
              const v = Number(e.target.value);
              // Enforce factor-of-4 on the client too — DB has the same CHECK.
              setField('editorial_photos', v >= 0 && v % 4 === 0 ? v : (draft.editorial_photos ?? 0));
            }} style={inp} />
        </div>

        <div>
          <Label icon={<Image size={13} />} text="الألبوم (مواصفات)" tip="اكتب مواصفات الألبوم إذا كان مشمولاً. أمثلة: 'A4 10 pages' أو 'A3 12 pages + mini album'. اتركه فارغاً إذا لا يشمل الألبوم. تكلفة A4: ~٤٥٠ ر.س | A3: ~٧٠٠ ر.س." />
          <input value={draft.album ?? ''} onChange={e => setField('album', e.target.value || null)} style={inp} placeholder="مثال: A4 10 pages" />
        </div>

        <div>
          <Label icon={<Tag size={13} />} text="الشارة" tip="نص صغير يظهر فوق بطاقة الباقة كشارة بارزة. لا تضع شارة على أكثر من باقتين. الأكثر فاعلية: 'الأكثر طلباً' و'VIP'." />
          <input value={draft.badge ?? ''} onChange={e => setField('badge', e.target.value || null)} style={inp} placeholder="مثال: الأكثر طلباً" />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '7px' }}>
            {BADGE_SUGGESTIONS.map(b => (
              <button key={b} onClick={() => setField('badge', b)}
                style={{ padding: '4px 10px', borderRadius: '14px', fontSize: '11px', fontFamily: 'inherit',
                  cursor: 'pointer', fontWeight: 600, border: `1px solid ${ATEMA_COLORS.champagne}`,
                  background: draft.badge === b ? ATEMA_COLORS.champagne : 'var(--a-surface-alt)',
                  color: draft.badge === b ? '#0B0B0B' : ATEMA_COLORS.champagne }}>
                {b}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
          <div>
            <Label icon={<Video size={13} />} text="تصوير فيديو" tip="فعّل إذا كانت الباقة تشمل تصوير فيديو. يعني ذلك تكلفة مصور فيديو ~٤٥٠ ر.س/ساعة — تأكد أن سعر الباقة يعكس هذا. مفيد لحساب P&L الدقيق لكل حجز." />
            <Toggle on={draft.video} onChange={v => setField('video', v)} label={draft.video ? 'نعم — يشمل فيديو' : 'لا يشمل فيديو'} />
          </div>
          <div>
            <Label icon={<Star size={13} />} text="باقة مميزة (شهيرة)" tip="يضيف إطاراً ذهبياً وتأثيراً بارزاً لبطاقة الباقة على الموقع. لا تفعّله لأكثر من ١-٢ باقات في نفس الوقت — كثرة التمييز تفقده أثره." />
            <Toggle on={draft.is_popular} onChange={v => setField('is_popular', v)} label={draft.is_popular ? 'مميزة — تظهر بإطار ذهبي' : 'عادية'} />
          </div>
          <div>
            <Label icon={draft.active ? <Eye size={13} /> : <EyeOff size={13} />} text="حالة الباقة" tip="إيقاف التفعيل يُخفي الباقة من الموقع فوراً دون حذفها. مفيد للباقات الموسمية أو عند إعادة التسعير." />
            <Toggle on={draft.active} onChange={v => setField('active', v)} label={draft.active ? 'مفعّلة — ظاهرة على الموقع' : 'مخفية من الموقع'} />
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: '18px' }}>
        <Label icon={<FileText size={13} />} text="الوصف القصير" tip="جملة أو جملتان تظهران أسفل اسم الباقة. اجعلها مشوّقة وتخاطب مشاعر العميلة — ليست مجرد قائمة مميزات. مثال جيد: 'تجربة تصوير تجعل كل لحظة أبدية'." />
        <textarea value={draft.description ?? ''} onChange={e => setField('description', e.target.value || null)} rows={2}
          style={{ ...inp, resize: 'vertical' }} placeholder="وصف الباقة بالعربية..." />
      </div>

      {/* Features */}
      <div style={{ marginBottom: '24px' }}>
        <Label icon={<CheckCircle2 size={13} />} text="مميزات الباقة" tip="تظهر كقائمة نقطية في بطاقة الباقة على الموقع. اجعلها ٤-٦ بنود فقط — أكثر من ذلك يشتت الانتباه. ابدأ بالأهم. اذكر الأرقام الملموسة (٣٠٠ صورة وليس 'صور كثيرة')." />
        <FeaturesEditor features={draft.features ?? []} onChange={f => setField('features', f)} />
      </div>

      {/* Included Add-ons */}
      <div style={{ marginBottom: '24px', borderTop: '1px solid var(--a-border)', paddingTop: '20px' }}>
        <Label icon={<Tag size={13} />}
          text="الإضافات المشمولة في الباقة"
          tip="اختر الإضافات التي تُعدّ جزءاً من هذه الباقة. ستظهر في بطاقة الباقة على الموقع تحت قائمة المميزات." />

        {addonsLoading ? (
          <div style={{ fontSize: '12px', color: 'var(--a-text-muted)', padding: '8px 0' }}>جارٍ تحميل الإضافات...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {addons.map((addon: Addon) => {
              const checked = (draft.included_addon_ids ?? []).includes(addon.id);
              return (
                <label key={addon.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                    padding: '9px 12px', borderRadius: '8px', transition: 'background 0.15s',
                    background: checked ? 'rgba(212,175,122,0.12)' : 'var(--a-surface-alt)',
                    border: `1.5px solid ${checked ? ATEMA_COLORS.champagne : 'var(--a-border)'}` }}>
                  <input type="checkbox" checked={checked}
                    onChange={() => toggleIncludedAddon(addon.id)}
                    style={{ accentColor: ATEMA_COLORS.champagne, width: '15px', height: '15px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: checked ? 700 : 400,
                      color: checked ? ATEMA_COLORS.deepBronze : '#444', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {addon.name_ar}
                    </div>
                    <div style={{ fontSize: '11px', color: ATEMA_COLORS.champagne, fontWeight: 600 }}>
                      {addon.price.toLocaleString()} ر.س
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* Add new addon */}
        <div style={{ background: 'var(--a-surface-alt)', border: '1px dashed var(--a-border-strong)', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#777', marginBottom: '10px' }}>
            + إضافة خدمة جديدة إلى قائمة الإضافات
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 2fr 1fr auto', gap: '8px', alignItems: 'center' }}>
            <input value={newAddonAr} onChange={e => setNewAddonAr(e.target.value)}
              placeholder="اسم الإضافة بالعربية *"
              style={{ ...inp, padding: '8px 10px' }} />
            <input value={newAddonEn} onChange={e => setNewAddonEn(e.target.value)}
              placeholder="Name in English"
              style={{ ...inp, padding: '8px 10px' }} />
            <input type="number" min={0} value={newAddonPrice || ''}
              onChange={e => setNewAddonPrice(Number(e.target.value))}
              placeholder="السعر ر.س *"
              style={{ ...inp, padding: '8px 10px' }} />
            <button onClick={handleSaveAddon} disabled={savingAddon || !newAddonAr.trim() || newAddonPrice <= 0}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px',
                background: addonSaved ? '#059669' : ATEMA_COLORS.champagne, color: '#0B0B0B', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
                fontWeight: 700, whiteSpace: 'nowrap', opacity: (!newAddonAr.trim() || newAddonPrice <= 0) ? 0.5 : 1 }}>
              {savingAddon ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
               : addonSaved ? <><CheckCircle2 size={13} /> تم</>
               : <><Plus size={13} /> حفظ</>}
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        paddingTop: '20px', borderTop: '1px solid var(--a-border)' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 24px',
            background: saved ? '#059669' : ATEMA_COLORS.champagne, color: '#0B0B0B', border: 'none',
            borderRadius: '9px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontFamily: 'inherit', transition: 'background 0.2s' }}>
          {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />حفظ...</>
           : saved  ? <><CheckCircle2 size={15} />تم الحفظ</>
           : <><Save size={15} />{isNew ? 'إنشاء الباقة' : 'حفظ التغييرات'}</>}
        </button>

        {!isNew && !deleteConf && (
          <button onClick={() => setDeleteConf(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 18px',
              background: 'rgba(220,38,38,0.10)', border: '1.5px solid rgba(220,38,38,0.32)', color: '#fca5a5',
              borderRadius: '9px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 600 }}>
            <Trash2 size={14} /> حذف الباقة
          </button>
        )}

        {deleteConf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(220,38,38,0.10)', border: '1.5px solid rgba(220,38,38,0.32)', borderRadius: '9px', padding: '10px 14px' }}>
            <AlertTriangle size={14} color="#dc2626" />
            <span style={{ fontSize: '13px', color: '#fca5a5', fontWeight: 600 }}>تأكيد الحذف؟</span>
            <button onClick={handleDelete} style={{ background: '#dc2626', color: 'white', border: 'none',
              borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 700 }}>نعم</button>
            <button onClick={() => setDeleteConf(false)} style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)',
              borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>إلغاء</button>
          </div>
        )}

        {!isNew && (
          <a href="https://atemastudio.xyz/" target="_blank" rel="noreferrer"
            style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', color: 'var(--a-text-muted)', textDecoration: 'none' }}>
            <ArrowRight size={12} /> معاينة الموقع
          </a>
        )}
      </div>

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
      <Layers size={40} />
      <p style={{ fontSize: '14px' }}>اختر باقة من القائمة أو أنشئ واحدة جديدة</p>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-bg)',
      fontFamily: 'Cairo, Tajawal, Inter, sans-serif', direction: 'rtl' }}>
      {TopBar}
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 30px' }}>
        {!import.meta.env.VITE_SUPABASE_URL && (
          <div style={{ marginBottom: '16px', padding: '10px 16px', background: 'rgba(217,119,6,0.14)',
            border: '1px solid rgba(217,119,6,0.32)', borderRadius: '8px', fontSize: '12px', color: '#fbbf24' }}>
            ⚠️ وضع العرض — التغييرات لن تُحفظ. أضف VITE_SUPABASE_URL لتفعيل الحفظ الحقيقي.
          </div>
        )}
        {isMobile ? (
          showForm ? EditForm : PackageList
        ) : (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {PackageList}
            {EditForm}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
