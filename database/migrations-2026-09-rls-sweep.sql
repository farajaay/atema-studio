-- ============================================================
-- ATEMA STUDIO — Row-Level Security sweep (September 2026)
-- ============================================================
-- Silences the Supabase security advisor finding:
--
--   "Table publicly accessible — anyone with your project URL can read,
--    edit, and delete all data in this table because Row-Level Security
--    is not enabled."   (advisor code: rls_disabled_in_public)
--
-- WHY A SWEEP AND NOT A NAMED TABLE
-- Every table the repo creates already ships an `enable row level
-- security` line in its own migration. A table can still show up bare in
-- production for two reasons we have hit before:
--   • it was created by hand in the Supabase UI and never round-tripped
--     into `database/` (exactly how `contracts` / `invoices` got their
--     anon PII leak — see migrations-2026-06-documents.sql);
--   • its migration was never applied, or was applied from an older copy
--     that predated the RLS clause.
-- So instead of naming one table, this migration asserts the invariant:
-- **no base table in `public` may sit without RLS.** Re-run it after any
-- hand-made table and the advisor goes quiet again.
--
-- ORDER OF OPERATIONS (this matters)
--   1. Report what is bare BEFORE we touch anything — that line in the
--      run output is the answer to "which table was the advisor angry
--      about?", and it is gone the moment step 3 runs.
--   2. Re-assert anon SELECT on the eight public-read surfaces, so that
--      switching RLS on can never dark the catalogue, the portfolio, the
--      journal, the films or the album covers for a visitor.
--   3. Enable RLS on every remaining base table in `public`.
--   4. Report the after-state, and flag every table that ended up
--      RLS-on-with-no-policies (= service-role only). That is the safe
--      default for an internal table and a bug for a customer-facing one,
--      so it is printed, not guessed at.
--
-- RLS is enabled, never FORCEd: the Edge Functions talk to these tables
-- with the service-role key and must keep bypassing policy.
--
-- Idempotent — safe to re-run.
-- ============================================================

begin;

-- ─── 1. Before: what the advisor is seeing right now ─────────────────────────
select '— tables WITHOUT RLS (before) —' as section;
select c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and not c.relrowsecurity
 order by c.relname;

-- ─── 2. Keep the public surfaces public ──────────────────────────────────────
-- These eight are read by anonymous visitors. Each already carries a read
-- policy from its own migration; this block is the safety net for a project
-- where one of those migrations never landed. It only writes when no
-- anon-visible SELECT policy exists, so a narrower existing policy
-- (e.g. album_designs' "active only") is left exactly as it is.
do $$
declare
  t           text;
  public_read constant text[] := array[
    'packages',       -- booking catalogue
    'addons',
    'portfolio_items',
    'journal_posts',
    'film_entries',
    'album_designs',
    'app_settings',   -- theme + feature flags, read before first paint
    'blocked_dates'   -- calendar availability
  ];
begin
  foreach t in array public_read loop
    if to_regclass('public.' || t) is null then
      raise notice 'rls-sweep: % absent, skipping', t;
      continue;
    end if;

    if not exists (
      select 1
        from pg_policies p
       where p.schemaname = 'public'
         and p.tablename  = t
         and p.cmd in ('SELECT', 'ALL')
         and (p.roles::text[] && array['anon', 'public'])
    ) then
      execute format(
        'create policy %I on public.%I for select to anon using (true)',
        t || '_public_read', t
      );
      raise notice 'rls-sweep: restored anon SELECT on %', t;
    end if;
  end loop;
end $$;

-- ─── 3. The sweep ────────────────────────────────────────────────────────────
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n2 on n2.oid = c.relnamespace
     where n2.nspname = 'public'
       and c.relkind  = 'r'
       and not c.relrowsecurity
     order by c.relname
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    raise notice 'rls-sweep: RLS enabled on %', r.relname;
    n := n + 1;
  end loop;

  raise notice 'rls-sweep: % table(s) hardened', n;
end $$;

commit;

-- ─── 4. After: the invariant, stated ─────────────────────────────────────────
select '— tables WITHOUT RLS (after — expect zero rows) —' as section;
select c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and not c.relrowsecurity
 order by c.relname;

-- Locked to service-role only. Correct for booking_otps, the notification
-- dedupe guards and anything internal; a red flag for a table a visitor or
-- the admin panel is supposed to read. Review anything unexpected here.
select '— RLS on, but NO policies (service-role only) —' as section;
select c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and c.relrowsecurity
   and not exists (
     select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
   )
 order by c.relname;

-- The catalogue, read back. This file writes no data — there is not one
-- INSERT / UPDATE / DELETE in it, and the single-file workflow path never
-- touches the SEEDS array — so a price cannot move here. Printing the
-- fingerprint makes that checkable instead of merely asserted, and doubles as
-- proof the hardening left `packages` readable. The sweep sits last in the
-- manifest, so the catalogue exists by the time this runs.
select '— catalogue fingerprint (read-only — prices must be unchanged) —' as section;
select id, name_en, price, active, sort_order
  from public.packages
 order by id;

select '— full policy map —' as section;
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
 order by tablename, cmd, policyname;

-- ─── 5. The one result set the Management API hands back ─────────────────────
-- The individual SELECTs above are for a human pasting this file into the
-- Supabase SQL editor, which shows every statement's rows. The
-- `/database/query` endpoint the GitHub Action posts to returns ONLY the last
-- statement, so the four checks are unioned here — otherwise a CI run reports
-- "applied" and shows nothing but the policy map.
select ord, check_name, detail
  from (
    -- 1 · the invariant itself
    select 1 as ord,
           'A · table WITHOUT RLS (expect none)' as check_name,
           c.relname::text as detail
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

    union all
    -- 2 · locked to service-role: right for the internal tables, a red flag
    --     for anything a visitor or the admin panel reads
    select 2,
           'B · RLS on, no policies (service-role only)',
           c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and not exists (
         select 1 from pg_policies p
          where p.schemaname = 'public' and p.tablename = c.relname
       )

    union all
    -- 3 · prices, read back — this file contains no INSERT/UPDATE/DELETE, and
    --     the single-file workflow path never touches the seeds, so nothing
    --     here can move a price. This makes that checkable.
    select 3,
           'C · catalogue price (must match the admin panel)',
           pk.id::text || ' · ' || coalesce(pk.name_en, '?') || ' · '
             || to_char(pk.price, 'FM999G999D00') || ' SAR · active='
             || coalesce(pk.active::text, 'null')
      from public.packages pk

    union all
    -- 4 · the public site can still read what it must
    select 4,
           'D · anon-readable surface',
           p.tablename::text || ' :: ' || p.policyname::text
      from pg_policies p
     where p.schemaname = 'public'
       and p.cmd in ('SELECT', 'ALL')
       and (p.roles::text[] && array['anon', 'public'])
  ) checks
 order by ord, detail;
