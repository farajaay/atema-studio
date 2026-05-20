// ATEMA STUDIO — Mood Board Composer
//
// Admin-only modal that:
//   1. Opens for a single booking (passed in via prop)
//   2. Loads any existing mood_boards row for that booking (so it edits in place)
//   3. If none exists, auto-selects 6 portfolio images + drafts a bilingual
//      title + caption using the moodboard service
//   4. Lets Fatima swap any of the 6 slots from a full-pool picker, edit copy,
//      save, preview, and send via WhatsApp deep-link
//
// The board itself lives at /#/board/<token> — a public, noir-themed page.

import { useEffect, useState } from 'react';
import { Eye, Loader2, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import {
  autoSelectImages,
  buildBoardUrl,
  draftCopy,
  getMoodBoardForBooking,
  listPortfolioPool,
  markMoodBoardSent,
  saveMoodBoard,
  seasonFromDate,
  seasonLabelAr,
  type MoodBoard,
} from '../services/moodboard';
import { ATEMA_COLORS } from '../config/constants';
import type { Booking } from '../hooks/useAdminData';

interface Props {
  booking: Booking;
}

export default function MoodBoardComposer({ booking }: Props) {
  const [loading,       setLoading]       = useState(true);
  const [board,         setBoard]         = useState<MoodBoard | null>(null);
  const [imageUrls,     setImageUrls]     = useState<string[]>([]);
  const [titleAr,       setTitleAr]       = useState('');
  const [titleEn,       setTitleEn]       = useState('');
  const [captionAr,     setCaptionAr]     = useState('');
  const [captionEn,     setCaptionEn]     = useState('');
  const [pool,          setPool]          = useState<Array<{ image_url: string; category: string }>>([]);
  const [pickerIdx,     setPickerIdx]     = useState<number | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [justSaved,     setJustSaved]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const season    = seasonFromDate(booking.event_date);
  const packageId = booking.package_id ?? null;

  // ── Initial load ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [existing, poolData] = await Promise.all([
          getMoodBoardForBooking(booking.id),
          listPortfolioPool(),
        ]);
        if (cancelled) return;
        setPool(poolData);

        if (existing) {
          setBoard(existing);
          setImageUrls(existing.image_urls || []);
          setTitleAr(existing.title_ar || '');
          setTitleEn(existing.title_en || '');
          setCaptionAr(existing.caption_ar || '');
          setCaptionEn(existing.caption_en || '');
        } else {
          const urls  = await autoSelectImages(packageId, booking.id);
          const draft = draftCopy(packageId, season, booking.customer_name);
          if (cancelled) return;
          setImageUrls(urls);
          setTitleAr(draft.titleAr);
          setTitleEn(draft.titleEn);
          setCaptionAr(draft.captionAr);
          setCaptionEn(draft.captionEn);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  // ── Re-shuffle (admin asked for a different 6) ─────────────────────────
  async function handleReshuffle() {
    setLoading(true);
    try {
      const urls = await autoSelectImages(packageId, booking.id + '_' + Date.now());
      setImageUrls(urls);
    } finally {
      setLoading(false);
    }
  }

  // ── Save (insert or update) ────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveMoodBoard({
        bookingId: booking.id,
        packageId,
        season,
        imageUrls,
        titleAr, titleEn, captionAr, captionEn,
        existingId: board?.id,
      });
      if (saved) {
        setBoard(saved);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1500);
      } else {
        setError('لم يتم الحفظ — تحقّقي من صلاحيات الحساب');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Open preview ───────────────────────────────────────────────────────
  function handleOpenPreview() {
    if (!board) return;
    window.open(buildBoardUrl(board.token), '_blank', 'noopener,noreferrer');
  }

  // ── Send via WhatsApp ─────────────────────────────────────────────────
  async function handleSendWa() {
    if (!board) return;
    try { await markMoodBoardSent(board.id); }
    catch { /* non-blocking */ }
    setBoard(b => (b ? { ...b, sent_at: new Date().toISOString() } : b));

    const url = buildBoardUrl(board.token);
    const msg = encodeURIComponent(
      `مرحباً ${booking.customer_name} 🤍\n\n` +
      `هذه لوحةُ المزاج التي أعددناها لكِ — لمحةٌ من اليوم كما نراه:\n${url}\n\n` +
      `بكلّ حب،\nأتيما`
    );
    // Normalise to international WA format
    const digits = (booking.customer_phone || '').replace(/\D/g, '');
    const phone  = digits.startsWith('0')   ? '966' + digits.slice(1)
                 : digits.startsWith('966') ? digits
                 : digits.startsWith('5')   ? '966' + digits
                 : digits;
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener,noreferrer');
  }

  // ── Slot swap ──────────────────────────────────────────────────────────
  function changeImage(idx: number, newUrl: string) {
    const next = [...imageUrls];
    next[idx] = newUrl;
    setImageUrls(next);
    setPickerIdx(null);
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--a-text-muted)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: 10, fontSize: 13 }}>جاري التحضير…</div>
      </div>
    );
  }

  // ── Empty-pool guard ──────────────────────────────────────────────────
  if (pool.length === 0) {
    return (
      <div style={{ padding: 16, background: '#fef3c7', color: '#92400e', borderRadius: 8, fontSize: 13 }}>
        لا توجد صور منشورة في صالة الأعمال (Portfolio). أضيفي صورًا من قسم
        إدارة المعرض ثم عودي إلى هنا.
      </div>
    );
  }

  // ── Styles ─────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid var(--a-border)', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    background: 'var(--a-surface)', color: 'var(--a-text)',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--a-text-soft)', marginBottom: 6, marginTop: 14,
  };

  return (
    <div>
      {/* Header note */}
      <div style={{
        background: 'var(--a-surface-alt)', padding: '12px 14px', borderRadius: 8,
        fontSize: 12, color: 'var(--a-text-soft)', marginBottom: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
      }}>
        <Sparkles size={14} style={{ color: ATEMA_COLORS.champagne }} />
        <span>لوحة مزاج خاصة بـ <b>{booking.customer_name}</b> — موسم {seasonLabelAr(season)}</span>
        {board?.sent_at && (
          <span style={{ color: '#059669', fontWeight: 600 }}>✓ تم الإرسال</span>
        )}
        {board?.viewed_at && (
          <span style={{ color: ATEMA_COLORS.deepBronze, fontWeight: 600 }}>👁 تم العرض</span>
        )}
      </div>

      {/* 6-image grid header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: ATEMA_COLORS.champagne,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>الصور (٦)</div>
        <button onClick={handleReshuffle} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'transparent', border: '1px solid var(--a-border)',
          borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
          fontSize: 11, color: 'var(--a-text-soft)', fontFamily: 'inherit',
        }}>
          <RefreshCw size={11} /> إعادة الاختيار تلقائيًا
        </button>
      </div>

      {/* 6-image grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {imageUrls.map((url, idx) => (
          <button key={idx} onClick={() => setPickerIdx(idx)} style={{
            position: 'relative', aspectRatio: '3 / 4', borderRadius: 4,
            overflow: 'hidden', border: '1px solid var(--a-border)',
            cursor: 'pointer', padding: 0, background: 'var(--a-surface-alt)',
          }}>
            <img src={url} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              padding: '6px 0',
              background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent 60%)',
            }}>
              <span style={{
                background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10,
                padding: '3px 8px', borderRadius: 3, fontFamily: 'inherit',
              }}>تغيير</span>
            </div>
          </button>
        ))}
      </div>

      {/* Title + caption */}
      <div>
        <label style={labelStyle}>العنوان (عربي)</label>
        <input style={inputStyle} value={titleAr} onChange={e => setTitleAr(e.target.value)}
          dir="rtl" maxLength={120} />

        <label style={labelStyle}>Title (English)</label>
        <input style={inputStyle} value={titleEn} onChange={e => setTitleEn(e.target.value)}
          maxLength={120} />

        <label style={labelStyle}>الوصف (عربي)</label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          value={captionAr} onChange={e => setCaptionAr(e.target.value)}
          dir="rtl" maxLength={600} />

        <label style={labelStyle}>Caption (English)</label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          value={captionEn} onChange={e => setCaptionEn(e.target.value)}
          maxLength={600} />
      </div>

      {/* Error */}
      {error && (
        <div role="alert" style={{
          marginTop: 14, padding: '8px 12px', borderRadius: 6,
          background: '#fee2e2', color: '#991b1b', fontSize: 12,
        }}>{error}</div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 8, justifyContent: 'flex-end',
        marginTop: 20, flexWrap: 'wrap',
      }}>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '10px 20px',
          background: justSaved ? '#059669' : ATEMA_COLORS.champagne,
          color: '#fff', border: 'none', borderRadius: 8,
          fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
          fontSize: 13, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1,
        }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          {justSaved ? 'تم الحفظ ✓' : board ? 'تحديث' : 'حفظ'}
        </button>

        {board && (
          <>
            <button onClick={handleOpenPreview} style={{
              padding: '10px 16px', background: 'var(--a-surface-alt)',
              color: 'var(--a-text)', border: '1.5px solid var(--a-border)',
              borderRadius: 8, fontWeight: 600, cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Eye size={14} /> معاينة
            </button>
            <button onClick={handleSendWa} style={{
              padding: '10px 16px', background: '#25D366', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Send size={14} /> إرسال عبر واتساب
            </button>
          </>
        )}
      </div>

      {/* Picker overlay */}
      {pickerIdx !== null && (
        <div onClick={() => setPickerIdx(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 400, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--a-surface)', borderRadius: 12,
            maxWidth: 720, width: '100%', maxHeight: '80vh',
            overflowY: 'auto', padding: 16,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 12,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ATEMA_COLORS.deepBronze }}>
                اختاري صورة من المعرض
              </div>
              <button onClick={() => setPickerIdx(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--a-text-muted)', padding: 4,
              }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {pool.map(p => (
                <button key={p.image_url} onClick={() => changeImage(pickerIdx, p.image_url)} style={{
                  aspectRatio: '3 / 4', padding: 0,
                  border: '1px solid var(--a-border)', borderRadius: 3,
                  overflow: 'hidden', cursor: 'pointer', background: 'transparent',
                }}>
                  <img src={p.image_url} alt="" loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
