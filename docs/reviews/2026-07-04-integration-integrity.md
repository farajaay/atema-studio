# ATEMA Studio - W3 Integration Integrity Pass

> **Date:** 2026-07-04
> **Base reviewed:** `master` at `bbd2212` before W3 fixes
> **Scope:** W3 from `docs/plans/integration-2026-07.md`: static gates,
> regression greps, asset audit, local route/media smoke, deploy status check.
> **Live Supabase note:** DB advisor, Edge deployed versions, and real money-path
> smoke were not run because the Supabase migrations workflow is intentionally
> disabled and live operator/test-payment access is outside this local pass.

---

## Result

Local integrity pass is green after W3 fixes.

| Gate | Result |
|---|---|
| `npm run lint` | PASS |
| `npm test` | PASS - 16 files, 141 tests |
| `npm run build` | PASS |
| Local preview smoke | PASS for app shell, `/#/films`, HLS manifest/playlists/posters, orphan noindex |

Production build split confirms the public site shell does not cold-load HLS:
`index-ChApwQRc.js` is the main app chunk, while `FilmsPage-Thny2J7K.js`
contains the films player path and `hls.js`.

---

## Fixes Landed In This Pass

| Finding | Fix |
|---|---|
| ESLint parsed generated HLS `.ts` transport segments as TypeScript. | `eslint.config.js` now ignores `public/videos/hls`. |
| Two Edge helper types used explicit `any`. | Replaced EdgeRuntime casts in `create-booking` / `change-booking`; narrowed the SMTP client message type. |
| `create-booking` still used `Math.random()` for a log trace id. | Replaced with `crypto.getRandomValues` + Crockford base32. No executable `Math.random()` calls remain. |
| July portfolio seed pointed new rows at raw camera `.JPG` files. | `database/seed-portfolio-2026-07.sql` now points at `.optimised.jpg`; added `database/migrations-2026-07-portfolio-optimised-urls.sql` to repair already-applied DBs. |
| New Films thumbnails needed explicit dimensions. | `FilmsPage` and `FilmsManager` poster images now include `width`/`height` from the manifest. |
| New Films admin UI introduced raw hex literals. | Replaced with theme tokens / existing rgba semantics. Focused grep shows no raw hex in the new Films files. |

---

## Regression Greps

- `Math.random`: executable calls removed; only historical comments remain.
- `dangerouslySetInnerHTML`: still limited to legal-copy constants
  (`PolicyPage`, `BookingPage`) and JSON-LD (`JournalPostPage`).
- `bookings` table access: public calendar still uses `public_booked_dates`.
  Direct `bookings` calls found are admin services, Edge Functions, or existing
  post-booking bank-transfer status write.
- Raw hex: legacy semantic/status colors remain in older admin surfaces and
  token maps; no new raw hex remains in `FilmsPage` or `FilmsManager`.

---

## Asset And Route Smoke

Local `vite preview` on the built `dist/` bundle:

- `/#/films` returned the app shell.
- `/videos/hls/manifest.json` returned 19 manifest entries.
- Every manifest `hls` and `poster` path exists under `public/`.
- Every manifest entry has width, height, and duration.
- `clip-03` intentionally reuses `clip-02` stream/poster because
  `duplicateOf: "clip-02"`.
- `clip-01` master playlist and all three rung playlists (`360p`, `540p`,
  `720p`) returned 200.
- `clip-01/poster.jpg` returned 200 image/jpeg.
- No video preload link tags were found. The player uses `preload="metadata"`.
- Film thumbnails are lazy + async and now dimensioned.
- `public/atema-motion-review-f7c9a2.html` still returns 200 and contains
  `noindex`.

GitHub Actions status before this W3 commit:

- Latest `Deploy to GitHub Pages` run for `bbd2212` succeeded.
- Latest `pages-build-deployment` run succeeded.
- Supabase migrations workflow remains disabled by `if: ${{ false }}`.

---

## Not Covered Locally

These remain operator/live checks, not code blockers:

- Apply and verify live SQL migrations, including:
  `migrations-2026-07-films.sql`,
  `migrations-2026-07-journal-cover-reshuffle.sql`, and
  `migrations-2026-07-portfolio-optimised-urls.sql`.
- Confirm Supabase security advisor/RLS after the live SQL is applied.
- Confirm current deployed Edge Function versions after push, especially
  `create-booking` and `change-booking`.
- Run a test-mode booking narrative through email, WhatsApp/manage link,
  reschedule, OTP package change, top-up payment verification, mood board, and
  album selection.
- Decide whether raw camera files should leave `public/photos/` for an
  untracked archive. The local worktree still contains a large media queue that
  W3 did not stage.
