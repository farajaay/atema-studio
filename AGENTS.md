# AGENTS.md — Cross-Agent Handoff (Claude ⇄ Codex)

> This file exists so any coding agent (Codex, Claude Code, or other) can pick
> up mid-stream when the previous agent's session or usage limits run out.
> **The full working brief is [`CLAUDE.md`](./CLAUDE.md) — read it first; it
> is agent-agnostic despite the name.** This file only adds the live handoff
> state and the rules that keep two agents from stepping on each other.

---

## 1. Read these, in order

1. [`CLAUDE.md`](./CLAUDE.md) — project brief, conventions (theming, i18n,
   security, migrations, commits). **All conventions there are binding for
   every agent.**
2. [`docs/plans/integration-2026-07.md`](./docs/plans/integration-2026-07.md)
   — the **current active plan** (Films page integration, album-cover example
   render, full integrity pass). Status of each workstream is tracked there.
3. [`docs/bugs.md`](./docs/bugs.md) — known-broken vs known-good.
4. `git log --oneline -20` — what actually shipped last.

## 2. Live state (update this section on every handoff)

*Last updated: 2026-07-04 (Claude, live-DB verification + orphan retirement).*

- **Live Supabase verified via anon REST (2026-07-04):** July album +
  album-examples + films migrations are applied (`example_url`/`box_url`
  populated; `film_entries` live with 6 published clips — the owner keeps the
  rest disabled deliberately: weak audio / repetitive takes; assets and
  registry entries stay in the repo).
- **⚠ Two-step SQL fix still owed by the operator, in this order:**
  1. run `migrations-2026-07-portfolio-optimised-urls.sql` (6 portfolio rows
     still point at raw multi-MB `/photos/IMG_*.JPG` files);
  2. re-run `migrations-2026-07-gallery-image-refresh.sql` (its matchers
     expect the `.optimised.jpg` URLs from step 1, and its journal covers
     were clobbered by `journal-cover-reshuffle`, which ran after it).
  **Never re-run `migrations-2026-07-journal-cover-reshuffle.sql`** — it is
  marked superseded in its header.
- **Orphan review surface deleted** (owner approved the Films wording):
  `public/atema-motion-review-f7c9a2.html` + `public/video-review.js` are
  gone; all HLS clips remain, and the admin Films Manager's "sync defaults"
  restores any missing registry rows for toggling.

- **Browser-level verification of `/films` (production build): passed.**
  Driven with headless Chromium against `vite preview`: page renders (RTL,
  chapters, playlist, quality UI), and the full HLS chain works — manifest →
  level playlists → segments, ABR ladder, retries. One caveat for future
  agents: **sandboxed/open-source Chromium builds lack H.264/AAC**
  (`MediaSource.isTypeSupported → false`), so decode fails there with the
  page's "تعذر تشغيل هذا المقطع الآن" note — that is the test environment,
  not a bug; real browsers ship those codecs. Also verified `npm run lint`,
  `npm test` (141/141), `npm run build` on the same tree.

- Latest completed local pass: W3 from `docs/plans/integration-2026-07.md`.
  Report: `docs/reviews/2026-07-04-integration-integrity.md`.
- **W1 (Films page): done.** Public `/#/films` is routed/nav-linked, backed by
  `public/videos/hls/manifest.json`, `src/content/films.ts`, and the
  Supabase-backed admin Films Manager at `/#/admin/films`.
- **W2 (album example render): done.** Photographic mockups are primary
  (`example_url`/`box_url`, migration
  `migrations-2026-07-album-examples.sql`), with `AlbumCoverExample` fallback.
- **W3 (local integrity pass): done.** `npm run lint`, `npm test` (141/141),
  and `npm run build` pass. W3 also fixed the July portfolio seed to use
  optimized images and added
  `database/migrations-2026-07-portfolio-optimised-urls.sql`.
- **Gallery refresh follow-up:** portfolio/journal admin editors now include a
  shared picker from `src/content/photoPool.ts`; the stronger public refresh is
  in `database/migrations-2026-07-gallery-image-refresh.sql`.
- Live/operator follow-ups remain: apply July SQL in Supabase, verify security
  advisor/RLS and Edge Function deployed versions, then run the full test-mode
  booking/payment/capability-link narrative.
- Orphaned video review page (`public/atema-motion-review-f7c9a2.html`) is
  still present and `noindex`. Delete it only after the owner approves the
  curated Films page wording.
- The local worktree may still contain a large unstaged media queue under
  `public/photos/` and raw `public/videos/` sources from the photo/video
  optimizer work. Do not stage those unless the owner explicitly asks.

## 3. Handoff protocol

- **Before starting:** read §2 above and the plan doc's status column; run
  `git status` + `git log -5`. Never rebuild what §0 of the plan marks done.
- **While working:** one feature = one commit, prose-first message, build
  must pass `tsc` (`npm run build`) before committing. Push to the branch you
  were told to use; never force-push `master`/`gh-pages`.
- **Before stopping:** update §2 of this file (and the plan doc's status)
  in your final commit, so the next agent lands on truth, not archaeology.
- **Docs are the source of truth.** If a doc is wrong, fixing it is part of
  the change (CLAUDE.md §7).

## 4. Quick command reference

```bash
npm run dev              # local dev server
npm run build            # tsc gate + vite build (must pass pre-commit)
npm test                 # vitest suites (policy modules + glue tests)
npm run lint             # eslint
node scripts/optimise-images.mjs   # after adding photos to public/photos/
npm run videos:prepare   # ffmpeg → HLS ladders + manifest for new clips
```

Deploys are automatic: push to `master` → `.github/workflows/deploy.yml` →
`gh-pages`. Supabase functions/migrations/secrets ship via the three
`supabase-*.yml` workflows (see `BACKEND_SETUP.md`).
