# CLAUDE.md — Working Brief for Claude Code Sessions

> Read this first when opening a new session on **ATEMA STUDIO**.
> It gives you the lay of the land in 60 seconds, then points you at the
> deep-dive docs that already exist. **Do not re-discover what is already
> documented — read the linked file.**

---

## 0. What this project is

**ATEMA STUDIO** — bilingual (Arabic-first / English) luxury photography
booking platform for a women-only studio in Saudi Arabia (Eastern Province).

- **Live:** <https://atemastudio.xyz>
- **Repo root:** `_deploy/atema-studio/`
- **Default branch:** `master` → auto-published to `gh-pages` via `npm run deploy`
- **Owner:** Fatima Bohassan (Al-Jubail, KSA)

It is **not** a generic SaaS. Every decision (theme, copy tone, payments,
compliance) is shaped by the Saudi luxury wedding/events market.

---

## 1. The 30-second mental model

```
React 19 + Vite + TS  →  Supabase (Postgres + Edge Functions)  →  GH Pages
        ↓                              ↓
   HashRouter                   Moyasar (cards) +
   (GH Pages constraint)        Al Rajhi bank transfer
                                       ↓
                                Meta WhatsApp Cloud API
                                (lifecycle reminders +
                                 receipt auto-extraction
                                 via Claude Vision)
                                       ↓
                                Mood Board ritual page
                                (admin-composed, /#/board/<token>)
```

- **Theming:** two themes (`Couture Noir` default, `Atelier Ivory`) via CSS
  custom properties on `:root[data-theme="noir|ivory"]`. Admin-toggleable,
  persists across visits. Theme tokens live in `src/theme/themes.ts` and
  `index.html`.
- **Routing:** `HashRouter` (because GH Pages can't do SPA paths). Routes
  use `/#/…` form externally.
- **i18n:** `useLang()` hook + per-page bilingual content blocks. Arabic is
  the primary language; RTL via `[dir="rtl"]` selectors.
- **Auth:** Supabase email/password for the single admin user. No customer
  accounts — booking is anonymous.
- **PII discipline:** the public calendar/portfolio NEVER exposes customer
  names or refs. Admin sees full detail.

---

## 2. Where to read what (single source of truth)

**Always check the docs folder before implementing. It is current, opinionated,
and answers most "how does X work" questions.**

| You need to know about… | Read this |
|---|---|
| Overall stack, folder layout, env vars, schema, build commands | [`PROJECT.md`](./PROJECT.md) |
| Day-to-day owner operations (admin panel, P&L, calendar, settings) | [`docs/MANUAL.md`](./docs/MANUAL.md) |
| **Design system — palettes, stationery, typography, FAB monogram, how to add a surface** | [`docs/design.md`](./docs/design.md) |
| The doc set itself + navigation | [`docs/README.md`](./docs/README.md) |
| Investor / client pitch (the "what is ATEMA" story) | [`docs/PRESENTATION.md`](./docs/PRESENTATION.md) |
| P&L model, margin warnings, owner-hour costing | [`docs/PROFITABILITY.md`](./docs/PROFITABILITY.md) |
| **Outstanding bugs + security audit + patch tracker** | [`docs/bugs.md`](./docs/bugs.md) |
| **Active plan — Films integration + album example render + integrity pass** | [`docs/plans/integration-2026-07.md`](./docs/plans/integration-2026-07.md) |
| Cross-agent handoff state (Claude ⇄ Codex) | [`AGENTS.md`](./AGENTS.md) |
| Payment gateway readiness (Moyasar live + transfer flow) | [`docs/integrations/payments.md`](./docs/integrations/payments.md) |
| WhatsApp Cloud API blueprint (legacy reference) | [`docs/integrations/whatsapp.md`](./docs/integrations/whatsapp.md) |
| **WhatsApp lifecycle reminders + receipt vision — IMPLEMENTED** | [`docs/integrations/wa-platform.md`](./docs/integrations/wa-platform.md) |
| **Email confirmation (Zoho Mail SMTP) — IMPLEMENTED**          | [`docs/integrations/email.md`](./docs/integrations/email.md) |
| **Mood Board composer & public page — IMPLEMENTED** | [`docs/MANUAL.md`](./docs/MANUAL.md) §13b |
| First-time Supabase wiring | [`BACKEND_SETUP.md`](./BACKEND_SETUP.md) |
| Quick-start (npm scripts, dev/build/deploy) | [`README.md`](./README.md) |

**Rule of thumb:** if a doc exists for the area you're touching, read it
before editing code. The docs encode tradeoffs that the code doesn't show.

---

## 3. Folder map (high-level)

```
atema-studio/
├── CLAUDE.md                  ← you are here
├── PROJECT.md                 stack, schema, build/deploy reference
├── README.md                  quick-start
├── BACKEND_SETUP.md           first-time Supabase + Moyasar wiring
├── docs/                      ← deep-dive docs (read these!)
│   ├── README.md              doc index
│   ├── MANUAL.md              owner operating manual
│   ├── PRESENTATION.md        16-slide pitch
│   ├── PROFITABILITY.md       P&L model + worked numbers
│   ├── bugs.md                security audit + patch tracker
│   └── integrations/
│       ├── payments.md        Moyasar + transfer readiness
│       ├── whatsapp.md        WA blueprint (early)
│       └── wa-platform.md     WA lifecycle reminders (built)
├── database/
│   ├── schema.sql                          base schema (run once)
│   ├── admin-setup.sql                     admin user bootstrap
│   ├── app-settings.sql                    app_settings table
│   ├── migrations-2026-05.sql              May-2026 core migration
│   ├── migrations-2026-05-branding.sql     branding columns
│   ├── migrations-2026-05-custom-domain.sql /atema-studio/photos/ → /photos/
│   ├── migrations-2026-05-wa.sql           wa_messages + wa_reminders_sent
│   ├── migrations-2026-05-moodboard.sql    mood_boards table + viewed RPC
│   ├── seed-packages-2026-05.sql           6 packages + 11 addons (UPSERT)
│   ├── seed-journal-2026-05.sql            6 bilingual journal posts
│   ├── seed-portfolio-2026-05.sql          (superseded) 7 portfolio items
│   └── seed-portfolio-2026-05-expanded.sql 23 portfolio items, bride/couture/editorial
├── supabase/functions/
│   ├── _shared/               wa.ts · pricing.ts · validation.ts · signature.ts · receipt.ts
│   ├── create-booking/        server-side total recompute (Patch C-3)
│   ├── discount-preview/      rate-limited preview_discount_code (Patch M-10)
│   ├── wa-webhook/            Meta webhook receiver (GET handshake + POST)
│   ├── wa-receipt/            Claude 3.5 Sonnet Vision bank-receipt OCR
│   ├── wa-reminders/          cron-fired lifecycle reminders (every 30 min)
│   └── send-whatsapp/         ad-hoc admin send
├── scripts/
│   └── optimise-images.mjs    sharp → WebP + JPEG, ~91% size reduction
├── public/
│   ├── CNAME                  atemastudio.xyz
│   └── photos/                optimised JPEG + WebP pairs
└── src/
    ├── App.tsx                HashRouter + React.lazy admin routes
    ├── components/            SiteHeader, PromotionModal, MoodBoardComposer, …
    ├── pages/                 BookingPage, AboutPage, MoodBoardPage, AdminDashboard, …
    ├── services/              supabase, booking, contract, invoice, moyasar, moodboard
    ├── theme/themes.ts        getBookingPalette(name) + theme tokens
    ├── utils/validation.ts    normalizeSaudiMobile, validEmail, …
    └── hooks/                 useLang, useBreakpoint, useAdminAuth, …
```

Self-service booking changes (reschedule + package/add-on change) add:
```
supabase/functions/
├── _shared/reschedule.ts      contract Article-3 reschedule policy (pure, tested)
├── _shared/otp.ts             step-up OTP primitives (pure, tested)
├── _shared/change.ts          package-change / delta math (pure, tested)
└── change-booking/            token-authed Edge Fn (reschedule | request_otp | change_package)
database/
├── migrations-2026-05-booking-changes.sql      manage_token + reschedule_count + booking_changes + get_booking_by_token RPC
└── migrations-2026-05-booking-changes-otp.sql  booking_otps (step-up codes)
src/
├── services/manage.ts         token read + Edge calls
└── pages/ManageBookingPage.tsx  /#/manage/<token> customer page
```

---

## 4. Conventions you MUST follow

### 4.1 Theming — TWO palettes, by purpose
- **Screen surfaces** (public site, admin, booking flow, mood board page,
  manage page): use the CSS custom properties declared in `index.html`
  (`--a-ink`, `--a-surface`, `--a-gold`, etc.) or pull from
  `getBookingPalette(theme)` in `src/theme/themes.ts`. **Two themes** —
  Couture Noir (default) + Atelier Ivory — admin-toggleable.
- **Stationery surfaces** (contract, ZATCA invoice, booking-confirmation
  email, `/policy` page, T&C/PDPL popups in the booking flow): import
  the `STATIONERY` token map from `src/theme/stationery.ts` (Edge
  Functions use the Deno mirror at
  `supabase/functions/_shared/stationery.ts` — **change both**). Stationery
  is **not** theme-toggleable; printed/sent artifacts always wear the
  same dress.
- **Never** hard-code hex literals in any of these surfaces. Reach for
  the right palette's tokens.
- **Full design system + token tables** live at
  [`docs/design.md`](./docs/design.md).
- **One exception:** Lucide icon `color={…}` props are SVG presentation
  attributes — they don't resolve CSS vars. Use a literal hex (e.g.
  `color="#D4AF7A"`) at icon sites only.
- **The live-palette pattern** in `BookingPage.tsx`: a module-level `T`
  object is mutated by `syncT(theme)` during render so inline styles can
  reference `T.coffee` etc. without prop-drilling. Keep this pattern when
  extending the booking flow.

### 4.2 Bilingual copy
- Use the `useLang()` hook (`const { lang, dir } = useLang()`).
- Provide both `_ar` and `_en` columns in every new DB table that holds
  user-visible strings.
- Arabic h1s fall back to **Tajawal** (not Amiri) per a stylistic decision —
  the rule lives in `index.html` under `[dir="rtl"] .display-serif`.

### 4.3 Database changes
- **Never edit `schema.sql` retroactively.** Add a new
  `migrations-YYYY-MM-<topic>.sql` file in `database/`.
- All seeds use **UPSERT by stable id** (not DELETE) so foreign keys (e.g.
  `bookings.package_id`) survive.
- Portfolio + journal seeds match on `image_url like '/photos/%'` so they
  only touch seeded rows, leaving admin uploads untouched.

### 4.4 Security
- **Every customer-controlled string interpolated into HTML must pass
  through `esc()`** — see `src/services/contract.ts` / `invoice.ts`. This
  is Patch C-1 in `docs/bugs.md`. Do not regress.
- **All input validation goes through `src/utils/validation.ts`** —
  `normalizeSaudiMobile`, `validEmail`, `isFutureOrToday`, `clampText`.
- **Booking totals are computed server-side** in the `create-booking`
  Edge Function (Patch C-3). The client value is for display only.
- **Booking refs use `crypto.getRandomValues` + Crockford base32**, never
  `Math.random` or `Date.now()`.
- **Webhook signatures (Meta) verified via HMAC-SHA256** in
  `supabase/functions/_shared/wa.ts`. Do not skip.
- **Public DatePicker reads `public_booked_dates`, NOT `bookings`.** The
  view exposes only `event_date` + `status`. Never call
  `fetchAdminBookedDates` from a customer surface — that path is for
  AdminCalendar only. See `src/services/calendar.ts` for the fork.
- **Production bundle is terser-minified, name-mangled, console-stripped,
  source-map-free.** See `vite.config.ts`. Don't loosen these settings.
  Anyone can still inspect the bundle; the layer of protection is
  defence-in-depth, not security.
- **Discount codes are admin-only at the table level.** `discount_codes`
  is `authenticated`-only for SELECT. Anon talks to it via two RPCs:
  `preview_discount_code()` (read-only forecast) and
  `redeem_discount_code()` (service-role only, called from the
  `create-booking` Edge Function). Never expose the table directly from
  a public surface; never trust client-supplied discount amounts.

### 4.5 Images
- **Always run `node scripts/optimise-images.mjs`** after dropping a new
  raw photo in `public/photos/`. It produces a WebP + JPEG pair.
- **Always serve via `<picture>`** with `<source type="image/webp">` and
  `<img>` JPEG fallback + `loading="lazy"` + `decoding="async"` + explicit
  `width`/`height` (CLS).
- For the promotion modal hero, also add a `<link rel="preload"
  as="image" type="image/webp" media="…">` in `index.html`.

### 4.6 Routing & paths
- We are on the custom domain. `vite.config.ts` has `base: '/'`.
- **All hardcoded asset URLs use `/photos/...`**, not `/atema-studio/photos/...`.
- If you ever revert to `farajaay.github.io/atema-studio`, also revert the
  base and re-run `migrations-2026-05-custom-domain.sql` in reverse.

### 4.7 Commits & deploys
- One feature = one commit, prose-first message ("why" before "what").
- `npm run build` must pass type-check before commit.
- **Auto-deploy** — every push to `master` triggers
  `.github/workflows/deploy.yml` (test → build → publish to `gh-pages` via
  `peaceiris/actions-gh-pages@v4`). Don't push to `gh-pages` manually.
- The legacy `npm run deploy` still works for local emergency deploys
  but is no longer the day-to-day path.
- **Never** force-push `master` or `gh-pages` without an explicit user OK.

### 4.8 Mood Board (post-booking ritual)
- After a booking is paid or `awaiting_transfer`, the admin booking modal
  exposes a **3rd tab — "لوحة المزاج"** — where Fatima composes a private
  editorial board for the bride.
- The composer auto-selects 6 portfolio images keyed to `(package category
  × season)` and drafts a bilingual title + caption in the Atelier voice.
  Each slot is swappable from the full portfolio pool; copy is editable.
- The board lives at `/#/board/<token>` (public, noir theme). The token is
  32 chars of `crypto.getRandomValues` Crockford base32 (160 bits) — the
  only secret guarding the page.
- `viewed_at` is recorded via a `SECURITY DEFINER` RPC
  (`mark_mood_board_viewed`), so anon can update that single column on
  that single row, nothing else. Don't loosen RLS to allow anonymous
  UPDATEs.
- The composer phones home to `portfolio_items` via
  `src/services/moodboard.ts`. Keep that service the single source of
  truth for any future board logic (AI accent images, multi-board per
  booking, etc.). See `docs/MANUAL.md` §13b.

### 4.9 Customer self-service changes (`/#/manage/<token>`)
- Every booking has a `manage_token` (160-bit secret, defaulted in SQL via
  `encode(gen_random_bytes(20),'hex')`). It is the **only** credential for the
  page — same capability-link model as the Mood Board.
- The page reads its booking through the `get_booking_by_token()`
  `SECURITY DEFINER` RPC. **Anon never touches the `bookings` table.** All
  writes go through the `change-booking` Edge Function as service-role.
- **Policy is a single source of truth.** The rules live in dependency-free,
  unit-tested modules under `supabase/functions/_shared/`
  (`reschedule.ts`, `otp.ts`, `change.ts`). The reschedule policy
  (`reschedule.ts`) is imported by **both** the client page and the Edge
  Function, so the date gating can't drift. The OTP + price-change engines
  (`otp.ts`, `change.ts`) are server-side and unit-tested; the client shows a
  display-only estimate. Don't fork any of this logic.
- **Reschedule** = link only (no money). **Package/add-on change** = step-up
  OTP (6-digit, salted-hash at rest, 10-min TTL, 5-attempt lockout, **emailed
  to the address on file** via Zoho SMTP — never in the HTTP response, never in
  the subject line). Email (not WhatsApp) because a web-initiated change rarely
  has Meta's 24h session window open, so a free-form WA text would be rejected;
  the renderer lives in `_shared/email-otp.ts`. Delivery failures surface to
  the page (`no_email_on_file` / `otp_send_failed`) instead of a fake "sent".
- **Server recomputes the total** from the catalogue (same discipline as
  `create-booking`); the client estimate is display-only. The original
  discount is **preserved, not re-redeemed** (don't double-spend a code's
  budget). Deposit is non-refundable → downgrades refund nothing.
- `booking_otps` is RLS-on with **no** anon/authenticated policies (service
  role only). `booking_changes` is the audit log (admin SELECT only). Don't
  loosen either.
- After a change, documents are regenerated **manually from the admin booking
  modal** (المستندات card → rebuild from current state; append-only versions).
  See `docs/MANUAL.md` §13i. The change-booking glue is unit-tested via
  `handlers.ts` + `src/services/change-booking-glue.test.ts` — keep the Deno
  shell (`index.ts`) free of logic.

---

## 5. The booking flow (one-breath summary)

```
Landing  →  Promo modal  →  /book
            (sessionStorage         ↓
            dismissal)         choose package OR customise
                                    ↓
                              add-ons (toggles + hour steppers)
                                    ↓
                              modal: booking form
                                    ↓
                              handleSubmit:
                                1. validate (utils/validation.ts)
                                2. submittingRef guard (double-click)
                                3. create-booking Edge Fn
                                   - server-side total recompute
                                   - WA notify owner (fire & forget)
                                   - EMAIL bride from atema@atemastudio.xyz
                                     (Zoho SMTP, fire & forget)
                                4. saveContract + saveInvoice
                                    ↓
                              PaymentMethodChooser
                              ├─ Card → MoyasarForm → /payment-result
                              └─ Transfer → BankTransferPayment
                                          (copy IBAN, WA receipt,
                                           DL contract + tax invoice)
                                    ↓
                              (paid / awaiting_transfer)
                                    ↓
                              Admin composes Mood Board
                              (optional ritual — /#/board/<token>)
```

After the booking exists, the bride can self-serve at `/#/manage/<token>`:
reschedule (link only) or change package/add-ons (step-up OTP). Server-enforced
by the `change-booking` Edge Fn — see §4.9.

Payment status lifecycle: `unpaid` → `awaiting_transfer` → `paid`.

Full detail: [`PROJECT.md` §4](./PROJECT.md) and
[`docs/MANUAL.md`](./docs/MANUAL.md).

---

## 6. Outstanding work (when in doubt, ask the user first)

### Owner-side (DNS / secrets / button-clicks — not code)
- Namecheap DNS: 4 A records on apex (`185.199.108-111.153`),
  CNAME `www → farajaay.github.io`.
- GitHub Pages settings: confirm custom domain, enforce HTTPS once DNS
  propagates.
- Run pending SQL in Supabase SQL editor (each is idempotent — safe to re-run):
  - `database/migrations-2026-05-custom-domain.sql` (fixes existing rows)
  - `database/migrations-2026-05-wa.sql` (WhatsApp tables)
  - `database/migrations-2026-05-moodboard.sql` (Mood Board table + RPC)
  - `database/migrations-2026-05-booking-changes.sql` (manage_token +
    reschedule_count + booking_changes + get_booking_by_token RPC;
    backfills a token onto existing bookings)
  - `database/migrations-2026-05-booking-changes-otp.sql` (booking_otps —
    step-up codes for package/add-on changes)
  - `database/migrations-2026-05-rls-hardening.sql` (PII view + constrained
    INSERT/UPDATE policies — silences Supabase security advisor)
  - `database/migrations-2026-05-discount-codes.sql` (discount_codes table
    + 3 booking columns + preview/redeem RPCs + RLS)
  - `database/migrations-2026-05-launch-code.sql` (LAUNCH15 — 15% off, max
    800 SAR, valid 20 days from when the SQL is applied)
  - `database/migrations-2026-05-email.sql` (email_messages audit table —
    booking-confirmation email via Zoho Mail SMTP)
  - `database/migrations-2026-06-topup.sql` (adds `topup_amount_due` to `bookings` — required for self-service top-up payments after package upgrades)
  - `database/migrations-2026-06-documents.sql` (contracts + invoices DDL under
    version control + admin-only SELECT — fixes an anon PII leak; required for
    the admin "المستندات" regeneration card)
  - `database/migrations-2026-07-album.sql` (album_designs palette + booking
    album columns + token RPCs — the post-event cover-selection feature)
  - `database/migrations-2026-07-album-examples.sql` (example_url + box_url —
    photographic album/box mockups on the selection page; run after the
    album migration)
  - `database/migrations-2026-07-videos-bucket.sql` (public `videos` Storage
    bucket — then run the "Sync film streams" workflow; see AGENTS.md for
    the 4-step sequence before deleting `public/videos/`)
  - `database/seed-packages-2026-05.sql` (6 packages + 11 add-ons — required
    if `packages` table is empty; the booking flow falls back to the DEMO
    catalogue without it, but the Edge Function still needs real rows to
    redeem against)
  - `database/seed-journal-2026-05.sql` (6 journal posts)
  - `database/seed-portfolio-2026-05-expanded.sql` (23 portfolio items —
    **use this, not the old `seed-portfolio-2026-05.sql`**)
- **WhatsApp is OPTIONAL (July 2026 decision — Meta approval never came).**
  Email is the always-channel; WA is additive behind the admin switch
  `app_settings.wa_enabled` (default off; every sender guards before entering
  WA code — off costs nothing). Only when the owner decides to activate WA:
  Meta Business verification + permanent token, submit the 6 templates
  (`docs/integrations/wa-platform.md` §6), set `META_WA_*` + `CRON_SECRET`,
  schedule the `wa-reminders` cron at `*/30 * * * *`, then flip the switch.
- Supabase secrets (email path — the live one): `ZOHO_SMTP_*`
  (see `docs/integrations/email.md` §2.4), `SITE_ORIGIN`, `OWNER_WA_NUMBER`,
  optional `OWNER_EMAIL` (change alerts; defaults to the Zoho sender),
  `ANTHROPIC_API_KEY` (receipt vision — WA-dependent).
- Edge Function deploys are **automatic** (`supabase-functions.yml` on any
  `supabase/functions/**` push to master); manual `supabase functions deploy`
  is emergency-only.
- **Card payments are DEFERRED (July 2026 decision)** — the studio runs
  transfer-only, and the code treats that as first-class (booking chooser
  hides cards; manage-page top-up shows IBAN + WA receipt hand-off; admin
  clears `topup_amount_due` from the booking modal). To activate cards later:
  set the `VITE_MOYASAR_PUBLISHABLE_KEY` GitHub secret + matching
  `MOYASAR_SECRET_KEY` Supabase secret (same test/live mode) and redeploy —
  both surfaces switch to the card form automatically.
- ~~Drop the legacy public bookings INSERT RLS policy~~ — superseded:
  `migrations-2026-06-fix-booking-insert.sql` deliberately keeps a
  constrained anon-INSERT fallback behind the Edge Function.

### Owner attention (time-sensitive)
- **LAUNCH15 has likely expired** — it was valid 20 days from when
  `migrations-2026-05-launch-code.sql` was applied (May 2026). Verify in the
  admin discount panel and retire or replace it before any campaign.

### Code-side (low-priority bug-tracker items)
- L-5: `useBreakpoint` SSR-safety guard
- L-6: VAT registration in invoice seller block (cosmetic — placeholder
  until Fatima registers)
- L-9: document the monolithic-admin assumption on `discount_codes` UPDATE policy

### Design parking lot (not built — discuss before starting)
**Still parked, not yet ordered:**
- AI Concierge bilingual conversational booking (recommend WA pilot first)
- Voice-note transcription (high value for KSA WA volume)
- Customer reminder opt-out checkbox at booking time
- `/admin/conversations` live monitor UI (only when WA volume justifies)
- Tap Payments as a secondary gateway (only when Mada volume justifies)

**Done in recent sessions (do not re-build):**
- ✅ Contract/invoice regeneration + versioned document storage (June 2026) —
  `src/services/documents.ts` + المستندات card in the admin booking modal;
  `migrations-2026-06-documents.sql` brings the contracts/invoices DDL under
  version control and locks reads to admin (was an anon PII leak).
- ✅ Refund-deposit button (studio-side cancellation) + failed-sends banner
  (`src/hooks/useFailedSends.ts`) in the admin dashboard. `docs/MANUAL.md` §13i.
- ✅ change-booking glue tests — wiring extracted to `handlers.ts`, 11 tests
  with a mocked Supabase client (`src/services/change-booking-glue.test.ts`).
- ✅ Studio-wide P&L dashboard — built and wired as the admin "P&L" view
  (`src/components/StudioPLDashboard.tsx`, rendered from `AdminDashboard.tsx`).
- ✅ `/policy` public page — `src/pages/PolicyPage.tsx`, sharing T&C/PDPL copy
  with the booking popups via `src/content/legal.ts`, plus an
  official-channels / anti-impersonation notice (June 2026).
- ✅ Anti-fraud copy hardening (June 2026) — OTP WhatsApp text now states
  ATEMA will never ask for the code; transfer screen pins the official IBAN
  and points at `/policy` for verification.
- ✅ Full system review (2026-06-12) — status, gap analysis, phased plan at
  `docs/reviews/2026-06-12-full-system-review.md`.
- ✅ Manage-link WhatsApp delivery — `create-booking` fetches `manage_token` once, passes `manageLink` to `send-whatsapp`; bride receives self-service link in her booking WhatsApp.
- ✅ Top-up payment flow — `change-booking` stores `topup_amount_due`; `ManageBookingPage` shows live `MoyasarForm` (purpose=topup) after upgrade; `verify-payment` clears the amount once Moyasar confirms. Requires `migrations-2026-06-topup.sql`.
- ✅ Client-side payment verification hardened (M-11) — `verify-payment` Edge Function; `PaymentResultPage` uses server result, not URL params.
- ✅ Mood Board (post-booking ritual page) — shipped commit `dc1655b`
- ✅ Expanded portfolio (23 items) — shipped commit `0a99efc`
- ✅ Customer self-service: reschedule (Phase 1) + OTP-gated package/add-on
  change (Phase 2) — `/#/manage/<token>` + `change-booking` Edge Fn. See §4.9.
- ✅ Promo modal case fix (`.JPG` → `.jpg` + OG/Twitter/schema.org meta) — commit `44a7556`.
- ✅ Booking-confirmation email via Zoho Mail SMTP — commit `f5ed8d9`. Docs at `docs/integrations/email.md` and `docs/MANUAL.md` §13h.
- ✅ Stationery palette convergence (contract + invoice + email + `/policy` + legal popups) — commit `a2866ae`. Docs at `docs/design.md`.
- ✅ GitHub Actions auto-deploy (`master → gh-pages` with test gate) — commit `6b74854`.
- ✅ GitHub Actions for Supabase ops — three workflows:
  `.github/workflows/supabase-secrets.yml` (manual, pushes secrets from GH Actions store),
  `.github/workflows/supabase-functions.yml` (auto on `supabase/functions/**` push, + manual),
  `.github/workflows/supabase-migrations.yml` (manual, applies `database/migrations-*.sql` via Supabase Management API — `only-file` input for single-file runs, `include-seeds` for full catalogue). Operator setup in `BACKEND_SETUP.md` §1 + §3 and `docs/integrations/email.md` §2.4 + §2.5.
- ✅ **July 2026 integration pass** (plan: `docs/plans/integration-2026-07.md`;
  all live-verified against production):
  - Films page `/#/films` (nav + footer + sitemap), curated registry in
    `src/content/films.ts` + Supabase-backed admin Films Manager
    (`/#/admin/films`, `migrations-2026-07-films.sql`); orphan review page
    deleted; owner keeps weak/repetitive clips unpublished.
  - Album example render — per-cover photographic mockups
    (`example_url`/`box_url`, `migrations-2026-07-album-examples.sql`) with
    `AlbumCoverExample` CSS mock as fallback + admin previews.
  - Gallery refresh (portfolio + journal repointed at the optimised July
    pool; `journal-cover-reshuffle` is SUPERSEDED — never re-run it).
  - **Transfer-only payments as first-class** — manage-page top-up shows
    IBAN + WA receipt hand-off (`TopUpTransfer`, facts in
    `src/content/payment.ts`); admin clears `topup_amount_due` from the
    booking modal; bookings table marks receivables with a gold chip.
  - **Dual-channel notifications** — email always, WA additive behind
    `app_settings.wa_enabled`; change-booking sends bride + studio emails
    (`_shared/email-change.ts`) and reports `notified:{wa,email}` so the
    manage page states the real channel; OTP consume is atomic single-use.
  - Wordmark switched from Cinzel to Tajawal light (matches the Atelier
    portrait placeholder face) — `.atema-wordmark`/`.atema-sub` in
    `index.html`.

Full tracker: [`docs/bugs.md`](./docs/bugs.md).

---

## 7. How to start a session productively

1. **Open this file.** (You're doing it.)
2. **Open `docs/bugs.md`.** It tells you what's known-broken vs known-good.
3. **Skim the relevant doc** for the area you're about to touch.
4. **Check `git status` + `git log -5`** to see what shipped recently.
5. Then implement. **One commit per logical change.**

If the user asks for something the docs already answer, point them at the
doc instead of re-explaining. If a doc is wrong or stale, fix it as part
of the change.

---

## 8. Tone & taste (for copy and UI)

This is a **luxury** studio for **Saudi women's events**. Copy is:
- **Slow, considered, sensory.** Not punchy startup voice.
- **Arabic-first.** Arabic copy is poetic (Amiri italic for editorial
  flourishes); English is the supporting voice.
- **Never breezy.** No "Get started in 30 seconds!" energy. Think Saint
  Laurent editorial, not Shopify landing page.
- **PII-aware.** Same opacity OpenTable / Calendly use for public calendars.

When writing new strings, mirror the tone of `src/pages/AboutPage.tsx` and
the journal/portfolio seed captions in `database/seed-*.sql`. Those are
the canonical voice samples.

---

*Last updated: 2026-07-04 — July integration pass complete and live-verified
(Films page, album photographic mockups, gallery refresh), launch decisions
locked in code: transfer-only payments (cards deferred behind the Moyasar
secrets), dual-channel notifications (email always, WhatsApp additive behind
`app_settings.wa_enabled`), admin top-up clearing + receivable chip, wordmark
→ Tajawal light. Cross-agent state: `AGENTS.md`. Prior review history:
`docs/reviews/`.*
