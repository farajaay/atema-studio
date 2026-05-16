import { supabase } from './supabase';

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
}

function formatDateAr(dateStr: string): string {
  if (!dateStr) return '_______________';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory' });
}

function fmt(n: number): string {
  return n.toLocaleString('ar-SA');
}

export function generateContractHTML(d: ContractData): string {
  const eventDateFmt  = formatDateAr(d.eventDate);
  const contractDateFmt = d.contractDate || formatDateAr(new Date().toISOString().split('T')[0]);
  const addonsStr = d.addons.length > 0
    ? `<tr><td style="padding:6px 12px;border:1px solid #d6bfa3;font-size:13px">الإضافات</td><td style="padding:6px 12px;border:1px solid #d6bfa3;font-size:13px">${d.addons.join(' · ')}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>عقد خدمات التصوير — ${d.bookingRef}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@300;400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Tajawal',sans-serif;background:#f9f5f0;color:#2c2218;padding:32px 20px;direction:rtl}
  .page{max-width:760px;margin:0 auto;background:white;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden}
  .header{background:linear-gradient(135deg,#1a1a1a,#2c2c2c,#4a3728);padding:32px 40px;text-align:center;color:white}
  .header h1{font-family:'Amiri',serif;font-size:26px;letter-spacing:0.15em;margin-bottom:4px}
  .header p{font-size:12px;letter-spacing:0.2em;opacity:0.7;font-weight:300}
  .header .subtitle{font-size:13px;color:#e8d9c5;margin-top:8px;opacity:0.9}
  .stamp{display:inline-block;border:2px solid #c9b393;border-radius:8px;padding:6px 16px;font-size:11px;letter-spacing:0.12em;color:#c9b393;margin-top:12px}
  .body{padding:36px 40px}
  h2{font-family:'Amiri',serif;font-size:16px;color:#8c6b4f;border-bottom:1px solid #e8d9c5;padding-bottom:8px;margin:28px 0 16px}
  h2:first-child{margin-top:0}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:4px}
  .party-box{background:#f9f5f0;border-radius:8px;padding:16px 18px;border:1px solid #e8d9c5}
  .party-box .role{font-size:10px;letter-spacing:0.14em;color:#b09880;text-transform:uppercase;margin-bottom:6px}
  .party-box .name{font-family:'Amiri',serif;font-size:15px;color:#2c2218;font-weight:700}
  .party-box .detail{font-size:12px;color:#8c6b4f;margin-top:3px}
  table.data-table{width:100%;border-collapse:collapse;margin-bottom:4px}
  table.data-table td{padding:8px 12px;border:1px solid #e8d9c5;font-size:13px;line-height:1.5}
  table.data-table td:first-child{background:#f9f5f0;font-weight:600;color:#555;width:42%}
  .financial{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:4px}
  .fin-box{text-align:center;padding:14px;background:#f9f5f0;border-radius:8px;border:1px solid #e8d9c5}
  .fin-box .fin-label{font-size:10px;color:#b09880;letter-spacing:0.1em;margin-bottom:4px}
  .fin-box .fin-val{font-family:'Amiri',serif;font-size:20px;color:#8c6b4f;font-weight:700}
  .fin-box .fin-cur{font-size:11px;color:#b09880}
  .fin-box.highlight{background:linear-gradient(135deg,#1a1a1a,#2c2c2c);border-color:#2c2c2c}
  .fin-box.highlight .fin-label{color:#c9b393}
  .fin-box.highlight .fin-val{color:#e8d9c5}
  .fin-box.highlight .fin-cur{color:#c9b393}
  .article{margin-bottom:18px}
  .article h3{font-size:13px;font-weight:700;color:#4a3728;margin-bottom:8px}
  .article p,.article li{font-size:12.5px;line-height:1.9;color:#444}
  .article ul{padding-right:18px}
  .article ul li{margin-bottom:4px}
  .article table{width:100%;border-collapse:collapse;margin-top:8px}
  .article table td{padding:6px 10px;border:1px solid #e8d9c5;font-size:12px}
  .article table td:first-child{background:#f9f5f0;font-weight:600;width:50%}
  .important{background:#fff8f0;border-right:3px solid #8c6b4f;padding:10px 14px;border-radius:0 6px 6px 0;font-size:12.5px;color:#5c3d1e;font-weight:600;margin:10px 0}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:32px;padding-top:24px;border-top:1px solid #e8d9c5}
  .sig-box .role{font-size:10px;letter-spacing:0.14em;color:#b09880;text-transform:uppercase;margin-bottom:14px}
  .sig-box .sig-line{border-bottom:1px dashed #c9b393;height:40px;margin-bottom:8px}
  .sig-box .sig-label{font-size:11px;color:#b09880}
  .footer-bar{background:#f4ede4;padding:16px 40px;text-align:center;border-top:1px solid #e8d9c5}
  .footer-bar p{font-size:11px;color:#b09880;letter-spacing:0.08em}
  .ref-badge{display:inline-block;background:#1a1a1a;color:#e8d9c5;border-radius:6px;padding:4px 12px;font-size:11px;letter-spacing:0.1em;font-weight:600;margin-top:6px}
</style>
</head>
<body>
<div class="page">

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
        <div class="name">${d.customerName}</div>
        <div class="detail">${d.customerPhone}</div>
      </div>
    </div>

    <!-- Contract Data -->
    <h2>بيانات العقد</h2>
    <table class="data-table">
      <tr><td>رقم الحجز</td><td><strong>${d.bookingRef}</strong></td></tr>
      <tr><td>تاريخ إبرام العقد</td><td>${contractDateFmt}</td></tr>
      <tr><td>تاريخ المناسبة</td><td>${eventDateFmt}</td></tr>
      <tr><td>وقت البدء</td><td>${d.eventTime || '—'}</td></tr>
      <tr><td>مدة التصوير</td><td>${d.durationHours} ساعات</td></tr>
      <tr><td>الباقة المختارة</td><td>${d.packageNameAr} (${d.packageNameEn})</td></tr>
      <tr><td>موقع المناسبة</td><td>${d.location || '—'}</td></tr>
      ${addonsStr}
      <tr><td>موعد استحقاق الدفعة الثانية</td><td>قبل يوم من تاريخ المناسبة</td></tr>
    </table>

    <!-- Financials -->
    <h2>الملخص المالي</h2>
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
        <tr><td>الصور المعدَّلة</td><td>١٢٠–١٨٠ يوماً من تاريخ المناسبة</td></tr>
        <tr><td>الفيديو السينمائي</td><td>١٢٠ يوماً من تاريخ المناسبة</td></tr>
        <tr><td>الألبوم المطبوع</td><td>بعد اختيار الصور واعتمادها</td></tr>
        <tr><td>المعاينة نفس اليوم (إن وُجدت)</td><td>خلال نفس يوم المناسبة</td></tr>
      </table>
      <p style="margin-top:8px;font-size:12px;color:#888">تبدأ مدة التسليم من يوم انتهاء المناسبة، ولا يُعدّ التأخر ضمنها إخلالاً بالعقد.</p>
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
        <div class="sig-label">فاطمة بوحسن · التاريخ: ${contractDateFmt}</div>
      </div>
      <div class="sig-box">
        <div class="role">الطرف الثاني — العميلة</div>
        <div class="sig-line"></div>
        <div class="sig-label">${d.customerName} · وافقت إلكترونياً عند الحجز</div>
      </div>
    </div>

  </div><!-- /body -->

  <div class="footer-bar">
    <p>ATEMA STUDIO · atema.studio · 0548323496 · @atema.studio · جبيل، المملكة العربية السعودية</p>
    <div class="ref-badge">${d.bookingRef}</div>
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
