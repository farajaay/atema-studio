# ATEMA Studio — Stress Test & Security Audit Report

> **Generated:** 2026-05-17
> **Commit audited:** `d13bea9`
> **Bundle:** 372 KB raw / 186 KB gzip
> **Audited by:** Claude Code (Anthropic) — static analysis + tool execution
>
> **Scope note.** Audit performed by static analysis + tool execution
> (`npm audit`, `tsc`, `vite build`, regex grep over the built bundle).
> Live-browser interaction tests in §2 of the source template are evaluated
> against the code paths that implement them — actual click-driven QA still
> recommended before go-live. The user's prompt template referenced packages
> "Essential / Professional / Premium / Signature"; the actual catalogue is
> six tiers (Engagement → Couture). Tests adapted accordingly.

---

## Severity legend

| Tag | Meaning |
|---|---|
| 🔴 **CRITICAL** | Fix before any deployment. Exploitable, data-integrity, or compliance-blocking. |
| 🟠 **HIGH** | Fix before go-live. Functional or security gaps with realistic exploit paths. |
| 🟡 **MEDIUM** | Fix before production load. UX, a11y, defence-in-depth. |
| 🟢 **LOW / UX** | Recommended improvements. Cosmetic or future-proofing. |

---

## 🔴 CRITICAL (fix before any deployment)

### C-1 · Stored XSS via customer name / phone / venue in invoice + contract documents
- **Files:** `src/services/contract.ts:125, 126, 139, 278` · `src/services/invoice.ts:208, 209`
- **Sink:** Customer-supplied form fields are interpolated into HTML template
  strings without escaping, then rendered via `window.document.write()`
  (`invoice.ts:300`).
- **Exploit:** Customer enters `<img src=x onerror=alert(document.cookie)>`
  as their name → on contract/invoice open, payload fires inside the studio's
  origin. Stored in DB → admin viewing the contract also gets popped.
- **Fix:** Add `escapeHtml()` helper in each template module and wrap every
  `${d.customerName}` / `${d.customerPhone}` / `${d.location}` / `${a.name}`
  interpolation. ~20 line change.

### C-2 · Booking form does not validate phone or email — invalid bookings reach the DB
- **File:** `src/pages/BookingPage.tsx:631-637`
- **Defect:** `handleSubmit` checks only `name.trim()`, `phone.trim()`,
  `date`, `city`. Phone format never validated (a user can submit "abc" or
  `<script>` and it passes). Email never validated.
- **Fix:** Reuse `validPhone()` from `services/raed/client.ts:21` (move it
  to a shared `utils/validation.ts`). Add
  `/^[^@]+@[^@]+\.[^@]+$/.test(email)` for the optional email.

### C-3 · Server-side trust gap: booking insert accepts client-computed `subtotal` / `vat` / `total`
- **File:** `src/services/booking.ts:27-29`
- **Defect:** The Supabase insert writes whatever the client posts. A
  crafted POST can record a 14,000 SAR Couture booking with `total: 1` and
  `deposit: 1`. The admin sees the booking and may not notice the
  discrepancy.
- **Fix:** Either (a) re-compute totals server-side via a Supabase RPC /
  Edge Function before insert, or (b) drop those columns and recompute from
  `package_id` + `addon_ids` in a database VIEW.

---

## 🟠 HIGH (fix before go-live)

### H-1 · Double-submit race — duplicate bookings possible
- **File:** `src/pages/BookingPage.tsx:631-711`
- **Defect:** `handleSubmit` is async. The "Confirm" button is not disabled
  while `state === 'loading'` (state flip happens after `setState('loading')`,
  but the button has no `disabled={state === 'loading'}` guard).
- **Fix:** Disable the submit button when `state !== 'idle'` and
  `!== 'error'`. Also add a `savingRef` guard early in `handleSubmit` with
  an early return if already saving.

### H-2 · Booking reference is predictable
- **File:** `src/services/booking.ts:4-6`
- **Defect:** `ref()` returns
  `ATEMA-${Date.now()}-${Math.random().toString(36).substr(2,9).toUpperCase()}`.
  `Date.now()` is leaked in HTTP `Date` headers; `Math.random()` is not
  cryptographically secure. If the booking reference ever grants any access
  (download contract by ref, payment callback verification), it can be
  brute-forced inside a small window.
- **Fix:** Use `crypto.randomUUID()` or
  `crypto.getRandomValues(new Uint8Array(8))` → base32. Also drop the
  deprecated `String.prototype.substr` (use `slice`).

### H-3 · Past-date events accepted
- **File:** `src/pages/BookingPage.tsx:635` and `DatePicker.tsx:94`
- **Defect:** `DatePicker.pick()` blocks past dates client-side, but the form
  handler never re-checks. A user manipulating the form state (or a crafted
  submission) can save a past event date.
- **Fix:** Re-validate `form.date >= today` in `handleSubmit` AND add a
  server-side CHECK constraint on `bookings.event_date >= CURRENT_DATE` at
  creation time.

### H-4 · ATEMA_COLORS in Lucide `color=` SVG attributes (already patched)
- **Status:** Already audited and fixed in earlier commits. Kept here as a
  guard rail: future contributors must not regress to `color={ATEMA_COLORS.x}`
  on Lucide icons — SVG attribute `var(--…)` references do not resolve.

### H-5 · No CSRF / abuse protection on the anonymous booking insert
- **Defect:** With the Supabase anon key inlined into the bundle, any
  origin can POST to `/rest/v1/bookings`. Unless RLS specifically restricts
  inserts (e.g., requires anonymous JWT with a one-time CAPTCHA-derived
  claim), spammers can flood the table.
- **Fix:** Tighten the bookings INSERT RLS policy to require a captcha-token
  check (Supabase + hCaptcha), OR move the insert to a Supabase Edge
  Function gated by captcha verification. Code can't tell — review Supabase
  RLS policies for the `bookings` table.

---

## 🟡 MEDIUM (fix before production load)

### M-1 · `dangerouslySetInnerHTML` used in LegalPopup with a constant
- **File:** `src/pages/BookingPage.tsx:587`
- **Risk:** Currently low — `TC_CONTENT` and `PDPL_CONTENT` are hardcoded
  strings. But the pattern is dangerous if anyone ever refactors them to
  fetch from Supabase or admin-edit them.
- **Fix:** Either keep them as JSX (preferable) or add a
  `// SAFE: hardcoded constant — do not pass user data` comment guard.

### M-2 · Single 372 KB JS bundle (186 KB gzip)
- **Defect:** Above Vite's 500 KB raw warning threshold and represents the
  entire site including admin. A customer hitting `/` downloads admin code
  they'll never run.
- **Fix:** `React.lazy` + `Suspense` around the admin routes:
  ```tsx
  const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
  ```
  Expected cut: 30-40% off the public-facing bundle.

### M-3 · Form labels not linked via `htmlFor` / `id`
- **File:** `src/pages/BookingPage.tsx:819-865`
- **Defect:** `<label>` and `<input>` are siblings inside a `<div>` but with
  no `for`/`id` pair, so screen readers don't reliably associate them.
- **Fix:** Add `id="bf-name"` / `htmlFor="bf-name"` on each pair (~12 small
  edits).

### M-4 · Error message has no `aria-live` region
- **File:** `src/pages/BookingPage.tsx:908-912`
- **Defect:** Validation errors silently appear — screen readers don't
  announce them.
- **Fix:** Add `role="alert"` + `aria-live="polite"` on the error container.

### M-5 · Free-text fields have no `maxLength`
- **Files:** `src/pages/BookingPage.tsx:821, 827, 832, 862, 869`
- **Defect:** Name / phone / email / venue / notes can be arbitrarily long.
  A 100 k-character notes field will inflate the DB row and bog down later
  admin renders.
- **Fix:** `maxLength={120}` on name/venue, `{20}` on phone, `{120}` on
  email, `{2000}` on notes. Mirror with DB column-length checks if not
  already enforced.

### M-6 · `Math.random` for booking reference
- Covered under **H-2**.

### M-7 · Combined PDPL + T&C validation message
- **File:** `src/pages/BookingPage.tsx:632`
- **Defect:** `if (!agreed || !pdpl)` — user can't tell which one they
  missed.
- **Fix:** Split into two checks with two messages.

---

## 🟢 LOW / UX (recommended improvements)

### L-1 · Bank-transfer "Mark as awaiting transfer" doesn't persist
- **File:** `src/components/BankTransferPayment.tsx`
- **Defect:** Clicking the button updates local state but doesn't write to
  the DB. Manual reconciliation only.
- **Fix:** Either remove the button or wire it to
  `UPDATE bookings SET payment_method='transfer', status='awaiting_transfer'`.

### L-2 · Bundle warning ignored on every deploy
- The Vite build emits "Some chunks are larger than 500 kB" every deploy.
  Adding `build.chunkSizeWarningLimit = 800` silences it, OR fix per **M-2**.

### L-3 · `@types/node` one version behind (24.12.4 → 25.8.0)
- Cosmetic; no security impact. Update during next maintenance window.

### L-4 · Raed client (`src/services/raed/client.ts`) is dead code
- Nothing in the rest of the codebase imports it (Moyasar replaced it).
  85 lines.
- **Fix:** Either delete the file + Raed types in `src/types/index.ts` OR
  add a comment confirming it's reserved for future re-introduction.

### L-5 · `useBreakpoint` reads `window.innerWidth` in initial state
- **File:** `src/hooks/useBreakpoint.ts:16`
- **Risk:** Crashes during SSR. Not a real issue with the current Vite SPA
  build, but blocks any future migration to Next.js.
- **Fix:**
  `useState(() => typeof window !== 'undefined' ? getBreakpoint(window.innerWidth) : 'md')`.

### L-6 · ZATCA QR omits VAT when `vat_enabled = false`, but template still shows VAT registration
- **File:** `src/services/invoice.ts`
- The QR omits VAT fields when VAT is off (correct behaviour), but the
  invoice template still renders the VAT registration number in the seller
  block. Cosmetic inconsistency.

### L-7 · Defense-in-depth check on admin views
- Once **C-1** is patched, double-check that the booking detail modal in
  `AdminDashboard.tsx` also uses React JSX (textContent path) and not any
  `dangerouslySetInnerHTML` pattern for customer-name fields.

---

## ✅ PASSED — no issues

- `npm audit` — **0 critical, 0 high, 0 moderate, 0 low** out of 240 deps.
- `tsc --noEmit` — clean across the entire project.
- `vite build` — succeeds with no errors.
- Bundle scan — no real API keys leaked. Supabase URL + publishable anon
  key are inlined (by design — this is the public key, RLS protects data).
- `.env` is in `.gitignore` with `!.env.example` override.
- `.env.example` documents every variable with placeholders.
- VAT computation — uses `0.15` exactly, integer-rounded via `Math.round`,
  no float-precision risk.
- ر.س / SAR currency display switches correctly with language toggle.
- Lang toggle (`useLang.ts`) syncs `document.documentElement.dir` and
  `lang` attributes — RTL/LTR works correctly.
- Phone displays use `atema-input-ltr` class which forces LTR direction in
  RTL pages.
- Fonts loaded via `preconnect` + `display=swap` from Google Fonts CDN —
  never bundled.
- Customer `DatePicker` correctly fetches booked + blocked dates and
  visually disables them (privacy posture — no PII shown).
- T&C and PDPL consent checkboxes block submission when unchecked.
- No `eval()`, no `innerHTML` (other than `document.write` for the
  printable invoice/contract).
- No payment-card fields collected anywhere in the frontend (PCI-safe —
  Moyasar handles card UI).
- Bank-transfer flow does not capture card data.
- Inputs are ~44 px tall (`padding: 12px 16px`), meeting WCAG tap-target
  size.
- Mobile / Tablet breakpoints at 768 / 1024 — `useBreakpoint` hook drives
  layout swap.

---

## STUB / PRODUCTION READINESS SCORES

| Subsystem | Score | Notes |
|---|---|---|
| `createBooking` | **3/5** | Real Supabase wiring works. Loses points for: client-trusted totals (C-3), no idempotency key, deprecated `substr`, mock fallback should refuse to run in prod. |
| `createRaedPaymentIntent` | **n/a (dead code)** | Wired but **not consumed anywhere**. Moyasar replaced it. Either delete or document as reserved. |
| `MoyasarForm` (real card) | **4/5** | Hosted form, 3DS handled by gateway, metadata attached. Loses 1 point for missing webhook signature verification (relies on URL redirect only — covered in `docs/integrations/payments.md` §4). |
| `BankTransferPayment` | **3/5** | UI complete (IBAN, copy buttons, contract+invoice download). Loses points: "Mark awaiting transfer" doesn't persist, manual admin reconciliation, no WhatsApp automation (designed in `docs/integrations/whatsapp.md`, not built). |
| `generateContractHTML` | **2/5** | Functional. **Critical XSS risk** until C-1 is patched. |
| `generateInvoiceHTML` (ZATCA QR) | **3/5** | ZATCA Phase-1 compliant QR encoding correct. Same XSS risk on customer-name fields. |
| `services/calendar.ts` | **5/5** | Clean, monthly windowed fetch, proper PII boundaries. |
| `services/settings.ts` + `AppSettingsPanel` | **5/5** | Singleton row, RLS-gated, validation on VAT-on path. |

---

## RECOMMENDED NEXT ACTIONS — priority order

1. **Patch C-1 (XSS in invoice / contract templates).** Add `escapeHtml()`
   in both template files and wrap every interpolation. **~30 min work.**

2. **Patch C-2 (form validation).** Extract `validPhone` + `validEmail` to
   `src/utils/validation.ts`, call from `BookingPage.handleSubmit`.
   **~30 min work.**

3. **Patch C-3 (server-side total recomputation).** Add a Supabase Edge
   Function `create-booking` that recomputes totals from `package_id` +
   `addon_ids` server-side; change `services/booking.ts` to call it.
   **~2 hours work, includes RLS tightening.**

4. **Patch H-1 (double-submit guard).** One-line
   `disabled={state === 'loading'}` on the submit button + a `savingRef`
   guard in handleSubmit. **~10 min.**

5. **Patch H-2 (cryptographic booking ref).** Swap `Math.random` for
   `crypto.getRandomValues`. **~10 min.**

6. **Activate Moyasar live mode** (per `docs/integrations/payments.md` §2).
   Add the publishable key to `.env`, configure callback URLs in dashboard,
   test one happy path with a real card.
   **1 hour admin + 30 min test.**

7. **Patch H-3 + M-5 (date + length validation).** Add `maxLength` on text
   inputs; re-validate date in handler. **~20 min.**

8. **Patch M-2 (code-split admin from public).** Add `React.lazy` to admin
   routes. **~20 min, ~30 % bundle cut.**

9. **Patch M-3 + M-4 (a11y).** `htmlFor` / `id` on labels;
   `role="alert"` on error container. **~20 min.**

10. **Build WhatsApp receipt automation** per
    `docs/integrations/whatsapp.md` blueprint.
    **2–3 days engineering, ~$45 / mo running cost.**

---

## What could NOT be executed in this environment

- Live browser-driven click tests for §2A–§2F of the prompt template (would
  need Playwright + a running dev server).
- `axe-core` accessibility scanner (would need browser).
- Mobile-viewport screenshots (no headless browser).
- Real charge against Moyasar test cards.

These should be added to the QA pass before go-live. Everything
code-detectable is in the table above.

---

## Patch progress tracking

This section is updated as fixes land. Patch commits reference these IDs
(e.g. `Patch C-1: escapeHtml invoice + contract templates`).

| ID | Status | Commit |
|---|---|---|
| C-1 | ✅ Fixed | `faa43bb` |
| C-2 | ✅ Fixed | `<form-hardening commit>` |
| C-3 | Open | — |
| H-1 | ✅ Fixed | `<form-hardening commit>` |
| H-2 | ✅ Fixed | `<form-hardening commit>` |
| H-3 | ✅ Fixed | `<form-hardening commit>` |
| H-5 | Open (Supabase config, not code) | — |
| M-1 | Open | — |
| M-2 | Open | — |
| M-3 | ✅ Fixed (partial — booking form only) | `<form-hardening commit>` |
| M-4 | ✅ Fixed | `<form-hardening commit>` |
| M-5 | ✅ Fixed | `<form-hardening commit>` |
| M-7 | ✅ Fixed | `<form-hardening commit>` |
| L-1 | Open | — |
| L-2 | Open | — |
| L-3 | Open | — |
| L-4 | Open | — |
| L-5 | Open | — |
| L-6 | Open | — |
| L-7 | Open | — |
