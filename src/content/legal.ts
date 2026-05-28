// Single source of truth for the bilingual T&C and PDPL copy.
// Re-exported into BookingPage's inline popups AND the public /policy page,
// so a copy change updates both surfaces. Colours + fonts come from the
// shared stationery palette so the popups, /policy, contract, invoice, and
// confirmation email all match.

import { STATIONERY } from '../theme/stationery';

export const TC_CONTENT_AR = `
<h3 style="font-family:${STATIONERY.fontDisplayAr};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">شروط الدفع</h3>
<ul style="padding-right:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li>الدفعة الأولى (٥٠٪) واجبة الأداء لتأكيد الحجز وإلزامه — لا يُعدّ الحجز نافذاً قبل استلامها.</li>
  <li>الدفعة الثانية تُسدَّد قبل المناسبة بيوم واحد على الأقل.</li>
  <li>التحويل إلى: بنك الراجحي — فاطمة بوحسن — رقم الحساب: 329608010885626 أو عبر سداد.</li>
  <li>الأسعار شاملة ضريبة القيمة المضافة ١٥٪.</li>
</ul>
<h3 style="font-family:${STATIONERY.fontDisplayAr};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">الإلغاء والتأجيل</h3>
<div style="background:${STATIONERY.paperWarn};border-right:3px solid ${STATIONERY.warnAccent};padding:10px 14px;border-radius:0 6px 6px 0;font-size:0.82rem;color:${STATIONERY.warnInk};font-weight:600;margin:0 0 12px">
  الدفعة الأولى (٥٠٪) غير قابلة للاسترداد في جميع الأحوال دون استثناء.
</div>
<ul style="padding-right:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li>إلغاء قبل ١٤ يوماً أو أكثر: تُستردّ الدفعة الثانية إن كانت مسددة.</li>
  <li>إلغاء خلال أقل من ١٤ يوماً: لا يُستردّ أي مبلغ.</li>
  <li>الغياب دون إشعار يُعدّ إلغاءً ولا يُستردّ أي مبلغ.</li>
  <li>يُسمح بتأجيل مرة واحدة فقط خلال ٣٠ يوماً وبإشعار لا يقل عن ٧ أيام.</li>
</ul>
<h3 style="font-family:${STATIONERY.fontDisplayAr};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">مواعيد التسليم</h3>
<ul style="padding-right:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li>الصور المعدّلة: ١٢٠–١٨٠ يوماً من تاريخ المناسبة.</li>
  <li>الفيديو السينمائي: ١٢٠ يوماً من تاريخ المناسبة.</li>
  <li>الألبوم المطبوع: بعد اختيار الصور واعتمادها.</li>
</ul>
<h3 style="font-family:${STATIONERY.fontDisplayAr};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">الملكية الفكرية</h3>
<ul style="padding-right:18px;margin:0 0 8px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li>تحتفظ ATEMA Studio بكامل حقوق الملكية الفكرية لجميع الصور والفيديوهات.</li>
  <li>يُمنح الطرف الثاني ترخيص استخدام شخصي غير حصري للأغراض الشخصية فقط.</li>
  <li>لا يحق نشر الصور الخام (غير المعدّلة) أو تداولها.</li>
</ul>
`;

export const TC_CONTENT_EN = `
<h3 style="font-family:${STATIONERY.fontDisplayEn};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">Payment terms</h3>
<ul style="padding-left:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li>A 50% deposit is required to confirm and reserve the booking — the date is not held until the deposit is received.</li>
  <li>The remaining 50% is due at least one day before the event.</li>
  <li>Bank transfer to: Al Rajhi Bank — Fatima Bohassan — Account 329608010885626 — or via SADAD.</li>
  <li>Prices are inclusive of 15% VAT.</li>
</ul>
<h3 style="font-family:${STATIONERY.fontDisplayEn};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">Cancellation & rescheduling</h3>
<div style="background:${STATIONERY.paperWarn};border-left:3px solid ${STATIONERY.warnAccent};padding:10px 14px;border-radius:6px 0 0 6px;font-size:0.82rem;color:${STATIONERY.warnInk};font-weight:600;margin:0 0 12px">
  The 50% deposit is non-refundable under any circumstance.
</div>
<ul style="padding-left:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li>Cancellation 14 or more days in advance: the second payment, if already made, is refunded.</li>
  <li>Cancellation within 14 days of the event: no refund.</li>
  <li>No-show without notice is treated as cancellation; no refund.</li>
  <li>One reschedule is allowed within 30 days, with at least 7 days' notice.</li>
</ul>
<h3 style="font-family:${STATIONERY.fontDisplayEn};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">Delivery</h3>
<ul style="padding-left:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li>Edited photographs: 120–180 days from the event date.</li>
  <li>Cinematic film: 120 days from the event date.</li>
  <li>Printed album: after photo selection and approval.</li>
</ul>
<h3 style="font-family:${STATIONERY.fontDisplayEn};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">Intellectual property</h3>
<ul style="padding-left:18px;margin:0 0 8px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li>ATEMA Studio retains full intellectual property rights to all photographs and videos.</li>
  <li>The client is granted a non-exclusive personal-use license for personal purposes only.</li>
  <li>Raw (unedited) photographs may not be published or circulated.</li>
</ul>
`;

export const PDPL_CONTENT_AR = `
<h3 style="font-family:${STATIONERY.fontDisplayAr};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">سياسة حماية البيانات الشخصية (PDPL)</h3>
<p style="font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft};margin:0 0 14px">
  تلتزم ATEMA Studio بمعالجة بياناتك الشخصية وفق نظام حماية البيانات الشخصية السعودي (م/٢٠):
</p>
<ul style="padding-right:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li><strong>الغرض من الجمع:</strong> تُستخدم بياناتك حصراً لتنفيذ عقد الخدمة والتواصل المتعلق بحجزك.</li>
  <li><strong>المشاركة:</strong> لا تُشارَك بياناتك مع أطراف ثالثة إلا بما يقتضيه النظام.</li>
  <li><strong>مدة الاحتفاظ:</strong> تُحتفظ بالبيانات ٣ سنوات من تاريخ المناسبة ثم تُحذف آمنياً.</li>
  <li><strong>حقوقك:</strong> لكِ في أي وقت حق الاطلاع على بياناتك، وطلب تصحيحها أو حذفها عبر التواصل على: 0548323496.</li>
  <li><strong>الصور:</strong> تحتفظ ATEMA Studio بحق عرض الصور لأغراض تسويقية ما لم تُبدي العميلة رغبتها في الخصوصية الكاملة كتابةً قبل المناسبة.</li>
  <li><strong>الأمان:</strong> تُطبَّق إجراءات تقنية وتنظيمية لحماية بياناتك من الوصول غير المصرح به.</li>
</ul>
<p style="font-size:0.78rem;color:${STATIONERY.goldDeep};border-top:1px solid ${STATIONERY.borderHair};padding-top:12px;margin:0">
  للاستفسار عن بياناتك: atema.studio · 0548323496 · جبيل، المملكة العربية السعودية
</p>
`;

export const PDPL_CONTENT_EN = `
<h3 style="font-family:${STATIONERY.fontDisplayEn};font-size:1.05rem;color:${STATIONERY.goldDeep};margin:0 0 14px">Personal Data Protection Policy (PDPL)</h3>
<p style="font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft};margin:0 0 14px">
  ATEMA Studio processes your personal data in accordance with the Saudi Personal Data Protection Law (Royal Decree M/20):
</p>
<ul style="padding-left:18px;margin:0 0 16px;font-size:0.82rem;line-height:1.9;color:${STATIONERY.inkSoft}">
  <li><strong>Purpose:</strong> Your data is used solely to execute the service contract and communicate about your booking.</li>
  <li><strong>Sharing:</strong> Your data is not shared with third parties except as required by law.</li>
  <li><strong>Retention:</strong> Data is retained for 3 years from the event date, then securely deleted.</li>
  <li><strong>Your rights:</strong> You may at any time request access, correction, or deletion of your data via 0548323496.</li>
  <li><strong>Photographs:</strong> ATEMA Studio reserves the right to use photographs for marketing unless the client requests full privacy in writing before the event.</li>
  <li><strong>Security:</strong> Technical and organisational measures are in place to protect your data from unauthorised access.</li>
</ul>
<p style="font-size:0.78rem;color:${STATIONERY.goldDeep};border-top:1px solid ${STATIONERY.borderHair};padding-top:12px;margin:0">
  Data enquiries: atema.studio · 0548323496 · Jubail, Saudi Arabia
</p>
`;
