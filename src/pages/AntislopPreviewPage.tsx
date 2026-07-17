// ATEMA STUDIO — Anti-slop home-page redesign preview.
//
// Hidden route: not linked from any nav, not in public/sitemap.xml, and
// disallowed in public/robots.txt. Reachable only if you have the URL.
// Ships as a real route (not an external mockup) so the owner can review
// it on-device, on the actual domain, with the actual brand fonts.
//
// Uses the site's already-loaded fonts (Amiri, Tajawal — see index.html's
// Google Fonts link) and the exact Couture Noir hex values from
// src/theme/themes.ts. No new color or font was introduced.
//
// Audit + rationale: docs/reviews/2026-07-17-antislop-audit.md

import { useEffect, useRef } from 'react';

const CSS = `
.aslp{ --a-bg:#0B0B0B; --a-surface:#141414; --a-surface-alt:#1C1C1C;
  --a-ivory:#EFE3D1; --a-text:#D8CDB9; --a-text-soft:#9C8E76; --a-text-muted:#6B5F4E;
  --a-gold:#D4AF7A; --a-gold-deep:#BB864B;
  --a-border:rgba(212,175,122,0.14); --a-border-strong:rgba(212,175,122,0.35);
  --ease:cubic-bezier(0.22,0.61,0.36,1);
  background:var(--a-bg); color:var(--a-text); font-family:'Tajawal',sans-serif;
  font-weight:300; min-height:100vh; direction:rtl; -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
.aslp *{box-sizing:border-box;}
.aslp svg,.aslp img{display:block; max-width:100%;}
.aslp a{color:inherit;}
.aslp .wrap{max-width:1180px; margin:0 auto; padding-inline:60px;}
@media (max-width:860px){ .aslp .wrap{padding-inline:22px;} }
.aslp h1,.aslp h2,.aslp h3{font-family:'Tajawal',sans-serif; font-weight:700; color:var(--a-ivory); margin:0; text-wrap:balance;}
.aslp p{line-height:1.9; margin:0;}
.aslp :focus-visible{ outline:2px solid var(--a-gold); outline-offset:3px; }

.aslp .wordmark{ font-family:'Amiri',serif; font-weight:700; letter-spacing:0.3em; color:var(--a-ivory); direction:ltr; unicode-bidi:isolate; white-space:nowrap; }
.aslp .wordmark small{ display:block; font-size:0.34em; letter-spacing:0.48em; color:var(--a-gold); margin-top:4px; font-weight:400; }

.aslp .reveal{opacity:0; transform:translateY(20px); transition:opacity .7s var(--ease), transform .7s var(--ease);}
.aslp .reveal.in{opacity:1; transform:translateY(0);}
@media (prefers-reduced-motion:reduce){ .aslp .reveal{opacity:1; transform:none; transition:none;} }

.aslp .thread-defs{ position:absolute; width:0; height:0; overflow:hidden; }
.aslp .thread{ color:var(--a-gold); filter:drop-shadow(0 0 10px rgba(212,175,122,.32)); pointer-events:none; }

.aslp .btn{
  display:inline-flex; align-items:center; gap:10px;
  font-family:'Tajawal',sans-serif; font-weight:600; font-size:0.82rem;
  letter-spacing:0.16em; padding:15px 30px; border-radius:2px; cursor:pointer;
  text-decoration:none; border:1px solid var(--a-gold);
  background:var(--a-gold); color:#0B0B0B; transition:background-color .3s var(--ease), border-color .3s var(--ease);
}
.aslp .btn:hover{ background:var(--a-gold-deep); border-color:var(--a-gold-deep); }
.aslp .bare{
  display:inline-flex; align-items:center; gap:8px; text-decoration:none;
  color:var(--a-text-soft); font-size:0.88rem; font-weight:500;
  transition:color .25s var(--ease);
}
.aslp .bare:hover{ color:var(--a-gold); }
.aslp .bare .arw{ transition:transform .25s var(--ease); }
.aslp .bare:hover .arw{ transform:translateX(4px); }

.aslp .plate{ position:relative; overflow:hidden; background:var(--a-surface-alt); }
.aslp .plate::before{ content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(212,175,122,0.12), transparent 60%); }

.aslp header{ position:sticky; top:0; z-index:40; backdrop-filter:blur(10px); background:rgba(11,11,11,0.7); border-bottom:1px solid var(--a-border); }
.aslp .nav-row{ display:flex; align-items:center; justify-content:space-between; padding:20px 0; gap:24px; }
.aslp .nav-links{ display:flex; gap:30px; list-style:none; margin:0; padding:0; }
.aslp .nav-links a{ text-decoration:none; color:var(--a-text-soft); font-size:0.85rem; font-weight:500; transition:color .25s; }
.aslp .nav-links a:hover{ color:var(--a-gold); }
@media (max-width:760px){ .aslp .nav-links{display:none;} }

.aslp .ribbon{
  position:fixed; top:14px; left:14px; z-index:60; background:var(--a-surface);
  border:1px solid var(--a-border-strong); color:var(--a-text-soft); font-size:0.68rem;
  letter-spacing:0.1em; padding:9px 14px; border-radius:2px;
  box-shadow:0 12px 32px rgba(0,0,0,0.5);
}
.aslp .ribbon b{ color:var(--a-gold); font-weight:600; }

.aslp .hero{ position:relative; }
.aslp .hero-stage{
  display:grid; grid-template-columns:1.15fr 0.85fr; gap:0 56px;
  min-height:calc(100vh - 84px); position:relative;
}
@media (max-width:900px){ .aslp .hero-stage{ grid-template-columns:1fr; min-height:auto; gap:40px; padding-top:20px;} }
.aslp .hero-copy{ align-self:end; padding-bottom:84px; position:relative; z-index:2; }
@media (max-width:900px){ .aslp .hero-copy{ align-self:start; order:2; padding-bottom:0; } }
.aslp .hero-copy h1{ font-size:clamp(2.3rem,5vw,3.9rem); line-height:1.18; margin-bottom:24px; max-width:15ch; }
.aslp .hero-copy p{ max-width:440px; color:var(--a-text-soft); font-size:1rem; margin-bottom:32px; }
.aslp .hero-plate-col{ align-self:start; padding-top:64px; position:relative; }
@media (max-width:900px){ .aslp .hero-plate-col{ padding-top:0; order:1; } }
.aslp .hero-plate{ aspect-ratio:3/4; }
.aslp .hero-edge{
  writing-mode:vertical-rl; position:absolute; top:64px; inset-inline-end:-16px;
  font-size:0.66rem; letter-spacing:0.28em; color:var(--a-text-muted);
}
.aslp .hero-thread{ position:absolute; inset-inline-end:2%; top:8%; width:min(46%,380px); z-index:1; }
@media (max-width:900px){ .aslp .hero-thread{ display:none; } }

.aslp .trust{ border-top:1px solid var(--a-border); border-bottom:1px solid var(--a-border); }
.aslp .trust-line{ padding:22px 0; font-size:0.86rem; color:var(--a-text-soft); line-height:1.9; }
.aslp .trust-line b{ color:var(--a-text); font-weight:500; }

.aslp .work{ padding:120px 0; }
.aslp .filmstrip{ display:flex; gap:14px; align-items:flex-end; }
@media (max-width:760px){ .aslp .filmstrip{ flex-wrap:wrap; } }
.aslp .frame-cell{ flex:1 1 0; }
.aslp .frame-cell.lead{ flex:1.7 1 0; }
.aslp .frame-cell .plate{ aspect-ratio:3/4; }
.aslp .frame-cell.lead .plate{ aspect-ratio:4/5; }
.aslp .frame-cell:nth-child(3){ transform:translateY(18px); }
.aslp .frame-cell:nth-child(5){ transform:translateY(26px); }
@media (max-width:760px){ .aslp .frame-cell{ flex:1 1 42%; transform:none !important; } }
.aslp .frame-tick{ display:flex; justify-content:space-between; margin-top:10px; font-size:0.64rem; letter-spacing:0.06em; color:var(--a-text-muted); font-variant-numeric:tabular-nums; }
.aslp .text-frame{ display:flex; flex-direction:column; justify-content:space-between; aspect-ratio:3/4; background:var(--a-surface); padding:26px 22px; }
.aslp .text-frame h2{ font-size:1.5rem; line-height:1.38; }

.aslp .experience{ padding:130px 0; background:var(--a-surface); border-top:1px solid var(--a-border); border-bottom:1px solid var(--a-border); }
.aslp .exp-grid{ display:grid; grid-template-columns:1.3fr 1fr; gap:34px; }
@media (max-width:860px){ .aslp .exp-grid{ grid-template-columns:1fr; } }
.aslp .exp-lead{ background:var(--a-surface-alt); padding:46px 40px; display:flex; flex-direction:column; gap:20px; justify-content:center; }
.aslp .exp-lead h2{ font-size:clamp(1.6rem,2.6vw,2.1rem); line-height:1.32; }
.aslp .exp-lead p{ color:var(--a-text-soft); font-size:0.94rem; max-width:420px; }
.aslp .exp-lead .tag{ font-size:0.78rem; color:var(--a-gold); font-weight:500; }
.aslp .exp-stack{ position:relative; padding-inline-start:34px; display:flex; flex-direction:column; gap:30px; justify-content:center; }
.aslp .exp-stack .thread{ position:absolute; inset-inline-start:-2px; top:6px; bottom:6px; width:26px; height:calc(100% - 12px); }
.aslp .exp-item h3{ font-size:1.12rem; margin-bottom:8px; }
.aslp .exp-item p{ color:var(--a-text-soft); font-size:0.88rem; }

.aslp .explore{ padding:110px 0; }
.aslp .explore .lede{ color:var(--a-text-soft); font-size:1rem; margin-bottom:6px; max-width:32ch; }
.aslp .explore-list{ list-style:none; margin:44px 0 0; padding:0; }
.aslp .explore-list li{ border-top:1px solid var(--a-border); }
.aslp .explore-list li:last-child{ border-bottom:1px solid var(--a-border); }
.aslp .explore-row{ display:grid; grid-template-columns:1fr auto; gap:20px; align-items:center; padding:28px 0; text-decoration:none; color:inherit; }
.aslp .explore-title{ font-size:1.35rem; font-weight:700; color:var(--a-ivory); transition:color .25s var(--ease); }
.aslp .explore-title span{ display:block; font-size:0.85rem; font-weight:300; color:var(--a-text-soft); margin-top:6px; }
.aslp .explore-row:hover .explore-title{ color:var(--a-gold); }

.aslp .cta{ padding:150px 0; position:relative; overflow:hidden; }
.aslp .cta-thread{ position:absolute; inset-inline-start:-4%; bottom:-8%; width:min(60%,520px); opacity:.7; }
.aslp .cta-inner{ position:relative; z-index:2; max-width:640px; }
.aslp .cta h2{ font-size:clamp(2rem,4vw,3rem); margin-bottom:34px; }

.aslp footer{ border-top:1px solid var(--a-border); padding:48px 0; }
.aslp .foot-row{ display:flex; justify-content:space-between; align-items:center; gap:20px; flex-wrap:wrap; }
.aslp .foot-thread{ width:70px; height:50px; opacity:.6; }
.aslp .foot-addr{ font-size:0.82rem; color:var(--a-text-soft); }
.aslp .foot-fine{ color:var(--a-text-muted); font-size:0.76rem; margin-top:30px; text-align:center; }

.aslp .notes{ background:#0E0E0E; border-top:1px dashed var(--a-border-strong); padding:90px 0 110px; }
.aslp .notes .tag2{ font-size:0.7rem; letter-spacing:.18em; color:var(--a-text-muted); margin-bottom:10px; }
.aslp .notes h2{ font-size:1.4rem; margin-bottom:32px; }
.aslp .notes-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:1px; background:var(--a-border); border:1px solid var(--a-border); }
@media (max-width:760px){ .aslp .notes-grid{ grid-template-columns:1fr; } }
.aslp .note-card{ background:var(--a-bg); padding:28px 26px; }
.aslp .note-card .k{ font-size:0.66rem; letter-spacing:.14em; color:var(--a-gold); font-weight:600; margin-bottom:10px; }
.aslp .note-card h4{ font-family:'Tajawal',sans-serif; font-weight:600; font-size:0.98rem; color:var(--a-ivory); margin:0 0 10px; }
.aslp .note-card p{ font-size:0.85rem; color:var(--a-text-soft); line-height:1.85; }
.aslp .notes-foot{ margin-top:34px; font-size:0.82rem; color:var(--a-text-muted); max-width:740px; line-height:1.9; }
.aslp .notes-foot strong{ color:var(--a-text-soft); }
`;

const BODY_HTML = `
<svg class="thread-defs" aria-hidden="true">
  <defs>
    <symbol id="aslp-thread" viewBox="0 0 500 360">
      <path d="M20,320 C90,260 60,180 140,170 C200,162 190,240 260,225 C330,210 300,120 380,95 C420,82 430,40 480,20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
    </symbol>
    <symbol id="aslp-thread-v" viewBox="0 0 60 320" preserveAspectRatio="none">
      <path d="M30,8 C10,58 50,88 26,148 C6,198 46,228 24,278 C12,298 34,308 30,316" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
    </symbol>
  </defs>
</svg>

<div class="ribbon"><b>معاينة داخلية</b> — رابط خاص، غير مرتبط بالموقع العام</div>

<header>
  <div class="wrap nav-row">
    <div class="wordmark" style="font-size:1.02rem;">ATEMA<small>STUDIO</small></div>
    <ul class="nav-links">
      <li><a href="#aslp-hero">الرئيسية</a></li>
      <li><a href="#aslp-work">الأعمال</a></li>
      <li><a href="#aslp-experience">التجربة</a></li>
      <li><a href="#aslp-explore">الاستوديو</a></li>
      <li><a href="#aslp-notes">ملاحظات المعاينة</a></li>
    </ul>
    <a href="#aslp-cta" class="bare">احجزي جلستك <span class="arw">←</span></a>
  </div>
</header>

<section class="hero" id="aslp-hero">
  <div class="wrap hero-stage">
    <div class="hero-copy reveal">
      <h1>لحظتُكِ، خالدةً في الضوء.</h1>
      <p>استوديو فاطمة بوحسن للتصوير النسائي الحصري: لحظات حميمة، صور سينمائية، وإرث بصري يُحفظ.</p>
      <a href="#aslp-cta" class="btn">احجزي جلستك</a>
    </div>
    <div class="hero-plate-col reveal" style="transition-delay:.12s;">
      <div class="hero-edge">EST. 2018 · JUBAIL, KSA</div>
      <div class="plate hero-plate"></div>
    </div>
    <svg class="thread hero-thread" aria-hidden="true"><use href="#aslp-thread"></use></svg>
  </div>
</section>

<section class="trust">
  <div class="wrap trust-line">
    <b>فريق نسائي بالكامل</b> · الجبيل والشرقية · تحويل بنكي · بطاقة · مدى
  </div>
</section>

<section class="work" id="aslp-work">
  <div class="wrap">
    <div class="filmstrip reveal">
      <div class="frame-cell text-frame">
        <h2>كل لقطة، لحظة لن تتكرر.</h2>
        <a href="#aslp-explore" class="bare">كل الأعمال <span class="arw">←</span></a>
      </div>
      <div class="frame-cell lead"><div class="plate"></div><div class="frame-tick"><span>٠١</span><span>ATM—001</span></div></div>
      <div class="frame-cell"><div class="plate"></div><div class="frame-tick"><span>٠٢</span><span>ATM—002</span></div></div>
      <div class="frame-cell"><div class="plate"></div><div class="frame-tick"><span>٠٣</span><span>ATM—003</span></div></div>
      <div class="frame-cell"><div class="plate"></div><div class="frame-tick"><span>٠٤</span><span>ATM—004</span></div></div>
    </div>
  </div>
</section>

<section class="experience" id="aslp-experience">
  <div class="wrap">
    <div class="exp-grid reveal">
      <div class="exp-lead">
        <h2>أربع لحظات تصنع إرثاً.</h2>
        <p>تبدأ باستشارة خاصة تُحدّد كل تفصيل، ثم تتكشف عبر الجلسة نفسها، لتُختم بإرث يُحفظ.</p>
        <div class="tag">٠١ المشاورة</div>
      </div>
      <div class="exp-stack">
        <svg class="thread" aria-hidden="true"><use href="#aslp-thread-v"></use></svg>
        <div class="exp-item">
          <h3>الأجواء</h3>
          <p>إضاءة ناعمة، تركيز مطلق على الخصوصية، وفريق نسائي كامل.</p>
        </div>
        <div class="exp-item">
          <h3>الالتقاط</h3>
          <p>لحظات غير مُتدخّل بها: صور سينمائية تنبض بالشعور.</p>
        </div>
        <div class="exp-item">
          <h3>الإرث</h3>
          <p>ألبومات مطبوعة بأيدٍ حِرَفية وفيديو سينمائي محفور في الذاكرة.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="explore" id="aslp-explore">
  <div class="wrap">
    <p class="lede reveal">ثلاث نوافذ على هذا العالم.</p>
    <ul class="explore-list reveal" style="transition-delay:.08s;">
      <li><a class="explore-row" href="#aslp-work">
        <span class="explore-title">الأعمال<span>مختارات من جلساتنا الأخيرة</span></span>
        <span class="bare"><span class="arw">←</span></span>
      </a></li>
      <li><a class="explore-row" href="#aslp-notes">
        <span class="explore-title">اليوميات<span>مقالات عن الضوء، التحضير، والذاكرة</span></span>
        <span class="bare"><span class="arw">←</span></span>
      </a></li>
      <li><a class="explore-row" href="#aslp-hero">
        <span class="explore-title">الاستوديو<span>رؤية الاستوديو وفلسفته</span></span>
        <span class="bare"><span class="arw">←</span></span>
      </a></li>
    </ul>
  </div>
</section>

<section class="cta" id="aslp-cta">
  <svg class="thread cta-thread" aria-hidden="true"><use href="#aslp-thread"></use></svg>
  <div class="wrap cta-inner reveal">
    <h2>احجزي جلستكِ: مساحة محدودة.</h2>
    <a href="#" class="btn">احجزي الآن</a>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="foot-row">
      <div class="wordmark" style="font-size:0.86rem;">ATEMA<small>STUDIO</small></div>
      <svg class="thread foot-thread" aria-hidden="true"><use href="#aslp-thread"></use></svg>
      <div class="foot-addr">الجبيل، المملكة العربية السعودية</div>
    </div>
    <div class="foot-fine">© 2026 ATEMA STUDIO · جميع الحقوق محفوظة</div>
  </div>
</footer>

<section class="notes" id="aslp-notes">
  <div class="wrap">
    <div class="tag2">ملاحظة داخلية — لا تُعرض للعميل النهائي</div>
    <h2>ما الذي تغيّر هنا، ولماذا</h2>
    <div class="notes-grid">
      <div class="note-card">
        <div class="k">الإشارة الوحيدة</div>
        <h4>One signature, decided first</h4>
        <p>الخيط الذهبي الواحد (خيط حرفة الخياطة، من لغة العلامة "black silk, champagne gold") هو العنصر الوحيد المتكرر بثلاث نقاط: البطل، التجربة، الإغلاق — بنفس المسار، بلا تكرار مصطنع.</p>
      </div>
      <div class="note-card">
        <div class="k">لا صناديق متطابقة</div>
        <h4>No hairline-border cards, no accent rail</h4>
        <p>اللوحات والبطاقات فقدت حدودها الرفيعة الموحّدة؛ التمايز الآن بالدرجة اللونية فقط. عمود «الأجواء / الالتقاط / الإرث» استبدل الخط الجانبي العام بالخيط نفسه.</p>
      </div>
      <div class="note-card">
        <div class="k">زر واحد، لا زوجًا</div>
        <h4>One button voice, no filled+ghost pair</h4>
        <p>كل إجراء رئيسي زر ذهبي واحد؛ كل إجراء ثانوي رابط نصي بسهم. لا يوجد زوج (زر مملوء + زر مفرّغ) في أي قسم.</p>
      </div>
      <div class="note-card">
        <div class="k">تركيبة مختلفة لكل قسم</div>
        <h4>No repeated kicker-then-heading skeleton</h4>
        <p>عنوان «الأعمال» أصبح إطارًا داخل الفيلم نفسه، وعنوان «التجربة» عاش داخل بطاقة القيادة، بدل تكرار سطر عنوان صغير فوق عنوان كبير في كل قسم.</p>
      </div>
    </div>
    <div class="notes-foot">
      <strong>ما لم يتغيّر:</strong> كل قيمة لون هنا منسوخة حرفيًا من src/theme/themes.ts. الخطوط هي خطوط الهوية نفسها (Amiri للشعار، Tajawal للعناوين والنصوص) — وهذه نقطة تستحق قرارًا منكم: قانون anti-slop يمنع Cormorant Garamond وغيره من خطوط Google الافتراضية كخط توقيع، لكنه لا يذكر Tajawal/Amiri تحديدًا، وهما هوية العلامة الفعلية، فأبقيناهما. الصور لوحات تجريدية بإضاءة اتجاهية واحدة، وليست صور عميلات حقيقية. هذا القسم توضيحي فقط ولن يظهر في أي نشر فعلي. التفاصيل الكاملة: docs/reviews/2026-07-17-antislop-audit.md
    </div>
  </div>
</section>
`;

export default function AntislopPreviewPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    const root = rootRef.current;
    const els = root ? root.querySelectorAll('.reveal') : [];
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io!.unobserve(en.target);
          }
        });
      }, { threshold: 0.14 });
      els.forEach((e) => io!.observe(e));
    } else {
      els.forEach((e) => e.classList.add('in'));
    }

    return () => {
      document.head.removeChild(meta);
      if (io) io.disconnect();
    };
  }, []);

  return (
    <div className="aslp" ref={rootRef}>
      <style>{CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: BODY_HTML }} />
    </div>
  );
}
