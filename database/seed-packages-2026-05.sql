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
  ('extra-hour',     'ساعة تصوير إضافية',                       'Extra photo hour',                         700,  true, 10),
  ('video-short',    'فيديو سينمائي قصير (إضافة للكلاسيكية)',    'Short cinematic video (Classic add-on)',  2200,  true, 20),
  ('video-full',     'فيديو سينمائي كامل (إضافة للكلاسيكية)',    'Full cinematic video (Classic add-on)',   3200,  true, 30),
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

-- ── 1. Engagement Session — 2,400 SAR ────────────────────────────────────────
(1, 'باقة الخطوبة', 'Engagement Session', 2400, 2, 30,
 NULL, false,
 'جلسة خطوبة رومانسية بأسلوب راقٍ — مثالية لإعلان البداية.',
 array[
   'ساعتان من التصوير الاحترافي',
   '٣٠ صورة معدّلة بعناية',
   'اختيار أجمل اللقطات',
   'وحدة تخزين باسم العروسين',
   'تصميم Save the Date رقمي هدية'
 ],
 NULL, false, true, 10, array[]::text[]),

-- ── 2. Base — 1,800 SAR — Customise-tab foundation, HIDDEN from Ready Packages ─
-- The booking page picks the cheapest active package as the "design your own"
-- starting point and filters it out of the Ready Packages grid + comparison
-- view (see src/pages/BookingPage.tsx — predefinedPackages). This row must
-- therefore stay the lowest-priced active package; renaming Engagement to
-- 2,400 SAR above ensures Base (1,800) remains the cheapest.
(2, 'الباقة الأساسية', 'Base', 1800, 2, 30,
 NULL, false,
 'الأساس الذي تُبنى عليه باقتك المخصّصة — اختاري الإضافات حسب يومك.',
 array[
   'ساعتان من التصوير',
   '٣٠ صورة معدّلة',
   'وحدة تخزين رقمية',
   'أساس مرن لإضافة ما تشائين'
 ],
 'الأساسي', false, true, 5, array[]::text[]),

-- ── 3. Classic — 4,200 SAR ───────────────────────────────────────────────────
(3, 'الباقة الكلاسيكية', 'Classic', 4200, 4, 300,
 'ألبوم A4 ١٥ صفحة', false,
 'الباقة المثالية للمناسبات الخاصة — ألبوم فاخر وذكريات تبقى.',
 array[
   '٤ ساعات تغطية شاملة للحفل',
   'ألبوم A4 بـ ١٥ صفحة',
   '٥ صور عائلية معدّلة',
   'وحدة تخزين بجميع الصور المعدّلة'
 ],
 NULL, false, true, 30, array[]::text[]),

-- ── 4. Royal — 6,900 SAR — الأكثر طلباً ──────────────────────────────────────
(4, 'الباقة الملكية', 'Royal', 6900, 5, 400,
 'ألبوم A4 + ميني ألبوم', true,
 'تجربة تصوير ملكية مع فيديو سينمائي قصير وألبومين فاخرين.',
 array[
   '٥ ساعات تغطية شاملة للحفل',
   'فيديو سينمائي قصير (٣–٥ دقائق)',
   'ألبوم A4 بـ ١٥ صفحة',
   'ميني ألبوم عائلي',
   'وحدة تخزين باسم العروسين',
   'معاينة في نفس اليوم (٥ صور مختارة)'
 ],
 'الأكثر طلباً', true, true, 40, array[]::text[]),

-- ── 5. Signature — 8,500 SAR ─────────────────────────────────────────────────
(5, 'باقة التوقيع', 'Signature', 8500, 6, 500,
 'ألبوم فاخر A3 ١٢ صفحة + ميني', true,
 'الباقة الاحترافية الشاملة — فيديو سينمائي كامل وألبوم A3 فاخر.',
 array[
   '٦ ساعات تغطية شاملة للحفل',
   'فيديو سينمائي كامل',
   'جلسة تصوير تحضيرات العروس',
   'ألبوم فاخر A3 بـ ١٢ صفحة',
   'ميني ألبوم عائلي',
   'وحدة تخزين منقوشة بالاسم',
   'معاينة في نفس اليوم (٥ صور مختارة)'
 ],
 'فاخر', false, true, 50, array[]::text[]),

-- ── 6. ATEMA Couture — 14,000 SAR — الأفخم ───────────────────────────────────
(6, 'ATEMA Couture', 'ATEMA Couture', 14000, 8, 700,
 'ألبوم فاخر A3 ٢٠ صفحة + ميني + لوحة جدارية', true,
 'تجربة الفخامة الكاملة — كل تفاصيل اليوم بتوقيع كوتور حصري.',
 array[
   'تغطية شاملة كاملة للحفل',
   'فيديو سينمائي فاخر',
   'جلسة تحضيرات العروس',
   'تغطية ليلة الحناء',
   'ألبوم فاخر A3 بـ ٢٠ صفحة',
   'ميني ألبوم فاخر',
   'لوحة جدارية فنية مؤطرة',
   'وحدة تخزين فاخرة بالاسم',
   'معاينة في نفس اليوم (١٠ صور مختارة)',
   'خدمة عملاء ومتابعة خاصة'
 ],
 'الأفخم', true, true, 60, array[]::text[])

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
