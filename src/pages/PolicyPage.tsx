// ATEMA STUDIO — Public Terms / Refund / PDPL page (bilingual).
//
// Required by Moyasar live-activation review and by Apple/Google policy
// reviewers. Single source of truth for the same copy lives in
// src/content/legal.ts.

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import FadeUp from '../components/FadeUp';
import { useLang } from '../hooks/useLang';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { STATIONERY } from '../theme/stationery';
import {
  TC_CONTENT_AR, TC_CONTENT_EN,
  PDPL_CONTENT_AR, PDPL_CONTENT_EN,
} from '../content/legal';

const tx = (l: 'ar' | 'en', ar: string, en: string) => l === 'ar' ? ar : en;

export default function PolicyPage() {
  const { lang, setLang } = useLang();
  const { isMobile } = useBreakpoint();

  const tc   = lang === 'ar' ? TC_CONTENT_AR   : TC_CONTENT_EN;
  const pdpl = lang === 'ar' ? PDPL_CONTENT_AR : PDPL_CONTENT_EN;

  return (
    <div style={{ background: 'var(--a-bg)', color: 'var(--a-text)', minHeight: '100vh' }}>
      <SiteHeader lang={lang} setLang={setLang} solidOnScroll />

      <section style={{
        padding: isMobile ? '120px 24px 40px' : '160px 60px 50px',
        textAlign: 'center',
      }}>
        <FadeUp>
          <div className="editorial-eyebrow" style={{ marginBottom: 14 }}>
            {tx(lang, 'الشروط والسياسات', 'Terms & Policies')}
          </div>
        </FadeUp>
        <FadeUp delay={120}>
          <h1 className="display-serif" style={{
            fontSize: isMobile ? '2rem' : '3rem', color: 'var(--a-ivory)',
            marginBottom: 16, fontWeight: 300,
          }}>
            {tx(lang, 'الشروط والأحكام وحماية البيانات', 'Terms, Refunds & Data Protection')}
          </h1>
        </FadeUp>
        <FadeUp delay={220}>
          <p style={{
            maxWidth: 620, margin: '0 auto', color: 'var(--a-text-soft)',
            fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : "'Montserrat', sans-serif",
            fontSize: '0.95rem', lineHeight: 1.85,
          }}>
            {tx(lang,
              'هذه السياسات تحكم العلاقة بينكِ وبين ATEMA Studio. آخر تحديث: ٢٠٢٦-٠٥.',
              'These policies govern your relationship with ATEMA Studio. Last updated: 2026-05.')}
          </p>
        </FadeUp>
      </section>

      {/* The legal copy lives as HTML strings — we render it on a white card
          to inherit the existing light-theme typography from the in-booking
          popup, so the two surfaces look identical. */}
      <section style={{
        padding: isMobile ? '20px 24px 80px' : '20px 60px 120px',
      }}>
        <div style={{
          maxWidth: 760, margin: '0 auto',
          display: 'grid', gap: 24,
        }}>
          <FadeUp>
            <article
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              style={{
                background: STATIONERY.paperAlt, color: STATIONERY.inkSoft, borderRadius: 8,
                padding: isMobile ? '22px 20px' : '34px 36px',
                border: `1px solid ${STATIONERY.borderHair}`,
              }}
              dangerouslySetInnerHTML={{ __html: tc }}
            />
          </FadeUp>
          <FadeUp delay={120}>
            <article
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              style={{
                background: STATIONERY.paperAlt, color: STATIONERY.inkSoft, borderRadius: 8,
                padding: isMobile ? '22px 20px' : '34px 36px',
                border: `1px solid ${STATIONERY.borderHair}`,
              }}
              dangerouslySetInnerHTML={{ __html: pdpl }}
            />
          </FadeUp>

          {/* Official channels — the anti-impersonation anchor. Customers can
              verify here that a WhatsApp message, email, or IBAN really came
              from ATEMA. Values mirror BankTransferPayment.tsx + SiteFooter. */}
          <FadeUp delay={200}>
            <article
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              style={{
                background: STATIONERY.paperAlt, color: STATIONERY.inkSoft, borderRadius: 8,
                padding: isMobile ? '22px 20px' : '34px 36px',
                border: `1px solid ${STATIONERY.borderHair}`,
                fontFamily: "'Tajawal', sans-serif", fontSize: '0.9rem', lineHeight: 1.9,
              }}
            >
              <h2 style={{
                fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Cormorant Garamond', serif",
                color: STATIONERY.inkMuted, fontSize: '1.15rem', marginBottom: 12, fontWeight: 600,
              }}>
                {tx(lang, 'قنواتنا الرسمية — تحقّقي قبل أي تحويل', 'Our official channels — verify before any transfer')}
              </h2>
              <p style={{ marginBottom: 12 }}>
                {tx(lang,
                  'نتواصل معكِ حصرياً عبر القنوات التالية. أي رسالة أو طلب تحويل من رقم أو حساب آخر لا يمثّل استوديو ATEMA.',
                  'We contact you exclusively through the channels below. Any message or transfer request from a different number or account does not represent ATEMA Studio.')}
              </p>
              <ul style={{ paddingInlineStart: 20, marginBottom: 12 }}>
                <li>{tx(lang, 'واتساب: ', 'WhatsApp: ')}<strong dir="ltr">+966 54 832 3496</strong></li>
                <li>{tx(lang, 'البريد الإلكتروني: ', 'Email: ')}<strong dir="ltr">atema@atemastudio.xyz</strong></li>
                <li>{tx(lang, 'إنستغرام: ', 'Instagram: ')}<strong dir="ltr">@atema.studio</strong></li>
                <li>
                  {tx(lang, 'الآيبان الرسمي الوحيد (مصرف الراجحي): ', 'Our only official IBAN (Al Rajhi Bank): ')}
                  <strong dir="ltr" style={{ letterSpacing: '0.03em' }}>SA03 8000 0000 3296 0801 0885 626</strong>
                  {' — '}
                  {tx(lang, 'لا يتغيّر أبداً.', 'it never changes.')}
                </li>
              </ul>
              <p style={{
                background: STATIONERY.paperWarn, borderInlineStart: `3px solid ${STATIONERY.warnAccent}`,
                color: STATIONERY.warnInk, padding: '10px 14px', borderRadius: 6, margin: 0,
              }}>
                {tx(lang,
                  'فريق ATEMA لن يطلب منكِ أبداً رمز التحقق المرسل إلى جوالك، ولن يطلب التحويل إلى أي حساب آخر. إن وصلكِ طلب كهذا فهو محاولة احتيال — تجاهليه وأبلغينا.',
                  'ATEMA will never ask you for the verification code sent to your phone, and will never ask you to transfer to any other account. Any such request is a scam — ignore it and let us know.')}
              </p>
            </article>
          </FadeUp>
        </div>
      </section>

      <SiteFooter lang={lang} />
    </div>
  );
}
