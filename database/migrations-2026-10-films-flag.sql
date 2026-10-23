-- ATEMA Studio — admin switch for the public Films page («الأفلام»).
-- Run once (idempotent — ADD COLUMN IF NOT EXISTS).
--
-- films_enabled: when true, /#/films is public and the header + footer show
-- the «الأفلام» link. Defaults to false, which keeps the 2026-07-18 decision
-- (Films hidden) until the owner flips it in «إعدادات النظام».
-- app_settings already has a public SELECT policy, so visitors can read it.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS films_enabled boolean NOT NULL DEFAULT false;
