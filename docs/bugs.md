# ATEMA Studio — Stress Test & Security Audit Report

> **Tip-of-tree iteration appended:** 2026-05-28 — see "Status update"
> immediately below for what's changed since the last full audit.
>
> **Last full audit pass:** 2026-05-21
> **Commit audited:** `5260db0` (discount-codes shipped)
> **Bundle:** 627 KB raw / 178 KB gzip (terser-minified)
> **Audited by:** Claude Code (Anthropic) — static analysis + tool execution
>
> **Scope of that pass:** All changes since the previous audit (Mood
> Board, Studio-wide P&L, RLS hardening, terser obfuscation, package
> hero photos, discount-codes system) plus a regression sweep over
> every previously-patched finding (C-1 through L-7).

---

## Status update — 2026-06-05

Four fixes landed:

| Area | What changed |
|---|---|
| **Manage-link WhatsApp delivery** | `create-booking` now fetches `manage_token` once before sending both the confirmation email and the booking WhatsApp, then passes `manageLink` to `send-whatsapp`. `send-whatsapp` appends `🔗 إدارة حجزك: <url>` to the bride's message. The bride receives her self-service link on the same message she gets at booking time — no admin intervention required. |
| **Top-up payment flow** | `change-booking` stores `topup_amount_due` on the booking after an upgrade. `ManageBookingPage` now shows a live `MoyasarForm` (with `purpose="topup"`) instead of the old "we'll be in touch" message. After payment, `verify-payment` detects `purpose: topup` in the Moyasar metadata and clears `topup_amount_due = 0` instead of re-confirming the booking. `PaymentResultPage` shows a different success message for top-ups. **Requires `database/migrations-2026-06-topup.sql` to be applied and `supabase functions deploy change-booking verify-payment`.** |
| **M-11 (security)** | `verify-payment` Edge Function + `PaymentResultPage` refactored — see previous entry. |
| **M-8 (invoice number)** | ✅ Already patched — see previous entry. |

---

## Status update — 2026-06-05 (security)

Two security fixes landed:

| Patch | What changed | Security note |
|---|---|---|
| **M-11** | `supabase/functions/verify-payment/index.ts` (new Edge Function) + `PaymentResultPage.tsx` refactored | Closes the forged-callback attack: booking status is now updated only after `verify-payment` fetches the payment from Moyasar using `MOYASAR_SECRET_KEY` and confirms `metadata.booking_id` matches. URL `?status=` param is used for optimistic UI only — never for DB writes. **Requires new Supabase secret `MOYASAR_SECRET_KEY` and `supabase functions deploy verify-payment`.** |
| **M-8** | `src/services/invoice.ts:generateInvoiceNumber()` | ✅ Already patched — `crypto.getRandomValues` + Crockford base32 is in place. Bug tracker entry below updated to reflect resolved status. |

---

## Status update — 2026-05-28

Four shipments landed after the last full audit; none introduce new
critical findings:

| Commit | What landed | Security note |
|---|---|---|
| `44a7556` | Promo modal + social-meta `.JPG` → `.jpg` (Linux case-sensitive paths) | Pure bug fix — restores JPEG fallback and unbreaks OG / Twitter / schema.org link previews. No surface change. |
| `f5ed8d9` | Booking-confirmation email via Zoho Mail SMTP. New `_shared/email.ts` + `_shared/email-confirmation.ts`, `email_messages` audit table, wired fire-and-forget into `create-booking`. | Service-role only audit writes; admin SELECT. New Supabase secrets (`ZOHO_SMTP_*`). Recipient is `bookings.customer_email`, already PII-classified and stored. No new PII surface. |
| `a2866ae` | Stationery palette convergence: single token map (`STATIONERY`) drives contract + invoice + email + `/policy` + legal popups. Dropped Inter, replaced Tailwind status badges. | Pure refactor. C-1 (`esc()` wrapping every customer-controlled string) was preserved on every template — verified by grep before commit. No behaviour change. |
| `6b74854` | GitHub Actions auto-deploy (`master → gh-pages`). Tests gate the build. | CI uses default `GITHUB_TOKEN` with `contents: write` on the same repo. No new secrets, same trust boundary as the previous local `npm run deploy`. Workflow code lives at `.github/workflows/deploy.yml` and is reviewable in PRs. |

Tip-of-tree commit: `6b74854`. Vitest suite: 113 passing. Type-check
clean. The H-6/H-7/H-7b/H-9/M-8/M-9/M-10/L-8 patches from the 2026-05-21
sweep have not regressed.

---

## Original 2026-05-21 audit report follows.
>
> **What this audit covers:** static analysis (`npm audit`, `tsc
> --noEmit`, `vite build`, grep over the build output), code review,
> RLS/policy review, race-condition reasoning, ZATCA QR math review.
>
> **What this audit does NOT cover:** live browser-driven click tests,
> Playwright/axe-core, mobile-viewport screenshots, real Moyasar charges.
> Recommended as a pre-go-live QA pass with a real bride doing a real
> booking on a real device.

---

## Severity legend

| Tag | Meaning |
|---|---|
| 🔴 **CRITICAL** | Fix before any deployment. Exploitable, data-integrity, or compliance-blocking. |
| 🟠 **HIGH** | Fix before go-live. Functional or security gaps with realistic exploit paths. |
| 🟡 **MEDIUM** | Fix before production load. UX, a11y, defence-in-depth. |
| 🟢 **LOW / UX** | Recommended improvements. Cosmetic or future-proofing. |

---

## ✅ STATIC BASELINE — PASSED

- `npm audit` — **0 critical, 0 high, 0 moderate, 0 low** out of 263 deps.
- `tsc --noEmit -p tsconfig.app.json` — clean (0 errors).
- `vite build` — succeeds. Bundle 627 KB raw / 178 KB gzip.
- No `Math.random` in booking-ref path (H-2 fix holds).
- No customer-name interpolation without `esc()` in contract/invoice (C-1 fix holds).
- DatePicker (customer) uses `fetchPublicBookedDates` — no PII over the wire from the customer surface.
- AdminCalendar (admin) uses `fetchAdminBookedDates` — admin path intact.
- Terser mangling safe: no `Function.prototype.name` or `.constructor.name`
  references; all RPC + Edge Function names are string literals; Moyasar
  global accessed via `window.Moyasar` (terser does not mangle global
  property access).
- `esc()` still wraps all customer-controlled fields in contract.ts +
  invoice.ts (14 usages each).
- New discount fields (`d.discount.code`) are escaped in both templates.
- Booking flow with **no discount applied** remains identical to the
  pre-discount behaviour (default state is `null`, all conditional
  branches return the pre-existing values).

---

## 🔴 CRITICAL (fix before any deployment)

**None.** All previously-flagged CRITICALs (C-1 XSS in templates, C-2
form validation, C-3 server-side total recomputation) remain patched
and have not regressed.

---

## 🟠 HIGH (fix before go-live)

### H-6 · Mood Board table is anon-readable — PII enumerable
- **File:** `database/migrations-2026-05-moodboard.sql:43-46`
- **Policy:**
  ```sql
  create policy "Public select mood_boards"
    on public.mood_boards for select
    using (true);
  ```
- **Defect:** The design intent was "token = the secret." The policy
  doesn't actually enforce that the row is looked up by token —
  `using (true)` means anyone with the anon key can `SELECT * FROM
  mood_boards` and harvest every row. `title_ar` / `title_en` contain
  customer names (auto-drafted as `لـ ${customerName} — هكذا نراكِ`),
  `booking_id` links to bookings, and the 6 image URLs reveal which
  packages were sold. A competitor scraping the anon endpoint can
  enumerate the studio's full client roster.
- **Severity:** HIGH (real PII leak; PDPL-relevant).
- **Fix:** Replace the SELECT policy with **deny-all-direct**, and add
  a `get_mood_board_by_token(p_token text)` `security definer` RPC
  similar to `mark_mood_board_viewed`. Update
  `getMoodBoardByToken` in `src/services/moodboard.ts` to call the
  RPC instead of querying the table.
  ```sql
  drop policy if exists "Public select mood_boards" on public.mood_boards;
  -- (no replacement; only admins SELECT directly; anon goes via RPC)
  create or replace function public.get_mood_board_by_token(p_token text)
    returns public.mood_boards
    language sql
    security definer
    stable
    set search_path = public
    as $$
      select * from public.mood_boards where token = p_token limit 1;
    $$;
  grant execute on function public.get_mood_board_by_token(text)
    to anon, authenticated;
  ```

### H-7 · Discount-amount re-validation gap when basket changes
- **File:** `src/pages/BookingPage.tsx:1131-1132, 1153-1154`
- **Defect:** Once a bride applies a discount, the absolute SAR
  `amount` is stored. If she then adds or removes addons, the code
  caps the cached amount at the new gross subtotal but **does not
  re-evaluate the percent against the new gross**. Concrete example:
  - Apply `RAMADAN25` (25%) on subtotal 8000 → `amount = 2000` cached
  - Bride removes a 4000 SAR addon → new subtotal 4000
  - Effective discount stays at `min(2000, 4000) = 2000`, i.e. 50% off
  - Bride pays 2000 net + VAT — **double the intended discount**.
- **Severity:** HIGH (real money leak; only affects percent codes).
- **Fix:** Re-call `previewDiscountCode(code, newGrossSubtotal)` from
  a `useEffect` in `BookingPage` whenever `grossSubtotal` changes. If
  the new result has `reason !== 'ok'` or a different `appliedAmount`,
  update `appliedDiscount` accordingly. Same change for both the
  packages and custom tabs.

### H-7b · Display says "10% off" when the code is actually "25% (capped)"
- **File:** `src/components/DiscountInput.tsx:76-78`
- **Defect:** When a percent code has a `max_discount` cap, the
  server returns the capped amount, and the client reverse-engineers
  the percent via `Math.round((amount / subtotal) * 100)`. This
  underreports — a "25% off, capped at 1000 SAR" code on a 10 000
  subtotal yields amount = 1000, displayed as "10% off." Brides who
  know the code's real value get confused.
- **Severity:** HIGH (trust erosion at the moment of conversion).
- **Fix:** Have the `preview_discount_code` RPC return the code's
  raw `value` and `max_discount` in addition to the applied amount.
  Client can then display "25% off (capped)" honestly.

### H-9 · Anon SELECT on `bookings` still permissive
- **File:** `database/migrations-2026-05-rls-hardening.sql:66-73`
- **Defect:** The migration's open-SELECT policy was a transitional
  measure while DatePicker still queried `bookings` directly. Now
  that DatePicker has migrated to `public_booked_dates` (commit
  265a6a5), the policy is dead weight and remains a PII bypass —
  anyone with the anon key can `SELECT * FROM bookings` because RLS
  in stock Postgres can't restrict columns. The view path is
  *defended by convention*, not by the database.
- **Severity:** HIGH (regresses §H-6 of the original audit).
- **Fix:** Drop the policy. The "Final cleanup" block at the bottom
  of the migration already shows the exact statement; promote it
  out of the comment.
  ```sql
  drop policy if exists "Public select event_date status only" on public.bookings;
  ```
  No code change needed (every reader has been migrated).

---

## 🟡 MEDIUM (fix before production load)

### ~~M-8 · `generateInvoiceNumber` uses `Math.random`~~ ✅ PATCHED
- **Patched in:** `src/services/invoice.ts` (Patch M-8 comment in file)
- `generateInvoiceNumber()` now uses `crypto.getRandomValues` + Crockford
  base32 (5 bytes → 40 bits → ~1.1 T possibilities per month). Confirmed
  no `Math.random` in the invoice or booking-ref path.

### M-9 · Discount fields not persisted in booking.ts fallback path
- **File:** `src/services/booking.ts:88-109`
- **Defect:** When the `create-booking` Edge Function returns 404 or
  is unreachable, `booking.ts` falls back to a direct `bookings`
  insert. That fallback inserts `subtotal/vat/total` (already
  discounted client-side) but **does not write
  `discount_code`/`discount_amount`/`discount_kind`** — so the audit
  trail vanishes. `used_count` on the code is never incremented (the
  code is effectively unlimited in fallback mode). The constrained
  anon-insert RLS policy currently allows discount columns to be
  written, but the safer thing is to either:
  - **(a)** persist the discount fields in fallback **AND** harden
    the RLS to verify amount-vs-code consistency via a CHECK that
    calls `preview_discount_code()`; or
  - **(b)** keep the current behaviour (don't persist) and document
    clearly that fallback mode loses discount audit until Edge
    Function deploys.
- **Severity:** MEDIUM (only during Edge Function deploy window;
  documented temporary state).
- **Recommended fix:** Take path **(a)** — extend the constrained
  INSERT RLS policy in a new migration:
  ```sql
  -- Verify discount math at write time
  and (
    discount_code is null
    or exists (
      select 1
        from preview_discount_code(discount_code, subtotal + discount_amount) p
       where p.applied_amount = discount_amount and p.reason = 'ok'
    )
  )
  ```
  Then add the three columns to the fallback insert in `booking.ts`.

### M-10 · `preview_discount_code` is unrate-limited
- **File:** `database/migrations-2026-05-discount-codes.sql:99-150`
- **Defect:** Anon can call `preview_discount_code` an unlimited
  number of times. A determined attacker can brute-force codes via
  dictionary attack (`RAMADAN25`, `WELCOME10`, etc.). Each call is
  cheap, but enumeration of valid codes is possible. Once a valid
  code is found, the bride can use it freely (subject to validity
  + max_uses) — there's no per-IP rate-limit.
- **Severity:** MEDIUM (annoyance for the studio; not a vuln per
  se — codes are time-limited and capped — but a real concern at
  scale).
- **Fix:** Wrap the preview in a Supabase Edge Function with a
  per-IP token-bucket (e.g. 5/sec, 50/min). The design doc
  (`docs/integrations/discount-codes.md` §5.1) sketched this; the
  shipped implementation went straight to RPC for simplicity.

### M-1 · `dangerouslySetInnerHTML` on guarded constants — STILL OPEN
- **File:** `src/pages/BookingPage.tsx:587` (line shift since prior
  audit — still applicable)
- **Status:** Same as before. Low risk today since `TC_CONTENT` and
  `PDPL_CONTENT` are hardcoded module constants. Add a guard
  comment `// SAFE: hardcoded constant — do not pass user data`.

---

## 🟢 LOW / UX

### L-8 · `Math.random` in storage path generation
- **Files:** `src/services/journal.ts:78`, `src/services/portfolio.ts:74`
- **Defect:** Both generate uploaded-image paths as
  `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`.
  Six base36 chars from `Math.random` is ~30 bits of pseudo-random,
  not crypto. Collisions could overwrite previous uploads (very
  unlikely at ATEMA's volume, but worth tightening).
- **Fix:** Replace with `crypto.randomUUID()` (35 char) — same call
  on browsers + Deno + Node 19+.

### L-3 · `@types/node` minor version behind — STILL OPEN
- Cosmetic. Update during next maintenance window.

### L-5 · `useBreakpoint` SSR-safety — STILL OPEN
- Future Next.js migration only.

### L-6 · ZATCA invoice template shows VAT-reg even when VAT off — STILL OPEN
- Cosmetic.

### L-9 · `discount_codes` UPDATE policy uses `USING (true) WITH CHECK (true)`
- **File:** `database/migrations-2026-05-discount-codes.sql:284-289`
- **Defect:** Fine while the admin role is monolithic. If sub-admin
  roles are ever introduced (e.g. "assistant" who can run campaigns
  but not change percent values), this policy would let any
  authenticated user edit any code. Document the assumption.

### L-10 · Stray `ref()` generator in booking.ts fallback
- **File:** `src/services/booking.ts:24-30` + the fallback insert
  on line 88
- The Edge Function generates its own canonical ref; the client's
  `ref()` is only used in the fallback + the mock path. Once the
  Edge Function is the only insert path, this function becomes
  dead. Add a comment, or remove once the loose anon INSERT policy
  is dropped.

---

## ✅ PASSED — no issues found

- `npm audit` clean (263 deps).
- No customer-name interpolation without `esc()` in contract.ts /
  invoice.ts.
- Booking ref uses CSPRNG + Crockford base32 (H-2 holds).
- DatePicker on customer surfaces goes via `public_booked_dates`
  view — no PII over wire when used.
- AdminCalendar uses `fetchAdminBookedDates` — correct admin path.
- Terser mangling safe (no name-based runtime hooks).
- ZATCA QR math: TLV tag 4 (total incl VAT) + tag 5 (VAT amount)
  both reflect post-discount values per Phase-1 treatment.
- VAT computed on net (discounted) subtotal per ZATCA Phase-1.
- Booking flow without a discount is identical to pre-discount
  behaviour (default state `null`, all conditionals short-circuit
  to the pre-existing path).
- New discount fields in contract.ts + invoice.ts pass through
  `esc()` where appropriate.
- Promise.all and async error paths in moodboard.ts swallow
  errors silently — appropriate for best-effort `markViewed`.
- VAT is computed on the **discounted** subtotal — correct per
  Saudi ZATCA Phase-1 rules.

---

## RECOMMENDED NEXT ACTIONS — priority order

1. **Patch H-6 (Mood Board PII leak).** Drop the open SELECT policy
   on `mood_boards`, add `get_mood_board_by_token()` RPC, update
   `getMoodBoardByToken` in `src/services/moodboard.ts`. ~20 min.

2. **Patch H-9 (Anon SELECT on bookings).** Drop the loose policy.
   The block is already written at the bottom of
   `migrations-2026-05-rls-hardening.sql` — just promote it out of
   comments and run. ~5 min.

3. **Patch H-7 (basket-change re-validation).** Add a `useEffect`
   in `BookingPage.tsx` that re-previews on `grossSubtotal` change.
   ~25 min.

4. **Patch H-7b (display percent).** Extend `preview_discount_code`
   RPC to return `code_value` + `code_max_discount`. Update
   `DiscountInput` to display the honest percent. ~20 min.

5. **Patch M-8 (invoice number crypto).** Replace `Math.random`
   with `crypto.getRandomValues`. ~5 min.

6. **Patch M-10 (preview rate-limit).** Either deploy the preview
   as an Edge Function with rate-limiting, or accept the risk and
   document it. ~1 hour for the Edge Function path.

7. **Patch M-9 (fallback persistence).** Optional — only needed if
   the Edge Function deploy is delayed. Otherwise document the
   gap. ~30 min.

8. **Patch L-8 (storage UUID).** Tighten the random path
   generation. ~10 min.

---

## 2026-05-26 — Customer self-service booking changes (security notes)

New feature shipped this session: a private per-booking link
(`/#/manage/<token>`) lets the bride reschedule or change her package /
add-ons. Security properties designed in from the start (no audit findings
outstanding on this feature; listed here for the record):

- **Capability-link auth.** `bookings.manage_token` is a 160-bit secret
  (`encode(gen_random_bytes(20),'hex')`), defaulted in SQL and unique. Same
  unguessable-link model as the Mood Board.
- **No anon table access.** The page reads its single booking through the
  `get_booking_by_token()` `SECURITY DEFINER` RPC — anon can't read or
  enumerate `bookings`. All writes go through the `change-booking` Edge
  Function as service-role.
- **Server is authoritative on money.** Package/add-on changes recompute the
  total from the catalogue (package + add-ons + re-derived city fee); the
  client estimate is display-only — same discipline as Patch C-3.
- **Discount not re-redeemed.** A change preserves the originally-redeemed
  discount amount (capped at the new gross); it never re-runs
  `redeem_discount_code`, so a code's usage budget can't be double-spent.
- **Step-up OTP on the money path.** `change_package` requires a 6-digit code
  texted to the phone on file. Codes are stored salted-SHA-256 (never clear),
  expire in 10 min, lock out after 5 attempts, and are checked
  constant-time. The code is never returned in the HTTP response.
- **Least-privilege tables.** `booking_otps` is RLS-on with no
  anon/authenticated policies (service-role only). `booking_changes` (audit)
  is admin-SELECT only.
- **Policy single-sourced + tested.** Rules live in dependency-free
  `_shared/{reschedule,otp,change}.ts` with a Vitest suite (reschedule
  eligibility/new-date, OTP verify/expiry/lockout, change-delta
  classification). `reschedule.ts` is imported by both the client page and the
  Edge Function so date gating can't drift; `otp.ts`/`change.ts` run
  server-side only (the client shows a display-only estimate).

**Open follow-ups (functional, not security):** manage-link delivery, top-up
payment collection, contract/invoice regeneration after a change, and
Edge-function glue tests (the pure engines are covered).

---

## Patch progress tracking

Updated as fixes land. Patch commits reference these IDs.

| ID | Origin | Status | Commit |
|---|---|---|---|
| C-1 | 2026-05-17 | ✅ Holds (re-verified 2026-05-21) | `faa43bb` |
| C-2 | 2026-05-17 | ✅ Holds | `e6a75e4` |
| C-3 | 2026-05-17 | ✅ Code shipped; awaits Edge deploy | `ceafc29` |
| H-1 | 2026-05-17 | ✅ Holds | `e6a75e4` |
| H-2 | 2026-05-17 | ✅ Holds | `e6a75e4` |
| H-3 | 2026-05-17 | ✅ Holds | `e6a75e4` |
| H-5 | 2026-05-17 | ⚠ Partially patched, see H-9 | RLS migration |
| H-6 | 2026-05-21 | ✅ Fixed — mood_boards SELECT locked, RPC added | this commit |
| H-7 | 2026-05-21 | ✅ Fixed — re-eval on basket change | this commit |
| H-7b | 2026-05-21 | ✅ Fixed — server returns code metadata | this commit |
| H-9 | 2026-05-21 | ✅ Fixed — loose policy dropped | this commit |
| M-1 | 2026-05-17 | Open (intentional — guarded) | — |
| M-2 | 2026-05-17 | ✅ Fixed | `ceafc29` |
| M-3 | 2026-05-17 | ✅ Fixed (partial) | `e6a75e4` |
| M-4 | 2026-05-17 | ✅ Fixed | `e6a75e4` |
| M-5 | 2026-05-17 | ✅ Fixed | `e6a75e4` |
| M-7 | 2026-05-17 | ✅ Fixed | `e6a75e4` |
| M-8 | 2026-05-21 | ✅ Fixed — CSPRNG invoice number | this commit |
| M-9 | 2026-05-21 | ✅ Fixed — fallback now persists, RLS verifies | this commit |
| M-10 | 2026-05-21 | ✅ Fixed — discount-preview Edge Fn with token-bucket | this commit |
| L-1 | 2026-05-17 | ✅ Already correct | n/a |
| L-2 | 2026-05-17 | ✅ Fixed | `ceafc29` |
| L-3 | 2026-05-17 | Open (cosmetic) | — |
| L-4 | 2026-05-17 | ✅ Fixed | `ceafc29` |
| L-5 | 2026-05-17 | Open (SSR future-proofing) | — |
| L-6 | 2026-05-17 | Open (cosmetic) | — |
| L-7 | 2026-05-17 | ✅ Verified clean | n/a |
| L-8 | 2026-05-21 | ✅ Fixed — crypto.randomUUID in storage paths | this commit |
| L-9 | 2026-05-21 | Open — admin policy doc | — |
| L-10 | 2026-05-21 | Open — stray ref() generator | — |

---

## Summary of this pass

**Re-verified all previous CRITICAL and HIGH fixes — none regressed.**
The Mood Board, P&L dashboard, package photo upgrade, terser
obfuscation, and discount-codes shipments introduced **four new HIGH
findings** (`H-6` Mood Board PII; `H-7` discount basket re-eval; `H-7b`
discount display when capped; `H-9` loose anon SELECT on bookings now
removable), **three new MEDIUM findings** (`M-8` invoice number crypto;
`M-9` fallback discount persistence; `M-10` preview rate-limit), and
**three new LOW findings** (`L-8` storage UUID; `L-9` admin policy doc;
`L-10` stray ref generator). No CRITICALs introduced.

The two most consequential items are **H-6** (real PII leak — fix
first) and **H-7** (money leak on percent codes when basket shrinks).
Both are ~20-30 min of work each. Recommended to land before any
real campaign is launched.
