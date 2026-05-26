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
| Styling      | Inline styles + brand tokens (no CSS framework) |
| Icons        | `lucide-react` |
| Backend / DB | Supabase (PostgreSQL + Row-Level Security) |
| Payments     | Moyasar SDK (CDN, Halalas) **+** Bank Transfer fallback |
| Tax          | ZATCA Phase 1 Simplified Tax Invoice (TLV/Base64 QR) |
| Hosting      | GitHub Pages (`gh-pages -d dist`) |
| Comms        | WhatsApp deep-link (`wa.me`) for receipts & support |

---

## 2. Brand Identity

Per `Photos/Identity.PNG`. Theme tokens are CSS custom properties declared in `index.html` (inline `<style>`) + `src/theme/themes.ts` (`getBookingPalette`); two themes (Couture Noir default, Atelier Ivory). See `CLAUDE.md` §4.1.

| Token       | Hex       | Usage |
|-------------|-----------|-------|
| Soft Ivory  | `#F5EDE4` | Page background |
| Champagne   | `#E8D9C5` | Cards, hover states |
| Warm Sand   | `#D6BFA3` | Borders, dividers |
| Deep Bronze | `#8C6B4F` | Prices, accents, primary CTA bg |
| Deep Taupe  | `#6B5440` | Secondary text |
| Mocha       | `#4A3728` | Body text |
| Editorial Black | `#1A1A1A` | Headings, dark CTA bg |

**Typography**
- Headings (decorative): `Cormorant Garamond` (Latin) · `Amiri` (Arabic)
- Body / UI: `Tajawal` (works for both Latin + Arabic)
- Mono / numerals: `Inter`

---

## 3. Folder Structure

```
src/
├── App.tsx                    Root router (HashRouter)
├── main.tsx                   Entry point
├── index.css                  Brand-aligned base styles
├── components/
│   ├── SiteHeader.tsx         Top nav (lang switcher, admin link)
│   ├── PackageCard.tsx        Package tile with click-to-details modal
│   ├── DatePicker.tsx         Customer date picker (public_booked_dates)
│   ├── MoyasarForm.tsx        Online card payment (Moyasar SDK)
│   ├── BankTransferPayment.tsx Bank-transfer flow with copy buttons + WA receipt
│   ├── PaymentMethodChooser.tsx Card vs Transfer selector
│   └── PLTab.tsx              P&L admin tab
├── pages/
│   ├── BookingPage.tsx        Customer booking flow (long file — modal lives here)
│   ├── ManageBookingPage.tsx  Customer self-service (/#/manage/<token>)
│   ├── MoodBoardPage.tsx      Private mood board (/#/board/<token>)
│   ├── AdminLogin.tsx         Email/password gate
│   ├── AdminDashboard.tsx     Bookings list + KPIs
│   ├── PackagesManager.tsx    CRUD for packages + addons
│   └── PaymentResultPage.tsx  Moyasar callback handler
├── services/
│   ├── supabase.ts            Supabase client (env-driven)
│   ├── booking.ts             createBooking() — inserts booking row
│   ├── manage.ts              self-service reads + change-booking Edge calls
│   ├── moodboard.ts           mood-board compose/read
│   ├── contract.ts            generateContractHTML() + saveContract()
│   ├── invoice.ts             ZATCA TLV QR + generateInvoiceHTML() + saveInvoice()
│   └── moyasar.ts             Moyasar SDK loader
├── hooks/
│   ├── useBreakpoint.ts       Responsive breakpoint hook
│   ├── useAdminAuth.ts        Supabase auth wrapper
│   ├── useAdminData.ts        Bookings/KPIs fetch
│   ├── usePackagesData.ts     Packages fetch (with demo fallback)
│   └── useAddonsData.ts       Addons fetch
├── context/                   (auth providers if any)
├── config/                    Static config (cities, etc)
└── types/                     Shared TS types
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
         1. createBooking()           → Supabase `bookings` row
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
npm run build             # outputs to dist/

# deploy to GitHub Pages
npm run deploy            # publishes dist/ to gh-pages branch
```

`vite.config.ts` sets `base: '/'` for the custom domain (atemastudio.xyz). Switch back to `/atema-studio/` if reverting to the github.io project URL.
The router uses `HashRouter` because GH Pages cannot handle SPA paths server-side.

---

## 10. Admin Panel

URL: `/#/admin/login`

- Auth: Supabase email/password
- Dashboard: bookings list, status filters, payment marking
- Packages Manager: full CRUD; per-package checkbox grid for included addons; quick-add addon row
- All edits write directly to Supabase

---

## 11. Known Limitations / TODO

- `SELLER.vatNum` in `invoice.ts` is a placeholder — needs real ZATCA VAT registration
- Moyasar webhook → `bookings.payment_status='paid'` is currently client-side only (no server-side webhook handler since hosting is static GH Pages)
- WhatsApp Business API integration for auto-sending PDF contract/invoice is **not yet wired** (currently a `wa.me` deep-link with prefilled message)
- Contract & Invoice PDF export uses `window.print()` — no headless PDF generator on the client
- Vitest suite covers pure logic (pricing, discounts, reschedule/OTP/change policy, validation); no browser/E2E tests yet
- Self-service: manage-link delivery and top-up payment collection are not yet wired (see §4b / MANUAL §13g)

---

## 12. Recent Major Additions (this iteration)

1. **Bank-transfer payment flow** — full UX with copy buttons, WA confirmation, awaiting-transfer status
2. **ZATCA-compliant tax invoice** — TLV/Base64 QR encoder, printable HTML, saved per booking
3. **PaymentMethodChooser** — graceful card/transfer pick, auto-skip if Moyasar disabled
4. **Brand-aligned `index.css`** — replaced Vite template defaults (purple, dark mode, 1126px width) with brand palette
5. **Contract template** — bilingual Arabic legal contract (11 articles) generated and stored per booking
6. **T&C / PDPL popup acknowledgment** — clickable underlined links open full content modals

---

*Generated for ATEMA Studio · Riyadh, KSA*
