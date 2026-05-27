# ATEMA STUDIO — Path to Revenue: Gap Analysis & Activation Roadmap

> **What this is:** an assessment + ordered checklist of everything standing
> between "platform built" and "platform collecting money." It changes no code —
> it tells you what to run, deploy, and build, in priority order.
> **Last reviewed:** 2026-05-27.

## Context

ATEMA is a bilingual luxury photography booking platform that is **functionally
built** — booking flow, card + bank-transfer payments, ZATCA invoices,
contracts, discount codes, and customer self-service (reschedule + package
change) all exist and are unit-tested. But it is **not yet generating money**,
and the question is *what's missing to start*.

Investigation (verified against code, not docs) found three categories of gap:
1. **Activation** — most of the system is built but unrun/undeployed/in-test-mode.
2. **Revenue integrity** — the card "paid" state is set from a spoofable URL param.
3. **Revenue capture** — upgrade top-ups aren't collected and the self-service
   link is never delivered, so money is left on the table.

Deployments stay on hold until PC access. Intended outcome: a single ordered
path from "no revenue" → "collecting deposits safely" → "capturing the full
upside."

---

## Current state (verified)

| Path | State | Evidence |
|---|---|---|
| Bank transfer | Works; `awaiting_transfer` set on WA tap; **`paid` is manual admin step** | `BankTransferPayment.tsx:148-155`; `payments.md:139-141` |
| Card (Moyasar) | Wired but **test mode**, and `paid` written **client-side from URL param** | `MoyasarForm.tsx:6`; `BookingPage.tsx:691-692,854`; `PaymentResultPage.tsx:30-37` |
| Deposit model | 50% of total, computed + displayed correctly | `BookingPage.tsx:754` |
| Self-service changes | Shipped + tested, **undeployed**; top-up only *notified*, link never *sent* | `change-booking/index.ts:188-211`; `create-booking/index.ts:221-234` |
| Security HIGHs (H-6/H-7/H-7b/H-9) | **Fixed in code**; need their migrations run | `docs/bugs.md` patch tracker |
| `/policy` page (Moyasar prereq) | **Exists** | `App.tsx:70`, `src/pages/PolicyPage.tsx` |
| VAT/CR | Off by default; not a blocker | `src/services/settings.ts:18-25` |

---

## TIER 0 — Activation: take real money (owner + deploy; **no new code**)

The fastest path to the first riyal. After this, **bank transfer is live
immediately** (deposit confirmed manually) and **cards go live once Moyasar
approves**. Detailed sub-checklist for the self-service piece already exists at
[`ACTIVATION-BOOKING-CHANGES.md`](./ACTIVATION-BOOKING-CHANGES.md).

1. **Run pending SQL migrations + seeds** in the Supabase SQL editor (all
   idempotent; full list in `CLAUDE.md` §6). The revenue-critical ones:
   - `seed-packages-2026-05.sql` — **required**: `create-booking` prices/redeems
     against real catalogue rows (else it falls back to demo data).
   - `migrations-2026-05-rls-hardening.sql` + `…-audit-patches.sql` — these
     **apply the H-6/H-7/H-9 PII + discount fixes** that are already in code.
   - `migrations-2026-05-discount-codes.sql` + `…-launch-code.sql` — seeds the
     `LAUNCH15` code so promotions work day one.
   - `migrations-2026-05-booking-changes.sql` + `…-otp.sql` — self-service.
2. **Deploy Edge Functions** + set secrets:
   - `create-booking` — **server-side total recompute (Patch C-3); deploy before
     promoting any payment** so a crafted POST can't record total=1 SAR.
   - `change-booking`, `wa-webhook`, `wa-receipt`, `wa-reminders`.
   - Secrets: `META_WA_*`, `ANTHROPIC_API_KEY`, `OWNER_WA_NUMBER`, `CRON_SECRET`.
   - Schedule `wa-reminders` cron `*/30 * * * *`.
3. **Drop the legacy anon `bookings` INSERT policy** once `create-booking` is
   stable (finishes Patch C-3 — closes the forge-a-total hole).
4. **Activate Moyasar live**: obtain `pk_live_…`, set
   `VITE_MOYASAR_PUBLISHABLE_KEY`, configure success/cancel callback URLs to
   `atemastudio.xyz`, run one real test booking. (`/policy` prereq already met.)
   ⚠ Do **TIER 1 #1 first** — see below.
5. **Deploy site**: `npm run build && npm run deploy`.

*VAT/CR optional:* leave VAT off until ZATCA-registered; then set
`vat_number`/`cr_number` in admin settings before enabling.

---

## TIER 1 — Protect the money (engineering; do **before** relying on card revenue)

- **#1 CRITICAL — server-side Moyasar payment verification.**
  Today `PaymentResultPage.tsx:30-37` writes `payment_status:'paid'` directly
  from the `status` URL param. Anyone can open
  `…/#/?status=paid&id=<bookingId>` and mark a booking paid **without paying**.
  Fix: a `verify-payment` Edge Function (or Moyasar webhook handler) that calls
  Moyasar's API with the **secret** key to confirm the charge is actually
  captured, then marks `paid` server-side. The client must stop writing `paid`.
  Reference: `payments.md:99-101` lists this as the open priority. *Est. ~½ day.*
- **Confirm discount integrity holds.** H-7/H-7b (basket-change re-eval) are
  fixed; additionally sanity-check that self-service package change preserves —
  but never *increases* — the discount vs the code's `max_discount`
  (`change-booking/index.ts:188-189`). *Low.*
- **Verify the PII migrations are applied** (H-6 `mood_boards`, H-9 `bookings`
  anon SELECT) — code is fixed; this is just confirming Tier 0 step 1 ran.

---

## TIER 2 — Capture revenue left on the table (engineering)

- **Deliver the manage link automatically.** `create-booking` never sends
  `/#/manage/<token>` (`index.ts:221-234`; token not even returned). Without it,
  customers can't self-serve → no reschedule/upgrade activity. Fix: return
  `manage_token` and include the link in the WA confirmation (and/or an admin
  "send link" button). *Small — unlocks Tier 2 below.*
- **Collect the top-up on upgrades.** `change-booking` computes `topUpDue` but
  only texts "we'll be in touch" (`index.ts:207-211`; `ManageBookingPage.tsx`
  shows the balance). Wire the difference into the existing payment UI
  (`PaymentMethodChooser` / `MoyasarForm` / `BankTransferPayment`) so the bride
  pays the delta. *Est. ~1 day. Highest direct upside.*
- **Regenerate contract + invoice after a change.** Totals update but the signed
  contract / tax invoice go stale (`index.ts:197-200`; acknowledged in
  `MANUAL.md` §13g). Trigger client-side regen on manage-page success, or move
  generators server-side. *Medium; compliance + clarity.*

---

## TIER 3 — Trust, retention, polish (supports revenue)

- **Automate bank-transfer confirmation.** `wa-receipt` (Claude Vision receipt
  OCR) already exists — deploying it + `wa-reminders` closes the manual
  "admin eyeballs the receipt" loop and cuts drop-off.
- **Admin "Refund deposit" button** (`payments.md` TODO).
- **Lifecycle reminders** (`wa-reminders`) reduce no-shows / unpaid balances.

---

## Recommended order

1. **TIER 0** (activation) → bank-transfer bookings + deposits flow immediately.
2. **TIER 1 #1** (payment verification) → before any card promotion.
3. **Moyasar live** (Tier 0 step 4, gated on #1).
4. **TIER 2**: link delivery → top-up collection → invoice/contract regen.
5. **TIER 3**.

The single biggest unlock for *new* code is **Tier 2 top-up collection**; the
single biggest *risk* to fix is **Tier 1 #1 payment verification**; the fastest
*first money* is **Tier 0** (bank transfer needs no new code).

---

## Verification (how to confirm money actually flows)

- **Bank transfer:** create a booking → choose transfer → tap WA →
  `payment_status='awaiting_transfer'`; admin marks `paid` → `status='confirmed'`.
- **Card (after Tier 1 #1):** pay with a Moyasar test card → booking marked
  `paid` **by the server**; then **spoof test** — hit the callback with
  `status=paid` and a real bookingId and confirm it does **NOT** mark paid.
- **Total integrity:** POST a crafted `create-booking` with a tampered total →
  server recomputes from catalogue (Patch C-3).
- **Discount:** apply `LAUNCH15`, confirm the server-capped amount.
- **Self-service:** open the texted manage link → reschedule (date moves,
  `reschedule_count`=1) → upgrade → confirm the **top-up is collected**, not just
  shown.

---

## Critical files referenced

- Payment trust hole: `src/pages/PaymentResultPage.tsx:27-38`; `src/App.tsx` (`parseMoyasarCallback`)
- Moyasar enable / deposit: `src/components/MoyasarForm.tsx:6`; `src/pages/BookingPage.tsx:691-692,854,754`
- Bank transfer: `src/components/BankTransferPayment.tsx:148-155`
- Booking create (notify + return): `supabase/functions/create-booking/index.ts:221-251`
- Top-up: `supabase/functions/change-booking/index.ts:188-211`; `supabase/functions/_shared/change.ts`; `src/pages/ManageBookingPage.tsx`
- Discount: `database/migrations-2026-05-discount-codes.sql` + `…-launch-code.sql`; `supabase/functions/discount-preview/`
- Invoice / VAT seller block: `src/services/invoice.ts:221-222`; `src/services/settings.ts:18-25`
- Pending steps source-of-truth: `CLAUDE.md` §6; `docs/bugs.md` tracker; `docs/integrations/payments.md`; `docs/ACTIVATION-BOOKING-CHANGES.md`
