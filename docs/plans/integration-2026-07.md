# Plan — July 2026 Integration Pass

> **Status:** approved plan, ready to execute. Written 2026-07-03.
> **Scope:** fold the two orphaned Codex deliverables into the site proper —
> (1) the videography surface, (2) the album-cover *example render* — then run
> one full integrity pass over the whole system.
> **Companion:** [`AGENTS.md`](../../AGENTS.md) is the cross-agent handoff
> (Claude ⇄ Codex). Keep both in sync as work lands.

---

## 0. Where we actually are (audit, 2026-07-03)

Verified against `git log` / working tree — **all of the following is already
committed and pushed on `master`. Do not rebuild any of it.**

| Item | State | Evidence |
|---|---|---|
| Photo pool expanded (7 new couture editorials) + optimised | ✅ done | `5e498a1`, `0226d03`, `database/seed-portfolio-2026-07.sql` |
| Album material swatches (10 fabric F-series + 8 leather E/NERO) | ✅ done | `eaff8b7` — `public/photos/album/<code>.jpg/.webp`, `preview_url` seeded in `migrations-2026-07-album.sql` |
| Album-selection feature (admin palette + composer + customer page) | ✅ done | `4098981`, `0f22211` — `/#/album/<token>`, `AlbumDesignsManager`, `AlbumComposer` |
| Video review surface (orphaned, unlinked slug) | ✅ done, **not integrated** | `3879b23`, `f9ca75b`, `f9d9fe1` — `public/atema-motion-review-f7c9a2.html` + `video-review.js` + `public/videos/hls/` (18 clips, 3-rung ladders, ~204 MB) |
| Video prep pipeline | ✅ done | `scripts/prepare-video-streams.mjs` (`npm run videos:prepare`, ffmpeg/ffprobe-static) |
| P0 security: anon SELECT leak on `bookings` closed | ✅ done | `5e6...` (`5e8cf4c`), `1005af9` (definer view for `public_booked_dates`) |
| Email-layer bug sweep (empty attachments, false booking error, OTP dead-end, background OTP send) | ✅ done | `0d2a25b`, `552e0af`, `a65ca8c` |

**What is genuinely outstanding** (this plan):

- **W1** — the video page is reachable only by direct URL; it must become a
  first-class, bilingual, theme-correct site page in the nav.
- **W2** — the selection page shows the 18 material swatches as flat tiles;
  the owner wants a rendered **example album** driven by the picked colour.
- **W3** — one full integrity test across code, assets, DB, and deploy.

---

## 1. W1 — "Films" page: integrate the videography surface

### 1.1 Architecture decision

The orphaned page (`atema-motion-review-f7c9a2.html` + 330-line
`video-review.js` + CDN `hls.js`) was built as a **review** surface — raw
Facetune filenames as titles, quality-debug UI, `noindex`. We do **not**
promote that file. We build a proper React page that consumes the same HLS
assets, and keep the orphan as the owner's private review tool until the new
page ships, then delete it.

**Curation lives in code, not the DB.** Unlike portfolio/journal (owner
uploads at runtime → DB + admin manager), a new film can only enter the site
via `npm run videos:prepare` + a git commit — the assets are repo-static. So a
DB table would be pure ceremony. The curated registry is a content module,
same pattern as `src/content/legal.ts`:

```
src/content/films.ts
  export type Film = {
    id: string;            // = manifest outputId, e.g. 'clip-02'
    title_ar: string;      // Atelier voice — NOT the Facetune filename
    title_en: string;
    caption_ar?: string;
    caption_en?: string;
    category: 'bride' | 'couture' | 'editorial' | 'backstage';
    published: boolean;    // curate the public cut; review page shows all
    order: number;
  }
  export const FILMS: Film[] = [ …18 entries… ]
```

The machine facts (hls url, poster, duration, dimensions, renditions) stay in
`public/videos/hls/manifest.json`; `FilmsPage` fetches it at mount and joins
on `id`. One source of truth per concern: humans edit `films.ts`, ffmpeg
regenerates the manifest.

### 1.2 New files

| File | Purpose |
|---|---|
| `src/content/films.ts` | curated bilingual registry (above). First pass: draft titles in the Atelier voice (mirror `seed-portfolio` captions); the owner reviews wording before launch. |
| `src/components/HlsPlayer.tsx` | reusable player. Port the logic from `public/video-review.js`: native HLS on Safari (`canPlayType('application/vnd.apple.mpegurl')`), `hls.js` elsewhere. **Lazy-load hls.js via dynamic `import()`** so it never enters the main bundle. Minimal luxury chrome — poster, play, mute, fullscreen; drop the review page's quality-debug readouts (keep Auto ABR). |
| `src/pages/FilmsPage.tsx` | public page at `/#/films`. Poster-grid editorial layout (posters exist per clip: `videos/hls/<id>/poster.jpg`), category filter mirroring `PortfolioPage`, click → inline lightbox with `HlsPlayer`. Bilingual via `useLang()`, RTL-first, **CSS-var theme tokens only** (works in Noir *and* Ivory — the orphan page hard-codes noir hexes; don't copy them). |

### 1.3 Edits

- `package.json` — add `hls.js` as a real dependency (pin `^1.6.x`), remove
  the jsdelivr CDN dependency from the app path. (The orphan page may keep its
  CDN tag until it is deleted.)
- `src/App.tsx` — lazy route `/films` (public pages are currently eager;
  lazy is right here — the page pulls a player lib).
- `src/components/SiteHeader.tsx` — nav item between Portfolio and Journal:
  `أفلام الأتيليه` / `Films`.
- `src/pages/HomePage.tsx` — optional teaser strip (3 posters → `/films`).
  Do this only if it doesn't disturb the landing rhythm; owner's call.
- `public/sitemap.xml` — add the `/#/films` entry, matching how existing hash
  routes are listed.
- Docs: `docs/MANUAL.md` gains a short §"Films — adding a clip" (drop file in
  a staging dir → `npm run videos:prepare` → curate `films.ts` → commit);
  `CLAUDE.md` folder map + conventions get one-line updates.

### 1.4 Retire the orphan (last step of W1)

Once `/films` is live and the owner has approved the curated titles:
delete `public/atema-motion-review-f7c9a2.html` + `public/video-review.js`.
Until then they stay (they cost nothing and remain her full-pool review tool).

### 1.5 Weight & platform constraints (read before adding clips)

- `public/videos/` is **~204 MB inside git and inside every gh-pages deploy**.
  GitHub Pages soft-caps sites at ~1 GB and repos degrade well before that.
  Current state is fine; but the *policy* going forward: short clips (< 25 s)
  can drop the 720p rung, and when the pool next grows materially, move HLS
  assets to Supabase Storage (public bucket, same folder shape — only
  `MANIFEST_URL` and the hls/poster prefixes change). Record the decision in
  `docs/plans/` when it happens; don't do it preemptively.
- Never `<link rel="preload">` any video asset. Posters are `loading="lazy"`
  `<img>`s with explicit dimensions (CLS rule §4.5 of CLAUDE.md applies to
  posters too).

---

## 2. W2 — Album-cover example render on the selection page

> **Status: ✅ SHIPPED 2026-07-03** — with a better architecture than planned
> below. The owner supplied photographic mockup sheets (per-code finished
> album + luxury presentation box, plus re-shot clean material swatches), so
> the **photo mockups are the primary example render** and the CSS-composed
> book mock (§2.2) ships as the fallback for admin-added custom colours and
> as the admin tile/chip preview. Cut assets:
> `public/photos/album/<CODE>{,-album,-box}.jpg/.webp` (54 pairs, 2.4 MB).
> New columns `example_url` + `box_url` via
> `database/migrations-2026-07-album-examples.sql` (idempotent — **owner must
> run it after `migrations-2026-07-album.sql`**). Verified end-to-end with a
> mocked-service harness: grid → pick → example + box render → confirm →
> keepsake view, RTL, noir.

### 2.1 What exists vs what's asked

The 18 material photos already render as **flat swatch tiles**
(`AlbumSelectionPage.swatchTile`). The ask: when the bride picks a colour,
show a composed **example of the finished album** in that material — the
"how will *my* album look" moment.

### 2.2 Architecture: one presentational component, zero DB change

No migration, no new assets required — the material textures are the input;
the album shape is CSS/SVG composition on top.

```
src/components/AlbumCoverExample.tsx     (pure, no data fetching)
  props: { design: AlbumDesign; size?: 'hero' | 'tile'; lang: 'ar' | 'en' }
```

Rendered as a **portrait book mock** (aspect ≈ 4:5):

1. **Cover face** — the material texture full-bleed. Use `image-set()` /
   `<picture>` so the `.webp` is served with `.jpg` fallback (the pairs
   already exist). Fallback when `preview_url` is null: the existing
   `swatch_hex` radial-shade treatment.
2. **Spine** — a 10–12 % inline-start strip: darkening gradient +
   1 px highlight line → closed-book depth. Flip automatically with `dir`.
3. **Emboss** — centered `ATEMA` wordmark (Cinzel, letter-spaced) rendered as
   *deboss*: low-alpha gold fill + `text-shadow` pair (light above / dark
   below) so it reads pressed-in rather than printed-on. No customer PII on
   the mock — it's an atelier object, and the page must stay clean if
   screenshotted/shared.
4. **Sheen** — one diagonal low-alpha white gradient overlay, subtler on
   fabric than leather (key off `design.material`).
5. Soft contact shadow beneath. All colours from CSS vars / the design row —
   **no new hex literals** (§4.1); the page already lives in noir vars.

### 2.3 Wiring (all in existing files)

- **`AlbumSelectionPage.tsx`**
  - When `picked` changes: an example panel appears between the swatch grid
    and the confirm bar — `AlbumCoverExample size="hero"` (~min(70vw, 300px)
    wide) + the design's `name_ar/_en`, code, and `blurb_ar/_en` (seeded but
    currently unused on this page — this is where they belong). Animate with
    the existing fade pattern; on mobile make it the thing the confirm bar
    sits under, so pick → see example → confirm is one downward flow.
  - **Confirmed state**: replace the flat 200×240 `swatchTile` div with the
    same `AlbumCoverExample` — the keepsake view of her final choice.
- **`AlbumComposer.tsx`** (admin, chosen-cover chip) and
  **`AlbumDesignsManager.tsx`** (palette cards): swap their flat preview divs
  for `size="tile"` renders. One component, four surfaces, can't drift.

### 2.4 Explicit non-goals (Phase 2, only if the CSS mock underwhelms)

Pre-rendered photographic mockups per code (18 × shot/comped images), bride
name/date embossing, page-spread previews. Park them; the CSS mock ships first
and is likely enough.

---

## 3. W3 — Full integrity test (one pass, after W1+W2 land)

Run as a single session; file failures in `docs/bugs.md` with the usual
patch-tracker discipline. Deliverable: a dated report in `docs/reviews/`.

### 3.1 Static gates
- `npm run lint` · `npm test` (all suites, incl. change-booking glue +
  policy modules) · `npm run build` (tsc strict gate).
- Grep-audits: no new raw hex on themed surfaces (§4.1); every
  customer-controlled string through `esc()` (§4.4); no `Math.random`
  tokens; no direct `bookings` reads from public surfaces.

### 3.2 Asset audit (known suspect included)
- **Already-found issue, fix during W3:** `seed-portfolio-2026-07.sql` points
  the 7 new portfolio rows at **raw camera files** (`/photos/IMG_2536.JPG`,
  multi-MB) instead of the `.optimised.jpg`/`.webp` pairs that sit beside
  them. Follow-up migration/seed (`seed-portfolio-2026-07-optimised.sql` or
  UPDATE by `image_url like '/photos/IMG_%'`) to repoint at optimised URLs;
  then decide whether the raw `.JPG`s (29 of them, most of the 19 MB in
  `public/photos/`) should leave `public/` for an untracked archive.
- Every `<img>` on new surfaces: `<picture>`+webp, lazy, decoding async,
  width/height set.
- Video: no preload tags; posters lazy; `/#/films` cold-load JS budget —
  hls.js must appear only in the lazy chunk.

### 3.3 Route & bilingual walk
All public routes (`/`, `/book`, `/portfolio`, `/films`, `/journal`,
`/journal/:slug`, `/about`, `/policy`) — both languages, both themes, mobile
width. Capability pages with live tokens: `/#/board/`, `/#/manage/`,
`/#/album/` (not-ready → pick → example render → confirm → locked). Admin:
dashboard, calendar, packages, addons, portfolio, journal, discounts,
album-designs, P&L, settings.

### 3.4 Backend & DB
- Migration checklist vs live Supabase (CLAUDE.md §6 list + `2026-07-album`).
- Supabase security advisor: zero new warnings; spot-check RLS — anon on
  `bookings`, `booking_otps`, `album_*` tables; `public_booked_dates` returns
  dates+status only.
- Edge functions deployed & versions current: `create-booking`,
  `change-booking`, `verify-payment`, `discount-preview`, `wa-*`,
  `send-whatsapp`.

### 3.5 End-to-end money-path smoke (test mode)
Booking → email w/ attachments → manage-link WA → reschedule → OTP package
change → top-up Moyasar → verify-payment → admin docs regeneration → mood
board → album release → album selection. (This exercises every capability
token in one narrative.)

### 3.6 Deploy pipeline
`deploy.yml` on the W1 commit: build time + artifact size with 204 MB of
videos (Pages artifact limit headroom), custom-domain + HTTPS intact,
`/#/films` reachable on production, orphan slug still `noindex`.

---

## 4. Execution order & commit shape

One feature = one commit (§4.7), in this order — each leaves master shippable:

1. `films.ts` registry + `HlsPlayer` + `FilmsPage` + route/nav/sitemap (W1 core)
2. Homepage teaser (W1, optional — owner taste call)
3. Delete orphan review page (W1 close-out, after owner approves titles)
4. `AlbumCoverExample` + wiring into the three surfaces (W2)
5. Portfolio seed repoint to optimised images (W3 fix, can land anytime)
6. Integrity-pass fixes + `docs/reviews/2026-07-XX-integration-integrity.md`
7. Docs truth pass: MANUAL §films, CLAUDE.md + AGENTS.md updates

Suggested branch: `claude/films-and-album-example` off `master`; the plan
itself lives on `claude/project-status-integration-plan-25ou91`.

---

## 5. Open questions for the owner (non-blocking, defaults chosen)

1. **Nav label** — default `أفلام الأتيليه` / *Films*. Alternative: `موشن`.
2. **Homepage teaser** — include (step 2) or keep landing photo-only?
3. **Published cut** — all 18 clips public, or a curated subset? Default:
   start with the strongest ~10; flip `published` flags anytime.
4. **Raw `.JPG` archive** — after the seed repoint, keep raws in the repo
   (deployed weight) or move out of `public/`? Default: move out.
