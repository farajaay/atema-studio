# Installment plans (خطة التقسيط) — August 2026

> Admin-assigned split-payment plans: a booking's total divided over **3, 4
> or 5 دفعات**, attached to **any booking** from the admin dashboard (not a
> per-package setting). Requested by the owner for high-value bookings
> (Royal/Signature/Couture territory), but deliberately not restricted by
> package — eligibility is the owner's judgement.

## Context

Today the money story is rigid: a 50% deposit at booking (`Math.round(total *
0.5)`, computed — never stored) and the balance due one day before the event
(contract المادة الثانية), chased through the `final_payment` workflow step.
High-value bookings (11–20k SAR) need gentler terms; the owner wants to offer
3/4/5-way splits without touching the public booking flow.

## Decisions (owner-confirmed)

1. **The deposit is installment #1.** The existing 50% deposit stays exactly
   as it is in the booking flow; the *remaining balance* is divided across
   the remaining 2/3/4 installments. `payment_status` keeps its current
   meaning ('paid' = deposit received) — the plan layers on top.
2. **Installments carry due dates** — auto-suggested evenly spaced between
   plan creation and the contract's hard stop (event − 1 day, المادة
   الثانية). The daily cron reminds people (see 4).
3. **The bride sees the plan** on `/#/manage/<token>` — schedule, progress,
   and the IBAN facts for the next payment (reusing the top-up transfer
   card).
4. **Payments are recorded, not ticked** — each received transfer gets
   amount + received date + optional note, so uneven/partial settlements are
   representable. Reminders: owner digest lines (due/overdue) + a bride
   email ~3 days before each due date, email-only (WA stays behind
   `wa_enabled`, untouched).
5. **The contract tells the truth**: when a plan exists, regenerated
   documents render the actual schedule instead of the 50/50 wording — in
   BOTH `src/services/contract.ts` and the Deno mirror (change-both rule).

## Shape

- **`database/migrations-2026-08-installments.sql`** —
  `bookings.installment_plan smallint` (null | 3 | 4 | 5);
  `booking_installments` (booking_id FK cascade, seq 1..5, amount, due_date,
  paid_amount, paid_at, note; `unique(booking_id, seq)`; admin-CRUD RLS
  mirroring `booking_workflow_steps`);
  `installment_notifications` dedupe guard (`unique(booking_id, seq, kind)`,
  kind ∈ due/overdue/bride_upcoming; admin SELECT, service-role writes —
  the `wa_reminders_sent` convention);
  `get_installments_by_token(p_token)` SECURITY DEFINER RPC for the manage
  page (same capability-link model as `get_booking_by_token`).
- **`supabase/functions/_shared/installments.ts`** — dependency-free policy
  module (the `reschedule.ts` discipline): `buildInstallmentPlan` (deposit =
  seq 1, balance split with the LAST row absorbing rounding, last due =
  event − 1 day), `rebalanceUnpaid` (re-spread the outstanding remainder
  across unpaid rows after a total change), `installmentProgress`,
  `installmentPrompts` (owner due/overdue + bride upcoming, pure).
  Unit tests: `src/services/installments-policy.test.ts`.
- **`src/services/installments.ts`** — admin CRUD glue (fetch/create/record/
  undo/rebalance/remove), `.select()`-checked writes like `useAdminData`.
- **`src/pages/AdminDashboard.tsx`** — «خطة التقسيط» card in the booking
  modal's details tab (create 3/4/5 with preview, record payments inline,
  drift warning + rebalance when the booking total no longer matches the
  plan, armed remove) + a `تقسيط ×N` chip in the bookings table.
- **`src/services/manage.ts` + `src/pages/ManageBookingPage.tsx`** — bride
  card: schedule + progress + `TopUpTransfer` facts for the next unpaid
  installment.
- **`supabase/functions/workflow-reminders/index.ts`** — same daily run
  gains installment scanning: owner digest entries ride the existing
  workflow digest email; bride reminders are individual sends via
  **`_shared/email-installment.ts`**; ALL guard rows insert only after a
  confirmed send.
- **`src/services/contract.ts` + `supabase/functions/_shared/contract.ts`
  + `src/services/documents.ts`** — optional `installments` on
  `ContractData`; `regenerateDocuments` fetches the plan rows and the
  template swaps the 50/50 boxes + المادة الثانية bullets for the schedule.

## Not in scope (v1)

- Card payments for installments (cards are deferred studio-wide; transfer +
  receipt is the settlement path, admin records receipts).
- WhatsApp reminders (needs a Meta-approved template; email is the
  always-channel).
- Auto-flipping any `payment_status` from installment math — settled-ness is
  derived and displayed, the owner stays in control.

## Verification

- `npm test` — new policy tests (build/rounding/dates/clamp/progress/
  prompts/rebalance) + all existing suites.
- `npm run build` — type-check + bundle.
- Manual: admin modal → create plan on a demo booking → record a payment →
  bride page shows progress; regenerate documents → contract shows schedule.
- SQL: run `migrations-2026-08-installments.sql` in the Supabase editor
  (idempotent), then the daily `workflow-reminders` cron picks up
  installment reminders with no schedule change.
