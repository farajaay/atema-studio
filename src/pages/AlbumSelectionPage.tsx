// ATEMA STUDIO — Public Album Selection page (Phase 2)
//
// Route: /#/album/:token (HashRouter)
//
// After her event, the bride opens this private link and chooses one album
// cover from the curated palette (fabric F-series + croc leather E-series).
// The token is the only secret. The page is inert until the studio releases
// it / the event date passes (enforced server-side). The choice is FINAL once
// confirmed (plan §0). Noir editorial aesthetic, RTL-first, bilingual.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import AlbumCoverExample from '../components/AlbumCoverExample';
import {
  getAlbumSelectionByToken, fetchActiveDesigns, selectAlbumDesign,
  type AlbumDesign, type AlbumSelectionState,
} from '../services/album';

const tx = (lang: 'ar' | 'en', ar: string, en: string) => (lang === 'ar' ? ar : en);

export default function AlbumSelectionPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { lang } = useLang();
  const ar  = lang === 'ar';
  const dir = ar ? 'rtl' : 'ltr';

  const [state,   setState]   = useState<AlbumSelectionState | null>(null);
  const [designs, setDesigns] = useState<AlbumDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked,  setPicked]  = useState<string | null>(null);
  const [note,    setNote]    = useState('');
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    let off = false;
    (async () => {
      if (!token) { setLoading(false); return; }
      const [s, d] = await Promise.all([getAlbumSelectionByToken(token), fetchActiveDesigns()]);
      if (off) return;
      setState(s); setDesigns(d); setLoading(false);
    })();
    return () => { off = true; };
  }, [token]);

  const fabric  = useMemo(() => designs.filter(d => d.material === 'fabric'),  [designs]);
  const leather = useMemo(() => designs.filter(d => d.material === 'leather'), [designs]);
  const chosen  = designs.find(d => d.id === state?.chosen_design_id) ?? null;
  const pickedDesign = designs.find(d => d.id === picked) ?? null;

  // Bring the example render into view when a swatch is picked.
  const exampleRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (picked) exampleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [picked]);

  async function confirm() {
    if (!picked) return;
    setBusy(true); setErr('');
    const res = await selectAlbumDesign(token, picked, note.trim() || undefined);
    setBusy(false);
    if (res === 'ok') {
      setState(s => ({ ...(s ?? { status: 'selected' }), status: 'selected', chosen_design_id: picked, note }));
    } else if (res === 'locked') {
      setErr(tx(lang, 'تم الاختيار مسبقاً.', 'A choice was already confirmed.'));
      const s = await getAlbumSelectionByToken(token); if (s) setState(s);
    } else if (res === 'not_ready') {
      setErr(tx(lang, 'الاختيار غير متاح بعد.', 'Selection is not open yet.'));
    } else {
      setErr(tx(lang, 'تعذّر حفظ اختيارك. حاولي مرة أخرى.', 'We could not save your choice. Please try again.'));
    }
  }

  // ── Shells ───────────────────────────────────────────────────────────────
  if (loading) return <Center><Wordmark />{tx(lang, '…نُحمّل', 'LOADING')}</Center>;

  if (!token || !state || state.status === 'not_found')
    return <Center><Wordmark /><p style={soft}>{tx(lang, 'هذا الرابط غير صالح.', 'This link is not valid.')}</p></Center>;

  if (state.status === 'not_ready')
    return (
      <Center>
        <Wordmark />
        <h1 style={display}>{tx(lang, 'قريباً…', 'Almost there…')}</h1>
        <p style={{ ...soft, maxWidth: 420, lineHeight: 1.9 }}>
          {tx(lang,
            'نُجهّز لكِ خيارات غلاف ألبومك. سيُفتح هذا الرابط بعد مناسبتك — سنعلمكِ حين يحين الوقت.',
            'We\'re preparing your album cover options. This link opens after your event — we\'ll let you know when it\'s ready.')}
        </p>
      </Center>
    );

  // ── Confirmed / locked ─────────────────────────────────────────────────
  if (state.status === 'selected' && chosen)
    return (
      <Page dir={dir}>
        <Wordmark />
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto', padding: '10px 0 50px' }}>
          <div style={eyebrow}>{tx(lang, 'تمّ الاختيار', 'YOUR CHOICE')}</div>
          <h1 style={display}>{tx(lang, 'غلافكِ محفوظ', 'Your cover is set')}</h1>
          {chosen.example_url ? (
            <ExamplePhoto url={chosen.example_url} alt={ar ? chosen.name_ar : chosen.name_en}
              style={{ width: 'min(80vw, 360px)', margin: '26px auto' }} />
          ) : (
            <AlbumCoverExample design={chosen} size="hero" dir={dir}
              style={{ width: 200, margin: '26px auto' }} />
          )}
          <div style={{ fontFamily: "'Amiri', serif", fontSize: '1.5rem', color: 'var(--a-text)' }}>{ar ? chosen.name_ar : chosen.name_en}</div>
          <div style={{ ...soft, letterSpacing: '0.14em' }}>{chosen.code} · {chosen.material === 'leather' ? tx(lang, 'جلد', 'Leather') : tx(lang, 'قماش', 'Fabric')}</div>
          <p style={{ ...soft, marginTop: 22, lineHeight: 1.9 }}>
            {tx(lang, 'شكراً لكِ. اختيارُكِ نهائيّ، وسنبدأ بتجهيز ألبومكِ بهذا الغلاف.',
                      'Thank you. Your choice is final — we\'ll begin crafting your album with this cover.')}
          </p>
        </div>
      </Page>
    );

  // ── Ready — choose ─────────────────────────────────────────────────────
  return (
    <Page dir={dir}>
      <Wordmark />
      <header style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 8px' }}>
        <div style={eyebrow}>{tx(lang, 'ألبومكِ · ATEMA', 'YOUR ALBUM · ATEMA')}</div>
        <h1 style={display}>{tx(lang, 'اختاري غلافكِ', 'Choose your cover')}</h1>
        <p style={{ ...soft, lineHeight: 1.9 }}>
          {tx(lang, 'لمسةُ يدكِ الأخيرة على ذكرى اليوم. اختاري الخامة واللون اللذين يمثّلانكِ — الاختيار نهائيّ بعد التأكيد.',
                    'Your final touch on the memory of the day. Choose the material and colour that speak for you — your choice is final once confirmed.')}
        </p>
      </header>

      <Section title={tx(lang, 'قماش كتّان', 'Linen Fabric')} items={fabric} picked={picked} onPick={setPicked} lang={lang} />
      <Section title={tx(lang, 'جلد مطبوع', 'Embossed Leather')} items={leather} picked={picked} onPick={setPicked} lang={lang} />

      {/* Example render — how the finished album looks in the picked skin */}
      {pickedDesign && (
        <section ref={exampleRef} key={pickedDesign.id} className="fade-up"
          style={{ maxWidth: 560, margin: '38px auto 0', textAlign: 'center' }}>
          <div style={eyebrow}>{tx(lang, 'هكذا سيبدو ألبومكِ', 'YOUR ALBUM, LIKE THIS')}</div>
          {pickedDesign.example_url ? (
            <ExamplePhoto url={pickedDesign.example_url}
              alt={ar ? pickedDesign.name_ar : pickedDesign.name_en}
              style={{ width: 'min(86vw, 430px)', margin: '18px auto 0' }} />
          ) : (
            <AlbumCoverExample design={pickedDesign} size="hero" dir={dir}
              style={{ width: 'min(64vw, 260px)', margin: '18px auto 0' }} />
          )}
          <div style={{ fontFamily: "'Amiri', serif", fontSize: '1.4rem', color: 'var(--a-text)', marginTop: 18 }}>
            {ar ? pickedDesign.name_ar : pickedDesign.name_en}
          </div>
          <div style={{ ...soft, letterSpacing: '0.14em' }}>
            {pickedDesign.code} · {pickedDesign.material === 'leather' ? tx(lang, 'جلد', 'Leather') : tx(lang, 'قماش', 'Fabric')}
          </div>
          {(ar ? pickedDesign.blurb_ar : pickedDesign.blurb_en) && (
            <p style={{ ...soft, marginTop: 10, lineHeight: 1.9, maxWidth: 380, marginInline: 'auto' }}>
              {ar ? pickedDesign.blurb_ar : pickedDesign.blurb_en}
            </p>
          )}
          {pickedDesign.box_url && (
            <>
              <div style={{ ...eyebrow, marginTop: 26 }}>
                {tx(lang, 'ويصلكِ في صندوق التقديم الفاخر', 'DELIVERED IN THE PRESENTATION BOX')}
              </div>
              <ExamplePhoto url={pickedDesign.box_url}
                alt={tx(lang, 'صندوق التقديم', 'Presentation box')}
                style={{ width: 'min(86vw, 430px)', margin: '14px auto 0' }} />
            </>
          )}
        </section>
      )}

      {/* Confirm bar */}
      {picked && (
        <div style={confirmBar}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={note} onChange={e => setNote(e.target.value.slice(0, 500))} maxLength={500}
              placeholder={tx(lang, 'ملاحظة للأتيليه (اختياري)…', 'A note for the atelier (optional)…')}
              style={noteInput} />
            {err && <div style={{ color: '#E4A6A6', fontSize: 13, textAlign: 'center' }}>{err}</div>}
            <button onClick={confirm} disabled={busy} style={confirmBtn}>
              {busy ? '…' : tx(lang, 'تأكيد اختياري — نهائي', 'Confirm my choice — final')}
            </button>
          </div>
        </div>
      )}
      <div style={{ height: picked ? 150 : 40 }} />
    </Page>
  );
}

// ── Swatch section ─────────────────────────────────────────────────────────
function Section({ title, items, picked, onPick, lang }: {
  title: string; items: AlbumDesign[]; picked: string | null; onPick: (id: string) => void; lang: 'ar' | 'en';
}) {
  if (items.length === 0) return null;
  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '26px 4px 6px' }}>
      <div style={{ ...eyebrow, textAlign: 'center', marginBottom: 18 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
        {items.map(d => {
          const on = picked === d.id;
          return (
            <button key={d.id} onClick={() => onPick(d.id)} style={{
              border: `1.5px solid ${on ? 'var(--a-gold)' : 'var(--a-border)'}`,
              background: 'transparent', borderRadius: 14, padding: 8, cursor: 'pointer', textAlign: 'center',
              transition: 'all 0.2s', transform: on ? 'translateY(-3px)' : 'none',
              boxShadow: on ? '0 10px 30px rgba(212,175,122,0.25)' : 'none', fontFamily: 'inherit',
            }}>
              <div style={{ ...swatchTile(d), height: 150, borderRadius: 9, position: 'relative' }}>
                {on && <span style={checkBadge}>✓</span>}
              </div>
              <div style={{ fontFamily: "'Amiri', serif", fontSize: '1.05rem', color: 'var(--a-text)', marginTop: 9 }}>
                {lang === 'ar' ? d.name_ar : d.name_en}
              </div>
              <div style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--a-text-soft)' }}>{d.code}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────
/** Photographic mockup (…-album / …-box): webp + jpeg pair, fixed 4:3 frame. */
function ExamplePhoto({ url, alt, style }: { url: string; alt: string; style?: React.CSSProperties }) {
  const webp = url.replace(/\.jpe?g$/i, '.webp');
  return (
    <picture style={{ display: 'block', ...style }}>
      {webp !== url && <source type="image/webp" srcSet={webp} />}
      <img src={url} alt={alt} loading="lazy" decoding="async"
        style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 14,
          border: '1px solid var(--a-border)', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }} />
    </picture>
  );
}

const swatchTile = (d: AlbumDesign): React.CSSProperties =>
  d.preview_url
    ? { backgroundImage: `url(${d.preview_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: `radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.18), rgba(0,0,0,0.18)), linear-gradient(${d.swatch_hex}, ${d.swatch_hex})`,
        backgroundColor: d.swatch_hex };

const checkBadge: React.CSSProperties = {
  position: 'absolute', top: 8, insetInlineEnd: 8, width: 26, height: 26, borderRadius: '50%',
  background: 'var(--a-gold)', color: '#0B0B0B', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
};

function Page({ children, dir }: { children: React.ReactNode; dir: string }) {
  return <div dir={dir} style={{ minHeight: '100vh', background: 'var(--a-bg)', padding: '40px 20px',
    fontFamily: 'Tajawal, sans-serif' }}>{children}</div>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', background: 'var(--a-bg)', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 40,
    fontFamily: 'Tajawal, sans-serif' }}>{children}</div>;
}
function Wordmark() {
  return <div style={{ textAlign: 'center', fontFamily: "'Cinzel', serif", letterSpacing: '0.4em',
    color: 'var(--a-gold)', fontSize: '0.95rem', marginBottom: 22 }}>ATEMA</div>;
}

const eyebrow: React.CSSProperties = { fontSize: 11, letterSpacing: '0.28em', color: 'var(--a-gold)',
  fontFamily: "'Cormorant Garamond', serif", textTransform: 'uppercase', marginBottom: 10 };
const display: React.CSSProperties = { fontFamily: "'Amiri', serif", fontSize: '2rem', color: 'var(--a-text)',
  margin: '0 0 12px', lineHeight: 1.25 };
const soft: React.CSSProperties = { color: 'var(--a-text-soft)', fontSize: 14 };

const confirmBar: React.CSSProperties = {
  position: 'fixed', insetInline: 0, bottom: 0, background: 'var(--a-surface)',
  borderTop: '1px solid var(--a-border)', padding: '16px 20px', zIndex: 50,
  boxShadow: '0 -8px 30px rgba(0,0,0,0.3)',
};
const noteInput: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--a-border)',
  background: 'var(--a-bg)', color: 'var(--a-text)', fontSize: 13.5, fontFamily: 'inherit',
};
const confirmBtn: React.CSSProperties = {
  width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'var(--a-gold)',
  color: '#0B0B0B', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em',
};
