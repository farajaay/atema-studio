# Photo Adequacy & Readability Report

> Bilingual standalone report extracted from §4 of the main marketing proposal.
> Use this if you only want the photo verdict. The full proposal is at
> [`MARKETING_PROPOSAL.en.md`](./MARKETING_PROPOSAL.en.md) /
> [`MARKETING_PROPOSAL.ar.md`](./MARKETING_PROPOSAL.ar.md).

**Method (English).** Every JPEG in `/public/photos/` was passed through
`sharp.metadata()` and `sharp.stats()` to extract width, height, mean
luminance, and channel std-dev (a proxy for contrast). A WebP counterpart
was checked for each file. The script is reproducible —
`node docs/marketing-proposal-2026-05/screenshots/_photo-audit.mjs` regenerates
the JSON.

**المنهج (عربي).** كل JPEG في `/public/photos/` مُرِّر عبر `sharp.metadata()`
و`sharp.stats()` لاستخراج العرض والارتفاع، ومتوسّط الإضاءة، والانحراف
المعياري للقنوات (كمؤشر تباين). ولكل ملفّ تأكَّدنا من وجود نسخة WebP. السكربت
قابل لإعادة التشغيل عبر:
`node docs/marketing-proposal-2026-05/screenshots/_photo-audit.mjs`.

---

## Headline figures / الأرقام الرئيسية (33 photos)

| Metric / المقياس | Value / القيمة | Verdict / الحُكم |
|---|---|---|
| Portrait / عمودي | 28 / 33 (84.8%) | ✅ Ideal for IG Reels, TikTok, Stories, WhatsApp Status. مثاليّ لأسطح السعودية المسيطرة. |
| Square / مربّع | 4 / 33 (12.1%) | ✅ IG grid posts. شبكة منشورات إنستغرام. |
| Landscape / أفقي | 1 / 33 (3.0%) | ⚠ Only the promotion banner. فقط لافتة الترويج. |
| WebP coverage / تغطية WebP | 33 / 33 (100%) | ✅ -38.8% file size avg. توفير ٣٨.٨٪. |
| Average JPEG / متوسّط JPEG | 149.6 KB | ✅ Mobile-friendly. |
| Average WebP / متوسّط WebP | 91.6 KB | ✅ |
| Sub-HD (<1080 either axis) / أقلّ من 1080p | 3 / 33 | ⚠ `Promotion.jpg` (1200×675), `Promotion_Mobile.jpg` (941×1672), `customise.jpeg` (1125×987). |
| Too dark (lum<60) / داكنة | 2 | Both promo banners — intentional mood. لافتات الترويج — مزاج مقصود. |
| Too bright (lum>200) / ساطعة جداً | 0 | ✅ |
| Low-contrast (σ<35) / تباين منخفض | 1 (`IMG_3329.JPG`) | ⚠ Re-grade or replace. أعيدي المعالجة أو استبدليه. |

Raw data:
- [`screenshots/_photo-audit.json`](./screenshots/_photo-audit.json) — per-file rows
- [`screenshots/_photo-audit-summary.json`](./screenshots/_photo-audit-summary.json) — aggregate

---

## Readability — Couture Noir dark theme (default site)

**English.** The site defaults to Couture Noir (`--a-bg: #0B0B0B`). Photos
with mean luminance under 60 disappear into the background unless they have
a strong golden highlight. The 2 dark outliers (`Promotion.jpg`,
`Promotion_Mobile.jpg`) are promo-banner artwork by design and live under an
even darker scrim. They are **not** safe to reuse standalone on the homepage
or as Reels covers.

**Action.** Add a 6–10px gold/champagne border or soft outer glow to any
image-on-dark component. The Mood Board page already does this — port the
pattern to the homepage and journal cards.

**عربي.** الموقع يفتح افتراضياً بثيم «كوتور نوار». الصور التي سطوعها أقلّ من
٦٠ تختفي في الخلفية ما لم تحتوِ ضوءاً ذهبيّاً قويّاً. الصورتان الداكنتان
هما لافتتا العرض الترويجي، وهي مقصودة وتحت طبقة معتمة أصلاً. لا تَصلحان
كصور هيرو مستقلّة أو كأغلفة ريلز.

**الإجراء.** أضيفي حدّاً ذهبياً ٦–١٠px أو توهّجاً خارجياً ناعماً لأي مكوّن
«صورة على داكن». لوحة المزاج تفعل ذلك أصلاً — انسخي النمط إلى الصفحة
الرئيسية وبطاقات اليوميات.

---

## Readability — Instagram light-mode grid

**English.** Saudi luxury bridal accounts are usually viewed in Instagram
light mode on iPhones — a 9-tile grid on a near-white canvas. The luminance
risk is reversed: photos that are bright with washed-out highlights bleed
into the canvas. Four photos qualify:

- `IMG_3329.JPG` — lum 196, contrast 28.2 → **highest risk.**
- `bride-hero.jpeg` — lum 193.8, contrast 60.6 → works with darker neighbours.
- `royal.jpeg` — lum 178.7, contrast 37.0 → moderate risk.
- `IMG_4237.JPG` — lum 176.6, contrast 38.2 → moderate risk.

**Action.** When sequencing a 9-up grid, alternate `lum<120` and `lum>160`
photos so no row is uniformly bright. The audit JSON is pre-sorted by
luminance.

**عربي.** حسابات العرائس الفاخرة تُشاهَد عادةً على إنستغرام في الوضع الفاتح
— تسعة صور على لوحة شبه بيضاء. الخطر معكوس: الصور شديدة السطوع مع نقاط بلا
تباين تذوب في الخلفية البيضاء. أربع صور تتأهّل:

- `IMG_3329.JPG` — الأعلى خطراً.
- `bride-hero.jpeg` — تَصلح بلاطاً مع جارات أغمق.
- `royal.jpeg` — خطر متوسّط.
- `IMG_4237.JPG` — خطر متوسّط.

**الإجراء.** عند ترتيب شبكة من ٩ صور، تبادلي صور سطوع<١٢٠ مع سطوع>١٦٠ كي
لا يكون أيّ صفّ موحَّد السطوع. الـJSON رتَّب الصور حسب الإضاءة.

---

## Format gaps for the next shoot

| Gap / الفجوة | What's missing | Why it matters in KSA |
|---|---|---|
| Landscape / أفقي | Only 1 of 33 photos is landscape. | YouTube thumbnails, web hero banners, Google Discover ads all need 16:9 or 4:3. Without re-shooting, the studio can't run those surfaces. |
| Video / فيديو | Zero motion assets in `/public/photos/`. | KSA discovery is short-form video. TikTok engagement is ~90 minutes/day per user. A photography studio with no Reels output is invisible to the algorithm. |
| Cultural detail / تفصيل ثقافي | Most of the 23 frames lean Western-editorial (white gowns, neutral palettes). | Add 4–6 Eastern-Province-rooted frames: henna night, thobe-and-bisht detail, Qatif/Ahsa architecture if venues allow. This locks the brand to the region. |

**Briefing for the next shoot:**

- 6 deliberate landscape frames (3 × 16:9 for web hero / YouTube, 2 × 4:3 for
  Discover, 1 × ultra-wide editorial).
- 6 × 15-second BTS video clips for a month of Reels.
- 4–6 Eastern-Province-rooted detail frames.
- All frames must be ≥1080px on the short axis (≥1920px preferred).
- One mid-luminance (lum 100–160) frame per shoot for grid alternation.

**ملخّص الجلسة القادمة:**

- ٦ لقطات أفقية متعمَّدة (٣ × ١٦:٩ لويب يوتيوب، ٢ × ٤:٣ لـDiscover، ١ تحريري
  واسع جداً).
- ٦ × ١٥ ثانية فيديو خلف الكواليس لشهر من ريلز.
- ٤–٦ إطارات سعودية الجذور: حنّة، ثوب وبشت، معمار القطيف/الأحساء.
- كل إطار ≥ ١٠٨٠px على المحور القصير (الأفضل ≥ ١٩٢٠px).
- إطار سطوع متوسّط (١٠٠–١٦٠) لكل جلسة لتناوُب الشبكة.

---

## Reproducibility / إعادة التشغيل

```bash
node docs/marketing-proposal-2026-05/screenshots/_photo-audit.mjs
```

Both the JSON and this report will pick up any new photo added to
`/public/photos/`. Re-run after every photo session.

كلا الـJSON وهذا التقرير يلتقطان أي صورة جديدة في `/public/photos/`. أعيدي
التشغيل بعد كل جلسة.
