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
    a_ar: 'نُسلِّم الصور المعدَّلة خلال ٤ إلى ٦ أشهر من تاريخ المناسبة — هذا الإطار الزمني يتيح لنا تقديم تعديل عميق ومتأنٍّ على كل صورة بدلاً من التسليم المتسرع. بمجرد اكتمال التعديل، تصلكِ رسالة واتساب برابط معرض التنزيل.',
    a_en: 'Edited images are delivered within 4 to 6 months of the event date — this window lets us give every frame the careful, unhurried attention it deserves. Once editing is complete, you receive a WhatsApp message with a private gallery download link.',
  },
  {
    q_ar: 'كم عدد الصور التي سأستلمها؟',
    q_en: 'How many photos will I receive?',
    a_ar: 'كل باقة تُحدّد عددًا من الصور المختارة بعناية ومعدَّلة احترافيًا — العدد مذكور على بطاقة الباقة. الصور غير المختارة من جلستك تبقى محفوظة لمدة ٦ أشهر بعد تسليم المعرض، ويمكنكِ طلب صور إضافية منها بتكلفة منفصلة.',
    a_en: 'Each package specifies a curated, hand-edited count — visible on the package card. Unselected frames are kept for six months after gallery delivery; you may request additional images from them for a separate fee.',
  },
  {
    q_ar: 'كيف تصلني صوري بعد التعديل؟',
    q_en: 'How are my photos delivered?',
    a_ar: 'بعد اكتمال التعديل، يُرسَل لكِ رابط معرض خاص عبر واتساب لتحميل صورك بجودة عالية. المعرض يبقى متاحًا لمدة ١٤ يوماً — نوصي بتحميل الملفات فور وصول الرابط وحفظ نسخة احتياطية. الصور تُسلَّم بصيغة JPG عالية الدقة، والملفات الخام (RAW) غير مشمولة في أي باقة.',
    a_en: 'Once editing is complete, a private gallery link is sent to you via WhatsApp for high-resolution download. The gallery remains active for 14 days — we recommend downloading immediately and keeping a personal backup. Images are delivered as high-resolution JPGs; RAW files are not included in any package.',
  },
  {
    q_ar: 'هل يمكنني طلب تعديلات على الصور؟',
    q_en: 'Can I request edits or revisions?',
    a_ar: 'نعم — تشمل كل باقة جولة تعديلات واحدة مجانية يجب تقديمها خلال أسبوعين من تاريخ استلام المعرض. يُرجى إرسال طلباتكِ جملةً واحدة لا تباعاً. التعديلات التي تتجاوز نطاق الباقة — كإعادة القص، وتغيير درجة الألوان، أو الرتوش المتقدم — تُسعَّر بشكل منفصل ويُتفق عليها مسبقاً.',
    a_en: 'Yes — one round of refinements is included free of charge and must be submitted within two weeks of gallery delivery. Please send all requests together, not one at a time. Changes beyond the package scope — re-cropping, colour-grade shifts, advanced retouching — are quoted separately and agreed before work begins.',
  },
  {
    q_ar: 'كيف تتم عملية الدفع؟',
    q_en: 'How does payment work?',
    a_ar: 'نوفر طريقتين: الدفع بالبطاقة الائتمانية (فيزا / ماستركارد / STC Pay) أو التحويل البنكي إلى حساب الراجحي مع إرسال إيصال التحويل عبر واتساب. عربون ٥٠٪ غير مسترد لتأكيد الحجز وإلزامه، والدفعة الثانية (٥٠٪) تُسدَّد قبل يوم واحد من تاريخ المناسبة. الأسعار شاملة ضريبة القيمة المضافة ١٥٪.',
    a_en: 'Two routes are offered: card payment (Visa / Mastercard / STC Pay) or bank transfer to our Al Rajhi account with a receipt sent via WhatsApp. A non-refundable 50% deposit confirms and locks the booking; the remaining 50% is due one day before the event. All prices include 15% VAT.',
  },
  {
    q_ar: 'هل يمكنني تأجيل الحجز؟',
    q_en: 'Can I reschedule my booking?',
    a_ar: 'يُسمح بتأجيل واحد فقط طوال مدة العقد، بشرط إشعارنا قبل ٧ أيام على الأقل، ويخضع التأجيل لتوفر الطرف الأول في التاريخ الجديد. لا تُستردّ أي مبالغ عند التأجيل ولا تُحتسب كمناسبة جديدة.',
    a_en: 'One reschedule is permitted per contract, provided we receive at least 7 days' notice and the new date is available. No refunds are issued for rescheduling, and it does not count as a new booking.',
  },
  {
    q_ar: 'ما هي سياسة الإلغاء؟',
    q_en: 'What is your cancellation policy?',
    a_ar: 'العربون ٥٠٪ غير مسترد في جميع الأحوال بمجرد تأكيد الحجز. إن أُلغي الحجز قبل ١٤ يوماً أو أكثر من المناسبة تُستردّ الدفعة الثانية إن كانت مسددة. الإلغاء خلال أقل من ١٤ يوماً من المناسبة لا يُستردّ معه أي مبلغ. التفاصيل الكاملة في العقد.',
    a_en: 'The 50% deposit is non-refundable in all cases once the booking is confirmed. If cancelled 14 days or more before the event, the second instalment is refunded if already paid. Cancellations within 14 days of the event date forfeit all amounts. Full terms are in the contract.',
  },
  {
    q_ar: 'هل المصوّرات إناث فقط؟',
    q_en: 'Is your team all-female?',
    a_ar: 'نعم — وهذا هو جوهر ATEMA. فريق التصوير والمونتاج والتنسيق نسائي بالكامل، ضمانًا للراحة والخصوصية والثقة في يومكِ الخاص. لن يُسمح لأي رجل بحضور جلسات التصوير الخاصة.',
    a_en: 'Yes — and that is the heart of ATEMA. Our photography, editing, and coordination team is exclusively female, ensuring comfort, privacy, and trust on your day. No male presence is permitted during private sessions.',
  },
  {
    q_ar: 'هل يمكنني طلب الخصوصية الكاملة ومنع نشر صوري؟',
    q_en: 'Can I keep my event fully private — off the portfolio?',
    a_ar: 'بالتأكيد. ATEMA تحترم خصوصيتكِ بشكل كامل. إذا كنتِ لا تودّين أن تُستخدم صورتكِ أو صور مناسبتكِ لأغراض تسويقية أو عرض في معرض الأعمال، يكفي إبلاغنا كتابةً عبر واتساب قبل المناسبة وسيُضاف ذلك إلى بنود العقد.',
    a_en: 'Absolutely. ATEMA respects your privacy completely. If you do not wish your images or event to be used for marketing or portfolio purposes, simply notify us in writing via WhatsApp before the shoot date and it will be added to your contract terms.',
  },
  {
    q_ar: 'ماذا يعني "صمّمي باقتك"؟',
    q_en: 'What does "Design Your Package" mean?',
    a_ar: 'هي طريقة مرنة لبناء تجربتكِ من الصفر. نبدأ من الأساس المرن (ساعة تصوير + ٢٠ صورة معدَّلة بـ ١٨٠٠ ر.س)، ثم تختارين الإضافات التي تناسب مناسبتكِ — ساعات تصوير، فيديو سينمائي، ألبوم فاخر، تغطية ليلة الحناء، أو جلسة تحضيرات العروس. تدفعين فقط لما تختارينه، والإجمالي يتحدث معكِ مباشرةً مع كل خيار.',
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
