# ATEMA STUDIO — Owner's Manual

> A complete operational + technical handbook for the ATEMA Studio booking platform.
> Updated 2026-05-17. Maintained alongside the codebase at
> [farajaay/atema-studio](https://github.com/farajaay/atema-studio).

---

## 1. What you own

ATEMA Studio is a **bilingual (Arabic / English), luxury women-only photography
studio booking platform** for the Eastern Province of Saudi Arabia. The system
includes:

| Surface | Purpose |
|---|---|
| **Public site** | Editorial brand presence — Home, Portfolio, Journal, About |
| **Booking flow** | Customer self-service: pick a package, customise add-ons, pay deposit |
| **Admin panel** | Bookings list, monthly calendar, packages CRUD, portfolio CRUD, journal CRUD, system settings |
| **Document engine** | Auto-generated ZATCA-compliant invoices (with QR), formal contracts, T&C popups |
| **Theme engine** | Two themes (Couture Noir + Atelier Ivory), switchable from the admin panel |

Hosted on **GitHub Pages** at <https://atemastudio.xyz> with
data in **Supabase** (Postgres + Storage + Auth).

---

## 2. Brand & design concepts

### 2.1 The two themes

| Token | Couture Noir (default) | Atelier Ivory |
|---|---|---|
| Bg | `#0B0B0B` true black | `#F5EDE4` ivory |
| Surface | `#141414` | white |
| Surface alt | `#1C1C1C` | `#FBF6EE` |
| Heading ink | `#EFE3D1` ivory | `#1A1A1A` editorial black |
| Body ink | `#D8CDB9` | `#4A3728` |
| Accent (gold) | `#D4AF7A` champagne | `#8C6B4F` deep bronze |
| Accent (deep) | `#BB864B` | `#6B5440` |
| Hairline | `rgba(212,175,122,0.18)` | `rgba(214,191,163,0.4)` |

### 2.2 Typography
- **Display headlines** — `Cinzel Light` (Latin). For Arabic, the cascade falls
  back to `Tajawal Light` so headings stay in family with body copy.
- **Body** — `Montserrat Light` (Latin) / `Tajawal Light` (Arabic).
- **Editorial captions / eyebrows** — `Cinzel 400` 0.4em letter-spacing,
  uppercase, gold.
- **Printable docs (contracts / invoices)** — `Amiri` (display) + `Tajawal` (body),
  ivory paper aesthetic regardless of theme.

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
  /book                    BookingPage        Full booking flow

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
bookings            id · booking_ref · customer_name/phone/email · city · venue
                    package_id (FK) · event_date · addons (jsonb)
                    subtotal · vat · total · deposit
                    status (pending|confirmed|completed|cancelled)
                    payment_status (unpaid|paid|refunded)
                    payment_method · payment_ref · vat_enabled · special_requests
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

Supabase Storage buckets: `portfolio`, `journal` (image uploads).

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

```bash
npm install          # one-time
npm run dev          # local dev at http://localhost:5173
npm run build        # tsc + vite build → dist/
npm run deploy       # publish dist/ to gh-pages branch
```

Pushing to `master` does **not** auto-deploy — `npm run deploy` is the manual
step. Production URL: <https://atemastudio.xyz>.

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

## 14. Future enhancements (parked)

- **WhatsApp automation** — see [`docs/integrations/whatsapp.md`](./integrations/whatsapp.md).
- **Tap Payments** as a Moyasar alternative — see [`docs/integrations/payments.md`](./integrations/payments.md).
- **Bundle code-splitting** — current bundle is 715 KB; split admin and public
  surfaces with React.lazy when bundle size becomes an issue.
- **Server-side rendering / SEO** — current setup is client-rendered with hash
  routing. Migrate to Next.js + Supabase if SEO becomes important.

---

## 15. Where to find things in code

| Need to change… | File |
|---|---|
| Booking-page UI / customer flow | `src/pages/BookingPage.tsx` |
| Admin bookings list, modal, filters | `src/pages/AdminDashboard.tsx` |
| Admin month calendar | `src/components/AdminCalendar.tsx` |
| Customer date picker | `src/components/DatePicker.tsx` |
| Theme tokens | `src/theme/themes.ts` + `index.html` `<style>` block |
| Theme picker UI | `src/components/AppSettingsPanel.tsx` (ThemeCard sub-component) |
| Invoice template | `src/services/invoice.ts` |
| Contract template | `src/services/contract.ts` |
| Bank account details | `src/components/BankTransferPayment.tsx` (BANK constant) |
| Cities + travel fees | `src/pages/BookingPage.tsx` (CITIES constant) |
| Promotion modal image | `public/photos/Promotion.jpg` + `.webp` (+ `_Mobile` variants) |

---

## 16. Support & escalation

- Code repo: <https://github.com/farajaay/atema-studio>
- Supabase project: log in at <https://supabase.com> with the studio account.
- Moyasar dashboard: <https://moyasar.com> with the studio account.
- Domain / DNS: GitHub Pages defaults (`farajaay.github.io/atema-studio`).
  Add a custom domain by setting `CNAME` in `public/` and updating the DNS
  records.
