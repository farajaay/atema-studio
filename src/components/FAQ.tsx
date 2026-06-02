// ATEMA STUDIO — Bilingual FAQ (audit append, 2026-05)
//
// Addresses the audit's §6.6 gap: brides need answers to common questions
// (turnaround, revisions, payment, female-photographer policy, cancellation)
// during the booking decision, not buried in a separate help page.
//
// Theme: relies on the --a-* CSS custom properties from index.html so it
// adapts to Couture Noir / Atelier Ivory automatically. No hard-coded hex.

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLang } from '../hooks/useLang';

interface FAQItem {
  q_ar: string;
  q_en: string;
  a_ar: string;
  a_en: string;
}

// Editorial voice — slow, considered, sensory (per CLAUDE.md §8).
// Replace copy here when the studio refines the answers; do not
// machine-translate between AR/EN.
const ITEMS: FAQItem[] = [
  {
    q_ar: 'متى أستلم الصور المعدلة؟',
    q_en: 'When will I receive the edited photos?',
    a_ar: 'صورك المعدلة بعناية تصل بين ٧ و٢١ يومًا حسب الباقة — تجدين المهلة المحددة على بطاقة الباقة. إن كنتِ بحاجة إليها أبكر، تذكّري إضافة خدمة "تسليم سريع" عند الحجز.',
    a_en: 'Edited images arrive in 7 to 21 days depending on the package — the exact window is shown on each package card. If you need them sooner, add the express-delivery service at checkout.',
  },
  {
    q_ar: 'كم عدد الصور التي سأستلمها؟',
    q_en: 'How many photos will I receive?',
    a_ar: 'كل باقة تحدد عددًا من الصور المختارة بعناية ومعدّلة احترافيًا. الصور غير المختارة من جلستك تبقى محفوظة لمدة ٦ أشهر، ويمكنكِ طلب صور إضافية متى أردتِ.',
    a_en: 'Each package specifies a curated, hand-edited count. Unselected frames from your session are kept for six months, and additional photo packs can be added at any time.',
  },
  {
    q_ar: 'هل يمكنني طلب تعديلات على الصور؟',
    q_en: 'Can I request edits or revisions?',
    a_ar: 'بالطبع. تتضمن كل باقة جولة تعديلات واحدة دون رسوم إضافية ضمن أسبوع من التسليم. التعديلات الأكبر (إعادة قص، تغيير درجة اللون، رتوش متقدم) تُحسب بشكل منفصل ونتفق عليها قبل البدء.',
    a_en: 'Yes — one round of refinements is included with every package, free of charge, within one week of delivery. Larger interventions (re-cropping, colour-grade changes, advanced retouching) are quoted separately and agreed before we start.',
  },
  {
    q_ar: 'كيف تتم عملية الدفع؟',
    q_en: 'How does payment work?',
    a_ar: 'نوفر طريقتين: البطاقة الائتمانية (مدى / فيزا / ماستركارد) أو التحويل البنكي إلى حساب الراجحي مع رفع إيصال التحويل عبر واتساب. عربون ٥٠٪ غير مسترد لتأكيد حجز التاريخ، والرصيد قبل يوم التصوير.',
    a_en: 'Two routes are offered: card payment (Mada / Visa / Mastercard) or bank transfer to our Al Rajhi account with a receipt sent via WhatsApp. A non-refundable 50% deposit secures the date; the balance settles before the shoot.',
  },
  {
    q_ar: 'هل المصوّرات إناث فقط؟',
    q_en: 'Is your team all-female?',
    a_ar: 'نعم — وهذا هو جوهر ATEMA. فريق التصوير والمونتاج والتنسيق نسائي بالكامل، ضمانًا للراحة والخصوصية والثقة في يومك الخاص.',
    a_en: 'Yes — and that is the heart of ATEMA. Our photography, editing, and styling team is exclusively female, ensuring comfort, discretion, and trust on your day.',
  },
  {
    q_ar: 'ما هي سياسة الإلغاء؟',
    q_en: 'What is your cancellation policy?',
    a_ar: 'العربون ٥٠٪ غير مسترد بمجرد تأكيد الحجز، لأننا نحجز التاريخ لكِ ونرفض حجوزات أخرى. ما تبقى من المبلغ يُسترد بالكامل إن أُلغي الحجز قبل ٤٨ ساعة من التصوير. التفاصيل الكاملة في الشروط والأحكام.',
    a_en: 'The 50% deposit is non-refundable once the booking is confirmed — we hold the date for you and decline other requests for it. The remainder is fully refundable if cancelled at least 48 hours before the shoot. Full terms apply.',
  },
  {
    q_ar: 'ماذا يعني "صمّمي باقتك"؟',
    q_en: 'What does "Design Your Package" mean?',
    a_ar: 'هي طريقة مرنة لبناء تجربتكِ من الصفر. نبدأ من الأساس المرن (ساعة تصوير + ٢٠ صورة معدّلة بـ ١٨٠٠ ر.س)، ثم تختارين الإضافات التي تناسب مناسبتكِ — ساعات تصوير، فيديو سينمائي، ألبوم فاخر، تغطية ليلة الحناء، أو جلسة تحضيرات العروس. تدفعين فقط لما تختارينه، والإجمالي يتحدث معكِ مباشرةً مع كل خيار.',
    a_en: 'A flexible way to build your experience from the ground up. We start from the Custom Foundation (1 hour of photography + 20 edited photos at 1,800 SAR), then you choose the add-ons that fit your event — extra shoot hours, cinematic video, a couture album, henna-night coverage, or the bridal-prep session. You pay only for what you choose, and the total updates live as you decide.',
  },
];

interface FAQRowProps {
  item: FAQItem;
  open: boolean;
  onToggle: () => void;
  lang: 'ar' | 'en';
  idx: number;
}

function FAQRow({ item, open, onToggle, lang, idx }: FAQRowProps) {
  const q = lang === 'ar' ? item.q_ar : item.q_en;
  const a = lang === 'ar' ? item.a_ar : item.a_en;
  const panelId = `faq-panel-${idx}`;
  const headerId = `faq-header-${idx}`;
  return (
    <div style={{
      borderBottom: '1px solid var(--a-border)',
      transition: 'background 0.25s',
    }}>
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: lang === 'ar' ? 'right' : 'left',
          background: 'transparent',
          border: 'none',
          padding: '18px 4px',
          cursor: 'pointer',
          color: 'var(--a-heading)',
          fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : 'inherit',
          fontSize: '1rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          letterSpacing: lang === 'ar' ? 'normal' : '0.01em',
        }}
      >
        <span style={{ flex: 1 }}>{q}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          style={{
            color: 'var(--a-gold)',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
          }}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!open}
        style={{
          padding: open ? '0 4px 22px 4px' : '0 4px',
          color: 'var(--a-text)',
          fontFamily: lang === 'ar' ? "'Tajawal', sans-serif" : 'inherit',
          fontSize: '0.9rem',
          lineHeight: 1.85,
          maxWidth: '70ch',
        }}
      >
        {a}
      </div>
    </div>
  );
}

export default function FAQ() {
  const { lang } = useLang();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section
      aria-labelledby="faq-title"
      style={{
        background: 'var(--a-surface)',
        border: '1px solid var(--a-border)',
        borderRadius: '14px',
        padding: '36px 28px',
        maxWidth: '760px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          fontFamily: "'Cinzel', serif",
          fontSize: '0.72rem',
          letterSpacing: '0.42em',
          color: 'var(--a-gold)',
          marginBottom: '10px',
        }}>
          {lang === 'ar' ? 'الأسئلة المتكررة' : 'FREQUENTLY ASKED'}
        </div>
        <h2 id="faq-title" style={{
          fontFamily: lang === 'ar' ? "'Amiri', serif" : "'Cormorant Garamond', serif",
          fontStyle: lang === 'ar' ? 'italic' : 'normal',
          fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
          fontWeight: 400,
          color: 'var(--a-heading)',
          margin: 0,
          lineHeight: 1.2,
        }}>
          {lang === 'ar'
            ? 'إجابات لما تودّين معرفته'
            : 'Answers to what you might be wondering'}
        </h2>
      </div>
      <div role="presentation">
        {ITEMS.map((item, i) => (
          <FAQRow
            key={i}
            idx={i}
            item={item}
            lang={lang}
            open={openIdx === i}
            onToggle={() => setOpenIdx(openIdx === i ? null : i)}
          />
        ))}
      </div>
    </section>
  );
}
