-- ATEMA STUDIO — Packages & Add-ons seed
-- Mirrors the printed price list (قائمة الأسعار) handed to clients.
--
-- Idempotent and FK-safe: existing bookings reference packages.id, so this
-- script UPSERTS rows by explicit id (1..6) and DEACTIVATES (sets active=false)
-- any leftover legacy packages instead of deleting them. That preserves
-- booking history while hiding obsolete tiers from the catalogue + admin.
--
-- Run AFTER schema.sql and migrations-2026-05*.sql.

-- ─── Ensure schema columns exist (idempotent guards) ─────────────────────────
alter table public.packages
  add column if not exists included_addon_ids text[] default '{}'::text[],
  add column if not exists sort_order integer not null default 100;

alter table public.addons
  add column if not exists sort_order integer not null default 100;

-- ─── 1. ADD-ONS (11 line items) ──────────────────────────────────────────────
-- Insert/update by id so re-running keeps prices in sync.
insert into public.addons (id, name_ar, name_en, price, active, sort_order)
values
  -- Extra hour now includes assistant cost (110/hr) + 25% margin on full loaded labour.
  ('extra-hour',     'ساعة تصوير إضافية',                       'Extra photo hour',                         900,  true, 10),
  -- Video add-ons follow the videography 50% margin rule:
  --   short = ~5h × 450 × 1.5 ≈ 3,400 SAR
  --   full  = ~7h × 450 × 1.5 ≈ 4,800 SAR
  ('video-short',    'فيديو سينمائي قصير (إضافة للكلاسيكية)',    'Short cinematic video (Classic add-on)',  3400,  true, 20),
  ('video-full',     'فيديو سينمائي كامل (إضافة للكلاسيكية)',    'Full cinematic video (Classic add-on)',   4800,  true, 30),
  ('henna',          'تغطية ليلة الحناء',                        'Henna night coverage',                    2400,  true, 40),
  ('bridal-prep',    'تصوير تحضيرات العروس',                     'Bridal prep session',                     1200,  true, 50),
  ('album-upgrade',  'ترقية الألبوم إلى A3',                     'Album upgrade to A3',                      800,  true, 60),
  ('extra-pages',    'صفحات ألبوم إضافية (سعر الصفحة)',          'Extra album page (per page)',              120,  true, 70),
  ('raw-files',      'تسليم الملفات الخام',                      'Raw files delivery',                       900,  true, 80),
  ('second-photog',  'مصور ثانٍ',                                'Second photographer',                     1200,  true, 90),
  ('kosha',          'تصوير الكوشة قبل الحفل',                    'Pre-event kosha shoot',                    800,  true, 100),
  ('save-date',      'Save the Date',                            'Save the Date',                            700,  true, 110)
on conflict (id) do update set
  name_ar    = excluded.name_ar,
  name_en    = excluded.name_en,
  price      = excluded.price,
  active     = excluded.active,
  sort_order = excluded.sort_order;

-- ─── 2. PACKAGES (6 tiers — engagement → couture) ────────────────────────────
-- UPSERT by explicit id so existing bookings keep their FK reference intact.
insert into public.packages
  (id, name_ar, name_en, price, duration_hours, edited_photos, album, video,
   description, features, badge, is_popular, active, sort_order, included_addon_ids)
values

-- ── 1. Engagement Session — 2,500 SAR ────────────────────────────────────────
-- Pricing updated May-2026 (see migrations-2026-05-pricing-overhaul.sql).
-- Editing-tier copy aligned with migrations-2026-05-editing-tiers.sql.
(1, 'باقة الخطوبة', 'Engagement Session', 2500, 2, 30,
 NULL, false,
 'جلسة خطوبة رومانسية بأسلوب راقٍ — مثالية لإعلان البداية.',
 array[
   'ساعتان من التصوير الاحترافي',
   '٣٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   'اختيار أجمل اللقطات',
   'وحدة تخزين باسم العروسين',
   'تصميم Save the Date رقمي هدية'
 ],
 'الأساسي', false, true, 10, array['save-date']::text[]),

-- ── 2. Custom Foundation — singleton base for "Design Your Package" tab ─────
-- Set is_custom_base=true via migrations-2026-05-custom-base.sql after seeding.
-- This row was previously "Customise" (2,200 SAR, 3h, partially-loaded).
-- Now: minimal 1h foundation that customers build on with add-ons.
(2, 'الأساس المرن', 'Custom Foundation', 1800, 1, 20,
 NULL, false,
 'الأساس المرن لباقتك المخصّصة — ابدئي من هنا وأضيفي ما يلائم مناسبتك.',
 array[
   'ساعة واحدة من التصوير الاحترافي',
   '٢٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   'وحدة تخزين رقمية',
   'أضيفي ساعات، فيديو، ألبوم، أو ليلة الحناء حسب احتياجك'
 ],
 NULL, false, true, 0, array[]::text[]),

-- ── 3. Classic — 5,200 SAR ───────────────────────────────────────────────────
-- Adds assistant (>2h rule) + printing 25% margin.
(3, 'الباقة الكلاسيكية', 'Classic', 5200, 4, 300,
 'ألبوم A4 ١٥ صفحة', false,
 'الباقة المثالية للمناسبات الخاصة — ألبوم فاخر وذكريات تبقى، بفريق نسائي كامل.',
 array[
   '٤ ساعات تغطية شاملة للحفل',
   'مصوّرة رئيسية + مساعدة (فريق نسائي)',
   '٣٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
   '٥ صور عائلية معدّلة',
   'وحدة تخزين بجميع الصور المعدّلة'
 ],
 NULL, false, true, 30, array['second-photog']::text[]),

-- ── 4. Royal — 10,500 SAR — الأكثر طلباً ─────────────────────────────────────
-- Video service now priced at hours × 450 × 1.5 (50% margin per owner rule).
(4, 'الباقة الملكية', 'Royal', 10500, 5, 400,
 'ألبوم A4 + ميني ألبوم', true,
 'تجربة تصوير ملكية مع فيديو سينمائي قصير وألبومين فاخرين — الأكثر طلباً.',
 array[
   '٥ ساعات تغطية شاملة للحفل',
   'مصوّرة رئيسية + مساعدة (فريق نسائي)',
   '٤٠٠ صورة بتعديل أساسي (إضاءة + تحويل JPG)',
   '٤ صور بتعديل تحريري احترافي (رتوش متقدم وتدرّج سينمائي)',
   'فيديو سينمائي قصير (٣–٥ دقائق)',
   'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
   'ميني ألبوم عائلي',
   'وحدة تخزين باسم العروسين',
   'معاينة في نفس اليوم (٥ صور مختارة)'
 ],
 'الأكثر طلباً', true, true, 40, array['second-photog','video-short']::text[]),

-- ── 5. Signature — 12,500 SAR ────────────────────────────────────────────────
(5, 'باقة التوقيع', 'Signature', 12500, 6, 500,
 'ألبوم فاخر A3 ١٢ صفحة + ميني', true,
 'الباقة الاحترافية الشاملة — فيديو سينمائي كامل، ألبوم A3 فاخر، وجلسة تحضيرات العروس.',
 array[
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
 ],
 'فاخر', false, true, 50, array['second-photog','video-full','bridal-prep','album-upgrade']::text[]),

-- ── 6. ATEMA Couture — 19,500 SAR — الأفخم ───────────────────────────────────
(6, 'ATEMA Couture', 'ATEMA Couture', 19500, 8, 700,
 'ألبوم فاخر A3 ٢٠ صفحة + ميني + لوحة جدارية', true,
 'تجربة الفخامة الكاملة — كل تفاصيل اليوم بتوقيع كوتور حصري، من الحناء إلى الحفل.',
 array[
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
 ],
 'الأفخم', true, true, 60, array['second-photog','video-full','bridal-prep','album-upgrade','henna','kosha']::text[])

on conflict (id) do update set
  name_ar            = excluded.name_ar,
  name_en            = excluded.name_en,
  price              = excluded.price,
  duration_hours     = excluded.duration_hours,
  edited_photos      = excluded.edited_photos,
  album              = excluded.album,
  video              = excluded.video,
  description        = excluded.description,
  features           = excluded.features,
  badge              = excluded.badge,
  is_popular         = excluded.is_popular,
  active             = excluded.active,
  sort_order         = excluded.sort_order,
  included_addon_ids = excluded.included_addon_ids;

-- Hide (don't delete) any legacy packages with ids > 6 so they vanish from the
-- catalogue and admin grid but stay attached to historical bookings.
update public.packages
   set active = false, sort_order = 9999
 where id > 6;

-- Re-sync the SERIAL sequence so future auto-id inserts via the admin panel
-- don't collide with the explicit ids we just upserted.
select setval(
  pg_get_serial_sequence('public.packages', 'id'),
  greatest((select coalesce(max(id), 0) from public.packages), 6)
);

-- ─── 3. Verify ───────────────────────────────────────────────────────────────
-- Quick sanity output (will appear in the SQL editor result pane).
select '— Active packages —' as section;
select id, name_ar, price, duration_hours, badge, sort_order
  from public.packages where active order by sort_order;
select '— Deactivated legacy packages (preserved for booking history) —' as section;
select id, name_ar, price from public.packages where not active order by id;
select '— Add-ons —' as section;
select id, name_ar, price from public.addons order by sort_order;
