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
| The doc set itself + navigation | [`docs/README.md`](./docs/README.md) |
| Investor / client pitch (the "what is ATEMA" story) | [`docs/PRESENTATION.md`](./docs/PRESENTATION.md) |
| P&L model, margin warnings, owner-hour costing | [`docs/PROFITABILITY.md`](./docs/PROFITABILITY.md) |
| **Outstanding bugs + security audit + patch tracker** | [`docs/bugs.md`](./docs/bugs.md) |
| Payment gateway readiness (Moyasar live + transfer flow) | [`docs/integrations/payments.md`](./docs/integrations/payments.md) |
| WhatsApp Cloud API blueprint (legacy reference) | [`docs/integrations/whatsapp.md`](./docs/integrations/whatsapp.md) |
| **WhatsApp lifecycle reminders + receipt vision — IMPLEMENTED** | [`docs/integrations/wa-platform.md`](./docs/integrations/wa-platform.md) |
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
│   ├── _shared/wa.ts          Meta Cloud API wrapper, HMAC verify
│   ├── create-booking/        server-side total recompute (Patch C-3)
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

---

## 4. Conventions you MUST follow

### 4.1 Theming
- **Never** hard-code colours in component files. Use the CSS custom
  properties declared in `index.html` (`--a-ink`, `--a-surface`,
  `--a-gold`, etc.) or pull from `getBookingPalette(theme)` in
  `src/theme/themes.ts`.
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
- `npm run deploy` publishes `dist/` to `gh-pages`. Don't push there manually.
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
                                   (server-side total recompute)
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
  - `database/migrations-2026-05-rls-hardening.sql` (PII view + constrained
    INSERT/UPDATE policies — silences Supabase security advisor)
  - `database/seed-journal-2026-05.sql` (6 journal posts)
  - `database/seed-portfolio-2026-05-expanded.sql` (23 portfolio items —
    **use this, not the old `seed-portfolio-2026-05.sql`**)
- Meta Business verification + permanent access token.
- Submit 6 WA templates to Meta (copy from `docs/integrations/wa-platform.md` §6).
- Supabase secrets: `META_WA_*`, `ANTHROPIC_API_KEY`, `OWNER_WA_NUMBER`,
  `CRON_SECRET`.
- Deploy WA Edge Functions: `supabase functions deploy wa-webhook wa-receipt wa-reminders`.
- Schedule cron at `*/30 * * * *`.
- Drop the legacy public bookings INSERT RLS policy after `create-booking`
  Edge Function is deployed and stable (Patch C-3 finish).
- Activate Moyasar live mode + update callback URL to atemastudio.xyz.

### Code-side (low-priority bug-tracker items)
- M-1: `dangerouslySetInnerHTML` guarded constant cleanup
- L-3: `@types/node` minor bump
- L-5: `useBreakpoint` SSR-safety guard
- L-6: VAT registration in invoice seller block (cosmetic — placeholder
  until Fatima registers)

### Design parking lot (not built — discuss before starting)
**Pre-discussed order from last session:**
1. **Studio-wide P&L dashboard (monthly aggregate rollup)** — next when
   owner is ready. Currently only per-booking P&L exists. Big shape calls
   before building: route (`/admin/pnl` vs new tab), time bucket
   (month-only vs month+quarter+year), per-tier breakdown depth.
2. **/policy public page** (T&C + refund + PDPL) — required for Moyasar
   live activation. ~2 hr build, lifts existing TC_CONTENT / PDPL_CONTENT
   constants out of `BookingPage.tsx` popups into a standalone page.

**Still parked, not yet ordered:**
- AI Concierge bilingual conversational booking (recommend WA pilot first)
- Voice-note transcription (high value for KSA WA volume)
- Refund-deposit button in admin booking modal
- Customer reminder opt-out checkbox at booking time
- `/admin/conversations` live monitor UI (only when WA volume justifies)
- Tap Payments as a secondary gateway (only when Mada volume justifies)

**Done in recent sessions (do not re-build):**
- ✅ Mood Board (post-booking ritual page) — shipped commit `dc1655b`
- ✅ Expanded portfolio (23 items) — shipped commit `0a99efc`

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

*Last updated: 2026-05-20 (Phase 5 — Couture Noir + custom domain + WA
lifecycle + Mood Board + 23-photo portfolio)*
