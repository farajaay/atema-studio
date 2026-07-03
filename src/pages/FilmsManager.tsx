// ATEMA STUDIO - Admin Films Manager.
// Hide/show or remove curated entries from the public /films page.

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Clapperboard, Eye, EyeOff, Loader2, LogOut,
  RefreshCw, RotateCcw, Trash2,
} from 'lucide-react';
import { ATEMA_COLORS } from '../config/constants';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { FILM_CHAPTERS } from '../content/films';
import type { FilmCuration } from '../content/films';
import {
  deleteFilmCuration,
  fetchFilmCurationsAll,
  fetchFilmsManifest,
  syncDefaultFilmCurations,
  upsertFilmCuration,
} from '../services/films';
import type { FilmManifestItem } from '../services/films';

function assetUrl(path?: string) {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

function chapterLabel(key: FilmCuration['chapter']) {
  return FILM_CHAPTERS.find(chapter => chapter.key === key)?.ar ?? key;
}

export default function FilmsManager() {
  const { user, loading: authLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  const [items, setItems] = useState<FilmCuration[]>([]);
  const [manifestItems, setManifestItems] = useState<FilmManifestItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin', { replace: true });
  }, [authLoading, user, navigate]);

  async function load() {
    setLoading(true);
    const [filmsResult, manifestResult] = await Promise.allSettled([
      fetchFilmCurationsAll(),
      fetchFilmsManifest(),
    ]);

    if (filmsResult.status === 'fulfilled') {
      setItems(filmsResult.value.items);
      setConfigured(filmsResult.value.configured);
    } else {
      setItems([]);
      setConfigured(false);
    }

    setManifestItems(manifestResult.status === 'fulfilled' && manifestResult.value
      ? manifestResult.value.items
      : []);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  const streams = useMemo(
    () => new Map(manifestItems.map(item => [item.id, item])),
    [manifestItems],
  );

  const publishedCount = items.filter(item => item.published !== false).length;

  async function togglePublished(item: FilmCuration) {
    setWorkingId(item.manifestId);
    const ok = await upsertFilmCuration({ ...item, published: item.published === false });
    setWorkingId(null);
    if (!ok) { alert('تعذر حفظ حالة النشر. تأكدي من تطبيق migration الأفلام.'); return; }
    load();
  }

  async function remove(item: FilmCuration) {
    if (!confirm('حذف هذا المقطع من صفحة الأفلام؟ لا يحذف ملفات الفيديو من التخزين.')) return;
    setWorkingId(item.manifestId);
    const ok = await deleteFilmCuration(item.manifestId);
    setWorkingId(null);
    if (!ok) { alert('تعذر حذف المقطع. تأكدي من تطبيق migration الأفلام.'); return; }
    load();
  }

  async function syncDefaults() {
    setSyncing(true);
    const ok = await syncDefaultFilmCurations();
    setSyncing(false);
    if (!ok) { alert('تعذر مزامنة القائمة الافتراضية. طبقي migration الأفلام أولاً.'); return; }
    load();
  }

  if (authLoading) return <div style={{ padding: 80, textAlign: 'center' }}>...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-bg)', fontFamily: 'inherit', direction: 'rtl' }}>
      <div style={{
        background: 'var(--a-surface)', padding: isMobile ? '12px 16px' : '14px 30px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/admin/dashboard')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, color: 'var(--a-text-soft)',
            fontFamily: 'inherit',
          }}>
            <ChevronLeft size={18} /> {!isMobile && 'لوحة التحكم'}
          </button>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clapperboard size={17} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: ATEMA_COLORS.deepBronze }}>الأفلام</div>
            <div style={{ fontSize: 11, color: 'var(--a-text-muted)' }}>Films Manager</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
          <button onClick={load} style={topButton}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {!isMobile && 'تحديث'}
          </button>
          <button onClick={async () => { await logout(); navigate('/admin'); }} style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(220,38,38,0.10)',
            border: '1px solid rgba(220,38,38,0.32)', color: 'var(--a-gold)', borderRadius: 8,
            padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit',
          }}>
            <LogOut size={14} />{!isMobile && 'خروج'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '20px 16px' : '28px 30px' }}>
        {!configured && (
          <div style={{
            background: 'var(--a-surface-alt)', border: '1px solid var(--a-border)', color: 'var(--a-text)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 18,
            fontSize: 13, lineHeight: 1.7,
          }}>
            جدول الأفلام غير مفعّل بعد. طبقي ملف
            {' '}<code>database/migrations-2026-07-films.sql</code>{' '}
            ثم عودي لهذه الصفحة للمزامنة والتحكم.
          </div>
        )}

        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, marginBottom: 18,
        }}>
          <div style={{ color: 'var(--a-text-soft)', fontSize: 13 }}>
            {publishedCount} منشور / {items.length} مقطع
          </div>
          <button onClick={syncDefaults} disabled={syncing} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--a-surface-alt)', color: 'var(--a-text)',
            border: '1px solid var(--a-border)', borderRadius: 8,
            padding: '8px 14px', cursor: syncing ? 'wait' : 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
          }}>
            {syncing
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <RotateCcw size={14} />}
            مزامنة القائمة الافتراضية
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--a-text-muted)' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{
            background: 'var(--a-surface)', borderRadius: 12, padding: 54,
            textAlign: 'center', color: 'var(--a-text-muted)', border: '1px solid var(--a-border)',
          }}>
            لا توجد مقاطع في جدول الأفلام. استخدمي مزامنة القائمة الافتراضية بعد تطبيق migration.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map(item => {
              const stream = streams.get(item.manifestId);
              const published = item.published !== false;
              const busy = workingId === item.manifestId;
              return (
                <div key={item.manifestId} style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '86px minmax(0, 1fr)' : '132px minmax(0, 1fr) auto',
                  gap: 14, alignItems: 'center',
                  background: 'var(--a-surface)', border: '1px solid var(--a-border)',
                  borderRadius: 10, padding: 12, opacity: published ? 1 : 0.58,
                }}>
                  <div style={{
                    aspectRatio: stream && stream.height > stream.width ? '9 / 12' : '16 / 9',
                    background: 'var(--a-surface-alt)', overflow: 'hidden', borderRadius: 8,
                    display: 'grid', placeItems: 'center', color: 'var(--a-text-muted)',
                  }}>
                    {stream?.poster ? (
                      <img src={assetUrl(stream.poster)} alt="" loading="lazy" decoding="async"
                        width={stream.width} height={stream.height}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <Clapperboard size={22} />
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      color: 'var(--a-text-muted)', fontSize: 11, marginBottom: 5,
                      display: 'flex', gap: 8, flexWrap: 'wrap',
                    }}>
                      <span>{String(item.order).padStart(2, '0')}</span>
                      <span>{item.manifestId}</span>
                      <span>{chapterLabel(item.chapter)}</span>
                      <span>{published ? 'منشور' : 'مخفي'}</span>
                    </div>
                    <div style={{
                      color: ATEMA_COLORS.deepBronze, fontSize: 15,
                      fontWeight: 700, marginBottom: 4,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.title_ar}
                    </div>
                    <div style={{
                      color: 'var(--a-text-soft)', fontSize: 12,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.title_en}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap',
                    gridColumn: isMobile ? '1 / -1' : undefined,
                    justifyContent: isMobile ? 'stretch' : 'flex-end',
                  }}>
                    <button onClick={() => togglePublished(item)} disabled={busy}
                      title={published ? 'إخفاء من الصفحة' : 'نشر في الصفحة'}
                      style={actionButton(published ? 'var(--a-gold)' : 'var(--a-text-muted)')}>
                      {busy
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        : published ? <Eye size={13} /> : <EyeOff size={13} />}
                      {published ? 'إخفاء' : 'نشر'}
                    </button>
                    <button onClick={() => remove(item)} disabled={busy}
                      title="حذف من صفحة الأفلام" style={actionButton('var(--a-gold)')}>
                      <Trash2 size={13} /> حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const topButton: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--a-text-muted)',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 13,
  fontFamily: 'inherit',
};

function actionButton(color: string): CSSProperties {
  return {
    minHeight: 34,
    padding: '7px 12px',
    borderRadius: 7,
    background: 'var(--a-surface-alt)',
    color,
    border: `1px solid ${color}33`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  };
}
