// ATEMA STUDIO — The Atelier (about) page.
// Story of the studio, founder tribute, philosophy, and a private invitation.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';

const tx = (l: 'ar' | 'en', ar: string, en: string) => l === 'ar' ? ar : en;

export default function AboutPage() {
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();

  const bodyFont = lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif";

  // Portrait of Fatima. Falls back to the editorial placeholder if the file
  // isn't yet in /public/photos/. Drop fatima-portrait.jpeg (+ .webp) and the
  // image takes over with no code change required.
  const [portraitOk, setPortraitOk] = useState(true);

  return (
    <div style={{ background: 'var(--a-bg)', color: 'var(--a-text)', minHeight: '100vh' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      {/* ── 1. Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '140px 24px 60px' : '180px 60px 80px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 20%, rgba(212,175,122,0.08), transparent 65%)',
          pointerEvents: 'none',
        }} />
        <FadeUp>
          <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>
            {tx(lang,'الاستوديو','The Atelier')}
          </div>
        </FadeUp>
        <FadeUp delay={120}>
          <h1 className="display-serif" style={{
            fontSize: isMobile ? '2.3rem' : 'clamp(2.8rem, 5vw, 4.2rem)',
            color: 'var(--a-ivory)', marginBottom: 22, fontWeight: 300,
            maxWidth: 900, margin: '0 auto', lineHeight: 1.18,
          }}>
            {tx(lang,
              'استوديو نسائي للضوء والذاكرة.',
              'A feminine atelier of light and memory.'
            )}
          </h1>
        </FadeUp>
        <FadeUp delay={240}>
          <p style={{
            maxWidth: 680, margin: '28px auto 0',
            fontSize: isMobile ? '0.96rem' : '1.06rem',
            lineHeight: 1.95, color: 'var(--a-text-soft)',
            fontFamily: bodyFont, fontWeight: 300,
          }}>
            {tx(lang,
              'في قلب الجبيل، تُصاغ كل صورة كقطعةٍ من كوتور — بصمت، وبصبر، وبدقّة. وفي القلب من كل تلك الصور، يدُ امرأة، وعينٌ تعرف أين تختبئ الحكاية.',
              'In the heart of Jubail, every photograph is composed like a couture piece — quietly, patiently, precisely. And at the centre of all of it: a woman’s hand, and an eye that knows exactly where the story hides.'
            )}
          </p>
        </FadeUp>
      </section>

      {/* ── 2. The Founder — long-form tribute ──────────────────────────── */}
      <section style={{
        padding: isMobile ? '60px 24px 80px' : '80px 60px 120px',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '5fr 4fr',
          gap: isMobile ? 40 : 80, alignItems: 'start',
        }}>
          <FadeUp>
            <div className="ornament" style={{ marginBottom: 24 }}>
              <span>{tx(lang,'المؤسِّسة','The Founder')}</span>
            </div>
            <h2 className="display-serif" style={{
              fontSize: isMobile ? '2.1rem' : '2.6rem',
              color: 'var(--a-ivory)', marginBottom: 28, fontWeight: 300, lineHeight: 1.2,
            }}>
              {tx(lang,'فاطمة بوحسن','Fatima Bohassan')}
            </h2>

            {/* Paragraph 1 — origin */}
            <p style={{
              fontSize: '1rem', lineHeight: 2, color: 'var(--a-text)',
              fontFamily: bodyFont, marginBottom: 20, fontWeight: 300,
            }}>
              {tx(lang,
                'لم تبدأ فاطمة من عدسة. بدأت من نظرة. من إحساسٍ هادئ بأن كل امرأة — في يومٍ ما من حياتها — تستحق أن تُرى كما لم تُرَ من قبل: لا كما يراها الآخرون، بل كما تراها أحلامها.',
                'Fatima did not begin with a lens. She began with a gaze — with the quiet conviction that every woman, on some day of her life, deserves to be seen as she has never been seen before: not as others see her, but as her own dreams see her.'
              )}
            </p>

            {/* Paragraph 2 — her gift */}
            <p style={{
              fontSize: '1rem', lineHeight: 2, color: 'var(--a-text)',
              fontFamily: bodyFont, marginBottom: 20, fontWeight: 300,
            }}>
              {tx(lang,
                'تملك هبةً نادرة: أن تجعل الكاميرا تختفي. ما يظهر في صورها لا يبدو مُرتَّباً، لأنه لم يكن كذلك — هو لحظاتٌ صادقة وُلِدت لأنها صنعت من الاستوديو مساحةً آمنة. تعرف متى تتقدّم، ومتى تنسحب، ومتى تترك الضوء يحكي القصة وحده.',
                'She possesses a rare gift: she makes the camera vanish. What appears in her photographs never looks arranged, because it never was — these are honest moments, born only because she has built the studio into a sanctuary. She knows when to step closer, when to step back, and when to let the light tell the story by itself.'
              )}
            </p>

            {/* Paragraph 3 — her process */}
            <p style={{
              fontSize: '1rem', lineHeight: 2, color: 'var(--a-text)',
              fontFamily: bodyFont, marginBottom: 20, fontWeight: 300,
            }}>
              {tx(lang,
                'تجلس مع كل عروسٍ قبل الجلسة لتفهم أكثر مما يُطلب منها: لتقرأ ما لم يُقَل بعد. تختار الإضاءة بنفسها. تُحرّك الستائر بأصابعها. تُعدِّل تجعيدة الفستان دون أن يلاحظ أحد. وتنتظر — بصبرٍ نادر — تلك الابتسامة التي لا تأتي إلا حين تنسى العدسةُ نفسَها. ثم تمسك بها قبل أن تذوب.',
                'She sits with each bride before the session to understand more than is asked of her: to read what has not yet been said. She chooses the light herself. She adjusts a curtain with her fingertips. She straightens a fold of the gown without anyone noticing. And she waits — with a rare patience — for the smile that arrives only when the lens itself seems to have forgotten. Then she catches it before it dissolves.'
              )}
            </p>

            {/* Paragraph 4 — why ATEMA */}
            <p style={{
              fontSize: '1rem', lineHeight: 2, color: 'var(--a-text-soft)',
              fontFamily: bodyFont, fontStyle: 'italic', fontWeight: 300,
              borderInlineStart: '2px solid var(--a-gold)',
              paddingInlineStart: 22,
            }}>
              {tx(lang,
                'وُلد ATEMA لأن فاطمة آمنت بشيءٍ بسيط: أن الصورة ليست منتجاً، بل عهداً. عهدٌ بأن كل لحظةٍ جميلةٍ ستُحفظ بكرامة — وأن كل امرأةٍ دخلت هذا الاستوديو، ستخرج منه وهي تعرف، أكثر من قبل، كم هي جميلة.',
                'ATEMA was born because Fatima believed in something simple: a photograph is not a product — it is a promise. A promise that every beautiful moment will be kept with dignity. And that every woman who walks into this studio will walk out of it knowing, more clearly than before, just how beautiful she truly is.'
              )}
            </p>
          </FadeUp>

          {/* Right column — portrait placeholder + small caption card */}
          <FadeUp delay={140}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{
                aspectRatio: '3 / 4', background: 'var(--a-surface)',
                border: '1px solid var(--a-border)',
                position: 'relative', overflow: 'hidden',
              }}>
                {portraitOk ? (
                  <picture>
                    <source type="image/webp"
                      srcSet="/photos/fatima-portrait.webp" />
                    <img
                      src="/photos/fatima-portrait.jpeg"
                      alt={tx(lang, 'فاطمة بوحسن — مؤسِّسة استوديو ATEMA',
                                    'Fatima Bohassan — founder of ATEMA Studio')}
                      loading="lazy"
                      decoding="async"
                      onError={() => setPortraitOk(false)}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center 25%',
                      }}
                    />
                  </picture>
                ) : (
                  <>
                    <div aria-hidden style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(135deg, rgba(212,175,122,0.06), transparent 60%)',
                    }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div className="display-serif" style={{
                        fontSize: isMobile ? '2.2rem' : '3rem',
                        color: 'var(--a-gold)', letterSpacing: '0.05em',
                      }}>
                        ATEMA
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div style={{
                padding: '18px 22px',
                background: 'var(--a-surface-alt)',
                border: '1px solid var(--a-border)',
                textAlign: 'center',
              }}>
                <div className="editorial-eyebrow" style={{ marginBottom: 6 }}>
                  {tx(lang,'منذ ٢٠١٨','Est. 2018')}
                </div>
                <p style={{
                  fontSize: '0.82rem', lineHeight: 1.8,
                  color: 'var(--a-text-soft)', fontFamily: bodyFont,
                }}>
                  {tx(lang,
                    'الجبيل · المنطقة الشرقية · المملكة العربية السعودية',
                    'Jubail · Eastern Province · Saudi Arabia'
                  )}
                </p>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── 3. The Gift — 3-column tribute ──────────────────────────────── */}
      <section style={{
        padding: isMobile ? '80px 24px' : '120px 60px',
        background: 'var(--a-surface)',
        borderTop: '1px solid var(--a-border)',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <FadeUp>
            <div className="ornament"><span>{tx(lang,'الهِبَة','Her Gift')}</span></div>
          </FadeUp>
          <FadeUp delay={120}>
            <h2 className="display-serif" style={{
              fontSize: isMobile ? '1.9rem' : '2.6rem',
              color: 'var(--a-ivory)', textAlign: 'center',
              maxWidth: 820, margin: '0 auto 24px', lineHeight: 1.25, fontWeight: 300,
            }}>
              {tx(lang,
                'ما لا تستطيع كاميرا أن تفعله وحدها.',
                'What a camera cannot do alone.'
              )}
            </h2>
          </FadeUp>
          <FadeUp delay={200}>
            <p style={{
              textAlign: 'center', maxWidth: 640, margin: '0 auto 60px',
              fontSize: '0.96rem', lineHeight: 1.95, color: 'var(--a-text-soft)',
              fontFamily: bodyFont, fontWeight: 300,
            }}>
              {tx(lang,
                'ثلاثة أشياءٍ تميّز فاطمة، ولا يمكن تعلّمها — يمكن فقط الاعتراف بها.',
                'Three things set Fatima apart — none of them can be taught; they can only be witnessed.'
              )}
            </p>
          </FadeUp>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? 24 : 32,
          }}>
            {[
              {
                num: '01',
                ar: 'عينُها', en: 'Her Eye',
                arBody:
                  'لا تنظر إلى المشهد، بل إلى ما خلفه. ترى الانعكاس في زاوية المرآة. تلمح اللمسة التي ستُكمل الصورة قبل أن تحدث. هذا ليس تقنيةً — هذه رؤيا.',
                enBody:
                  'She does not look at the scene — she looks at what lies behind it. She notices the reflection in the corner of a mirror. She glimpses the gesture that will complete the frame before it has happened. This is not technique — this is vision.',
              },
              {
                num: '02',
                ar: 'يدُها', en: 'Her Hands',
                arBody:
                  'تُعدِّل الإضاءة درجةً واحدة. تُحرِّك خصلةَ شعرٍ بطرف الإصبع. تُجعِّد قطعةَ قماشٍ بدقّة الخياطة. هذه يدٌ لا تتسرّع، لأنها تعرف أن الجمال يستحق التريّث.',
                enBody:
                  'She adjusts a light by a single degree. She moves a strand of hair with the tip of one finger. She folds a length of fabric with the precision of a couturière. Hers are hands that never hurry — because beauty, she knows, is worth the wait.',
              },
              {
                num: '03',
                ar: 'حضورُها', en: 'Her Presence',
                arBody:
                  'لا تتحدث كثيراً. لكن المرأة التي أمام عدستها تشعر، خلال دقائق، أنها بأمان. وأن هناك شخصاً واحداً، في هذه الغرفة، يفهم تماماً قيمةَ ما يحدث.',
                enBody:
                  'She does not speak much. But the woman in front of her lens feels, within minutes, that she is safe. That there is, in this room, one person who fully understands the weight of what is being preserved.',
              },
            ].map((v, i) => (
              <FadeUp key={v.en} delay={i * 120}>
                <div style={{
                  border: '1px solid var(--a-border)',
                  background: 'var(--a-surface-alt)',
                  padding: isMobile ? '32px 26px' : '40px 32px',
                  height: '100%',
                }}>
                  <div className="editorial-eyebrow" style={{ marginBottom: 18 }}>
                    {v.num}
                  </div>
                  <h3 className="display-serif" style={{
                    fontSize: '1.45rem', color: 'var(--a-ivory)',
                    marginBottom: 16, fontWeight: 300,
                  }}>
                    {tx(lang, v.ar, v.en)}
                  </h3>
                  <p style={{
                    fontSize: '0.95rem', lineHeight: 1.95,
                    color: 'var(--a-text-soft)', fontFamily: bodyFont, fontWeight: 300,
                  }}>
                    {tx(lang, v.arBody, v.enBody)}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Letter from the Atelier ──────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '90px 24px' : '140px 60px',
        background: 'var(--a-bg)',
      }}>
        <FadeUp>
          <div className="ornament" style={{ marginBottom: 28 }}>
            <span>{tx(lang,'رسالة من الاستوديو','A Letter from the Atelier')}</span>
          </div>
        </FadeUp>
        <FadeUp delay={140}>
          <div style={{
            maxWidth: 720, margin: '0 auto',
            padding: isMobile ? '36px 28px' : '56px 64px',
            border: '1px solid var(--a-border-strong)',
            background: 'var(--a-surface)',
            position: 'relative',
            boxShadow: 'var(--a-shadow)',
          }}>
            {/* Gold corner ornaments */}
            <div aria-hidden style={{
              position: 'absolute', top: 12, insetInlineStart: 12,
              width: 28, height: 28,
              borderTop: '1px solid var(--a-gold)', borderInlineStart: '1px solid var(--a-gold)',
            }} />
            <div aria-hidden style={{
              position: 'absolute', bottom: 12, insetInlineEnd: 12,
              width: 28, height: 28,
              borderBottom: '1px solid var(--a-gold)', borderInlineEnd: '1px solid var(--a-gold)',
            }} />

            <p style={{
              fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Cormorant Garamond', serif",
              fontSize: isMobile ? '1.05rem' : '1.18rem',
              lineHeight: 2.1, color: 'var(--a-text)',
              fontStyle: 'italic', fontWeight: 300,
              marginBottom: 28, textAlign: lang === 'ar' ? 'right' : 'left',
            }}>
              {tx(lang,
                'سيّدتي،',
                'Dear lady,'
              )}
            </p>
            <p style={{
              fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Cormorant Garamond', serif",
              fontSize: isMobile ? '1rem' : '1.08rem',
              lineHeight: 2.1, color: 'var(--a-text)',
              fontStyle: 'italic', fontWeight: 300,
              marginBottom: 22,
            }}>
              {tx(lang,
                'حين تأتين إلى ATEMA، لا تأتين فقط لجلسةِ تصوير. تأتين إلى لقاءٍ هادئ — بينكِ، وبين الضوء، وبين امرأةٍ ستحمل كاميرتها بحبٍّ كما تحملينَ أنتِ قلبكِ.',
                'When you come to ATEMA, you are not coming simply for a photo session. You are coming to a quiet meeting — between you, the light, and a woman who will hold her camera with the same care that you hold your own heart.'
              )}
            </p>
            <p style={{
              fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Cormorant Garamond', serif",
              fontSize: isMobile ? '1rem' : '1.08rem',
              lineHeight: 2.1, color: 'var(--a-text)',
              fontStyle: 'italic', fontWeight: 300,
              marginBottom: 32,
            }}>
              {tx(lang,
                'ما سيُلتقط في تلك الساعات لن يكون مجرّد صور. سيكون انعكاساً صادقاً لِما أنتِ عليه — في أنقى لحظاتكِ، وأكثرها لُطفاً. ستحملينها معكِ سنوات، وحين تنظرين إليها يوماً، ستذكرين أنكِ كنتِ — حقاً — بهذا الجمال.',
                'What is captured in those hours will not merely be photographs. It will be an honest reflection of who you are — in your gentlest, truest moments. You will carry them with you for years; and one day, when you look back at them, you will remember that you were — truly — that beautiful.'
              )}
            </p>
            <div style={{ textAlign: lang === 'ar' ? 'left' : 'right', marginTop: 36 }}>
              <p style={{
                fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Cormorant Garamond', serif",
                fontSize: '0.95rem', color: 'var(--a-text-soft)',
                fontStyle: 'italic', marginBottom: 4,
              }}>
                {tx(lang, 'بكلّ الودّ،', 'With all our warmth,')}
              </p>
              <p className="display-serif" style={{
                fontSize: '1.3rem', color: 'var(--a-gold)', fontWeight: 300,
                letterSpacing: '0.08em',
              }}>
                {tx(lang, 'استوديو ATEMA', 'ATEMA Studio')}
              </p>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── 5. Philosophy ───────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '80px 24px' : '120px 60px',
        background: 'var(--a-surface)',
        borderTop: '1px solid var(--a-border)',
        borderBottom: '1px solid var(--a-border)',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <FadeUp>
            <div className="ornament"><span>{tx(lang,'الفلسفة','Philosophy')}</span></div>
          </FadeUp>
          <FadeUp delay={120}>
            <h2 className="display-serif" style={{
              fontSize: isMobile ? '1.9rem' : '2.6rem',
              color: 'var(--a-ivory)', textAlign: 'center',
              maxWidth: 820, margin: '0 auto 60px', lineHeight: 1.25, fontWeight: 300,
            }}>
              {tx(lang,'الجمال يُبنى ببطء.','Beauty is built slowly.')}
            </h2>
          </FadeUp>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? 24 : 32,
          }}>
            {[
              {
                ar: 'الخصوصية', en: 'Discretion',
                arBody: 'فريقٌ نسائي كامل، استوديو خاص، وضمانٌ مطلق لراحتكِ وكرامتكِ. ما يحدث داخل هذه الجدران، يبقى داخل هذه الجدران.',
                enBody: 'An all-female team, a private studio, and absolute assurance of your comfort and dignity. What happens within these walls remains within these walls.',
              },
              {
                ar: 'الحِرفة', en: 'Craft',
                arBody: 'إضاءة سينمائية مصمّمة لكل وجه، ألبوماتٌ مُجلَّدة باليد، وطباعةٌ على ورقٍ أرشيفيٍّ يصمد لأكثر من قرن. كل تفصيل، مدروس.',
                enBody: 'Cinematic lighting tuned to every face, hand-bound albums, and archival printing engineered to outlast a century. Every detail, considered.',
              },
              {
                ar: 'الذاكرة', en: 'Memory',
                arBody: 'ليست صوراً فحسب — هي إرثٌ بصريٌّ يُسلَّم للأجيال. ابنتكِ، يوماً ما، ستراكِ كما كنتِ — وستفهم.',
                enBody: 'Not merely photographs — a visual inheritance, passed to the next generation. One day, your daughter will see you as you were — and she will understand.',
              },
            ].map((v, i) => (
              <FadeUp key={v.en} delay={i * 120}>
                <div style={{
                  border: '1px solid var(--a-border)',
                  background: 'var(--a-surface-alt)',
                  padding: isMobile ? '28px 24px' : '36px 30px',
                  height: '100%',
                }}>
                  <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="display-serif" style={{
                    fontSize: '1.35rem', color: 'var(--a-ivory)',
                    marginBottom: 12, fontWeight: 300,
                  }}>
                    {tx(lang, v.ar, v.en)}
                  </h3>
                  <p style={{
                    fontSize: '0.9rem', lineHeight: 1.9,
                    color: 'var(--a-text-soft)', fontFamily: bodyFont, fontWeight: 300,
                  }}>
                    {tx(lang, v.arBody, v.enBody)}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Voices — anonymous client whispers ──────────────────────── */}
      <section style={{
        padding: isMobile ? '90px 24px' : '140px 60px',
        background: 'var(--a-bg)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeUp>
            <div className="ornament"><span>{tx(lang,'همساتٌ من العميلات','Voices')}</span></div>
          </FadeUp>
          <FadeUp delay={120}>
            <h2 className="display-serif" style={{
              fontSize: isMobile ? '1.8rem' : '2.4rem',
              color: 'var(--a-ivory)', textAlign: 'center',
              maxWidth: 820, margin: '0 auto 70px', lineHeight: 1.3, fontWeight: 300,
            }}>
              {tx(lang,
                'ما يُقال عن جلسةٍ مع فاطمة.',
                'On what it is like to sit before her camera.'
              )}
            </h2>
          </FadeUp>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? 28 : 48,
          }}>
            {[
              {
                ar: '«صورها لا تُلتَقط — هي تُحفَظ. كأنها تعرف اللحظةَ قبل أن تحدث.»',
                en: '"Her photographs are not taken — they are kept. As though she knows the moment before it has even arrived."',
                attrAr: '— عروسٌ من الرياض',
                attrEn: '— A bride from Riyadh',
              },
              {
                ar: '«خرجتُ من جلستي مع فاطمة وأنا أعرف نفسي أكثر. لم أكن أتوقّع أن تكون الكاميرا قادرةً على ذلك.»',
                en: '"I left my session with Fatima knowing myself better. I had not believed a camera could do that."',
                attrAr: '— عميلةٌ من الخبر',
                attrEn: '— A client from Al Khobar',
              },
              {
                ar: '«ثلاث ساعات شعرتُ فيها أنني أُرى. لا أكثر، ولا أقل. وهذا، في زمنٍ مزدحم، نادر.»',
                en: '"Three hours in which I felt, simply, that I was seen. No more, no less. In a crowded world, that is rare."',
                attrAr: '— أمٌّ شابّة، الدمام',
                attrEn: '— A young mother, Dammam',
              },
              {
                ar: '«فتحتُ الألبومَ بعد سنة، فبكيتُ — لا حُزناً، بل لأنّ ما كنتُ أحاول تذكّره كان كلّه، هناك، محفوظاً.»',
                en: '"I opened the album a year later and wept — not from sadness, but because everything I had been trying to remember was there, kept."',
                attrAr: '— عروسٌ من القطيف',
                attrEn: '— A bride from Qatif',
              },
            ].map((q, i) => (
              <FadeUp key={i} delay={(i % 2) * 120}>
                <figure style={{ margin: 0 }}>
                  <div style={{
                    fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Cormorant Garamond', serif",
                    fontSize: isMobile ? '1.1rem' : '1.25rem',
                    lineHeight: 1.85, color: 'var(--a-text)',
                    fontStyle: 'italic', fontWeight: 300, marginBottom: 18,
                  }}>
                    {tx(lang, q.ar, q.en)}
                  </div>
                  <figcaption style={{
                    fontSize: '0.78rem', letterSpacing: '0.16em',
                    color: 'var(--a-gold)', fontFamily: "'Cinzel', serif",
                    textTransform: 'uppercase',
                  }}>
                    {tx(lang, q.attrAr, q.attrEn)}
                  </figcaption>
                </figure>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Closing CTA ───────────────────────────────────────────────── */}
      <section style={{
        padding: isMobile ? '90px 24px' : '140px 60px',
        textAlign: 'center',
        background: 'var(--a-surface)',
        borderTop: '1px solid var(--a-border)',
      }}>
        <FadeUp>
          <div className="editorial-eyebrow" style={{ marginBottom: 18 }}>
            {tx(lang,'دعينا نلتقي','Let’s Meet')}
          </div>
        </FadeUp>
        <FadeUp delay={120}>
          <h2 className="display-serif" style={{
            fontSize: isMobile ? '2rem' : '2.8rem', color: 'var(--a-ivory)',
            maxWidth: 760, margin: '0 auto 22px', lineHeight: 1.25, fontWeight: 300,
          }}>
            {tx(lang,
              'احجزي مشاورةً خاصّة — لنبدأ معاً.',
              'Reserve a private consultation — let us begin together.'
            )}
          </h2>
        </FadeUp>
        <FadeUp delay={200}>
          <p style={{
            maxWidth: 560, margin: '0 auto 38px',
            fontSize: '0.98rem', lineHeight: 1.95, color: 'var(--a-text-soft)',
            fontFamily: bodyFont, fontWeight: 300,
          }}>
            {tx(lang,
              'لا التزام، ولا استعجال. فقط محادثةٌ هادئةٌ نفهم فيها رؤيتكِ، ثم نُصمّم لكِ تجربةً تليق بها.',
              'No commitment, no rush. Simply a quiet conversation in which we listen to your vision, then design an experience worthy of it.'
            )}
          </p>
        </FadeUp>
        <FadeUp delay={300}>
          <div style={{
            display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Link to="/book" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ width: 'auto', padding: '14px 32px' }}>
                {tx(lang,'احجزي جلستك','Reserve a Session')}
              </button>
            </Link>
            <Link to="/portfolio" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost">
                {tx(lang,'تصفّحي الأعمال','Browse Portfolio')}
              </button>
            </Link>
          </div>
        </FadeUp>
      </section>

      <SiteFooter lang={lang} />
    </div>
  );
}
