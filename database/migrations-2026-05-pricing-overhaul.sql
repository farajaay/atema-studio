-- ATEMA STUDIO — Pricing structure overhaul (May 2026)
--
-- Aligns the published price list with the cost model documented in
-- docs/PROFITABILITY.md. Five rules driving these changes:
--   1. Every package with shoot duration > 2 hours now factors in the cost
--      of a second photographer (assistant) at 110 SAR/hr.
--   2. Printing (album + extras) marked up by 25% over supplier cost.
--   3. Videography priced as (shoot_hours × 450 SAR/hr × 1.50) — i.e.
--      videographer cost + 50% margin. Closes the loss vector that made
--      Royal/Signature net-negative under the previous prices
--      (see PROFITABILITY.md §4, "the videographer fee is the real margin
--      killer").
--   4. Customise tier deactivated — it overlapped Engagement at a price
--      point the studio could not sustain. Honours "keep cheap options to
--      a minimum" from the owner brief.
--   5. Owner labour at 150 SAR/hr is factored in across all tiers — the
--      P&L engine in src/services/pl/engine.ts will now show positive
--      trueProfit across the full catalogue (was negative on 5 of 6).
--
-- Idempotent. Run AFTER seed-packages-2026-05.sql.
-- Preserves booking history — existing bookings keep their FK reference
-- to whatever package_id they were created with, including the now-hidden
-- Customise tier.
--
-- Per CLAUDE.md §4.3: never edit schema or seed retroactively; add a
-- topic-scoped migration instead. This is that migration.

begin;

-- ─── 1. ENGAGEMENT (id=1) — 1,800 → 2,500 SAR ────────────────────────────────
-- 2h shoot, no assistant (=2h threshold), no album, no video.
-- Cost model: 10.8 owner-hours × 150 = 1,620 + 80 storage + 184 overhead = 1,884.
-- 2,500 price → +25% margin over fully-loaded cost. Was structurally negative.
update public.packages set
  price = 2500,
  description = 'جلسة خطوبة رومانسية بأسلوب راقٍ — مثالية لإعلان البداية.',
  features = array[
    'ساعتان من التصوير الاحترافي',
    '٣٠ صورة معدّلة بعناية',
    'اختيار أجمل اللقطات',
    'وحدة تخزين باسم العروسين',
    'تصميم Save the Date رقمي هدية'
  ]
where id = 1;

-- ─── 2. CUSTOMISE (id=2) — deactivated ───────────────────────────────────────
-- Overlapped Engagement at a non-viable 2,200 SAR price point. Bookings
-- already pointing at id=2 keep their FK; the tier just disappears from
-- the public catalogue and admin grid.
update public.packages set
  active = false,
  sort_order = 9998,
  badge = NULL,
  is_popular = false
where id = 2;

-- ─── 3. CLASSIC (id=3) — 4,200 → 5,200 SAR ───────────────────────────────────
-- 4h shoot, assistant required (>2h), A4 album 15pg, no video.
-- Cost: 20.6 owner-hr × 150 = 3,090 + assistant 4×110 = 440 + printing
--       (450 base + 5×45 extra pages = 675) × 1.25 = 844 + storage 80
--       + overhead 184 = 4,638. Price 5,200 → +12% margin.
update public.packages set
  price = 5200,
  description = 'الباقة المثالية للمناسبات الخاصة — ألبوم فاخر وذكريات تبقى، بفريق نسائي كامل.',
  features = array[
    '٤ ساعات تغطية شاملة للحفل',
    'مصوّرة رئيسية + مساعدة (فريق نسائي)',
    'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
    '٥ صور عائلية معدّلة',
    'وحدة تخزين بجميع الصور المعدّلة'
  ]
where id = 3;

-- ─── 4. ROYAL (id=4) — 6,900 → 10,500 SAR ────────────────────────────────────
-- 5h shoot, assistant, A4 album + mini, short cinematic video (5h coverage).
-- Cost: 29.5 owner-hr × 150 = 4,425 + assistant 5×110 = 550
--       + printing (675 + 200 mini) × 1.25 = 1,094 + video 5×450×1.5 = 3,375
--       + storage 80 + overhead 184 = 9,708. Price 10,500 → +8% margin.
-- Video premium is the structural fix: previous price (6,900) carried the
-- video at cost only, producing -819 true profit per PROFITABILITY.md §4.
update public.packages set
  price = 10500,
  description = 'تجربة تصوير ملكية مع فيديو سينمائي قصير وألبومين فاخرين — الأكثر طلباً.',
  features = array[
    '٥ ساعات تغطية شاملة للحفل',
    'مصوّرة رئيسية + مساعدة (فريق نسائي)',
    'فيديو سينمائي قصير (٣–٥ دقائق)',
    'ألبوم A4 بـ ١٥ صفحة — طباعة فاخرة',
    'ميني ألبوم عائلي',
    'وحدة تخزين باسم العروسين',
    'معاينة في نفس اليوم (٥ صور مختارة)'
  ]
where id = 4;

-- ─── 5. SIGNATURE (id=5) — 8,500 → 12,500 SAR ────────────────────────────────
-- 6h shoot, assistant, A3 album 12pg + mini, full cinematic video (6h),
-- bridal-prep session.
-- Cost: 33.9 owner-hr × 150 = 5,085 + assistant 6×110 = 660
--       + printing (700 + 200 mini) × 1.25 = 1,125 + video 6×450×1.5 = 4,050
--       + storage 80 + overhead 184 = 11,184. Price 12,500 → +12% margin.
update public.packages set
  price = 12500,
  description = 'الباقة الاحترافية الشاملة — فيديو سينمائي كامل، ألبوم A3 فاخر، وجلسة تحضيرات العروس.',
  features = array[
    '٦ ساعات تغطية شاملة للحفل',
    'مصوّرة رئيسية + مساعدة (فريق نسائي)',
    'فيديو سينمائي كامل',
    'جلسة تصوير تحضيرات العروس',
    'ألبوم فاخر A3 بـ ١٢ صفحة',
    'ميني ألبوم عائلي',
    'وحدة تخزين منقوشة بالاسم',
    'معاينة في نفس اليوم (٥ صور مختارة)'
  ]
where id = 5;

-- ─── 6. ATEMA COUTURE (id=6) — 14,000 → 19,500 SAR ───────────────────────────
-- 8h main event + 4h henna, assistant, A3 20pg + mini + framed wall art,
-- full cinematic video (12h total coverage).
-- Cost: 44 owner-hr × 150 = 6,600 + assistant 8×110 = 880
--       + printing (700 + 8×45 = 1,060 + 200 mini + 600 wall art = 1,860) × 1.25 = 2,325
--       + video 12×450×1.5 = 8,100 + storage 80 + overhead 184 = 18,169.
--       Price 19,500 → +7% margin.
update public.packages set
  price = 19500,
  description = 'تجربة الفخامة الكاملة — كل تفاصيل اليوم بتوقيع كوتور حصري، من الحناء إلى الحفل.',
  features = array[
    'تغطية شاملة كاملة للحفل (٨ ساعات)',
    'مصوّرة رئيسية + مساعدة (فريق نسائي)',
    'فيديو سينمائي فاخر — تغطية كاملة + ليلة الحناء',
    'جلسة تحضيرات العروس',
    'تغطية ليلة الحناء',
    'ألبوم فاخر A3 بـ ٢٠ صفحة',
    'ميني ألبوم فاخر',
    'لوحة جدارية فنية مؤطرة',
    'وحدة تخزين فاخرة بالاسم',
    'معاينة في نفس اليوم (١٠ صور مختارة)',
    'خدمة عملاء ومتابعة خاصة'
  ]
where id = 6;

-- ─── 7. Add-on price tune (extra hour reflects new assistant rule) ───────────
-- An extra hour now includes the assistant's hour too (the package already
-- triggered the >2h assistant rule, so each extra hour adds 110 SAR of
-- assistant time on top of the owner's labour).
-- Old: 700 SAR/extra-hour (owner labour + small margin only)
-- New: 900 SAR/extra-hour = owner 2.4×150 ≈ 360 edit + 150 onsite
--      + 110 assistant + 25% margin ≈ 900
update public.addons set price = 900
where id = 'extra-hour';

-- Video add-ons (when added to Classic) follow the 50% rule:
-- short = 5h × 450 × 1.5 = 3,375 → round to 3,400
-- full  = 7h × 450 × 1.5 = 4,725 → round to 4,800
update public.addons set price = 3400 where id = 'video-short';
update public.addons set price = 4800 where id = 'video-full';

-- Album upgrade and extra pages already match the 25% printing rule (price
-- differential between A4 base 450 and A3 base 700 = 250; × 1.25 = 313;
-- existing 800 SAR upgrade is conservative — leave as-is to preserve UX).

commit;

-- ─── 8. Verify ───────────────────────────────────────────────────────────────
select '— New active price list —' as section;
select id, name_ar, price, duration_hours, badge, is_popular, sort_order
  from public.packages
 where active
 order by sort_order;

select '— Deactivated / legacy (preserved for FK history) —' as section;
select id, name_ar, price, active
  from public.packages
 where not active
 order by id;

select '— Add-ons updated —' as section;
select id, name_ar, price
  from public.addons
 where id in ('extra-hour','video-short','video-full')
 order by sort_order;
