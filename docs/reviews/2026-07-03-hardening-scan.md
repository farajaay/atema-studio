# ATEMA Studio — System Hardening Scan & Review

> **Date:** 2026-07-03
> **Branch reviewed:** `claude/system-hardening-scan-review-41ooh6` (base `master` @ `da0fcfe`)
> **Scope:** (1) security hardening scan, (2) system design & content review,
> (3) structure & prices review.
> **Method:** static analysis (`tsc`, Vitest, `npm audit`, `vite build`),
> RLS/policy read-through, `esc()` regression grep, cross-source price
> reconciliation. No live browser or real-payment testing.

---

## TL;DR

The system is in good shape. **No CRITICAL or HIGH findings.** Every prior
audit patch (C-1 XSS escaping, C-3 server-side totals, H-6 mood-board RPC,
H-9/H-10 anon-SELECT lockdowns, M-8/M-11 crypto + payment verification) still
holds. Static baseline is clean: `tsc` 0 errors, **139/139 tests pass**,
`npm audit` 0 vulnerabilities, production bundle console-stripped and
source-map-free.

Two concrete issues were found and **fixed in this branch**:

| # | Severity | Area | Status |
|---|---|---|---|
| A | 🟡 MEDIUM (operational) | Stale `bundle-existing-db.sql` reintroduces the broken booking-insert RLS policy on hand-paste | ✅ Fixed |
| B | 🟢 LOW (content hygiene) | Dead pre-overhaul price list in `src/config/constants.ts` | ✅ Fixed |

Everything else is confirmation that the current state is sound.

---

## 1. Security hardening scan

### Static baseline — PASSED
- `npm audit --omit=dev` → **0 vulnerabilities**.
- `tsc --noEmit -p tsconfig.app.json` → **0 errors**.
- `vitest run` → **139 passing / 16 files**.
- `vite build` → succeeds; `grep console\\.` over `dist/` → **0** (terser strip
  intact); no `*.map` emitted.

### Regression sweep of prior patches — all hold
- **C-1 (template XSS).** `esc()` wraps every customer-controlled string in
  both the client templates (`src/services/contract.ts` ×16, `invoice.ts` ×14)
  **and** the new server-side Edge templates added in the email-attachments
  merge (`supabase/functions/_shared/contract.ts`, `invoice.ts`): customer
  name, phone, package names, location, add-on names, and `discount.code` all
  pass through `esc()`. No unescaped interpolation of user data found.
- **C-3 (server-authoritative money).** `create-booking` recomputes
  subtotal/VAT/total from `packages`/`addons`/`app_settings`; the client value
  is never trusted. `_shared/pricing.ts` remains the single, unit-tested money
  engine (VAT on the post-discount subtotal, ZATCA Phase-1 correct).
- **H-6 (mood-board PII).** `getMoodBoardByToken` calls the
  `get_mood_board_by_token` SECURITY DEFINER RPC; anon cannot enumerate the
  table.
- **H-9 / H-10 (anon SELECT on `bookings` / `contracts` / `invoices`).**
  Customer surfaces read via `public_booked_dates` and `get_booking_by_token`;
  documents tables are admin-SELECT only.
- **Booking-ref & invoice-number CSPRNG (H-2 / M-8).** `crypto.getRandomValues`
  + Crockford base32 in every ref/invoice path. The only `Math.random` in
  `create-booking` is a non-security log correlation id.
- **M-11 (forged payment callback).** `verify-payment` fetches the payment from
  Moyasar with the secret key and checks `metadata.booking_id` before any DB
  write; the URL `?status=` param is optimistic-UI only.
- **Webhook signatures.** `wa-webhook` verifies Meta's `X-Hub-Signature-256`
  (HMAC-SHA256) via `_shared/signature.ts` before processing.
- **Secrets.** No committed secrets (`.env.example` only; CI reads from GitHub
  Actions secrets store). Service-role key never reaches the client bundle.

### RLS posture (from `bundle-existing-db.sql` + migrations)
- `bookings`: anon INSERT is shape-constrained (name/phone length, future date,
  monetary ceilings, forced `pending`/`unpaid`); anon UPDATE is payment-intent
  only; authenticated has full access. `booking_otps` service-role only;
  `booking_changes` admin-SELECT only. Correct least-privilege.
- `mood_boards`, `discount_codes`, `email_messages`, `wa_messages` all lock
  direct anon reads and route through RPCs / service-role. Correct.

---

## 2. System design & content review

- **Theming discipline holds.** The new server-side stationery templates
  (`_shared/contract.ts`, `invoice.ts`, `email-confirmation.ts`) use the
  `STATIONERY` token map exclusively — **zero** stray hex literals. Screen
  surfaces still carry hardcoded hex in `BookingPage.tsx` / `AdminDashboard.tsx`,
  but this is **documented pre-existing debt** (`docs/design.md` §2 explicitly
  exempts these two pre-custom-properties files), not a regression.
- **Bilingual coverage** intact — `useLang()` on all public pages; new email
  template renders both `_ar` and `_en`; copy matches the luxury Atelier voice.
- **No content placeholders** (`lorem`/`TODO`/`FIXME`) in shipped page copy.
- **Email robustness** is well-engineered: denomailer is imported lazily so a
  flaky mailer dependency degrades to a logged `failed` send instead of
  boot-failing `create-booking`; ASCII-only subject dodges the RFC 2047
  encoded-word bug; From header is RFC 5322 quoted.

---

## 3. Structure & prices review

**Live pricing is fully consistent across every source of truth:**

| Package | Seed SQL | `usePackagesData` (fallback) | PROFITABILITY.md |
|---|---|---|---|
| Custom Foundation | 1,800 | 1,800 | 1,800 |
| Engagement | 2,500 | 2,500 | 2,500 |
| Classic | 5,200 | 5,200 | 5,200 |
| Royal | 10,500 | 10,500 | 10,500 |
| Signature | 12,500 | 12,500 | 12,500 |
| ATEMA Couture | 19,500 | 19,500 | 19,500 |

Add-ons match one-to-one between `seed-packages-2026-05.sql` and
`useAddonsData.ts` (extra-hour 900, video-short 3,400, video-full 4,800,
henna 2,400, etc.). City travel fees match between the client `CITIES` list in
`BookingPage.tsx` and the server `CITY_FEES` in `_shared/validation.ts`
(Jubail/Riyadh free, Dammam/Khobar/Qatif 200, Ahsa 450). Deposit math agrees:
`Math.round(total × 0.5)` on both the client and in `create-booking`; Moyasar
charges `depositSAR × 100` halalas.

**The one discrepancy** was in `src/config/constants.ts` (finding B, below).

---

## Findings fixed in this branch

### A · 🟡 `bundle-existing-db.sql` reintroduces the broken booking-insert policy
- **File:** `database/bundle-existing-db.sql`
- **Root cause:** the bundle is a generated flat concatenation of the migration
  manifest, stamped `Generated: 2026-06-16T17:53:28Z`. That is *before*
  `migrations-2026-06-fix-booking-insert.sql` was authored, so the bundle's
  last `bookings` INSERT policy is the **M-9 version with the
  `EXISTS(preview_discount_code(...))` sub-check** — the exact clause that
  rejected valid anon booking inserts on the live site and was reverted in the
  fix migration.
- **Impact:** the CI path is safe (`supabase-migrations.yml` lists the fix
  migration last, item 8). But an operator who hand-pastes the bundle into the
  Supabase SQL editor to sync an existing DB would **silently reintroduce the
  booking-submission regression.**
- **Fix:** appended the fix migration's policy block to the end of the bundle's
  migration section (before the seeds), idempotent and clearly annotated, so
  both the CI and hand-paste paths converge on the known-good policy.
- **Follow-up for the owner:** if a bundle-generator script exists outside the
  repo, regenerate from the current manifest rather than relying on this manual
  append; otherwise commit the generator so the bundle can't drift again.

### B · 🟢 Dead, stale price list in `src/config/constants.ts`
- **Root cause:** `constants.ts` still exported `PACKAGES` / `ADDONS` / `CITIES`
  arrays carrying the **pre-overhaul** prices (Engagement 1,855 · Customise
  2,200 · Classic 4,200 · Royal 6,900 · Signature 8,500 · Couture 14,000).
- **Impact:** none today — nothing imports those symbols (only `ATEMA_COLORS`
  and `VAT_RATE` are consumed). But a second, wrong copy of the price list is a
  foot-gun: a future edit could wire it up and ship the old numbers.
- **Fix:** removed the dead catalogues; `constants.ts` now keeps only
  `ATEMA_COLORS` + `VAT_RATE` and documents the real sources of truth. `tsc` and
  all 139 tests still pass.

---

## Still-open, unchanged (from the standing tracker — no action this pass)

These remain accurately tracked in `docs/bugs.md` and are not regressions:

- **M-10** — `preview_discount_code` rate-limiting (mitigated by the
  discount-preview Edge Function; codes are time-limited + capped).
- **L-5** — `useBreakpoint` SSR guard (only relevant to a future SSR migration).
- **L-6** — invoice VAT-registration block placeholder (cosmetic until Fatima
  registers).
- **L-9** — document the monolithic-admin assumption on the `discount_codes`
  UPDATE policy.
- **Owner ops** — LAUNCH15 has almost certainly expired (validity was 20 days
  from a May-2026 application); verify and retire/replace before any campaign.

---

*Prepared as part of the 2026-07-03 hardening scan. Two fixes landed on this
branch; the remainder of the pass is a clean bill of health confirming the
prior audit patches have not regressed.*
