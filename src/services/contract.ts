import { supabase } from './supabase';
import { STATIONERY, STATIONERY_FONTS_IMPORT } from '../theme/stationery';

export interface ContractData {
  customerName: string;
  customerPhone: string;
  bookingRef: string;
  bookingId: string;
  contractDate: string;        // formatted Arabic date e.g. "١٢ محرم ١٤٤٧"
  eventDate: string;           // YYYY-MM-DD
  eventTime: string;
  packageNameAr: string;
  packageNameEn: string;
  location: string;
  durationHours: number;
  subtotal: number;
  vat: number;
  total: number;
  deposit: number;
  remaining: number;
  addons: string[];            // Arabic names of selected addons
  /** Count of photos covered by basic edit (lighting + JPG conversion). */
  editedPhotos?: number;
  /** Count of photos covered by editorial retouch (advanced retouching +
   *  cinematic grade). 0 means no editorial retouch is included; this is
   *  the default for all but Royal/Signature/Couture. */
  editorialPhotos?: number;
  /** Discount applied to this booking — when null, no discount line is rendered. */
  discount?: {
    code: string;
    amount: number;
    kind: 'percent' | 'flat';
    value: number;             // 25 for "25%", 500 for "500 SAR"
  } | null;
  /** Gross (pre-discount) subtotal. Only shown when a discount is applied. */
  grossSubtotal?: number;
}

function formatDateAr(dateStr: string): string {
  if (!dateStr) return '_______________';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory' });
}

function fmt(n: number): string {
  return n.toLocaleString('ar-SA');
}

// Escape user-controlled strings before interpolating them into the HTML
// template (Patch C-1). The contract is rendered via window.document.write
// in a freshly opened tab, so any unescaped < or " in customer-supplied
// values would execute as markup / break the document structure.
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

export function generateContractHTML(d: ContractData): string {
  const eventDateFmt  = formatDateAr(d.eventDate);
  const contractDateFmt = d.contractDate || formatDateAr(new Date().toISOString().split('T')[0]);
  const addonsStr = d.addons.length > 0
    ? `<tr><td style="padding:6px 12px;border:1px solid ${STATIONERY.borderDash};font-size:13px">الإضافات</td><td style="padding:6px 12px;border:1px solid ${STATIONERY.borderDash};font-size:13px">${d.addons.map(esc).join(' · ')}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>عقد خدمات التصوير — ${esc(d.bookingRef)}</title>
<style>
  ${STATIONERY_FONTS_IMPORT}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${STATIONERY.fontBody};background:${STATIONERY.paper};color:${STATIONERY.ink};padding:32px 20px;direction:rtl}
  .page{max-width:760px;margin:0 auto;background:${STATIONERY.card};border-radius:12px;box-shadow:${STATIONERY.shadow};overflow:hidden}
  .header{background:${STATIONERY.noirGrad};padding:32px 40px;text-align:center;color:white}
  .header h1{font-family:${STATIONERY.fontWordmark};font-size:26px;letter-spacing:0.15em;margin-bottom:4px}
  .header p{font-size:12px;letter-spacing:0.2em;opacity:0.7;font-weight:300}
  .header .subtitle{font-size:13px;color:${STATIONERY.goldHi};margin-top:8px;opacity:0.9}
  .stamp{display:inline-block;border:2px solid ${STATIONERY.goldChampagne};border-radius:8px;padding:6px 16px;font-size:11px;letter-spacing:0.12em;color:${STATIONERY.goldChampagne};margin-top:12px}
  .body{padding:36px 40px}
  h2{font-family:${STATIONERY.fontDisplayAr};font-size:16px;color:${STATIONERY.goldDeep};border-bottom:1px solid ${STATIONERY.borderHair};padding-bottom:8px;margin:28px 0 16px}
  h2:first-child{margin-top:0}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:4px}
  .party-box{background:${STATIONERY.paper};border-radius:8px;padding:16px 18px;border:1px solid ${STATIONERY.borderHair}}
  .party-box .role{font-size:10px;letter-spacing:0.14em;color:${STATIONERY.inkFaint};text-transform:uppercase;margin-bottom:6px}
  .party-box .name{font-family:${STATIONERY.fontDisplayAr};font-size:15px;color:${STATIONERY.ink};font-weight:700}
  .party-box .detail{font-size:12px;color:${STATIONERY.goldDeep};margin-top:3px}
  table.data-table{width:100%;border-collapse:collapse;margin-bottom:4px}
  table.data-table td{padding:8px 12px;border:1px solid ${STATIONERY.borderHair};font-size:13px;line-height:1.5}
  table.data-table td:first-child{background:${STATIONERY.paper};font-weight:600;color:${STATIONERY.inkSoft};width:42%}
  .financial{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:4px}
  .fin-box{text-align:center;padding:14px;background:${STATIONERY.paper};border-radius:8px;border:1px solid ${STATIONERY.borderHair}}
  .fin-box .fin-label{font-size:10px;color:${STATIONERY.inkFaint};letter-spacing:0.1em;margin-bottom:4px}
  .fin-box .fin-val{font-family:${STATIONERY.fontDisplayAr};font-size:20px;color:${STATIONERY.goldDeep};font-weight:700}
  .fin-box .fin-cur{font-size:11px;color:${STATIONERY.inkFaint}}
  .fin-box.highlight{background:linear-gradient(135deg,${STATIONERY.noir},${STATIONERY.noirMid});border-color:${STATIONERY.noirMid}}
  .fin-box.highlight .fin-label{color:${STATIONERY.goldChampagne}}
  .fin-box.highlight .fin-val{color:${STATIONERY.goldHi}}
  .fin-box.highlight .fin-cur{color:${STATIONERY.goldChampagne}}
  .article{margin-bottom:18px}
  .article h3{font-size:13px;font-weight:700;color:${STATIONERY.inkSoft};margin-bottom:8px}
  .article p,.article li{font-size:12.5px;line-height:1.9;color:${STATIONERY.inkSoft}}
  .article ul{padding-right:18px}
  .article ul li{margin-bottom:4px}
  .article table{width:100%;border-collapse:collapse;margin-top:8px}
  .article table td{padding:6px 10px;border:1px solid ${STATIONERY.borderHair};font-size:12px}
  .article table td:first-child{background:${STATIONERY.paper};font-weight:600;width:50%}
  .important{background:${STATIONERY.paperWarn};border-right:3px solid ${STATIONERY.warnAccent};padding:10px 14px;border-radius:0 6px 6px 0;font-size:12.5px;color:${STATIONERY.warnInk};font-weight:600;margin:10px 0}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:32px;padding-top:24px;border-top:1px solid ${STATIONERY.borderHair}}
  .sig-box .role{font-size:10px;letter-spacing:0.14em;color:${STATIONERY.inkFaint};text-transform:uppercase;margin-bottom:14px}
  .sig-box .sig-line{border-bottom:1px dashed ${STATIONERY.goldChampagne};height:40px;margin-bottom:8px}
  .sig-box .sig-label{font-size:11px;color:${STATIONERY.inkFaint}}
  .footer-bar{background:${STATIONERY.paperAlt};padding:16px 40px;text-align:center;border-top:1px solid ${STATIONERY.borderHair}}
  .footer-bar p{font-size:11px;color:${STATIONERY.inkFaint};letter-spacing:0.08em}
  .ref-badge{display:inline-block;background:${STATIONERY.noir};color:${STATIONERY.goldHi};border-radius:6px;padding:4px 12px;font-size:11px;letter-spacing:0.1em;font-weight:600;margin-top:6px}
  /* FAB couture monogram — reserved for printable contract / T&C only (per brand-usage rule) */
  .page{position:relative}
  .fab-monogram{position:absolute;top:18px;right:18px;width:42px;height:42px;border:1px solid rgba(201,179,147,0.45);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:${STATIONERY.fontWordmark};font-size:13px;letter-spacing:0.04em;color:${STATIONERY.goldChampagne};background:rgba(255,255,255,0.04);box-shadow:inset 0 0 0 3px rgba(255,255,255,0.04)}
  .fab-monogram span{display:inline-block;transform:translateY(-1px)}
</style>
</head>
<body>
<div class="page">

  <!-- FAB couture monogram (reserved for printable docs only) -->
  <div class="fab-monogram" aria-hidden="true"><span>FAB</span></div>

  <!-- Header -->
  <div class="header">
    <h1>A T E M A</h1>
    <p>S T U D I O</p>
    <div class="subtitle">استوديو تصوير نسائي حصري — جبيل، المملكة العربية السعودية</div>
    <div class="stamp">عقد تقديم خدمات التصوير الفوتوغرافي</div>
  </div>

  <div class="body">

    <!-- Parties -->
    <h2>أطراف العقد</h2>
    <div class="parties">
      <div class="party-box">
        <div class="role">الطرف الأول — مقدّمة الخدمة</div>
        <div class="name">ATEMA Studio</div>
        <div class="detail">فاطمة بوحسن · جبيل، المملكة العربية السعودية</div>
        <div class="detail">atema.studio · 0548323496</div>
      </div>
      <div class="party-box">
        <div class="role">الطرف الثاني — العميلة</div>
        <div class="name">${esc(d.customerName)}</div>
        <div class="detail">${esc(d.customerPhone)}</div>
      </div>
    </div>

    <!-- Contract Data -->
    <h2>بيانات العقد</h2>
    <table class="data-table">
      <tr><td>رقم الحجز</td><td><strong>${esc(d.bookingRef)}</strong></td></tr>
      <tr><td>تاريخ إبرام العقد</td><td>${esc(contractDateFmt)}</td></tr>
      <tr><td>تاريخ المناسبة</td><td>${esc(eventDateFmt)}</td></tr>
      <tr><td>وقت البدء</td><td>${esc(d.eventTime) || '—'}</td></tr>
      <tr><td>مدة التصوير</td><td>${d.durationHours} ساعات</td></tr>
      <tr><td>الباقة المختارة</td><td>${esc(d.packageNameAr)} (${esc(d.packageNameEn)})</td></tr>
      <tr><td>موقع المناسبة</td><td>${esc(d.location) || '—'}</td></tr>
      ${addonsStr}
      <tr><td>موعد استحقاق الدفعة الثانية</td><td>قبل يوم من تاريخ المناسبة</td></tr>
    </table>

    <!-- Financials -->
    <h2>الملخص المالي</h2>
    ${d.discount ? `
    <div style="background:${STATIONERY.paperWarn};border:1px solid ${STATIONERY.borderDash};border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px;color:${STATIONERY.warnInk};line-height:1.7">
      <div style="font-weight:700;color:${STATIONERY.goldDeep};margin-bottom:4px">خصم مطبّق</div>
      <div>
        كود: <span style="font-family:monospace;font-weight:700;letter-spacing:1px">${esc(d.discount.code)}</span>
        &nbsp;·&nbsp;
        ${d.discount.kind === 'percent' ? `${d.discount.value}٪` : `${fmt(d.discount.value)} ر.س`}
        &nbsp;·&nbsp;
        قيمة الخصم: <strong>${fmt(d.discount.amount)} ر.س</strong>
      </div>
    </div>` : ''}
    <div class="financial">
      <div class="fin-box">
        <div class="fin-label">المبلغ الإجمالي (شامل VAT)</div>
        <div class="fin-val">${fmt(d.total)}</div>
        <div class="fin-cur">ر.س</div>
      </div>
      <div class="fin-box highlight">
        <div class="fin-label">الدفعة الأولى المسددة (٥٠٪)</div>
        <div class="fin-val">${fmt(d.deposit)}</div>
        <div class="fin-cur">ر.س — مسددة ✓</div>
      </div>
      <div class="fin-box">
        <div class="fin-label">الدفعة الثانية المستحقة (٥٠٪)</div>
        <div class="fin-val">${fmt(d.remaining)}</div>
        <div class="fin-cur">ر.س — قبل المناسبة بيوم</div>
      </div>
    </div>

    <!-- Articles -->
    <h2>بنود العقد</h2>

    <div class="article">
      <h3>المادة الأولى — محل العقد</h3>
      <p>تتعهد الطرف الأول بتقديم خدمات التصوير الفوتوغرافي المدرجة في الباقة المختارة أعلاه وفق مواصفاتها المعتمدة، ولا يُلزَم الطرف الأول بأي خدمات إضافية تتجاوز نطاق الباقة إلا بموافقة خطية مسبقة ورسوم إضافية مقابلها.</p>
    </div>

    <div class="article">
      <h3>المادة الثانية — شروط الدفع</h3>
      <ul>
        <li>الدفعة الأولى (٥٠٪) واجبة الأداء لتأكيد الحجز وإلزامه؛ لا يُعدّ الحجز نافذاً قبل استلامها.</li>
        <li>الدفعة الثانية تُسدَّد قبل المناسبة بيوم واحد على الأقل، وللطرف الأول رفض تنفيذ الخدمة في حالة عدم السداد.</li>
        <li>التحويل إلى: بنك الراجحي — فاطمة بوحسن — رقم الحساب: 329608010885626 أو عبر سداد.</li>
        <li>تُرسَل صورة الحوالة فور التحويل عبر واتساب على: 0548323496.</li>
        <li>الأسعار شاملة ضريبة القيمة المضافة ١٥٪ وفق متطلبات هيئة الزكاة والضريبة والجمارك.</li>
      </ul>
    </div>

    <div class="article">
      <h3>المادة الثالثة — الإلغاء والتأجيل</h3>
      <div class="important">الدفعة الأولى (٥٠٪) غير قابلة للاسترداد في جميع الأحوال دون استثناء.</div>
      <ul>
        <li>إلغاء قبل ١٤ يوماً أو أكثر: تُستردّ الدفعة الثانية إن كانت مسددة.</li>
        <li>إلغاء خلال أقل من ١٤ يوماً من المناسبة: لا يُستردّ أي مبلغ.</li>
        <li>الغياب دون إشعار يُعدّ إلغاءً ولا يُستردّ أي مبلغ.</li>
        <li>يُسمح بتأجيل مرة واحدة فقط خلال ٣٠ يوماً وبإشعار لا يقل عن ٧ أيام، ويخضع لتوفر الطرف الأول.</li>
        <li>في حال الإلغاء من قِبَل الطرف الأول لظروف قاهرة، تُستردّ جميع المبالغ خلال ٧ أيام عمل.</li>
      </ul>
    </div>

    <div class="article">
      <h3>المادة الرابعة — مواعيد التسليم</h3>
      <table>
        <tr><td>الصور بالتعديل الأساسي</td><td>١٢٠–١٨٠ يوماً من تاريخ المناسبة</td></tr>
        ${(d.editorialPhotos ?? 0) > 0
          ? `<tr><td>الصور بالتعديل التحريري</td><td>١٢٠–١٨٠ يوماً من تاريخ المناسبة</td></tr>` : ''}
        <tr><td>الفيديو السينمائي</td><td>١٢٠ يوماً من تاريخ المناسبة</td></tr>
        <tr><td>الألبوم المطبوع</td><td>بعد اختيار الصور واعتمادها</td></tr>
        <tr><td>المعاينة نفس اليوم (إن وُجدت)</td><td>خلال نفس يوم المناسبة</td></tr>
      </table>
      <p style="margin-top:8px;font-size:12px;color:${STATIONERY.inkFaint}">تبدأ مدة التسليم من يوم انتهاء المناسبة، ولا يُعدّ التأخر ضمنها إخلالاً بالعقد.</p>
    </div>

    <div class="article">
      <h3>المادة الرابعة (مكرّر) — مستويات تعديل الصور</h3>
      <p>تُسلَّم الصور وفق مستويين متمايزين من التعديل، يلتزم بهما الطرف الأول صراحةً:</p>
      <ul>
        <li><strong>التعديل الأساسي (Basic Edit):</strong> يشمل تصحيح الإضاءة، موازنة الألوان، وتحويل الملفات من صيغة RAW إلى JPG عالية الجودة. يُطبَّق على <strong>جميع</strong> الصور المُسلَّمة في الباقة (${d.editedPhotos ? esc(String(d.editedPhotos)) : '—'} صورة).</li>
        ${(d.editorialPhotos ?? 0) > 0
          ? `<li><strong>التعديل التحريري (Editorial Retouch):</strong> رتوش متقدم يشمل تنعيم البشرة، وإزالة الشوائب، وتقنية Dodge &amp; Burn، والتدرّج اللوني السينمائي. هذا المستوى محدود في باقتك بـ <strong>${esc(String(d.editorialPhotos))} صورة</strong> فقط من إجمالي الصور المُسلَّمة، وتُختار بالتنسيق مع العميلة من بين الصور الأكثر تميّزاً في المناسبة.</li>`
          : `<li><strong>التعديل التحريري (Editorial Retouch):</strong> غير مشمول في هذه الباقة. متوفّر كخدمة إضافية في الباقات العليا (الملكية، التوقيع، الكوتور) بأعداد ٤ / ٨ / ١٢ صورة على التوالي.</li>`}
      </ul>
      <div class="important">يُقرّ الطرف الثاني بأنه قد اطّلع على الفرق بين مستويَي التعديل ووافق على الحدود المحدَّدة لكلّ مستوى في الباقة المختارة، وأن أي طلب يتجاوز ذلك يُعدّ خدمةً إضافيةً تُسعَّر بشكلٍ منفصل.</div>
    </div>

    <div class="article">
      <h3>المادة الخامسة — اختيار الصور</h3>
      <ul>
        <li>يُرسَل رابط معرض الصور فور الانتهاء من التعديل.</li>
        <li>تُمنح العميلة مهلة ١٤ يوماً للاختيار.</li>
        <li>انقضاء المهلة دون اختيار يُفوِّض الطرف الأول الاختيار نيابةً، ولا يحق الاعتراض لاحقاً.</li>
        <li>لا يُسلَّم الألبوم المطبوع قبل إتمام الاختيار.</li>
      </ul>
    </div>

    <div class="article">
      <h3>المادة السادسة — الملكية الفكرية</h3>
      <ul>
        <li>تحتفظ ATEMA Studio بكامل حقوق الملكية الفكرية لجميع الصور والفيديوهات المُنتجة.</li>
        <li>يُمنح الطرف الثاني ترخيص استخدام شخصي غير حصري للأغراض الشخصية والتواصل الاجتماعي فقط، دون حق إعادة البيع أو التوزيع التجاري.</li>
        <li>تحتفظ الطرف الأول بحق عرض الصور لأغراض تسويقية ما لم تُبدِ العميلة رغبتها في الخصوصية الكاملة كتابةً قبل المناسبة.</li>
        <li>لا يحق نشر الصور الخام (غير المعدَّلة) أو تداولها.</li>
      </ul>
    </div>

    <div class="article">
      <h3>المادة السابعة — التزامات الطرفين يوم المناسبة</h3>
      <p><strong>على الطرف الثاني:</strong></p>
      <ul>
        <li>الحضور في الموعد مع هامش لا يتجاوز ١٥ دقيقة.</li>
        <li>التنسيق المسبق لتمكين الطرف الأول من الوصول إلى موقع المناسبة.</li>
        <li>الإبلاغ المسبق عن أي متطلبات أو قيود خاصة.</li>
      </ul>
      <p style="margin-top:10px"><strong>على الطرف الأول:</strong></p>
      <ul>
        <li>الالتزام بالخصوصية التامة للمناسبة النسائية.</li>
        <li>العمل باحترافية وتقديم ما اتُّفق عليه ضمن الإمكانيات المتاحة.</li>
        <li>إحضار المعدات اللازمة وبديلها الاحتياطي.</li>
      </ul>
    </div>

    <div class="article">
      <h3>المادة الثامنة — حماية البيانات الشخصية (PDPL)</h3>
      <p>تلتزم الطرف الأول بمعالجة بيانات الطرف الثاني وفق نظام حماية البيانات الشخصية السعودي (م/٢٠):</p>
      <ul>
        <li>تُستخدم البيانات حصراً لأغراض تنفيذ هذا العقد والتواصل المتعلق به.</li>
        <li>لا تُشارَك مع أطراف ثالثة إلا بما يقتضيه القانون.</li>
        <li>تُحتفظ بها ٣ سنوات ثم تُحذف آمنياً.</li>
        <li>للعميلة حق الاطلاع والتصحيح والحذف في أي وقت.</li>
      </ul>
    </div>

    <div class="article">
      <h3>المادة التاسعة — القوة القاهرة</h3>
      <p>لا يُعدّ أيٌّ من الطرفين مخلّاً بالعقد جراء ظروف خارجة عن إرادته كالكوارث الطبيعية أو القرارات الحكومية؛ وفي هذه الحالة يُؤجَّل التنفيذ أو يُفسخ العقد باتفاق الطرفين وتُردّ المبالغ خلال ٧ أيام عمل.</p>
    </div>

    <div class="article">
      <h3>المادة العاشرة — تسوية النزاعات</h3>
      <p>يسعى الطرفان أولاً إلى التسوية الودية خلال ١٥ يوماً من تاريخ المطالبة الخطية. عند تعذّرها ينعقد الاختصاص للمحاكم المختصة في جبيل وفق أنظمة المملكة العربية السعودية.</p>
    </div>

    <div class="article">
      <h3>المادة الحادية عشرة — نفاذ العقد</h3>
      <p>يُعدّ هذا العقد نافذاً ومُلزِماً من تاريخ سداد الدفعة الأولى. حُرِّر بالعربية ويُعدّ موافقة العميلة الإلكترونية على الشروط أثناء الحجز الرقمي توقيعاً نافذاً قانونياً وفق نظام التعاملات الإلكترونية السعودي.</p>
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="role">الطرف الأول — ATEMA Studio</div>
        <div class="sig-line"></div>
        <div class="sig-label">فاطمة بوحسن · التاريخ: ${esc(contractDateFmt)}</div>
      </div>
      <div class="sig-box">
        <div class="role">الطرف الثاني — العميلة</div>
        <div class="sig-line"></div>
        <div class="sig-label">${esc(d.customerName)} · وافقت إلكترونياً عند الحجز</div>
      </div>
    </div>

  </div><!-- /body -->

  <div class="footer-bar">
    <p>ATEMA STUDIO · atema.studio · 0548323496 · @atema.studio · جبيل، المملكة العربية السعودية</p>
    <div class="ref-badge">${esc(d.bookingRef)}</div>
  </div>
</div>
</body>
</html>`;
}

export async function saveContract(
  bookingId: string,
  bookingRef: string,
  html: string
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('contracts')
    .insert({ booking_id: bookingId, booking_ref: bookingRef, content_html: html, status: 'draft' })
    .select('id')
    .single();
  if (error) { console.error('Contract save error:', error.message); return null; }
  return (data as { id: string }).id;
}
