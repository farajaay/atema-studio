import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Hls from 'hls.js';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useLang } from '../hooks/useLang';
import { FILM_CHAPTERS, FILMS } from '../content/films';
import type { FilmChapterKey, FilmCuration } from '../content/films';

type Lang = 'ar' | 'en';

interface ManifestRendition {
  label: string;
  width: number;
  height: number;
  bandwidth: number;
}

interface ManifestItem {
  id: string;
  order: number;
  title: string;
  duplicateOf: string | null;
  hls: string;
  poster: string;
  duration: number;
  width: number;
  height: number;
  renditions: ManifestRendition[];
}

interface FilmsManifest {
  player: 'hls';
  items: ManifestItem[];
}

interface FilmView extends FilmCuration {
  stream: ManifestItem;
}

interface QualityOption {
  value: string;
  label: string;
}

const MANIFEST_URL = '/videos/hls/manifest.json';
const tx = (lang: Lang, ar: string, en: string) => lang === 'ar' ? ar : en;

function assetUrl(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function qualityLabel(width: number, height: number) {
  return `${Math.min(width, height)}p`;
}

function joinFilms(manifest: FilmsManifest | null): FilmView[] {
  const streams = new Map((manifest?.items ?? []).map(item => [item.id, item]));
  return FILMS
    .map(film => {
      const stream = streams.get(film.manifestId);
      return stream ? { ...film, stream } : null;
    })
    .filter((film): film is FilmView => film !== null)
    .sort((a, b) => a.order - b.order);
}

function chapterLabel(lang: Lang, key: FilmChapterKey) {
  const chapter = FILM_CHAPTERS.find(item => item.key === key);
  return chapter ? tx(lang, chapter.ar, chapter.en) : key;
}

const pillStyle: CSSProperties = {
  border: '1px solid var(--a-border)',
  color: 'var(--a-text-soft)',
  padding: '6px 10px',
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontFamily: "'Montserrat', sans-serif",
};

export default function FilmsPage() {
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const shouldAutoplayRef = useRef(false);

  const [manifest, setManifest] = useState<FilmsManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [chapter, setChapter] = useState<FilmChapterKey | 'all'>('all');
  const [activeId, setActiveId] = useState(FILMS[0]?.manifestId ?? '');
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([{ value: 'auto', label: 'Auto' }]);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [playbackNote, setPlaybackNote] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(MANIFEST_URL, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Manifest failed: ${response.status}`);
        return response.json() as Promise<FilmsManifest>;
      })
      .then(data => {
        if (!alive) return;
        setManifest(data);
        setError(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, []);

  const films = useMemo(() => joinFilms(manifest), [manifest]);
  const visibleFilms = useMemo(
    () => chapter === 'all' ? films : films.filter(film => film.chapter === chapter),
    [chapter, films],
  );
  const activeFilm = films.find(film => film.manifestId === activeId) ?? films[0] ?? null;
  const activeVisibleIndex = visibleFilms.findIndex(film => film.manifestId === activeFilm?.manifestId);
  const activeIndex = activeVisibleIndex >= 0 ? activeVisibleIndex : 0;

  useEffect(() => {
    if (films.length > 0 && !films.some(film => film.manifestId === activeId)) {
      setActiveId(films[0].manifestId);
    }
  }, [activeId, films]);

  useEffect(() => {
    if (visibleFilms.length > 0 && activeFilm && !visibleFilms.some(film => film.manifestId === activeFilm.manifestId)) {
      setActiveId(visibleFilms[0].manifestId);
    }
  }, [activeFilm, visibleFilms]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeFilm) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    setSelectedQuality('auto');
    setQualityOptions([{ value: 'auto', label: 'Auto' }]);
    setPlaybackNote('');
    video.poster = assetUrl(activeFilm.stream.poster);
    video.removeAttribute('src');
    video.load();

    const playAfterAttach = () => {
      if (!shouldAutoplayRef.current) return;
      shouldAutoplayRef.current = false;
      video.play().catch(() => {
        setPlaybackNote(tx(lang, 'التشغيل ينتظر لمسة من المتصفح.', 'Playback is waiting for a browser gesture.'));
      });
    };

    const source = assetUrl(activeFilm.stream.hls);
    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        enableWorker: true,
        maxBufferLength: 24,
        startLevel: -1,
      });
      hlsRef.current = hls;
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setQualityOptions([
          { value: 'auto', label: 'Auto' },
          ...hls.levels.map((level, index) => ({
            value: String(index),
            label: qualityLabel(level.width, level.height),
          })),
        ]);
        playAfterAttach();
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        setSelectedQuality(hls.manualLevel >= 0 ? String(hls.manualLevel) : 'auto');
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        setPlaybackNote(tx(lang, 'تعذر تشغيل هذا المقطع الآن.', 'This film paused after a streaming error.'));
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source;
      setQualityOptions([{ value: 'auto', label: 'Auto HLS' }]);
      playAfterAttach();
    } else {
      setPlaybackNote(tx(lang, 'هذا المتصفح لا يدعم بث HLS.', 'This browser does not support HLS playback.'));
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [activeFilm, lang]);

  function move(delta: number) {
    if (visibleFilms.length === 0) return;
    const next = visibleFilms[(activeIndex + delta + visibleFilms.length) % visibleFilms.length];
    shouldAutoplayRef.current = true;
    setActiveId(next.manifestId);
  }

  function chooseFilm(film: FilmView, shouldPlay = true) {
    shouldAutoplayRef.current = shouldPlay;
    if (film.manifestId === activeFilm?.manifestId && shouldPlay) {
      shouldAutoplayRef.current = false;
      videoRef.current?.play().catch(() => {
        setPlaybackNote(tx(lang, 'التشغيل ينتظر لمسة من المتصفح.', 'Playback is waiting for a browser gesture.'));
      });
    }
    setActiveId(film.manifestId);
  }

  function handleQuality(value: string) {
    setSelectedQuality(value);
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = value === 'auto' ? -1 : Number(value);
  }

  const pagePadding = isMobile ? '118px 18px 58px' : '148px 42px 84px';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-bg)', color: 'var(--a-text)' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      <main>
        <section style={{ padding: pagePadding }}>
          <div style={{ maxWidth: 1320, margin: '0 auto' }}>
            <FadeUp>
              <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
                {tx(lang, 'الأفلام', 'Films')}
              </div>
            </FadeUp>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.35fr) minmax(340px, 0.65fr)',
              gap: isMobile ? 28 : 34,
              alignItems: 'start',
            }}>
              <div>
                <FadeUp delay={80}>
                  <h1 className="display-serif" style={{
                    fontSize: isMobile ? '2.1rem' : '3.35rem',
                    color: 'var(--a-ivory)',
                    marginBottom: 16,
                    fontWeight: 300,
                  }}>
                    {tx(lang, 'حركة تحفظ ما بين الصور', 'Motion Between the Stills')}
                  </h1>
                </FadeUp>
                <FadeUp delay={150}>
                  <p style={{
                    maxWidth: 680,
                    color: 'var(--a-text-soft)',
                    fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                    lineHeight: 1.9,
                    fontSize: '0.98rem',
                    marginBottom: 28,
                  }}>
                    {tx(
                      lang,
                      'مختارات متحركة من لغة ATEMA: دخول، طرحة، تفاصيل صغيرة، وسكون لا يظهر إلا حين يتحرك الضوء.',
                      'A moving selection from ATEMA: entrances, veils, small details, and the stillness that appears when light begins to move.',
                    )}
                  </p>
                </FadeUp>

                <FadeUp delay={220}>
                  <div style={{
                    border: '1px solid var(--a-border)',
                    background: 'var(--a-surface)',
                  }}>
                    <div style={{
                      position: 'relative',
                      aspectRatio: activeFilm && activeFilm.stream.height > activeFilm.stream.width
                        ? (isMobile ? '9 / 14' : '16 / 10')
                        : '16 / 9',
                      background: 'var(--a-surface-2)',
                      overflow: 'hidden',
                    }}>
                      {activeFilm ? (
                        <video
                          ref={videoRef}
                          controls
                          playsInline
                          preload="metadata"
                          poster={assetUrl(activeFilm.stream.poster)}
                          onEnded={() => move(1)}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            display: 'block',
                            background: 'var(--a-bg)',
                          }}
                        />
                      ) : (
                        <div style={{
                          minHeight: 320,
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--a-text-muted)',
                        }}>
                          {loading
                            ? tx(lang, 'جار التحميل...', 'Loading...')
                            : tx(lang, 'لا توجد أفلام جاهزة.', 'No films are ready yet.')}
                        </div>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: isMobile ? 'stretch' : 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: isMobile ? 16 : 18,
                      borderTop: '1px solid var(--a-border)',
                    }}>
                      <div>
                        <h2 className="display-serif" style={{
                          color: 'var(--a-ivory)',
                          fontSize: isMobile ? '1.28rem' : '1.58rem',
                          marginBottom: 8,
                        }}>
                          {activeFilm ? tx(lang, activeFilm.title_ar, activeFilm.title_en) : tx(lang, 'الأفلام', 'Films')}
                        </h2>
                        {activeFilm && (
                          <p style={{
                            color: 'var(--a-text-soft)',
                            lineHeight: 1.75,
                            fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                            maxWidth: 640,
                          }}>
                            {tx(lang, activeFilm.caption_ar, activeFilm.caption_en)}
                          </p>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isMobile ? 'space-between' : 'flex-end',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}>
                        <button type="button" onClick={() => move(-1)} aria-label={tx(lang, 'السابق', 'Previous')} style={controlButtonStyle}>
                          {lang === 'ar' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                        <button type="button" onClick={() => move(1)} aria-label={tx(lang, 'التالي', 'Next')} style={controlButtonStyle}>
                          {lang === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <select
                          value={selectedQuality}
                          onChange={event => handleQuality(event.target.value)}
                          aria-label={tx(lang, 'جودة التشغيل', 'Playback quality')}
                          style={{
                            minHeight: 42,
                            minWidth: 112,
                            border: '1px solid var(--a-border-strong)',
                            background: 'var(--a-surface-2)',
                            color: 'var(--a-ivory)',
                            padding: '0 10px',
                            fontFamily: "'Montserrat', sans-serif",
                            fontSize: '0.76rem',
                            direction: 'ltr',
                          }}
                        >
                          {qualityOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </FadeUp>

                {playbackNote && (
                  <p style={{
                    color: 'var(--a-gold)',
                    marginTop: 14,
                    fontSize: '0.82rem',
                    fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                  }}>
                    {playbackNote}
                  </p>
                )}
              </div>

              <FadeUp delay={260}>
                <aside style={{
                  borderTop: '1px solid var(--a-border)',
                  paddingTop: 18,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    marginBottom: 16,
                  }}>
                    <div>
                      <div className="editorial-eyebrow" style={{ marginBottom: 6 }}>
                        {tx(lang, 'القائمة', 'Playlist')}
                      </div>
                      <p style={{ color: 'var(--a-text-muted)', fontSize: '0.78rem' }}>
                        {visibleFilms.length} / {films.length}
                      </p>
                    </div>
                    {activeFilm && (
                      <span style={pillStyle}>
                        {formatDuration(activeFilm.stream.duration)}
                      </span>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 18,
                  }}>
                    <button type="button" onClick={() => setChapter('all')} style={filterButtonStyle(chapter === 'all')}>
                      {tx(lang, 'الكل', 'All')}
                    </button>
                    {FILM_CHAPTERS.map(item => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setChapter(item.key)}
                        style={filterButtonStyle(chapter === item.key)}
                      >
                        {tx(lang, item.ar, item.en)}
                      </button>
                    ))}
                  </div>

                  {error && (
                    <p style={{ color: 'var(--a-gold)', marginBottom: 16 }}>
                      {tx(lang, 'تعذر تحميل قائمة الأفلام.', 'The films manifest could not be loaded.')}
                    </p>
                  )}

                  <div style={{
                    display: 'grid',
                    gap: 10,
                    maxHeight: isMobile ? 'none' : 'calc(100vh - 250px)',
                    overflowY: isMobile ? 'visible' : 'auto',
                    paddingInlineEnd: isMobile ? 0 : 6,
                  }}>
                    {visibleFilms.map((film, index) => {
                      const active = film.manifestId === activeFilm?.manifestId;
                      return (
                        <button
                          key={film.manifestId}
                          type="button"
                          onClick={() => chooseFilm(film)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '92px minmax(0, 1fr)' : '108px minmax(0, 1fr)',
                            gap: 12,
                            width: '100%',
                            border: `1px solid ${active ? 'var(--a-gold)' : 'var(--a-border)'}`,
                            background: active ? 'var(--a-surface-2)' : 'transparent',
                            color: 'var(--a-text)',
                            padding: 8,
                            textAlign: lang === 'ar' ? 'right' : 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{
                            position: 'relative',
                            display: 'block',
                            aspectRatio: film.stream.height > film.stream.width ? '9 / 12' : '16 / 9',
                            overflow: 'hidden',
                            background: 'var(--a-surface)',
                          }}>
                            <img
                              src={assetUrl(film.stream.poster)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                                filter: active ? 'brightness(1)' : 'brightness(0.78)',
                              }}
                            />
                            {active && (
                              <span style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'grid',
                                placeItems: 'center',
                                color: 'var(--a-gold)',
                                background: 'color-mix(in srgb, var(--a-bg) 34%, transparent)',
                              }}>
                                <Play size={18} fill="currentColor" />
                              </span>
                            )}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              color: 'var(--a-text-muted)',
                              fontSize: '0.68rem',
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              marginBottom: 6,
                            }}>
                              <span>{String(index + 1).padStart(2, '0')}</span>
                              <span>{chapterLabel(lang, film.chapter)}</span>
                            </span>
                            <span className="display-serif" style={{
                              display: 'block',
                              color: active ? 'var(--a-gold)' : 'var(--a-ivory)',
                              fontSize: '1rem',
                              lineHeight: 1.25,
                              marginBottom: 6,
                            }}>
                              {tx(lang, film.title_ar, film.title_en)}
                            </span>
                            <span style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              color: 'var(--a-text-soft)',
                              fontSize: '0.78rem',
                              lineHeight: 1.55,
                              fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
                            }}>
                              {tx(lang, film.caption_ar, film.caption_en)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
              </FadeUp>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}

const controlButtonStyle: CSSProperties = {
  minWidth: 42,
  minHeight: 42,
  display: 'inline-grid',
  placeItems: 'center',
  border: '1px solid var(--a-border-strong)',
  background: 'transparent',
  color: 'var(--a-gold)',
  cursor: 'pointer',
};

function filterButtonStyle(active: boolean): CSSProperties {
  return {
    minHeight: 38,
    padding: '0 14px',
    border: `1px solid ${active ? 'var(--a-gold)' : 'var(--a-border-strong)'}`,
    background: active ? 'var(--a-gold)' : 'transparent',
    color: active ? 'var(--a-bg)' : 'var(--a-text-soft)',
    cursor: 'pointer',
    fontFamily: "'Cinzel', serif",
    fontSize: '0.68rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  };
}
