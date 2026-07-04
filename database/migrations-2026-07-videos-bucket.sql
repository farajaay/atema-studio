-- ATEMA STUDIO — public Storage bucket for the film streams (July 2026).
--
-- The HLS ladders (~200 MB) are moving OFF the GitHub Pages payload: their
-- size made GitHub's own pages-build-deployment step fail intermittently
-- ("Deployment failed, try again later" during syncing_files), stalling
-- every site deploy behind manual re-runs.
--
-- Same folder shape as the repo (videos/hls/<clip>/…), so only the base URL
-- changes. The frontend loads Storage first and falls back to the repo copy
-- (src/services/films.ts), so this can be applied and populated with zero
-- downtime. Populate with .github/workflows/supabase-videos-sync.yml, then
-- delete public/videos/ from the repo.
--
-- A public bucket serves objects at /storage/v1/object/public/videos/…
-- without any RLS policy on storage.objects — nothing else to grant.
-- Idempotent — safe to re-run.

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do update set public = true;
