-- ATEMA STUDIO — 2026-09 add-on catalogue cleanup
--
-- The live `addons` table had drifted badly from both the repo and itself.
-- The 2026-09-18 snapshot (database/backups/catalogue-2026-09-18.sql) showed:
--
--   · `second-photog` — the original "مصور ثانٍ" row — had been renamed in
--     Arabic to «مصورة فيديو» (a different service entirely) while its English
--     name still read "Second photographer", then deactivated. Meanwhile a new
--     active row `second-photographer` («مصورة ثانية», 1,200) was created.
--     All four mid/upper packages still listed the DEAD id in
--     `included_addon_ids` — which is the list that HIDES an add-on from the
--     booking page as "already included". Hiding a row that is already
--     invisible does nothing, so the live «مصورة ثانية» showed up as a paid
--     upsell on packages whose own feature list promises a female crew.
--
--   · Six more rows sat deactivated as superseded attempts at services that
--     an active row already covers (express-48h → express-24h, photo-pack-50
--     → photo-pack-10, videography → video-short/video-full, same-day-preview
--     → nothing sells it any more).
--
--   · A second boolean column, `is_active`, exists in production only (never
--     in database/schema.sql) and CONTRADICTED `active` on seven rows. No code
--     in this repo reads `is_active` — `useAddonsData.ts` filters on
--     `.eq('active', true)` — so anything toggled through a surface that wrote
--     `is_active` had no effect on the site.
--
-- OWNER DECISIONS (2026-09-18) encoded here:
--   1. «مصورة ثانية» is a PAID ADD-ON, not included in الكلاسيكية or any tier.
--      → the dead id is stripped from every bundle, and `second-photographer`
--        is deliberately NOT added to any. An «مساعدة» (assistant) in a
--        package's feature list is not the same service as a second
--        photographer, so no copy changes.
--   2. An add-on not enabled in any package → delete it completely.
--   3. The retired experiments whose intent an existing active option already
--      covers → delete them.
--
-- WHAT IS DELIBERATELY KEPT:
--   · `kosha` — active and sellable; it IS the "القاعة وما حوته" option
--     (تصوير القاعة والضيافة قبل الحفل), alongside `pre-wedding-mini` for the
--     pre-wedding session. Only its contradictory is_active flag is fixed.
--   · `save-date` — inactive, but still bundled into باقة الخطوبة, whose
--     features promise it as a gift. It is enabled in a package, so rule 2
--     does not reach it.
--
-- SAFETY: the DELETE carries its own guard — an add-on is removed only when
-- NO booking references it in `addon_ids` and no package still bundles it.
-- Historical bookings keep their line items, so regenerating an old contract
-- or invoice (src/services/documents.ts looks add-ons up by id) can never
-- silently lose a service the bride actually paid for. Anything blocked is
-- reported below and simply survives.
--
-- Idempotent — safe to re-run.

-- ── 1. What the bundles look like BEFORE ─────────────────────────────────
select 'before' as stage, id, name_ar, included_addon_ids
  from public.packages
 order by sort_order, id;

-- ── 2. Strip the dead id from every package bundle ───────────────────────
update public.packages
   set included_addon_ids = array_remove(included_addon_ids, 'second-photog')
 where 'second-photog' = any(included_addon_ids);

-- ── 3. Name the rows that CANNOT be deleted, and why ─────────────────────
-- (Reported rather than force-deleted: a booking that bought the service is
--  a record, not drift.)
select 'blocked' as stage,
       a.id,
       a.name_ar,
       (select count(*) from public.bookings b where a.id = any(b.addon_ids))     as bookings_using_it,
       (select count(*) from public.packages p where a.id = any(p.included_addon_ids)) as packages_bundling_it
  from public.addons a
 where a.id in ('second-photog','express-48h','photo-pack-50','same-day-preview','videography')
   and (exists (select 1 from public.bookings b where a.id = any(b.addon_ids))
        or exists (select 1 from public.packages p where a.id = any(p.included_addon_ids)));

-- ── 4. Retire the superseded rows ────────────────────────────────────────
delete from public.addons a
 where a.id in ('second-photog','express-48h','photo-pack-50','same-day-preview','videography')
   and not exists (select 1 from public.bookings b where a.id = any(b.addon_ids))
   and not exists (select 1 from public.packages p where a.id = any(p.included_addon_ids));

-- ── 5. Stop the two boolean columns contradicting each other ─────────────
-- `active` is the one the site reads; `is_active` is a production-only
-- leftover. Rather than drop a column something outside this repo may still
-- write, make it agree with `active` and document which one wins.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'addons' and column_name = 'is_active'
  ) then
    execute 'update public.addons set is_active = active where is_active is distinct from active';
    execute $c$comment on column public.addons.is_active is
      'IGNORED BY THE APPLICATION. The site reads public.addons.active only (src/hooks/useAddonsData.ts filters .eq(''active'', true)). Kept in sync with active by migrations-2026-09-addons-cleanup.sql; do not gate anything on this column.'$c$;
  end if;
end$$;

-- ── 6. The catalogue as it now stands ────────────────────────────────────
select 'after' as stage, id, name_ar, name_en, active, price, sort_order
  from public.addons
 order by active desc, sort_order, id;

select 'bundles' as stage, id, name_ar, included_addon_ids
  from public.packages
 order by sort_order, id;
