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

*Last updated: 2026-07-03 (Claude, planning session).*

- `master` is clean and deployed; all Codex asset work (photos, album
  swatches, HLS videos, orphaned review page) is committed.
- Active plan: `docs/plans/integration-2026-07.md`. Nothing from it has been
  executed yet. Execution order and commit shape are in its §4.
- Known suspect to fix during the integrity pass: portfolio seed
  `seed-portfolio-2026-07.sql` points at raw multi-MB `.JPG`s instead of the
  optimised pairs (plan §3.2).
- Orphaned video review page (`public/atema-motion-review-f7c9a2.html`) stays
  until the `/films` page ships and the owner approves curated titles.

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
