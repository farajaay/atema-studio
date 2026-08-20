-- ============================================================
-- ATEMA STUDIO — Enable RLS on the three legacy orphan tables
-- ============================================================
-- Fixes the Supabase security advisor warning that fired on
-- 2026-08-17 and was emailed 2026-08-18:
--   "rls_disabled_in_public" — Table publicly accessible: anyone
--   with the project URL can read, edit and delete all data in
--   this table because Row-Level Security is not enabled.
--
-- Root cause (traced 2026-08-20):
--   migrations-2026-05-repair-audit.sql:222-224 explicitly runs
--       ALTER TABLE public.booking_addons  DISABLE ROW LEVEL SECURITY;
--       ALTER TABLE public.profit_reports  DISABLE ROW LEVEL SECURITY;
--       ALTER TABLE public.system_logs     DISABLE ROW LEVEL SECURITY;
--   and nothing since turns it back on. That May file's comment
--   ("the live admin code reads these directly") describes a
--   codebase that no longer exists.
--
--   migrations-2026-06-rls-remaining.sql was written to undo
--   exactly this damage — its header names the same advisor — but
--   it only covered packages, addons, payments and whatsapp_logs.
--   These three were missed. The same DISABLE block is mirrored in
--   the generated bundle-existing-db.sql:2343-2345.
--
-- Why lock down rather than drop:
--   All three are LEGACY tables that pre-date this repo — no
--   CREATE TABLE for them exists anywhere in database/, and no
--   code in src/ or supabase/ reads or writes them (the only
--   .from('…') targets in src/services + src/hooks are the 21
--   documented tables). They are almost certainly dead, but their
--   row counts are not visible from the repo, so this migration is
--   deliberately non-destructive. Dropping them is a separate,
--   later call once the owner confirms they hold nothing.
--
-- Shape: one authenticated full-access policy each, mirroring the
-- payments / whatsapp_logs treatment in rls-remaining.sql:44-60.
-- No anon policy — nothing public reads these, and the Edge
-- Functions run as service_role, which bypasses RLS entirely.
--
-- Each table is guarded by to_regclass() so the file still applies
-- cleanly if one was already dropped by hand.
--
-- Safe to re-run (idempotent).
-- Run AS service_role (the Supabase SQL editor already does).
-- ============================================================

BEGIN;

-- ── booking_addons ──────────────────────────────────────────
do $legacy_ba$
begin
  if to_regclass('public.booking_addons') is null then
    raise notice 'skipped: public.booking_addons does not exist (already dropped?)';
  else
    execute $$alter table public.booking_addons enable row level security$$;
    execute $$drop policy if exists "Authenticated full access — booking_addons"
               on public.booking_addons$$;
    execute $$create policy "Authenticated full access — booking_addons"
               on public.booking_addons for all
               to authenticated
               using (true) with check (true)$$;
  end if;
end
$legacy_ba$;

-- ── profit_reports ──────────────────────────────────────────
do $legacy_pr$
begin
  if to_regclass('public.profit_reports') is null then
    raise notice 'skipped: public.profit_reports does not exist (already dropped?)';
  else
    execute $$alter table public.profit_reports enable row level security$$;
    execute $$drop policy if exists "Authenticated full access — profit_reports"
               on public.profit_reports$$;
    execute $$create policy "Authenticated full access — profit_reports"
               on public.profit_reports for all
               to authenticated
               using (true) with check (true)$$;
  end if;
end
$legacy_pr$;

-- ── system_logs ─────────────────────────────────────────────
do $legacy_sl$
begin
  if to_regclass('public.system_logs') is null then
    raise notice 'skipped: public.system_logs does not exist (already dropped?)';
  else
    execute $$alter table public.system_logs enable row level security$$;
    execute $$drop policy if exists "Authenticated full access — system_logs"
               on public.system_logs$$;
    execute $$create policy "Authenticated full access — system_logs"
               on public.system_logs for all
               to authenticated
               using (true) with check (true)$$;
  end if;
end
$legacy_sl$;

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────────
-- Every table in the public schema that still has RLS switched off. This is
-- the same condition the advisor scans for, so the expected result is ZERO
-- ROWS. Anything listed here is a table the repo has never seen — created by
-- hand in the Supabase table editor — and needs a deliberate decision before
-- it is touched. Report it; do not blanket-enable RLS on an unknown table,
-- because a public surface may be reading it.
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false
 order by tablename;

-- Policy check on the three tables this file locks down. Expect exactly one
-- ALL policy per surviving table, granted to {authenticated} and nothing else.
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('booking_addons', 'profit_reports', 'system_logs')
 order by tablename, policyname;
