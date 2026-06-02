-- ATEMA STUDIO — Editing-tier separation (May 2026)
--
-- Two editing tiers, formally declared in the catalogue + contract:
--
--   1. Basic edit   (التعديل الأساسي)
--      Lighting correction + colour balance + JPG conversion from RAW.
--      Applied to the FULL `edited_photos` count in every package.
--
--   2. Editorial retouch (التعديل التحريري)
--      Advanced retouching — skin work, dodge-and-burn, blemish removal,
--      cinematic colour grade. Time-intensive (~30 min/image).
--      Offered only on HIGH-END packages in multiples of 4: Royal=4,
--      Signature=8, Couture=12. Lower tiers can purchase editorial as
--      an add-on (future) but do not receive any by default.
--
-- This separation makes the deliverable promise legally precise and
-- protects the studio from "but I thought all photos would look like the
-- editorial samples" expectation drift. The contract (Article IV.b)
-- declares both tiers explicitly.
--
-- Idempotent. Run AFTER migrations-2026-05-custom-base.sql.

begin;

-- ─── 1. Schema: add the editorial counter ────────────────────────────────────
alter table public.packages
  add column if not exists editorial_photos integer not null default 0
    check (editorial_photos >= 0 and editorial_photos % 4 = 0);
  -- DB enforces the "factor of 4" business rule. Any other value rejected.

-- ─── 2. Backfill editorial counts on the high-end tiers ──────────────────────
update public.packages set editorial_photos = 0  where id = 1;  -- Engagement
update public.packages set editorial_photos = 0  where id = 2;  -- Custom Foundation
update public.packages set editorial_photos = 0  where id = 3;  -- Classic
update public.packages set editorial_photos = 4  where id = 4;  -- Royal
update public.packages set editorial_photos = 8  where id = 5;  -- Signature
update public.packages set editorial_photos = 12 where id = 6;  -- ATEMA Couture

-- ─── 3. Rewrite features text to declare the editing tier explicitly ─────────
-- Engagement (id=1): basic only.
update public.packages set features = array[
  'ساعتان من التصوير الاحترافي',
  '٣٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  'اختيار أجمل اللقطات',
  'وحدة تخزين باسم العروسين',
  'تصميم Save the Date رقمي هدية'
] where id = 1;

-- Custom Foundation (id=2): basic only.
update public.packages set features = array[
  'ساعة واحدة من التصوير الاحترافي',
  '٢٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  'وحدة تخزين رقمية',
  'أضيفي ساعات، فيديو، ألبوم، أو ليلة الحناء حسب احتياجك'
] where id = 2;

-- Classic (id=3): basic only.
update public.packages set features = array[
  '٤ ساعات تغطية شاملة للحفل',
  'مصوّرة رئيسية + مساعدة (فريق نسائي)',
  '٣٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
  '٥ صور عائلية معدّلة',
  'وحدة تخزين بجميع الصور المعدّلة'
] where id = 3;

-- Royal (id=4): basic + 4 editorial.
update public.packages set features = array[
  '٥ ساعات تغطية شاملة للحفل',
  'مصوّرة رئيسية + مساعدة (فريق نسائي)',
  '٤٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  '٤ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
  'فيديو سينمائي قصير (٣–٥ دقائق)',
  'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
  'ميني ألبوم عائلي',
  'وحدة تخزين باسم العروسين',
  'معاينة في نفس اليوم (٥ صور مختارة)'
] where id = 4;

-- Signature (id=5): basic + 8 editorial.
update public.packages set features = array[
  '٦ ساعات تغطية شاملة للحفل',
  'مصوّرة رئيسية + مساعدة (فريق نسائي)',
  '٥٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  '٨ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
  'فيديو سينمائي كامل',
  'جلسة تصوير تحضيرات العروس',
  'ألبوم فاخر A3 بـ ١٢ صفحة',
  'ميني ألبوم عائلي',
  'وحدة تخزين منقوشة بالاسم',
  'معاينة في نفس اليوم (٥ صور مختارة)'
] where id = 5;

-- ATEMA Couture (id=6): basic + 12 editorial.
update public.packages set features = array[
  'تغطية شاملة كاملة للحفل (٨ ساعات)',
  'مصوّرة رئيسية + مساعدة (فريق نسائي)',
  '٧٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
  '١٢ صورة بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
  'فيديو سينمائي فاخر — تغطية كاملة + ليلة الحناء',
  'جلسة تحضيرات العروس',
  'تغطية ليلة الحناء',
  'ألبوم فاخر A3 بـ ٢٠ صفحة',
  'ميني ألبوم فاخر',
  'لوحة جدارية فنية مؤطرة',
  'وحدة تخزين فاخرة بالاسم',
  'معاينة في نفس اليوم (١٠ صور مختارة)',
  'خدمة عملاء ومتابعة خاصة'
] where id = 6;

-- ─── 4. English features mirror ──────────────────────────────────────────────
update public.packages set features_en = array[
  '2 hours of professional photography',
  '30 photos with basic edit (light + JPG conversion)',
  'A curated selection of best frames',
  'Digital storage in the couple''s names',
  'Save-the-Date digital design — complimentary'
] where id = 1;

update public.packages set features_en = array[
  '1 hour of professional photography',
  '20 photos with basic edit (light + JPG conversion)',
  'Digital storage',
  'Add hours, video, album, or henna night as you need'
] where id = 2;

update public.packages set features_en = array[
  '4 hours of full event coverage',
  'Lead photographer + assistant (all-female team)',
  '300 photos with basic edit (light + JPG conversion)',
  'A4 album, 15 pages — premium printing',
  '5 retouched family photos',
  'Digital storage of all edited images'
] where id = 3;

update public.packages set features_en = array[
  '5 hours of full event coverage',
  'Lead photographer + assistant (all-female team)',
  '400 photos with basic edit (light + JPG conversion)',
  '4 photos with editorial retouch (advanced retouching + cinematic grade)',
  'Short cinematic video (3–5 minutes)',
  'A4 album, 15 pages — premium printing',
  'Mini family album',
  'Digital storage in the couple''s names',
  'Same-day preview (5 curated photos)'
] where id = 4;

update public.packages set features_en = array[
  '6 hours of full event coverage',
  'Lead photographer + assistant (all-female team)',
  '500 photos with basic edit (light + JPG conversion)',
  '8 photos with editorial retouch (advanced retouching + cinematic grade)',
  'Full cinematic video',
  'Bridal-prep session',
  'Premium A3 album, 12 pages',
  'Mini family album',
  'Engraved-name digital storage',
  'Same-day preview (5 curated photos)'
] where id = 5;

update public.packages set features_en = array[
  '8 hours of full event coverage',
  'Lead photographer + assistant (all-female team)',
  '700 photos with basic edit (light + JPG conversion)',
  '12 photos with editorial retouch (advanced retouching + cinematic grade)',
  'Premium cinematic video — full event + henna night',
  'Bridal-prep session',
  'Henna-night coverage',
  'Premium A3 album, 20 pages',
  'Premium mini album',
  'Framed art print',
  'Premium engraved digital storage',
  'Same-day preview (10 curated photos)',
  'Dedicated concierge service'
] where id = 6;

commit;

-- ─── 5. Verify ───────────────────────────────────────────────────────────────
select '— Editing tiers per package —' as section;
select id, name_ar, edited_photos as basic_count, editorial_photos as editorial_count
  from public.packages
 where active
 order by sort_order;
