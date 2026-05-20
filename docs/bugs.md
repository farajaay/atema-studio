# ATEMA Studio — Stress Test & Security Audit Report

> **Re-audit pass:** 2026-05-21
> **Commit audited:** `5260db0` (discount-codes shipped)
> **Bundle:** 627 KB raw / 178 KB gzip (terser-minified)
> **Audited by:** Claude Code (Anthropic) — static analysis + tool execution
>
> **Scope of this pass:** All changes since the previous audit (Mood
> Board, Studio-wide P&L, RLS hardening, terser obfuscation, package
> hero photos, discount-codes system) plus a regression sweep over
> every previously-patched finding (C-1 through L-7).
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

### M-8 · `generateInvoiceNumber` uses `Math.random`
- **File:** `src/services/invoice.ts:77`
- **Defect:** `INV-${yy}${mm}-${5-digit Math.random suffix}` —
  90 000 possible suffixes per month. Birthday paradox: ~50%
  collision chance at ~300 bookings/month. `invoices.invoice_number
  UNIQUE` constraint means collisions **throw** at insert time,
  breaking the customer flow.
- **Severity:** MEDIUM (functional reliability + ZATCA — every
  Phase-1 simplified tax invoice must have a unique number).
- **Fix:** Use `crypto.getRandomValues` + Crockford base32 (same
  pattern as `booking.ts`), or a server-side sequence. Suggested:
  ```ts
  const tail = (() => {
    const b = new Uint8Array(5); crypto.getRandomValues(b);
    return Array.from(b, x => CROCKFORD[x & 31]).join('');
  })();
  return `INV-${yy}${mm}-${tail}`;
  ```
  Crockford base32 over 5 bytes → 40 bits → ~1.1 T possibilities.
  Collision probability negligible at ATEMA's volume.

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
| H-6 | **2026-05-21 (NEW)** | Open — mood board PII leak | — |
| H-7 | **2026-05-21 (NEW)** | Open — discount basket re-eval | — |
| H-7b | **2026-05-21 (NEW)** | Open — discount display | — |
| H-9 | **2026-05-21 (NEW)** | Open — anon SELECT cleanup | — |
| M-1 | 2026-05-17 | Open (intentional — guarded) | — |
| M-2 | 2026-05-17 | ✅ Fixed | `ceafc29` |
| M-3 | 2026-05-17 | ✅ Fixed (partial) | `e6a75e4` |
| M-4 | 2026-05-17 | ✅ Fixed | `e6a75e4` |
| M-5 | 2026-05-17 | ✅ Fixed | `e6a75e4` |
| M-7 | 2026-05-17 | ✅ Fixed | `e6a75e4` |
| M-8 | **2026-05-21 (NEW)** | Open — invoice number crypto | — |
| M-9 | **2026-05-21 (NEW)** | Open — fallback persistence | — |
| M-10 | **2026-05-21 (NEW)** | Open — preview rate-limit | — |
| L-1 | 2026-05-17 | ✅ Already correct | n/a |
| L-2 | 2026-05-17 | ✅ Fixed | `ceafc29` |
| L-3 | 2026-05-17 | Open (cosmetic) | — |
| L-4 | 2026-05-17 | ✅ Fixed | `ceafc29` |
| L-5 | 2026-05-17 | Open (SSR future-proofing) | — |
| L-6 | 2026-05-17 | Open (cosmetic) | — |
| L-7 | 2026-05-17 | ✅ Verified clean | n/a |
| L-8 | **2026-05-21 (NEW)** | Open — storage UUID | — |
| L-9 | **2026-05-21 (NEW)** | Open — admin policy doc | — |
| L-10 | **2026-05-21 (NEW)** | Open — stray ref() generator | — |

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
