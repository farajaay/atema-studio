-- ATEMA STUDIO — "Design Your Package" base separation (May 2026)
--
-- Before: the "Design Your Package" tab in BookingPage reused the cheapest
-- active package (Engagement Session) as its base. This conflated two
-- distinct customer journeys:
--   • Engagement Session = a fixed, complete 2h package with curated features
--   • Design Your Package = a build-your-own flow that needs a MINIMAL,
--     flexible foundation the customer extends with add-ons.
--
-- After: a dedicated row carries `is_custom_base = true`. The Ready
-- Packages tab filters this row out; the Custom tab targets it explicitly.
-- The flag is enforced unique (only one base allowed) via a partial index.
--
-- Idempotent. Run AFTER migrations-2026-05-pricing-overhaul.sql.

begin;

-- ─── 1. Schema: add the flag + uniqueness constraint ─────────────────────────
alter table public.packages
  add column if not exists is_custom_base boolean not null default false;

create unique index if not exists packages_one_custom_base_idx
  on public.packages (is_custom_base)
  where is_custom_base = true;
  -- At most one package can be marked as the custom base. New base swaps
  -- require: UPDATE old SET is_custom_base = false; UPDATE new SET ... = true.

-- ─── 2. Reactivate id=2 (formerly "Customise") as the Custom Foundation ─────
-- 1h shoot, no assistant (under 2h threshold), no album, no video.
-- Cost: 7.4 owner-hr × 150 = 1,110 + 80 storage + 184 overhead = 1,374.
-- Price 1,800 → +31% margin. Intended as the entry point that customers
-- then build on via add-ons (extra hours, video, album, henna, etc.).
update public.packages set
  active             = true,
  is_custom_base     = true,
  name_ar            = 'الأساس المرن',
  name_en            = 'Custom Foundation',
  price              = 1800,
  duration_hours     = 1,
  edited_photos      = 20,
  album              = null,
  video              = false,
  badge              = null,
  is_popular         = false,
  sort_order         = 0,  -- sorts above everything else if ever shown in a list
  description        = 'الأساس المرن لباقتك المخصّصة — ابدئي من هنا وأضيفي ما يلائم مناسبتك.',
  features           = array[
    'ساعة واحدة من التصوير الاحترافي',
    '٢٠ صورة معدّلة',
    'وحدة تخزين رقمية',
    'أضيفي ساعات، فيديو، ألبوم، أو ليلة الحناء حسب احتياجك'
  ],
  features_en        = array[
    '1 hour of professional photography',
    '20 edited photos',
    'Digital storage',
    'Add hours, video, album, or henna night as you need'
  ]
where id = 2;

-- Belt-and-braces: make sure no other row claims is_custom_base = true.
update public.packages
   set is_custom_base = false
 where id <> 2 and is_custom_base = true;

commit;

-- ─── 3. Verify ───────────────────────────────────────────────────────────────
select '— Custom base (singleton) —' as section;
select id, name_ar, name_en, price, duration_hours, is_custom_base
  from public.packages where is_custom_base = true;

select '— Ready Packages (Custom tab base excluded) —' as section;
select id, name_ar, price, duration_hours, badge, sort_order
  from public.packages
 where active and not is_custom_base
 order by sort_order;
