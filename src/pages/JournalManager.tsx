// ATEMA STUDIO — Admin Journal Manager.
// Create / edit / publish / delete editorial journal posts.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { ATEMA_COLORS } from '../config/constants';
import PublicPhotoPicker from '../components/PublicPhotoPicker';
import {
  fetchJournalAll, upsertJournalPost, deleteJournalPost, uploadJournalCover, slugify,
} from '../services/journal';
import type { JournalPost } from '../services/journal';
import {
  LogOut, RefreshCw, Plus, Save, Trash2, Loader2,
  Eye, EyeOff, X, BookOpen, ChevronLeft, ExternalLink,
} from 'lucide-react';

type Draft = Partial<JournalPost> & { id?: string };

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric', calendar: 'gregory',
  });
}

export default function JournalManager() {
  const { user, loading: authLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  const [posts, setPosts]     = useState<JournalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit]       = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin');
  }, [authLoading, user, navigate]);

  async function load() {
    setLoading(true);
    setPosts(await fetchJournalAll());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCover(file: File) {
    setUploading(true);
    const url = await uploadJournalCover(file);
    setUploading(false);
    if (url) setEdit(e => ({ ...(e ?? {}), cover_url: url }));
    else alert('فشل رفع الصورة');
  }

  async function save() {
    if (!edit) return;
    if (!edit.title_ar || !edit.title_en) { alert('العنوان مطلوب (عربي / إنجليزي)'); return; }
    if (!edit.body_ar || !edit.body_en)   { alert('المحتوى مطلوب (عربي / إنجليزي)'); return; }
    const slug = edit.slug?.trim() || slugify(edit.title_en);
    setSaving(true);
    const ok = await upsertJournalPost({
      ...edit,
      slug,
      excerpt_ar: edit.excerpt_ar ?? '',
      excerpt_en: edit.excerpt_en ?? '',
      cover_url:  edit.cover_url  ?? '',
      published:  edit.published  ?? false,
    });
    setSaving(false);
    if (!ok) { alert('فشل الحفظ'); return; }
    setEdit(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا المنشور؟')) return;
    const ok = await deleteJournalPost(id);
    if (!ok) { alert('فشل الحذف'); return; }
    load();
  }

  async function togglePublished(p: JournalPost) {
    const ok = await upsertJournalPost({
      id: p.id,
      published: !p.published,
      // Stamp published_at on first publish if missing.
      ...(!p.published && !p.published_at ? { published_at: new Date().toISOString() } : {}),
    });
    if (ok) load();
  }

  if (authLoading) return <div style={{ padding: 80, textAlign: 'center' }}>...</div>;

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
            <BookOpen size={17} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: ATEMA_COLORS.deepBronze }}>اليوميات</div>
            <div style={{ fontSize: 11, color: 'var(--a-text-muted)' }}>Journal Manager</div>
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

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={() => setEdit({
            title_ar: '', title_en: '', excerpt_ar: '', excerpt_en: '',
            body_ar: '', body_en: '', cover_url: '', published: false,
          })} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: ATEMA_COLORS.champagne, color: '#0B0B0B',
            border: 'none', borderRadius: 8, padding: '9px 18px',
            cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 13,
          }}>
            <Plus size={15} /> منشور جديد
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--a-text-muted)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : posts.length === 0 ? (
          <div style={{
            background: 'var(--a-surface)', borderRadius: 12, padding: 60,
            textAlign: 'center', color: 'var(--a-text-muted)',
          }}>
            لا توجد منشورات بعد.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map(p => (
              <div key={p.id} style={{
                background: 'var(--a-surface)', borderRadius: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                display: 'flex', gap: 14,
                padding: isMobile ? 12 : 14,
                opacity: p.published ? 1 : 0.65,
                flexDirection: isMobile ? 'column' : 'row',
              }}>
                {p.cover_url ? (
                  <img src={p.cover_url} alt=""
                    style={{
                      width: isMobile ? '100%' : 160,
                      height: isMobile ? 140 : 100,
                      objectFit: 'cover', borderRadius: 8, flexShrink: 0,
                    }} />
                ) : (
                  <div style={{
                    width: isMobile ? '100%' : 160,
                    height: isMobile ? 140 : 100,
                    background: 'var(--a-surface-alt)', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--a-text-muted)', flexShrink: 0,
                  }}>
                    <BookOpen size={22} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--a-text-muted)', marginBottom: 3 }}>
                    {p.published
                      ? <>منشور · {fmt(p.published_at)}</>
                      : <>مسودة</>
                    } · /{p.slug}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 600, color: ATEMA_COLORS.deepBronze,
                    marginBottom: 4,
                  }}>
                    {p.title_ar}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--a-text-soft)', lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {p.excerpt_ar}
                  </div>
                </div>
                <div style={{
                  display: 'flex', gap: 6, alignItems: 'center',
                  flexShrink: 0, flexDirection: isMobile ? 'row' : 'column',
                }}>
                  <button onClick={() => setEdit(p)} style={smallBtn('#a8a8a8')}>تعديل</button>
                  <button onClick={() => togglePublished(p)} style={smallBtn(p.published ? '#34d399' : '#a8a8a8')}>
                    {p.published
                      ? <><Eye size={12} /> منشور</>
                      : <><EyeOff size={12} /> مسودة</>}
                  </button>
                  {p.published && (
                    <a href={`#/journal/${p.slug}`} target="_blank" rel="noreferrer"
                      style={{ ...smallBtn('#60a5fa'), textDecoration: 'none' }}>
                      <ExternalLink size={12} /> عرض
                    </a>
                  )}
                  <button onClick={() => remove(p.id)} style={smallBtn('#fca5a5')}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {edit && (
        <div onClick={() => setEdit(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--a-surface)', borderRadius: 14, padding: '24px 28px',
            maxWidth: 720, width: '100%', maxHeight: '92vh', overflow: 'auto',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20,
            }}>
              <h2 style={{ fontSize: 17, color: ATEMA_COLORS.deepBronze, margin: 0 }}>
                {edit.id ? 'تعديل المنشور' : 'منشور جديد'}
              </h2>
              <button onClick={() => setEdit(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-text-muted)',
              }}>
                <X size={20} />
              </button>
            </div>

            {/* Cover */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>صورة الغلاف</label>
              {edit.cover_url ? (
                <div style={{ position: 'relative' }}>
                  <img src={edit.cover_url} alt=""
                    style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8 }} />
                  <button onClick={() => setEdit(e => ({ ...(e ?? {}), cover_url: '' }))}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)', color: 'white',
                      border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                    }}>
                    <X size={12} /> تغيير
                  </button>
                </div>
              ) : null}

              <PublicPhotoPicker
                selectedUrl={edit.cover_url}
                onSelect={url => setEdit(e => ({ ...(e ?? {}), cover_url: url }))}
              />

              <label style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '22px 16px', marginTop: 10,
                border: '1.5px dashed var(--a-border-strong)',
                borderRadius: 8, cursor: 'pointer', color: 'var(--a-text-soft)',
              }}>
                {uploading ? (
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>
                    <BookOpen size={22} />
                    <span style={{ fontSize: 13 }}>رفع غلاف جديد</span>
                  </>
                )}
                <input type="file" accept="image/*" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCover(f); }} />
              </label>
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

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Slug (URL — leave blank to auto-generate)</label>
              <input value={edit.slug ?? ''}
                onChange={e => setEdit(s => ({ ...(s ?? {}), slug: e.target.value }))}
                placeholder="auto-from-english-title"
                style={inp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>مقتطف (عربي)</label>
                <textarea value={edit.excerpt_ar ?? ''}
                  onChange={e => setEdit(s => ({ ...(s ?? {}), excerpt_ar: e.target.value }))}
                  style={{ ...inp, minHeight: 70, resize: 'vertical' }} dir="rtl" />
              </div>
              <div>
                <label style={lbl}>Excerpt (English)</label>
                <textarea value={edit.excerpt_en ?? ''}
                  onChange={e => setEdit(s => ({ ...(s ?? {}), excerpt_en: e.target.value }))}
                  style={{ ...inp, minHeight: 70, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={lbl}>
                المحتوى (عربي) — استخدمي سطرين فارغين بين الفقرات
              </label>
              <textarea value={edit.body_ar ?? ''}
                onChange={e => setEdit(s => ({ ...(s ?? {}), body_ar: e.target.value }))}
                style={{ ...inp, minHeight: 180, resize: 'vertical', fontFamily: 'inherit' }} dir="rtl" />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Body (English) — blank line between paragraphs</label>
              <textarea value={edit.body_en ?? ''}
                onChange={e => setEdit(s => ({ ...(s ?? {}), body_en: e.target.value }))}
                style={{ ...inp, minHeight: 180, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10,
              marginTop: 16, fontSize: 13, color: 'var(--a-text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={edit.published ?? false}
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
function smallBtn(color: string): React.CSSProperties {
  return {
    padding: '6px 10px', borderRadius: 6,
    // Translucent tinted pill — pops on both themes. The icon/text color
    // (the `color` arg) is the semantic accent.
    background: 'var(--a-surface-alt)',
    color,
    border: `1px solid ${color}33`,
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 4,
  };
}
