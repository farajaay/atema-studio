-- ============================================================
-- ATEMA STUDIO — policies for the four legacy admin tables (Sept 2026)
-- ============================================================
-- Companion to migrations-2026-09-rls-sweep.sql. The sweep enabled RLS on
-- every bare table in `public`; its report showed five tables left RLS-on
-- with NO policies, i.e. reachable by the service role alone:
--
--   booking_otps    ← correct, by design (CLAUDE.md §4.9) — leave it
--   booking_addons  ┐
--   profit_reports  ├ legacy admin tables, this file's subject
--   system_logs     │
--   notifications   ┘
--
-- WHERE THEY CAME FROM
-- migrations-2026-05-repair-audit.sql §4 DISABLED RLS on the first three
-- (and dropped the notifications policy in §6) with this reasoning:
--
--   "The live admin code reads these directly with the authenticated
--    session. Enabling RLS without an 'authenticated' policy breaks the
--    admin UI."
--
-- That is the Supabase advisor's `rls_disabled_in_public` finding, sitting
-- in the repo since May, deliberate at the time. The same comment names the
-- correct exit: "If you later want to harden these, do it via a deliberate
-- migration that mirrors the bookings hardening pattern (one authenticated
-- full-access policy + scoped anon SELECT)." This is that migration.
--
-- WHY A POLICY RATHER THAN LEAVING THEM SEALED
-- Nothing in `src/` or `supabase/functions/` reads these four today — the
-- May comment describes an admin surface that has since been rebuilt around
-- bookings + the P&L dashboard's own queries. But "no caller today" is a
-- weaker guarantee than "the admin session can still read it": sealed
-- tables fail silently, returning zero rows to a future admin screen rather
-- than an error anyone would notice. So they get the same shape
-- migrations-2026-06-rls-remaining.sql gave `payments` and `whatsapp_logs`:
-- authenticated (the single admin user) full access, anon nothing.
--
-- Each table is guarded by to_regclass — three of the four exist only in
-- production, never in a from-scratch rebuild, and this must no-op there.
--
-- Idempotent — safe to re-run.
-- ============================================================

do $$
declare
  t      text;
  legacy constant text[] := array[
    'booking_addons',   -- pre-2026-05 line items; superseded by bookings.addons
    'profit_reports',   -- pre-dates the live P&L dashboard
    'system_logs',      -- early audit trail
    'notifications'     -- early in-app notifications, never shipped
  ];
begin
  foreach t in array legacy loop
    if to_regclass('public.' || t) is null then
      raise notice 'legacy-policies: % absent (fresh rebuild), skipping', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I',
                   'Authenticated full access — ' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'Authenticated full access — ' || t, t
    );

    raise notice 'legacy-policies: % is RLS-on with admin access', t;
  end loop;
end $$;

-- ─── Verify (the one result set the Management API returns) ───────────────────
select c.relname::text          as table_name,
       c.relrowsecurity         as rls_enabled,
       coalesce(p.policyname, '(none — service-role only)') as policy,
       coalesce(p.roles::text, '') as roles
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p
    on p.schemaname = 'public' and p.tablename = c.relname
 where n.nspname = 'public'
   and c.relname in ('booking_addons','profit_reports','system_logs',
                     'notifications','booking_otps')
 order by c.relname, policy;
