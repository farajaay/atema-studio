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

*Last updated: 2026-07-04, end of day (Claude → Codex handoff note).*

**Codex — picking up from here, read this instead of scrolling history.**
Everything below is live-verified against production unless marked otherwise.
Your W1/W3 work all held; three of your loose ends were closed, one of your
recommendations was retracted (details below, nothing personal — the facts
moved after your session).

### Where the system stands (launch is days away)

- **All July SQL is applied and live-verified** (album, album-examples,
  films, portfolio-optimised-urls, gallery-image-refresh). RLS spot-checked
  via anon REST: bookings/otps/contracts/invoices/discounts leak nothing.
  All five Edge Functions answer. Owner ran the money-path smoke: reschedule,
  OTP, package change, transfer top-up — all good.
- **Launch decisions locked in code:** transfer-only payments (cards deferred
  behind `VITE_MOYASAR_PUBLISHABLE_KEY` + `MOYASAR_SECRET_KEY`; admin clears
  `topup_amount_due` from the booking modal, gold receivable chip in the
  table) and dual-channel notifications (email ALWAYS via
  `_shared/email-change.ts` + `email-confirmation`/`email-otp`; WhatsApp
  additive behind `app_settings.wa_enabled`, default off; every sender
  guards before entering WA code; change-booking returns `notified:{wa,email}`
  and the manage page words itself from it). OTP consume is an atomic
  conditional update. Tests now 143.
- **Wordmark is Tajawal light** (owner call) — `.atema-wordmark`/`.atema-sub`.
- **Orphan review page deleted** (owner approved the /films wording). The
  6-clip published cut is the owner's curation; unpublished clips stay in
  repo + registry deliberately (weak audio / repeats).
- **Image weight pruned:** 16 unreferenced files gone (Promotion_Mobile +
  B39F4EE0 families, orphan .optimised twins, raw .JPGs whose optimised
  copies are the referenced ones); promo-card recompressed 394→108 KB
  (it is preloaded on first paint). All deletions were checked against code
  refs (incl. BASE-interpolated + derived-webp patterns, photoPool stems)
  AND live DB rows.

### Corrections to your session's artifacts (already committed)

- ⛔ **`migrations-2026-07-journal-cover-reshuffle.sql` is retracted** — your
  W3 report told the operator to apply it, but run after gallery-image-refresh
  it overwrites the refreshed covers (its WHERE matches any /photos/ cover;
  that exact accident happened live). The file header + your report
  (`docs/reviews/2026-07-04-integration-integrity.md`, see Addendum) both say
  do-not-re-run now.
- ⚠ **Your "pages-build-deployment succeeded" observation didn't hold** —
  3 of 4 later ingestions failed on the ~200 MB payload. Mitigation is
  built: films load **Storage-first with repo fallback**
  (`src/services/films.ts`), `migrations-2026-07-videos-bucket.sql` creates
  the public bucket, `.github/workflows/supabase-videos-sync.yml` uploads
  (manifest last, self-verifying). **Owner still has to run those two steps;
  after `/#/films` plays from Storage, delete `public/videos/` (~204 MB) in
  a follow-up commit.** Until then the fallback keeps everything working.
- ⚠ **Your May testimonials placeholder is now a launch blocker:**
  `Testimonials.tsx` ships FICTIONAL named bride quotes (your own
  TODO[CONTENT] comment says so) and it is live on the booking page. Owner
  was told: supply 3 real consented quotes or the carousel gets hidden.
  If you touch this area first, don't ship more placeholder quotes.

### Open items, in priority order

1. Testimonials: real quotes in or carousel out (above).
2. Videos → Storage operator steps, then delete `public/videos/`.
3. Owner retires LAUNCH15 and mints the real launch code.
4. Marketing follow-ups (see `docs/marketing-proposal-2026-05/README.md`
   §"Status re-check — 2026-07-04"): anchor bundle (C2) + 24h pledge (C3)
   await owner words; E2 region-rooted frames need a shoot; paid D1 is NOT
   blocked by Meta (inbound wa.me works without send-approval).
5. Low-priority tracker: L-5 / L-6 / L-9 in `docs/bugs.md`; raw `.jpeg`
   legacy originals (bride-hero.jpeg etc.) are still referenced as
   legacy-matchers only — safe to revisit later, not urgent.

Owner-facing hand-offs generated this session (PDFs, not in the repo): the
Arabic admin guide (from the refreshed `docs/MANUAL.ar.md`), the Arabic
marketing workbook, and a system relationship map.

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
