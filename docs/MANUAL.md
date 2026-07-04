# ATEMA STUDIO — Owner's Manual

> A complete operational + technical handbook for the ATEMA Studio booking platform.
> Updated 2026-05-28 (email + stationery + CI auto-deploy). Maintained
> alongside the codebase at
> [farajaay/atema-studio](https://github.com/farajaay/atema-studio).

---

## 1. What you own

ATEMA Studio is a **bilingual (Arabic / English), luxury women-only photography
studio booking platform** for the Eastern Province of Saudi Arabia. The system
includes:

| Surface | Purpose |
|---|---|
| **Public site** | Editorial brand presence — Home, Portfolio, Journal, About, `/policy` |
| **Booking flow** | Customer self-service: pick a package, customise add-ons, pay deposit |
| **Self-service changes** | Private per-booking link to reschedule or change package/add-ons (OTP-gated for money) — §13g |
| **Mood board** | Post-booking editorial 6-image page composed by Fatima for the bride — §13b |
| **Admin panel** | Bookings list, monthly calendar, packages CRUD, portfolio CRUD, journal CRUD, system settings, studio-wide P&L rollup |
| **Document engine** | Auto-generated ZATCA-compliant invoices (with QR), formal contracts, T&C popups — all on one stationery palette (§2 + `design.md`) |
| **Communications** | WhatsApp lifecycle reminders + receipt vision OCR (Meta Cloud API) **+** booking-confirmation email from `atema@atemastudio.xyz` (Zoho Mail SMTP) |
| **Theme engine** | Two screen themes (Couture Noir + Atelier Ivory), switchable from the admin panel. Stationery is single-palette regardless. |

Hosted on **GitHub Pages** at <https://atemastudio.xyz> with
data in **Supabase** (Postgres + Storage + Auth).

---

## 2. Brand & design concepts

ATEMA runs **two parallel design systems** — full reference at
[`design.md`](./design.md). Quick overview:

### 2.1 The two screen themes

Switchable from Admin → Settings → Theme card. Default is Couture Noir.

| Token | Couture Noir (default) | Atelier Ivory |
|---|---|---|
| Bg | `#0B0B0B` true black | `#F5EDE4` ivory |
| Surface | `#141414` | white |
| Surface alt | `#1C1C1C` | `#FBF6EE` |
| Heading ink | `#EFE3D1` ivory | `#1A1A1A` editorial black |
| Body ink | `#D8CDB9` | `#4A3728` |
| Accent (gold) | `#D4AF7A` champagne | `#8C6B4F` deep bronze |
| Accent (deep) | `#BB864B` | `#6B5440` |
| Hairline | `rgba(212,175,122,0.14)` | `rgba(214,191,163,0.4)` |

Lives in `src/theme/themes.ts`. Components consume via CSS custom
properties (`var(--a-bg)`, `var(--a-gold)`, …) declared in `index.html`,
or via `getBookingPalette(themeName)` for screens that pre-date the
properties era (`BookingPage.tsx`, `AdminDashboard.tsx`).

### 2.1b The stationery palette (printable + sendable)

A separate canonical palette — cream paper, deep umber ink, champagne +
gold accents, noir gradient — drives the **contract, ZATCA tax invoice,
booking-confirmation email, public `/policy` page, and the booking-flow
T&C/PDPL popups.** It is **not** theme-toggleable. Lives in
`src/theme/stationery.ts` (mirrored at
`supabase/functions/_shared/stationery.ts` for the email Edge Function).
Full token table + when-to-use guide in [`design.md`](./design.md) §3.

### 2.2 Typography

- **Brand wordmark** ("ATEMA STUDIO" in any script) — `Amiri`, spaced
  letters. The spaced-letter serif IS the wordmark.
- **Public-site display headlines** — `Cormorant Garamond` (Latin) +
  `Amiri` (Arabic, with a Tajawal fallback for screen H1s where Amiri
  feels too heavy).
- **Body / UI** — `Tajawal` for both scripts.
- **Tabular numerals** — `Tajawal` with `font-feature-settings:"tnum" 1`.
  (Inter was previously a third font on the invoice; it was dropped in
  the stationery convergence — commit `a2866ae`.)
- **Stationery documents** — same Amiri + Cormorant + Tajawal trio,
  sourced via `STATIONERY.fontDisplayAr/En/Wordmark/Body`. See
  [`design.md`](./design.md) §3.2.

### 2.3 Motion
A custom `FadeUp` component drives cinematic reveals using IntersectionObserver
+ `cubic-bezier(0.22, 0.61, 0.36, 1)` easing (700ms default). All motion
respects `prefers-reduced-motion`.

### 2.4 The FAB monogram (brand rule)
The `FAB` couture monogram is **reserved for printable documents and physical
gifts/bags only**. It appears:
- Faintly in the corner of generated contracts (`services/contract.ts`).
- Faintly in the corner of generated invoices (`services/invoice.ts`).
- **Never** on the public website chrome.

### 2.5 Theme switching
Theme is admin-controlled (Admin → Settings → Theme card). The active theme
writes CSS custom properties on `:root`, and a localStorage cache (`atema:theme`)
prevents first-paint flash for returning visitors.

---

## 3. Information architecture & routing

```
HashRouter (#-based, GitHub Pages constraint)

PUBLIC
  /                        HomePage           Editorial hero + 4-step experience
  /portfolio               PortfolioPage      Filterable gallery
  /journal                 JournalPage        Editorial blog list
  /journal/:slug           JournalPostPage    Single post detail
  /about                   AboutPage          Atelier story
  /policy                  PolicyPage         T&C + refund + PDPL
  /book                    BookingPage        Full booking flow
  /board/:token            MoodBoardPage      Private post-booking mood board
  /manage/:token           ManageBookingPage  Customer self-service (reschedule + change package)

ADMIN  (gated by Supabase Auth, /admin → /admin/dashboard)
  /admin                   AdminLogin
  /admin/dashboard         AdminDashboard     Bookings list + monthly calendar
  /admin/packages          PackagesManager    CRUD for packages + add-ons
  /admin/portfolio         PortfolioManager   CRUD for portfolio items
  /admin/journal           JournalManager     CRUD for journal posts
```

Hash routing is required because GitHub Pages is a static host with no
server-side route handling.

---

## 4. The booking flow — step by step

### Customer's experience
```
HomePage  →  /book
              │
              ├──[ Tab 1: الباقات الجاهزة ]── Pick from 6 packages
              │     │
              │     └── PkgDetailsModal (image, price, features, "Choose")
              │
              └──[ Tab 2: صمّمي باقتك ]──── Start from Customise base
                    │
                    └── Add-ons (toggle / quantity)
                          │
                          ▼
              ┌──────────────────────────────┐
              │   SummaryPanel               │
              │   subtotal · VAT 15% · total │
              │   "Book Now" button          │
              └──────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────────────┐
              │   BookingFormModal           │
              │   name · phone · email       │
              │   city · venue · DatePicker  │
              │   special requests           │
              └──────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────────────┐
              │   createBooking()            │
              │   → INSERT into bookings     │
              │   → Returns booking_ref      │
              └──────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────────────┐
              │   PaymentMethodChooser       │
              │   [Card]   [Bank Transfer]   │
              └──────────────────────────────┘
                 │                    │
                 ▼                    ▼
            MoyasarForm        BankTransferPayment
            (online card)      (IBAN + receipt upload)
                 │                    │
                 ▼                    ▼
        ─── on success ──→ Generate invoice (ZATCA QR)
                       ──→ Generate contract
                       ──→ Mark booking as confirmed / awaiting transfer
                       ──→ Both docs offered as View + Download (HTML → PDF print)
```

### Backend invariants (`src/services/booking.ts`)
- Booking reference format: `ATEMA-{YYMMDD}-{RAND}` (e.g. `ATEMA-260517-K7L9`).
- Deposit = 50% of total. Stored on the booking row.
- `vat_enabled` on the booking is derived from the global setting at creation
  time, then frozen — so changing the global VAT toggle later won't retroactively
  alter past contracts.

---

## 5. Payment flow

ATEMA supports two payment rails:

### 5.1 Online card (Moyasar)
- KSA-licensed payment gateway. Supports Mada, Visa, Mastercard, STC Pay.
- Wired in `src/components/MoyasarForm.tsx`.
- Publishable key configured via `VITE_MOYASAR_PUBLISHABLE_KEY` env var.
- Customer enters card → Moyasar tokenises + charges → callback fires
  `/?moyasar_id=…` → `App.tsx` callback handler verifies and finalises.

### 5.2 Bank transfer (Al Rajhi)
- IBAN: `SA0380000000329608010885626`, beneficiary: فاطمة بوحسن.
- `BankTransferPayment.tsx` shows account details, copy-to-clipboard buttons,
  contract + invoice download, and a "Mark as awaiting transfer" CTA.
- Currently **manual confirmation by admin** after the customer sends the
  receipt over WhatsApp. See `docs/integrations/whatsapp.md` for the proposed
  automation path.

### 5.3 Readiness audit
See [`docs/integrations/payments.md`](./integrations/payments.md) for the
current status of Moyasar and a comparison with Tap Payments.

---

## 6. Calendar & availability

Both the admin calendar (`AdminCalendar.tsx`) and the customer date picker
(`DatePicker.tsx`) consume the same `src/services/calendar.ts` API:

```
fetchBookedDates(from, to)    → any non-cancelled bookings in the window
fetchBlockedDates(from, to)   → admin-managed blocked rows (vacation, maintenance…)
```

### What customers see
- **Past dates** — greyed out, click-disabled.
- **Booked dates** — strikethrough, dashed pink border, tooltip `محجوز / Booked`.
- **Admin-blocked dates** — strikethrough, dashed sand border, tooltip shows the admin reason.
- **Selected date** — solid gold pill.

### Is it safe to show customers booked dates?
**Yes**, with the current implementation. Customers only see *that* a date is
taken, never *who* booked it. This is the same pattern used by OpenTable,
Booking.com, and Calendly. Two trade-offs to know:

1. **Pro** — it builds social proof ("ATEMA is busy on Saturdays, must be good").
2. **Con** — if a competitor scrapes the public site they can infer your
   booking density.

If you ever want stricter privacy, change `DatePicker.tsx` line 176 to render
both booked and admin-blocked dates with the same generic `غير متاح / Unavailable`
label so the visitor can't tell which is which.

### Admin actions on the calendar
- **Click an empty cell** — opens a "Block this day" dialog (reason field).
- **Click a blocked cell** — opens an "Unblock" confirmation.
- **Click a booked cell** — opens a read-only summary of the bookings.
- The calendar fetches **per displayed month** — empty cells in May just mean
  no May bookings exist; navigate chevrons to find your booking months.

---

## 7. Document engine — Contracts, T&C, Invoices

All three are generated as **printable HTML** that opens in a new tab.

### 7.1 Contract (`src/services/contract.ts`)
- Full bilingual contract (Arabic primary) with parties, financials, articles
  on payment / cancellation / delivery / IP.
- FAB monogram in corner (brand rule).
- Saved to `contracts` table for audit and re-issue.
- Customer can View + Download (Blob URL, Safari/iOS-safe).

### 7.2 ZATCA invoice (`src/services/invoice.ts`)
- ZATCA Simplified Tax Invoice (Phase 1) with embedded base64 TLV-encoded QR.
- QR contains: seller name, VAT number, ISO timestamp, total, VAT amount.
- When the global VAT toggle is OFF, the invoice still generates but with
  VAT = 0 and the QR omits VAT fields.

### 7.3 T&C / Privacy popup (`src/pages/BookingPage.tsx`)
- Surfaced as inline modals during the booking form step.
- Bilingual, ivory-styled (matches printable docs).
- Covers: payment terms, cancellation, delivery windows, IP, PDPL (Saudi data
  protection compliance).

---

## 8. Settings (admin-controlled)

Stored in the `app_settings` singleton row, edited via `AppSettingsPanel`:

| Setting | Default | Effect |
|---|---|---|
| `vat_enabled` | `true` | Toggles 15% VAT across booking summary, invoice, contract |
| `vat_number` | — | 15-digit ZATCA VAT registration (`3xxxxxxxxxxxxxx`); required when VAT is on |
| `cr_number` | — | Commercial registration number; appears on invoice |
| `seller_name_ar` / `_en` | `ATEMA Studio` | Used on invoice + QR |
| `theme` | `noir` | Active theme for the whole site |

---

## 9. Database schema (Supabase / Postgres)

Tables and key columns:

```
packages            id · name_ar/en · price · duration_hours · edited_photos
                    album · video · description · features (text[])
                    badge · is_popular · active · sort_order · included_addon_ids
addons              id · name_ar/en · price · active · sort_order
bookings            id · booking_ref · customer_name/phone/email · location
                    package_id (FK, int) · event_date · event_time · addon_ids (text[])
                    subtotal · vat · total (all integer SAR)
                    status (pending|confirmed|completed|cancelled)
                    payment_status (unpaid|paid|refunded; +awaiting_transfer via migration)
                    payment_method · vat_enabled · special_requests
                    discount_code/amount/kind (discount-codes migration)
                    manage_token (160-bit capability secret) · reschedule_count
booking_changes     id · booking_id (FK) · kind (reschedule|package) · actor
                    old_value · new_value (jsonb) · price_delta · created_at
booking_otps        id · booking_id (FK) · purpose · code_hash · salt
                    expires_at · attempts · consumed_at · created_at
blocked_dates       id · date · reason · created_at
app_settings        id (singleton) · vat_enabled · vat_number · cr_number
                    seller_name_ar · seller_name_en · theme
contracts           id · booking_id (FK) · html · created_at
invoices            id · booking_id (FK) · invoice_number · html · created_at
portfolio_items     id · title_ar/en · category · image_url · caption_ar/en
                    sort_order · published · created_at
journal_posts       id · slug · title_ar/en · excerpt_ar/en · body_ar/en
                    cover_url · published · published_at · created_at
```

Row Level Security:
- Public can `SELECT` on `packages`, `addons`, `portfolio_items` (published),
  `journal_posts` (published).
- Authenticated admin can do everything.
- `bookings`, `contracts`, `invoices` — admin only (the booking flow uses
  Supabase service role via an Edge Function pattern for inserts, or
  permissive insert RLS — review your project's policies).
- `booking_changes` — admin `SELECT` only; written by the `change-booking`
  Edge Function as service-role.
- `booking_otps` — RLS on with **no** anon/authenticated policies; only the
  service-role Edge Function reads/writes it. Codes are stored as a salted
  SHA-256 hash, never in clear.
- Customer self-service reads its single booking through the
  `get_booking_by_token()` `SECURITY DEFINER` RPC (anon never touches the
  `bookings` table); all writes go through the `change-booking` Edge Function.

Supabase Storage buckets: `portfolio`, `journal` (new admin uploads). The
portfolio and journal editors can also choose from the curated public photo
pool in `src/content/photoPool.ts`, which points at optimized assets under
`public/photos/`.

---

## 10. Package profitability engine

See [`docs/PROFITABILITY.md`](./PROFITABILITY.md) for the full P&L model:
hourly rate target, direct costs, overhead allocation, true profit per
booking, and the three warning states (`below_direct_cost`, `thin_margin`,
`hourly_rate_below_target`).

---

## 11. Environment variables

Place these in a project root `.env` file (not committed):

```
VITE_SUPABASE_URL=<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_MOYASAR_PUBLISHABLE_KEY=pk_live_…   # or pk_test_…
```

Without `VITE_SUPABASE_URL` the site falls back to in-memory demo data
(fallback arrays in `usePackagesData.ts` and `useAddonsData.ts`).

---

## 12. Deployment

**Deployment is automated** — every push to `master` runs the
[`deploy.yml`](../.github/workflows/deploy.yml) GitHub Actions workflow:

1. `npm ci`
2. `npm test` — gates the build; a failing suite blocks the publish
3. `npm run build` — type-check + Vite build → `dist/`
4. `peaceiris/actions-gh-pages@v4` publishes `dist/` to the `gh-pages`
   branch using the source commit's message
5. GitHub Pages serves the new HEAD at <https://atemastudio.xyz> within
   ~1 minute

Watch progress on the
[Actions tab](https://github.com/farajaay/atema-studio/actions/workflows/deploy.yml).
The same workflow has a **Run workflow** button for redeploys without a
code change.

For local development:

```bash
npm install          # one-time
npm run dev          # local dev at http://localhost:5173
npm run build        # tsc + vite build → dist/
npm test             # vitest pure-logic suite (113 passing)
```

The legacy `npm run deploy` (`gh-pages -d dist`) still works for local
emergency deploys, but the CI pipeline is the day-to-day path.

---

## 13. Performance optimisations in place

- **Image pipeline** — `scripts/optimise-images.mjs` (sharp) resamples every
  photo + emits both `.jpeg` + `.webp` variants. Frontend serves WebP via
  `<picture>` with JPEG fallback. Total catalogue weight dropped from
  7.66 MB → 689 KB WebP / 967 KB JPEG (-91%).
- **Lazy loading** — package photos carry `loading="lazy"` + `decoding="async"`
  with explicit `width/height` (no CLS).
- **Promotion preload** — `index.html` has `<link rel="preload" as="image"
  type="image/webp" media="…">` so the modal artwork arrives in parallel with
  the JS bundle.
- **First-paint theme** — theme tokens live in an inline `<style>` block in
  `index.html` so the noir background paints before React mounts.
- **CSS vars over JS** — theme switching writes properties on `:root` once;
  no React re-render storm.

---

## 13b. Mood Board (post-booking editorial surface)

After a booking is paid (or marked *awaiting transfer*), Fatima can compose a
**Mood Board** — a private, editorial 6-image page shared with the bride via
WhatsApp. It transforms the gap between *booking confirmed* and *event day*
into a felt ritual: *"this is how we already see your day."*

### How to compose one

1. Open **Admin → Dashboard**, click any booking to open the detail modal.
2. Switch to the **لوحة المزاج** (Mood Board) tab — the third tab next to
   Details and P&L.
3. The composer auto-fills:
   - **6 images** chosen from your published portfolio, filtered by the
     bride's package category + event season
   - **Bilingual title + caption** drafted in the Atelier voice
4. Edit anything:
   - Click any image slot → swap from the full portfolio pool
   - Click **إعادة الاختيار تلقائيًا** to reshuffle the 6
   - Edit the four text fields (title AR/EN, caption AR/EN)
5. Click **حفظ** → the board is saved with a private URL
6. Click **معاينة** to open it in a new tab (`/#/board/<token>`)
7. Click **إرسال عبر واتساب** to open a pre-filled WhatsApp message to the
   bride containing the link

### What the bride sees

A noir-themed editorial page at `/#/board/<token>` with:
- Hero with bilingual title + a thin gold rule
- 2×3 image grid (1×6 on mobile) with FadeUp reveals + `<picture>` WebP +
  JPEG fallback
- "A Letter from the Atelier" — your caption in Amiri italic Arabic +
  Cormorant italic English
- Signature: **FATIMA · ATEMA STUDIO**

### Privacy & lifecycle

- The board's URL contains a 32-character random token (160 bits of
  entropy) — unguessable, the only secret
- First open silently marks `viewed_at` so you can see in the composer
  whether she's opened it
- The composer shows two badges next to her name: `✓ تم الإرسال` once
  you've clicked the WA button, and `👁 تم العرض` once she opens the page
- If the booking is deleted, the board cascades with it
- Boards are per-booking (one per booking) — re-opening the composer
  edits the existing one

### Building the portfolio pool

The composer can only pick from images you've published in
**Admin → Portfolio Manager**. The richer that library, the more varied
the boards. Aim for at least 4–6 published items in each of `bride`,
`couture`, and `editorial` so the auto-selection has room to breathe.

Portfolio and Journal managers also expose **اختيار من صور الموقع** inside
the image/cover editor. That picker uses the curated optimized site-photo pool
(`src/content/photoPool.ts`) so you can reuse already-deployed photos without
uploading a duplicate into Supabase Storage.

### Where it lives in code

- DB: `database/migrations-2026-05-moodboard.sql` (`mood_boards` table +
  `mark_mood_board_viewed` RPC)
- Service: `src/services/moodboard.ts`
- Admin composer: `src/components/MoodBoardComposer.tsx`
- Public page: `src/pages/MoodBoardPage.tsx`

---

## 13c. Studio-wide P&L dashboard (monthly rollup)

Per-booking P&L (the "P&L" tab inside each booking detail) tells you whether
*this* booking made money. **Studio-wide P&L** rolls that math across all
bookings so you can see the whole studio's health at a glance.

### How to open it

**Admin → Dashboard → الأرباح والخسائر** (the third section tab, next to
*Bookings* and *Calendar*). It uses the same booking data already on the
page — no extra fetch.

### What you see

- **Period toggle** at the top: **شهري / ربع سنوي / سنوي** (month /
  quarter / year). Defaults to month. The dashboard always aggregates
  monthly first, then rolls quarter / year on the fly.
- **4 KPI cards**: booking count, revenue ex-VAT, true profit, margin %.
  The margin colour goes red < 0, amber 0–15%, green > 15%.
- **Bar chart**: two bars per bucket — *gold = revenue ex-VAT*, *green
  = true profit*. Hover a bar for the precise number.
- **Bucket table**: each row is one month / quarter / year. Click any
  row to **expand** and see the per-package breakdown inside that
  bucket — surfaces "Couture pays my rent, Engagement is loss-leader"
  in seconds.
- **Per-package summary** at the bottom: same per-package metrics rolled
  across the *entire visible scope*. Sorted by revenue, descending.

### Which bookings count?

A booking is included when it has reached commitment:

- `status` is `confirmed` or `completed`, **or**
- `payment_status` is `paid` or `awaiting_transfer`

**Cancelled** and **refunded** bookings are always excluded.

This rule matches the spirit of contracted revenue — anything the bride
has signed for or paid against. If you want to see strict cash, filter
by `paid` only in the Bookings tab and eyeball the totals there.

### Tuning the numbers

The P&L engine reads its defaults from
`src/services/pl/config.ts` (`DEFAULT_COST_CONFIG`, `PACKAGE_DEFAULTS`).
Edit that file to change:

- `ownerHourlyRate` — your hourly rate target (currently 150 SAR/hr)
- `cameraValue` / `cameraLifespanYears` — equipment depreciation
- `assistantHourlyRate` / `videographerHourlyRateDefault` — team rates
- `albumA4Cost` / `albumA3Cost` — production costs
- `expectedBookingsPerYear` — overhead allocation denominator (35 by
  default; lower this in slow years to allocate more overhead per booking)
- `PACKAGE_DEFAULTS` — coverage hours, album size, team inclusions per
  package tier

After editing, run `npm run build` and `npm run deploy` to push.

### What lives where in code

- Engine (per booking): `src/services/pl/engine.ts` (unchanged)
- Config & package defaults: `src/services/pl/config.ts`
- Studio-wide aggregator: `src/services/pnl.ts` (monthly aggregation,
  quarter/year rollup, totalSummary, `isPLRevenueBooking`)
- Dashboard UI: `src/components/StudioPLDashboard.tsx`
- Per-booking PLTab (unchanged): `src/components/PLTab.tsx`

---

## 13d. Security posture — what protects the studio

### What's in the deployed bundle and why it's safe

The `dist/` JavaScript that gets pushed to GitHub Pages contains:

- The **Supabase URL** + **anon public key**. These are public by design.
  All real protection lives in Row-Level Security policies on the
  database, not in keeping the key secret.
- The **business logic** (form validation, package definitions, P&L math).
  Anyone can read it. We minify + mangle + strip console logs (via terser
  in `vite.config.ts`) so casual inspection is harder, but it is not
  encrypted. **Never put a secret in source code.** Real secrets — the
  service-role key, Moyasar secret key, Anthropic API key, Meta WA
  tokens — live only in **Supabase Edge Function secrets**.

### Row-Level Security model

Every public table has RLS enabled. Roles:

| Role | What it can do |
|---|---|
| `anon` | Read tightly-scoped public views (e.g. `public_booked_dates` — date + status only, **no PII**). Insert bookings/customers with shape validation. Update bookings only to mark a payment intent. |
| `authenticated` | The admin's Supabase session. Full read/write on all tables. |
| `service_role` | Used **only** by Edge Functions. Bypasses RLS entirely. Where sensitive operations (e.g. server-side total recomputation, WhatsApp signing) happen. |

The hardening migration `database/migrations-2026-05-rls-hardening.sql`
replaces the old "`WITH CHECK (true)`" policies with constrained ones:

- Booking inserts require name 2-120 chars, phone 7-25 chars, future
  event_date, sane subtotal (≤ 200k SAR), and forced initial status
  `pending` + `unpaid`.
- Booking updates can only set `payment_method` and step
  `payment_status` along the allowed lifecycle.
- The customer-facing `DatePicker` reads from the
  `public_booked_dates` view, not the `bookings` table — so customer
  names + booking refs are never sent to anonymous browsers, even in
  network responses.

### When you'll want to do more

Run `database/migrations-2026-05-rls-hardening.sql` in Supabase SQL
editor whenever Supabase's security advisor flags `bookings`. After
deploying the `create-booking` Edge Function, you can run the **Final
cleanup** block at the bottom of that file to drop anonymous INSERT
on `bookings` entirely — at that point the only anon access is the
PII-free view.

### Repo visibility

The GitHub repository is **public**. Making it private requires GitHub
Pro / Team / Enterprise *if* you want to keep Pages serving from it on
the same plan. With the Free plan, flipping to private auto-disables
Pages, which takes the live site down. If you ever want this:

- **Pay $4/mo for GitHub Pro** (Pages from private repos becomes free)
- **OR** move hosting to Cloudflare Pages / Netlify / Vercel (free
  tiers support private repos and they're often faster than GH Pages)

Either way, the *deployed* bundle is still inspectable in DevTools, so
making the repo private is mostly about keeping the *source history* +
*commit messages* + *docs* private.

---

## 13e. Discount codes

Discount codes let Fatima run seasonal promotions (Ramadan, National Day),
hand custom codes to influencer partners, and offer goodwill discounts
during rescheduling — all with one mechanism. Full design lives in
[`docs/integrations/discount-codes.md`](./integrations/discount-codes.md).

### How brides apply a code

In the booking summary panel (right side on desktop, sticky on mobile),
above the running total, there's a **كود خصم؟** input. The bride types
the code and taps **تطبيق**. We validate it server-side and either show:

- `RAMADAN25 · خصم 25% · −١٬٩٠٠` (success, with strike-through over the
  gross subtotal and a new total below)
- A red helper line for any failure (expired, not found, fully redeemed,
  below the minimum subtotal, etc.)

The actual redemption + atomic increment of `used_count` happens later
inside the `create-booking` Edge Function — the input field is only a
preview.

### How Fatima manages codes

Admin → top nav → **الأكواد** (or `/admin/discount-codes`).

A list of every code with usage count + status. Click **+ كود جديد** or
the edit icon on a row to open the editor. Fields:

| Field | Notes |
|---|---|
| Code | Auto-uppercased. 2–32 chars. Only A–Z, 0–9, `-`, `_`. Must be unique. |
| Description | Internal label (not shown to brides). |
| Type | **نسبة مئوية** (percent) or **مبلغ ثابت** (flat SAR). |
| Value | The percent (1–100) or flat SAR amount. |
| Max discount | Optional cap on percent codes (e.g. "25% off, capped at 1500 SAR"). |
| Min subtotal | Optional floor — code rejected if booking is below this. |
| Valid from / to | Optional window. Blank = unbounded. |
| Max uses | Optional global cap. Blank = unlimited. |
| Active | When off, the code is invisible to brides but historical bookings keep their record. |

**Pause** a code instead of deleting it. Codes with `used_count > 0`
cannot be deleted (the bookings still reference them); pause via the
icon next to the edit button.

### Where it shows up

- **Booking page summary** — bride sees `−1,900 ر.س` line + new total.
- **Contract** — a highlighted "خصم مطبّق" box above the financial
  summary with the code and amount.
- **Invoice (ZATCA Phase-1)** — a discount row between gross subtotal
  and VAT. VAT is computed on the **discounted** subtotal, per ZATCA
  treatment. The QR code's `tag 4` (total incl VAT) and `tag 5` (VAT
  amount) reflect the discounted figures.
- **Admin booking modal** — a small gold-bordered banner under customer
  info showing which code was applied + the amount.
- **Studio-wide P&L** — automatically reflects discounts as lower
  `subtotal` (the column already stores the net figure post-discount).
  No special handling needed.

### Activation steps

1. **Run** `database/migrations-2026-05-discount-codes.sql` in Supabase
   SQL editor. This creates the `discount_codes` table, three new
   columns on `bookings`, the `preview_discount_code()` and
   `redeem_discount_code()` RPCs, and the RLS policies.
2. **Deploy** the updated `create-booking` Edge Function:
   ```
   supabase functions deploy create-booking
   ```
3. **Create your first code** at `/admin/discount-codes`. Try `TEST10`
   with `max_uses = 1` to test the flow end-to-end.

### Security model

- Brides cannot list valid codes (RLS blocks anon SELECT on
  `discount_codes`).
- Brides cannot forge a discount amount in the booking insert: the
  `create-booking` Edge Function ignores client-supplied discount
  values and asks `redeem_discount_code()` for the authoritative
  amount.
- Two brides redeeming the last seat of a `max_uses = 50` code at the
  same instant cannot both succeed: the RPC row-locks + increments in
  one transaction.
- `used_count` is `service_role`-only writable. Nothing in the public
  bundle can decrement or reset it.

---

## 13f. Audit-pass patches (2026-05-21)

A re-audit after the discount-codes ship surfaced four HIGH findings
and several MEDIUMs (full list in `docs/bugs.md`). All HIGHs and
MEDIUMs were patched in a single sweep on 2026-05-21:

| Patch | What it fixes |
|---|---|
| **H-6** | Mood Board table was anon-readable. Now locked down — anon access goes through `get_mood_board_by_token()` RPC which returns only the row matching the supplied token. |
| **H-9** | Loose `using (true)` anon SELECT on `bookings` (a leftover from before the DatePicker migration to the public view) is dropped. |
| **H-7** | Discount amount now re-validates server-side whenever the bride changes her basket. Percent codes can no longer become "50% off" by shrinking the basket. |
| **H-7b** | Discount input now displays the code's honest raw value + "capped at X" when applicable. Percent codes with a `max_discount` cap no longer mis-report. |
| **M-8** | Invoice number suffix is now CSPRNG + Crockford base32 (~1.1 T possibilities) instead of `Math.random` over 90k. No more birthday-paradox collisions. |
| **M-9** | The booking-insert RLS policy now verifies discount math via `preview_discount_code()` — so the fallback path (direct insert when the Edge Function is down) can safely persist discount fields without trusting client values. |
| **M-10** | `preview_discount_code` is now wrapped in a rate-limited Edge Function (`discount-preview`) with per-IP token-bucket (5/sec, 60/5min). Brute-force code enumeration is blocked. |
| **L-8** | Storage paths for journal + portfolio uploads now use `crypto.randomUUID()` instead of `Math.random` (eliminates any chance of collision-overwriting). |

### Activation steps

1. Run `database/migrations-2026-05-audit-patches.sql` in Supabase
   SQL editor. Idempotent.
2. Deploy the new + updated Edge Functions:
   ```
   supabase functions deploy discount-preview create-booking
   ```
3. (Already shipped) Code changes are live with this commit.

## 13g. Customer self-service booking changes

A bride can change her own booking from a private link — **without an account
and without messaging you** — for the two changes she most often needs:
reschedule the date, or swap her package / add-ons. Everything is policed by
the contract and recomputed server-side; she can never move money in her own
favour.

### The private link

Every booking carries a `manage_token` — a 160-bit random secret (the same
unguessable-link idea as the Mood Board). Her management page lives at:

```
https://atemastudio.xyz/#/manage/<token>
```

The token is the only credential. The page reads her booking through the
`get_booking_by_token()` RPC, which returns **only** the single row matching
that token — anon can never list or read the `bookings` table.

> ⚠ **Sending the link is not yet automated.** The token exists on every
> booking, but nothing texts it to the bride at booking time yet. For now the
> link is shared manually (or by a future tweak to `create-booking`). See
> "What's not built yet" below.

### Reschedule (low-risk — link only)

The page shows her booking and a date picker (the same one as the public site,
so it only offers genuinely free days). The rules — from **Article 3 of the
contract** — are enforced both in the page and, authoritatively, in the
`change-booking` Edge Function:

- **Once only** — a booking can be rescheduled a single time.
- **≥ 7 days notice** — no self-service moves inside the final week.
- **Within 30 days** of the original date.
- **Subject to availability** — the new day is re-checked against the live
  calendar (other bookings + blocked dates) at the moment of the change.

On success the date moves, `reschedule_count` ticks up, an audit row is
written, and both the bride and you get a WhatsApp confirmation.

### Change package / add-ons (money — step-up code required)

Because this moves money, it needs a second factor on top of the link:

1. She picks a new package / toggles add-ons and taps **"Send verification
   code."**
2. The Edge Function texts a **6-digit code** to the phone on file (the code
   is never returned in the web response — only to her WhatsApp).
3. She enters the code and confirms.

The server then **recomputes the total from the live catalogue** (package +
add-ons + her city's travel fee), **keeps her original discount** (it is not
re-redeemed, so a code's usage budget isn't double-spent), and classifies the
result:

- **Upgrade** → a *balance to pay* is shown; you'll be contacted to collect it.
- **Downgrade** → the deposit is non-refundable (Article 3), so nothing is
  refunded and nothing is owed.
- **No change** → nothing due.

The code is single-use, expires in **10 minutes**, and locks out after **5
wrong attempts**. Codes are stored only as a salted hash.

### What's not built yet (deliberate follow-ups)

All three original follow-ups have since shipped (June 2026):

- ✅ **Link delivery** — the manage link is texted with the booking WhatsApp.
- ✅ **Top-up collection** — `ManageBookingPage` opens a live Moyasar form for
  the balance after an upgrade; `verify-payment` clears it.
- ✅ **Contract / invoice regeneration** — not automatic, by design: after a
  change, regenerate from the admin booking modal's **المستندات** card
  (§13i). A new version is appended; history is kept.

### Where it lives in code

| Piece | File |
|---|---|
| Reschedule policy (pure, tested) | `supabase/functions/_shared/reschedule.ts` |
| OTP primitives (pure, tested) | `supabase/functions/_shared/otp.ts` |
| Price-change / delta math (pure, tested) | `supabase/functions/_shared/change.ts` |
| Request wiring (glue, tested) | `supabase/functions/change-booking/handlers.ts` |
| Deno runtime shell | `supabase/functions/change-booking/index.ts` |
| Glue test suite (mocked Supabase) | `src/services/change-booking-glue.test.ts` |
| Client data + Edge calls | `src/services/manage.ts` |
| Customer page | `src/pages/ManageBookingPage.tsx` |
| Schema | `database/migrations-2026-05-booking-changes.sql` + `…-otp.sql` |

### Activation steps

1. Run `database/migrations-2026-05-booking-changes.sql`, then
   `database/migrations-2026-05-booking-changes-otp.sql`, in the Supabase SQL
   editor (both idempotent). The first backfills a `manage_token` onto every
   existing booking.
2. Deploy the function: `supabase functions deploy change-booking`.
3. Push the change to master — the CI workflow ships the `/manage` page
   automatically.
4. (Optional) Submit a WhatsApp template for the OTP if you want it sent as a
   template rather than a session message.

---

## 13h. Booking-confirmation email (Zoho Mail SMTP)

Every booking with a valid `customer_email` receives a single bilingual
email from `atema@atemastudio.xyz` immediately after the booking row is
written. The email gives the bride a durable paper trail, an English
fallback when she's reading on a laptop, and a deep link back to her
`/#/manage/<token>` page.

### What gets sent

- **Subject:** `تأكيد الحجز · Booking confirmed — <ref> — ATEMA STUDIO`
- **Body:** Bilingual HTML — noir gradient header, two summary cards
  (Arabic + English) showing reference / package / date / time / total,
  a noir-pill CTA to the manage page, and a footer with the studio's
  contact info. Same stationery palette as the contract and invoice —
  see [`design.md`](./design.md).
- **Plaintext fallback** for clients that don't render HTML.
- **Reply-To** is the sender mailbox, so replies land back in the Zoho
  inbox naturally.

### Architecture

```
BookingPage  →  create-booking Edge Fn
                  │
                  ├─ INSERT bookings row
                  ├─ send-whatsapp call          (fire-and-forget)
                  └─ sendEmail()                 (fire-and-forget, NEW)
                        │
                        ├─ Zoho SMTP → atema@atemastudio.xyz
                        └─ audit row in email_messages
                            (status: sent | skipped | failed)
```

Failure is **non-fatal** — a flaky SMTP session never rolls back a
successful booking. The audit row tells you whether it landed.

### Where it lives in code

| Piece | File |
|---|---|
| SMTP wrapper (denomailer) | `supabase/functions/_shared/email.ts` |
| Bilingual HTML template | `supabase/functions/_shared/email-confirmation.ts` |
| Stationery palette (Deno mirror) | `supabase/functions/_shared/stationery.ts` |
| Wired into booking insert | `supabase/functions/create-booking/index.ts` |
| Audit table | `database/migrations-2026-05-email.sql` |
| Operator setup doc | `docs/integrations/email.md` |

### Activation steps

The full procedure (DNS, app password, secrets, smoke test) lives in
[`docs/integrations/email.md`](./integrations/email.md). Short form:

1. Generate a Zoho app password at <https://accounts.zoho.com> → Security → App Passwords.
2. Add DNS records: SPF (`v=spf1 include:zoho.com -all`), DKIM (from
   Zoho admin), DMARC (`p=none` to start).
3. Run `database/migrations-2026-05-email.sql` in Supabase SQL editor.
4. Set Supabase secrets: `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD`,
   `SITE_ORIGIN`, plus host/port/from defaults if overriding.
5. `supabase functions deploy create-booking`.
6. Smoke-test with a real booking to an inbox you control. The audit row
   in **Supabase → email_messages** should show `status='sent'`.

### Debugging deliverability

| Symptom | Cause | Fix |
|---|---|---|
| `status='skipped'`, error `no_valid_recipient` | Bride left email blank or it failed format check | Nothing to fix — booking still succeeded, follow up by WA |
| `status='skipped'`, error `smtp_credentials_unset` | Supabase secrets missing | Set them and redeploy |
| `status='failed'`, error `Invalid login: 535 Authentication failed` | App password expired or wrong | Regenerate at Zoho, update secret, redeploy |
| All mail lands in spam | DKIM / SPF misconfigured | Recheck via <https://mail-tester.com> |

### What's NOT built (deliberate scope)

- **Lifecycle emails** (deposit received, final-payment due, mood-board
  ready, shoot-day tomorrow). WhatsApp covers these. Add later only if
  brides ask.
- **PDF attachments.** The bride generates the contract + invoice
  client-side from the booking flow + manage page; the email links to
  the manage page rather than attaching duplicates.
- **Channel preference picker.** Currently every booking with an email
  gets the email; WA always sends. Decoupling them is parked until the
  Telegram bot decision lands (see §14).

---

## 13i. Documents, refunds & operational security (June 2026)

### The المستندات card (booking modal → details tab)

Every booking's contract and tax invoice live as **versions** in the
`contracts` / `invoices` tables (append-only; the newest row is the live
document). The card shows the latest version of each with **عرض** /
**تحميل**, plus one button:

> **إعادة إنشاء المستندات بالبيانات الحالية** — rebuilds both documents
> from the booking as it is *right now*.

Use it after any package/add-on change — whether the bride did it from
her manage link or you edited the booking. The regenerated invoice gets
a **new invoice number** (the old one stays on file); the contract is
re-dated to the regeneration day. Old versions are never deleted — they
are the audit trail.

Requires `database/migrations-2026-06-documents.sql` (also tightens the
tables to admin-only reads — they hold customer names and phones).

### Refund deposit (exceptional path)

The booking modal shows an **استرداد العربون** danger zone on paid /
awaiting-transfer bookings. It cancels the booking and marks the payment
**مُسترد** — nothing more. Two things to remember:

1. **The money moves outside the system.** Make the actual bank transfer
   yourself, then click the button so the records match.
2. **The customer policy is unchanged** — the deposit stays
   non-refundable *to the bride*. This button exists for the cases where
   ATEMA itself cancels (illness, double-book, force majeure).

### Bank-receipt verification is a human decision — always

The WhatsApp receipt OCR (Claude Vision) is **advisory**: it extracts
the amount/date/reference to save you typing. It does not, and must
never, flip a booking to `paid` on its own authority. The rule:

> **Money is confirmed against the bank statement, not against a
> screenshot.** Open Al Rajhi, find the credit, match the booking ref,
> *then* set حالة الدفع = مدفوع. A doctored receipt image costs a
> fraudster nothing; the bank statement cannot be photoshopped.

### Failed-sends banner

The dashboard shows a red banner when any confirmation email or
WhatsApp message failed in the last 7 days (from the `email_messages` /
`wa_messages` audit tables). Sends are fire-and-forget by design, so
this banner is the only place a dead Zoho password or an expired Meta
token becomes visible. If it appears: §13h has the email debugging
table; for WhatsApp, regenerate the access token in Meta Business
Manager and update the Supabase secret.

### Operator-account 2FA (do once, today)

One person controls everything, so one phished password is a full
compromise. Enable two-factor authentication on **all four** operator
accounts — Supabase (database + secrets), GitHub (code + deploy
pipeline), Meta Business (WhatsApp), Zoho (email) — using an
authenticator app, not SMS, where offered. Also decide now what happens
if the owner's phone is lost: it receives both the WA business messages
and any OTPs, so keep recovery codes for the four accounts printed and
stored offline at the studio.

---

## 13j. Transfer-only payments & the WhatsApp switch (July 2026)

Two launch decisions live in the product now; this is how you operate them.

### Payments are transfer-only (cards deferred)

- The booking flow offers **bank transfer only** while the Moyasar key is
  unset; the customer copies the official Al Rajhi IBAN and sends her
  receipt on WhatsApp, as before.
- **Package-upgrade top-ups** (from the bride's manage page) settle the same
  way: after an upgrade she sees the IBAN + a WhatsApp button pre-filled
  with her booking ref and the exact amount.
- **Your side:** bookings with an outstanding upgrade balance show a **gold
  chip** (● +amount) next to the payment badge in the dashboard list. Open
  the booking → under حالة الدفع you'll see **رصيد ترقية مستحق** with a
  two-tap **"تم استلام المبلغ — تصفير الرصيد"** button. Verify the transfer
  receipt first (WhatsApp / bank app), then clear it. The chip disappears.
- Activating cards later needs no code: set the
  `VITE_MOYASAR_PUBLISHABLE_KEY` GitHub secret + a matching-mode
  `MOYASAR_SECRET_KEY` Supabase secret and redeploy — card forms appear
  everywhere automatically, and card top-ups clear themselves.

### Notifications: email always, WhatsApp by switch

- **Email is the channel that always fires**: booking confirmation (with
  contract + invoice), the package-change OTP, reschedule and
  package-change confirmations to the bride, and change alerts to the
  studio inbox (atema@ by default; set an `OWNER_EMAIL` Supabase secret to
  redirect them).
- **WhatsApp is additive**, controlled by the **الإعدادات → WhatsApp**
  toggle (`wa_enabled`, currently OFF because Meta approval is pending).
  Off = the WA code path is skipped entirely — no failed sends, no log
  noise. On = customers get both channels; lifecycle reminders
  (`wa-reminders`) start working too, provided the Meta credentials +
  cron are configured (`docs/integrations/wa-platform.md`).
- Watch the **failed-sends banner** on the dashboard — it's your early
  warning if Zoho (or WhatsApp, when enabled) starts failing.

---

## 15. Package hero photos & object positioning

Each package card renders a hero photo above the card body. The
mapping + cropping are tuned in `src/pages/BookingPage.tsx`:

```ts
const PKG_PHOTO: Record<string, PkgPhoto> = {
  engagement: { file: 'B6B52466-...JPG',  position: 'top left' },
  customise:  { file: 'IMG_5506.JPG',      position: 'center 25%' },
  classic:    { file: 'IMG_5620.JPG',      position: 'center 25%' },
  royal:      { file: 'IMG_5607.JPG',      position: 'center 28%' },
  signature:  { file: 'IMG_5525.JPG',      position: 'center 22%' },
  couture:    { file: 'IMG_5623.JPG',      position: 'center 22%' },
};
```

- The card crops at 200 px tall (the modal at 220 px). `object-fit:
  cover` is set globally in `index.html` under `.pkg-photo`.
- `position` is CSS `object-position`. For face-in-upper-third
  portraits, `center 22%` to `center 28%` keeps the face just below
  the badge area. Adjust per photo if needed.
- To swap a photo: drop a new file into `public/photos/`, run
  `node scripts/optimise-images.mjs` to produce WebP + JPEG pairs,
  then edit the filename in `PKG_PHOTO`. The price-tier fallback at
  the bottom of `getVisual()` covers custom packages.

---

## 14. Future enhancements (parked)

**Already shipped (do not re-build):**
- ✅ WhatsApp lifecycle reminders + receipt vision OCR — see
  [`integrations/wa-platform.md`](./integrations/wa-platform.md).
- ✅ Booking-confirmation email (Zoho SMTP) — see §13h and
  [`integrations/email.md`](./integrations/email.md).
- ✅ CI auto-deploy on push to master — see §12.
- ✅ Stationery palette convergence — see [`design.md`](./design.md).

**Parked (genuinely not built):**
- **Telegram bot** as a parallel comms channel to WhatsApp. KSA luxury-
  bridal market is overwhelmingly WhatsApp; defer until brides actually
  ask. Build is cheap — mirror `wa-webhook` + `wa-receipt` into
  `tg-*`, add a `comm_pref` column on `bookings`, add a picker to the
  booking modal.
- **Lifecycle emails** (deposit received, mood-board ready, shoot-day
  tomorrow). WA covers these today.
- **Tap Payments** as a Moyasar alternative — see
  [`integrations/payments.md`](./integrations/payments.md). Only when
  Mada volume justifies it.
- **Channel-preference picker** on the booking form (WA / Email / Both).
- **Top-up payment collection** for the self-service upgrade path
  (§13g) — currently flags the balance owed but doesn't open a
  Moyasar/transfer flow.
- **Auto-send the `/manage/<token>` link** at booking time (§13g).
- **Contract / invoice regeneration** after a self-service change.
- **Bundle code-splitting** beyond the admin lazy chunk — the public
  bundle is ~464 KB gzipped to ~140 KB; split further if it grows.
- **Server-side rendering / SEO** — current setup is client-rendered
  with hash routing. Migrate to Next.js + Supabase if SEO becomes
  important.

---

## 15. Where to find things in code

| Need to change… | File |
|---|---|
| Booking-page UI / customer flow | `src/pages/BookingPage.tsx` |
| Admin bookings list, modal, filters | `src/pages/AdminDashboard.tsx` |
| Admin month calendar | `src/components/AdminCalendar.tsx` |
| Customer date picker | `src/components/DatePicker.tsx` |
| Customer self-service (reschedule / change package) | `src/pages/ManageBookingPage.tsx` + `src/services/manage.ts` |
| Mood Board composer (admin) | `src/components/MoodBoardComposer.tsx` + `src/services/moodboard.ts` |
| Mood Board public page | `src/pages/MoodBoardPage.tsx` |
| Booking-change rules + server enforcement | `supabase/functions/_shared/{reschedule,otp,change}.ts` + `supabase/functions/change-booking/` |
| Screen theme tokens | `src/theme/themes.ts` + `index.html` `<style>` block |
| Stationery palette (contract / invoice / email / policy) | `src/theme/stationery.ts` + Deno mirror at `supabase/functions/_shared/stationery.ts` |
| Theme picker UI | `src/components/AppSettingsPanel.tsx` (ThemeCard sub-component) |
| Invoice template | `src/services/invoice.ts` |
| Contract template | `src/services/contract.ts` |
| Booking-confirmation email template | `supabase/functions/_shared/email-confirmation.ts` |
| SMTP wrapper | `supabase/functions/_shared/email.ts` |
| T&C + PDPL bilingual content (popups + `/policy`) | `src/content/legal.ts` |
| Bank account details | `src/components/BankTransferPayment.tsx` (BANK constant) |
| Cities + travel fees | `src/pages/BookingPage.tsx` (CITIES constant) |
| Promotion modal image | `public/photos/Promotion.jpg` + `.webp` (+ `_Mobile` variants) |
| Promotion modal component | `src/components/PromotionModal.tsx` |
| CI auto-deploy workflow | `.github/workflows/deploy.yml` |

---

## 16. Support & escalation

- **Code repo:** <https://github.com/farajaay/atema-studio>
- **Live site:** <https://atemastudio.xyz>
- **CI deploys:** <https://github.com/farajaay/atema-studio/actions/workflows/deploy.yml>
- **Supabase project:** log in at <https://supabase.com> with the studio account.
- **Moyasar dashboard:** <https://moyasar.com>.
- **Zoho Mail inbox:** <https://mail.zoho.com> — `atema@atemastudio.xyz`.
- **Meta Business / WhatsApp:** <https://business.facebook.com>.
- **Domain / DNS (Namecheap):** the apex has 4 A records pointing at
  GitHub Pages (`185.199.108–111.153`), `www` is a CNAME to
  `farajaay.github.io`, and TXT records carry SPF / DKIM / DMARC for
  Zoho. `public/CNAME` pins `atemastudio.xyz` so the gh-pages publish
  preserves it. Full record table in
  [`../BACKEND_SETUP.md`](../BACKEND_SETUP.md) §8.
