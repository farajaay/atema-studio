# ATEMA STUDIO — Project Overview

> Luxury photography studio booking platform for Saudi Arabian women's events
> Bilingual (Arabic-first / English) · Mobile-optimised · ZATCA-compliant

**Live:** https://atemastudio.xyz
**Repo:** `_deploy/atema-studio/`

---

## 1. Stack

| Layer        | Technology |
|--------------|------------|
| Frontend     | React 19 + TypeScript + Vite 8 |
| Routing      | `react-router-dom` (HashRouter — required for GH Pages) |
| Styling      | Inline styles + brand tokens (no CSS framework). Two screen palettes + one stationery palette — see [`docs/design.md`](./docs/design.md) |
| Icons        | `lucide-react` |
| Backend / DB | Supabase (PostgreSQL + Row-Level Security) |
| Edge Functions | `create-booking` (server-side total + email), `change-booking` (self-service reschedule + OTP-gated package change), `discount-preview`, `wa-webhook`, `wa-receipt` (Claude-Vision OCR), `wa-reminders` (cron), `send-whatsapp` |
| Payments     | Moyasar SDK (CDN, Halalas) **+** Bank Transfer fallback |
| Tax          | ZATCA Phase 1 Simplified Tax Invoice (TLV/Base64 QR) |
| Hosting      | GitHub Pages (auto-deploy from `master` via `.github/workflows/deploy.yml`) |
| Comms — chat | Meta WhatsApp Cloud API (lifecycle reminders + Claude-Vision receipt OCR) |
| Comms — email | Zoho Mail SMTP from `atema@atemastudio.xyz` (bilingual booking confirmation) |

---

## 2. Brand Identity

ATEMA runs **two parallel palettes** — see [`docs/design.md`](./docs/design.md)
for the full system. In short:

- **Screen palette** — `src/theme/themes.ts` + `getBookingPalette()` +
  CSS custom properties on `:root`. Two themes (Couture Noir default,
  Atelier Ivory) switchable from the admin panel. The values above for
  Atelier Ivory live there.
- **Stationery palette** — `src/theme/stationery.ts` (mirrored at
  `supabase/functions/_shared/stationery.ts` for the email Edge Function).
  Drives the contract, ZATCA invoice, booking-confirmation email, public
  `/policy` page, and the booking-flow T&C/PDPL popups. Always wears the
  same dress regardless of the admin theme toggle.

**Typography**
- Brand wordmark ("ATEMA STUDIO" in any script): `Amiri`, spaced letters
- Display headlines: `Cormorant Garamond` (Latin) · `Amiri` (Arabic)
- Body / UI: `Tajawal` (works for both Latin + Arabic)
- Tabular numerals: `Tajawal` with `font-feature-settings:"tnum" 1`
  (Inter was previously used as a third font on the invoice but was
  dropped during the stationery convergence — commit `a2866ae`)

---

## 3. Folder Structure

```
atema-studio/
├── .github/workflows/
│   ├── deploy.yml             CI auto-deploy master → gh-pages
│   └── test.yml               Manual test run (workflow_dispatch)
├── src/
│   ├── App.tsx                Root router (HashRouter) + React.lazy admin
│   ├── main.tsx               Entry point
│   ├── index.css              Brand-aligned base styles
│   ├── components/
│   │   ├── SiteHeader.tsx     Top nav (lang switcher, admin link)
│   │   ├── PackageCard.tsx    Package tile with click-to-details modal
│   │   ├── DatePicker.tsx     Customer date picker (public_booked_dates)
│   │   ├── MoyasarForm.tsx    Online card payment (Moyasar SDK)
│   │   ├── BankTransferPayment.tsx
│   │   ├── PaymentMethodChooser.tsx
│   │   ├── PromotionModal.tsx Landing-page promo modal
│   │   ├── MoodBoardComposer.tsx Admin mood-board editor (3rd booking tab)
│   │   ├── PLTab.tsx          Per-booking P&L admin tab
│   │   └── StudioPLDashboard.tsx Studio-wide P&L rollup
│   ├── pages/
│   │   ├── BookingPage.tsx    Customer booking flow (modal lives here)
│   │   ├── ManageBookingPage.tsx /#/manage/<token> self-service
│   │   ├── MoodBoardPage.tsx  /#/board/<token> noir mood board
│   │   ├── PolicyPage.tsx     /#/policy T&C + PDPL public page
│   │   ├── AboutPage.tsx · HomePage.tsx · PortfolioPage.tsx · JournalPage.tsx
│   │   ├── AdminLogin.tsx · AdminDashboard.tsx
│   │   ├── PackagesManager.tsx · PortfolioManager.tsx · JournalManager.tsx
│   │   └── PaymentResultPage.tsx
│   ├── services/
│   │   ├── supabase.ts        Supabase client (env-driven)
│   │   ├── booking.ts         createBooking() → Edge Function
│   │   ├── manage.ts          self-service reads + change-booking calls
│   │   ├── moodboard.ts       mood-board compose/read
│   │   ├── contract.ts        generateContractHTML() — uses STATIONERY
│   │   ├── invoice.ts         ZATCA QR + generateInvoiceHTML() — uses STATIONERY
│   │   ├── moyasar.ts         Moyasar SDK loader
│   │   └── pl/                P&L engine + config
│   ├── theme/
│   │   ├── themes.ts          Screen palettes (noir + ivory) + applyTheme()
│   │   └── stationery.ts      Stationery palette (single source of truth)
│   ├── content/
│   │   └── legal.ts           T&C + PDPL HTML strings (uses STATIONERY)
│   ├── hooks/                 useLang · useBreakpoint · useAdminAuth · …
│   ├── utils/validation.ts    normalizeSaudiMobile · validEmail · clampText
│   └── types/                 Shared TS types
├── supabase/functions/
│   ├── _shared/               Pure modules: pricing · reschedule · otp · change ·
│   │                            validation · receipt · wa · signature ·
│   │                            email · email-confirmation · stationery (mirror)
│   ├── create-booking/        Server-side total + email fire-and-forget
│   ├── change-booking/        Reschedule | request_otp | change_package
│   ├── discount-preview/      Rate-limited preview_discount_code RPC
│   ├── wa-webhook/            Meta webhook receiver (GET handshake + POST)
│   ├── wa-receipt/            Claude 3.5 Sonnet Vision bank-receipt OCR
│   ├── wa-reminders/          Cron-fired lifecycle reminders (every 30 min)
│   └── send-whatsapp/         Ad-hoc admin send
├── database/                  Idempotent migrations + UPSERT-by-id seeds
├── scripts/optimise-images.mjs sharp → WebP + JPEG, ~91% size reduction
├── public/                    CNAME + optimised photo pairs
└── docs/                      Design system, manual, integrations, audits
```

---

## 4. Booking Flow (customer)

```
Landing → Choose Package OR Design Your Package
       → Select addons (toggles + hour steppers)
       → Tap "Book Now"
       → Modal: Booking Form (name, phone, date, city, venue, notes)
                Acknowledge T&C + PDPL (popups read full text)
       → handleSubmit:
         1. createBooking() → POST /create-booking Edge Function
            ├─ server-side recompute of subtotal/VAT/total (Patch C-3)
            ├─ INSERT bookings row (resilient against missing columns)
            ├─ fire-and-forget WhatsApp confirmation to owner
            └─ fire-and-forget booking-confirmation EMAIL to customer
               (Zoho SMTP, never throws, audited in email_messages)
         2. generateContractHTML()    → saveContract() → `contracts`
         3. generateInvoiceHTML()     → saveInvoice()  → `invoices`
         4. setState('choose' | 'transfer' if Moyasar disabled)
       → PaymentMethodChooser (skipped if !moyasarEnabled)
         ├─ Card  → MoyasarForm (Moyasar SDK callback → /payment-result)
         └─ Transfer → BankTransferPayment
                       - Copy IBAN/account/ref buttons
                       - WhatsApp button → marks 'awaiting_transfer'
                       - Download Contract & Tax Invoice
```

**Three booking states tracked in `bookings.payment_status`:**
- `unpaid` — initial
- `awaiting_transfer` — customer chose bank transfer, sent receipt via WA
- `paid` — Moyasar webhook confirms (or admin marks)

---

## 4b. Customer self-service changes (`/#/manage/<token>`)

After a booking exists, the bride can change it herself from a private link
guarded by a 160-bit `manage_token` — no account required. Two changes are
supported, both enforced server-side by the `change-booking` Edge Function:

- **Reschedule** (link only) — once, ≥ 7 days out, within 30 days of the
  original date, subject to live-calendar availability (contract Article 3).
- **Package / add-on change** (step-up OTP) — a 6-digit code is texted to the
  phone on file; the server then recomputes the total from the catalogue,
  preserves the original discount (no re-redeem), and classifies the result as
  top-up / downgrade / none. Deposit is non-refundable, so downgrades refund
  nothing.

All policy lives in dependency-free, unit-tested modules under
`supabase/functions/_shared/` (`reschedule.ts`, `otp.ts`, `change.ts`). The
client (`src/pages/ManageBookingPage.tsx`) imports `reschedule.ts` directly so
its date gating matches the server; the OTP + price math run server-side
(client shows a display-only estimate). See `docs/MANUAL.md` §13g.

---

## 5. ZATCA Phase 1 Invoice

Implemented in `src/services/invoice.ts`.

- **TLV encoder** — tags 1 (seller name), 2 (VAT#), 3 (timestamp), 4 (total incl VAT), 5 (VAT amount)
- **Base64-encoded** TLV is rendered as a QR via `api.qrserver.com` image URL
- Invoice HTML is **self-contained** (printable in new tab via `window.print()`)
- Status badge: `paid` / `pending` / `awaiting transfer`
- ⚠ **`SELLER.vatNum`** in `invoice.ts` is currently a placeholder — replace with real VAT number once registered.

---

## 6. Database Schema (Supabase)

### `packages`
```sql
id serial PRIMARY KEY,
name_ar text, name_en text,
price integer, duration_hours integer, edited_photos integer,
album text, video boolean, description text,
features text[], badge text, is_popular boolean,
active boolean, created_at timestamptz
-- migrations-2026-05-branding.sql adds: sort_order int, included_addon_ids text[]
```

### `addons`
```sql
id text PRIMARY KEY,
name_ar text, name_en text,
price integer, active boolean
```

### `bookings`
```sql
id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
booking_ref text UNIQUE,
package_id integer REFERENCES packages(id), addon_ids text[],
event_date date, event_time time,
customer_name text, customer_phone text, customer_email text,
location text, special_requests text,
subtotal integer, vat integer, total integer,
status text DEFAULT 'pending',         -- pending|confirmed|completed|cancelled
payment_status text DEFAULT 'unpaid',  -- unpaid|paid|refunded (awaiting_transfer via migration)
-- added by migrations: vat_enabled boolean, payment_method text,
--   discount_code/discount_amount/discount_kind (discount-codes migration)
manage_token text UNIQUE DEFAULT encode(gen_random_bytes(20),'hex'),  -- self-service capability secret
reschedule_count int DEFAULT 0,
created_at timestamptz DEFAULT now()
```

### `booking_changes` — customer self-service audit log
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
kind text,                 -- 'reschedule' | 'package'
actor text DEFAULT 'customer',
old_value jsonb, new_value jsonb,
price_delta numeric DEFAULT 0,
created_at timestamptz DEFAULT now()
```

### `booking_otps` — step-up codes for money changes (service-role only)
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
purpose text DEFAULT 'change_package',
code_hash text, salt text,   -- salted SHA-256; never the clear code
expires_at timestamptz, attempts int DEFAULT 0, consumed_at timestamptz,
created_at timestamptz DEFAULT now()
```

### `email_messages` — booking-confirmation email audit log
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
to_address text, subject text, template text,
status text CHECK (status IN ('sent','skipped','failed')),
error text, smtp_message_id text,
created_at timestamptz DEFAULT now()
```
RLS: admin SELECT only; written by the `create-booking` Edge Function as service-role.

> For the full schema (mood_boards, wa_messages, wa_reminders_sent,
> discount_codes, portfolio_items, journal_posts, blocked_dates,
> app_settings) see [`docs/MANUAL.md`](./docs/MANUAL.md) §9.

### `contracts` / `invoices`

> ⚠ **No creating SQL for these two tables lives in `database/`.** They are
> read/written by `src/services/contract.ts` and `invoice.ts` and exist in the
> production project, but were created outside the tracked migrations. The
> shapes below are the columns the code relies on — add a migration if you ever
> rebuild the DB from scratch.

```sql
-- contracts
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
booking_ref text, content_html text,
created_at timestamptz DEFAULT now()

-- invoices
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
booking_ref text, invoice_number text UNIQUE,
content_html text, total numeric(10,2),
issued_at timestamptz, created_at timestamptz DEFAULT now()
```

### RLS Policies (required)
```sql
-- Bookings
CREATE POLICY "Allow public booking insert" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public booking select" ON bookings FOR SELECT USING (true);
CREATE POLICY "Allow public booking update" ON bookings FOR UPDATE USING (true);

-- Contracts
CREATE POLICY "Allow public contract insert" ON contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public contract select" ON contracts FOR SELECT USING (true);

-- Invoices
CREATE POLICY "Allow public invoice insert" ON invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public invoice select" ON invoices FOR SELECT USING (true);
```

---

## 7. Environment Variables

`.env.local` (not committed):

```ini
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_MOYASAR_PUBLISHABLE_KEY=pk_test_xxxxx   # or pk_live_xxxxx
```

If `VITE_MOYASAR_PUBLISHABLE_KEY` is missing or contains `your_key_here`, the app **auto-skips card payment** and goes straight to the bank-transfer flow.

---

## 8. Bank Transfer Details

Hard-coded in `src/components/BankTransferPayment.tsx`:

| Field         | Value |
|---------------|-------|
| Bank          | بنك الراجحي / Al Rajhi Bank |
| Beneficiary   | فاطمة بوحسن / Fatima Bohassan |
| Account       | `329608010885626` |
| IBAN          | `SA0380000000329608010885626` |
| WhatsApp      | `+966 54 832 3496` |

To change these, edit the `BANK` and `WHATSAPP_NUMBER` constants in `BankTransferPayment.tsx`.

---

## 9. Build & Deploy

```bash
# install
npm install

# develop
npm run dev               # http://localhost:5173

# type-check + build
npm run build             # tsc -b && vite build → dist/

# test
npm test                  # 113 passing
```

**Deployment is CI-driven.** Every push to `master` triggers
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. `npm ci`
2. `npm test` — gates the build; a failing suite blocks deploy
3. `npm run build`
4. `peaceiris/actions-gh-pages@v4` publishes `dist/` to the `gh-pages`
   branch (the `commit_message` defaults to the source commit's message)
5. GitHub Pages serves the new HEAD at <https://atemastudio.xyz> within
   ~1 minute

A manual **Run workflow** button on the Actions tab covers redeploys
without a code change. The legacy `npm run deploy` (`gh-pages -d dist`)
still works for local emergency deploys.

`vite.config.ts` sets `base: '/'` for the custom domain
(atemastudio.xyz). Switch back to `/atema-studio/` if reverting to the
github.io project URL. The router uses `HashRouter` because GH Pages
cannot handle SPA paths server-side.

---

## 10. Admin Panel

URL: `/#/admin/login`

- Auth: Supabase email/password
- Dashboard: bookings list, status filters, payment marking
- Packages Manager: full CRUD; per-package checkbox grid for included addons; quick-add addon row
- All edits write directly to Supabase

---

## 11. Known Limitations / TODO

- VAT number on invoices is a placeholder until Fatima registers with ZATCA.
- Moyasar webhook → `bookings.payment_status='paid'` is currently client-side only (no server-side webhook handler since hosting is static GH Pages — Supabase Edge could host one in a follow-up).
- Self-service follow-ups (deliberate scope cut — see `MANUAL.md` §13g):
  - Manage-link delivery — auto-text `/#/manage/<token>` at booking time
  - Top-up payment collection — an upgrade flags the balance due but does not yet open Moyasar / transfer to charge the difference
  - Contract / invoice regeneration after a change (generators are client-side)
- Contract & Invoice PDF export uses `window.print()` — no headless PDF generator on the client.
- Email is **booking-confirmation only**; the WhatsApp lifecycle still carries deposit-received / final-due / mood-board-ready / shoot-day reminders. A channel-preference picker (WhatsApp / Email / Both) is parked.
- Vitest suite covers pure logic (pricing, discounts, reschedule/OTP/change policy, validation); no browser/E2E tests yet.

---

## 12. Recent Major Additions

**2026-05-28 iteration:**
1. **Booking-confirmation email** — Zoho Mail SMTP from `atema@atemastudio.xyz`, bilingual HTML + plaintext, fire-and-forget from `create-booking`, audited in `email_messages`. See [`docs/integrations/email.md`](./docs/integrations/email.md).
2. **Stationery palette convergence** — single `STATIONERY` token map drives contract + invoice + email + `/policy` + booking-flow popups. Inter dropped, Tailwind status badges replaced with brand tints. See [`docs/design.md`](./docs/design.md).
3. **GitHub Actions auto-deploy** — `master → gh-pages` on every push, tests gate the build.
4. **Promo modal case fix** — `Promotion.JPG` → `Promotion.jpg` (Linux case-sensitivity broke the JPEG fallback in prod and the OG / Twitter / schema.org link previews).

**Prior iterations:**
- **Customer self-service** — `/#/manage/<token>` with reschedule (link only) + OTP-gated package/add-on change. See [`docs/MANUAL.md`](./docs/MANUAL.md) §13g.
- **Mood Board ritual page** — post-booking editorial board at `/#/board/<token>`. See `docs/MANUAL.md` §13b.
- **Studio-wide P&L dashboard** — monthly / quarterly / yearly rollup with per-package breakdown. See `docs/MANUAL.md` §13c.
- **Discount codes** — `LAUNCH15` + admin CRUD; preview/redeem RPCs prevent double-spend.
- **Two screen themes** — Couture Noir (default) + Atelier Ivory, admin-toggleable.
- **WhatsApp Cloud API platform** — lifecycle reminders + receipt vision OCR via Claude.
- **ZATCA-compliant tax invoice** — TLV/Base64 QR encoder, printable HTML, saved per booking.

---

*ATEMA STUDIO · Al-Jubail, Eastern Province, KSA · <https://atemastudio.xyz>*
