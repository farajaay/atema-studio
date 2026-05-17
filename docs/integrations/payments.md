# Payment Integration Readiness — Moyasar & Tap

> Owner-facing readiness audit of the two KSA-licensed gateways the booking
> flow can ship with. Updated 2026-05-17.

---

## 1. TL;DR

| Gateway | Wired in code? | Test mode? | Live mode? | Recommendation |
|---|---|---|---|---|
| **Moyasar** | ✅ Yes (`src/components/MoyasarForm.tsx`) | ⚠️ Needs key | ⚠️ Needs key | **Ship-ready** — just add the publishable key to `.env`. |
| **Tap Payments** | ⛔ Not wired | n/a | n/a | Possible secondary integration if Moyasar fee rates become an issue. |
| **Bank transfer** | ✅ Yes (`BankTransferPayment.tsx`) | ✅ Always | ✅ Always | Already live; needs WhatsApp automation for confirmation (see [whatsapp.md](./whatsapp.md)). |

---

## 2. Moyasar — current implementation

### What's already built

| Concern | Status | Notes |
|---|---|---|
| Card form embed | ✅ | Moyasar's hosted form is injected into `MoyasarForm.tsx`'s container ref. |
| Mada / Visa / Mastercard / STC Pay | ✅ | All four methods enabled via `methods: ['creditcard', 'stcpay']` (creditcard covers Mada, Visa, Mastercard). |
| Currency | ✅ | SAR, hardcoded. |
| Deposit-only charge | ✅ | We charge `deposit` (50% of total) at booking time, not the full amount. |
| Callback handling | ✅ | `App.tsx` reads `?moyasar_id=` query param, verifies the transaction, marks the booking as paid. |
| Metadata | ✅ | `booking_id` + `booking_ref` attached to every charge for reconciliation. |
| 3DS / SCA | ✅ (handled by Moyasar) | Moyasar's hosted form takes care of 3DS challenges. |
| Webhooks | ⛔ Not configured | Currently we rely on the redirect callback only. Adding webhooks would catch the rare case where the customer's browser closes before redirect (3DS fallback). **See §4.** |
| Refunds | ⛔ Not exposed in admin | Issued manually from the Moyasar dashboard if needed. Could be wired into the booking edit modal as a "Refund deposit" button. |

### What's needed to go live

1. **Sign up at moyasar.com** (need a Saudi commercial registration + IBAN).
   ATEMA already has both (CR + Al Rajhi IBAN), so this is a 30-minute task.
2. **Get the publishable key** — Moyasar issues both a test (`pk_test_…`) and
   a live key (`pk_live_…`). Put the live key in `.env`:
   ```
   VITE_MOYASAR_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
   ```
3. **Configure the success/cancel callback URLs** in the Moyasar dashboard:
   ```
   Success: https://farajaay.github.io/atema-studio/#/?moyasar_id={id}&status=paid
   Cancel:  https://farajaay.github.io/atema-studio/#/?status=cancelled
   ```
4. **Test with their test cards** (4111 1111 1111 1111 for Visa, etc.) — at
   least one full happy path before flipping to live.
5. **Add a privacy-policy + refund-policy page** — Moyasar's live activation
   requires both linked URLs. T&C popup in BookingPage already covers most of
   this; just needs a public `/policy` page or extracts of the same text.

### Fee structure (Moyasar, as of 2026)

| Method | Fee |
|---|---|
| Mada (local debit) | 1.0% + 1 SAR |
| Visa / Mastercard | 2.75% + 1 SAR |
| STC Pay | 1.5% + 1 SAR |

For a 3,450 SAR deposit on a Royal package:
- Mada: ~36 SAR fee
- Visa: ~95 SAR fee
- STC Pay: ~53 SAR fee

This is **operating cost**, not deducted from customer — they pay the full
deposit amount. Fees are settled at month-end against ATEMA's bank account.

---

## 3. Tap Payments — comparison

### Why consider Tap

- Lower fees than Moyasar on Mada (~0.8%) and Visa/Master (2.5% + 1 SAR).
- Equivalent feature set (3DS, hosted card form, webhooks, refund API).
- Stronger presence in GCC outside KSA, so useful if ATEMA expands to UAE.

### Why stay with Moyasar (current choice)

- Moyasar's documentation is markedly more developer-friendly.
- Moyasar's settlement to Al Rajhi is T+1 (vs Tap's T+2).
- Switching now means re-implementing the card form (~1 day of work) for a
  fee delta of roughly 100 SAR/month at current volume.

### Decision rule

Stay with Moyasar until either:
1. Monthly card-payment volume exceeds 50,000 SAR (fee delta becomes
   meaningful), or
2. ATEMA opens a UAE branch (Tap's UAE coverage is materially better).

---

## 4. Recommended next steps (priority order)

1. **Activate Moyasar live mode** — 1 hour of admin work, then test 1 real
   booking. (Owner action.)
2. **Add webhook signature verification** — 2 hours of engineering work,
   eliminates the "browser closed before redirect" edge case.
3. **Expose a "Refund deposit" button** in the admin booking-detail modal —
   1 hour of engineering, lets the team handle cancellations without leaving
   the admin panel.
4. **Add a `/policy` public route** that aggregates T&C, refund policy, PDPL
   notice — 30 minutes of engineering, satisfies Moyasar's activation
   requirements and improves SEO.
5. **Consider Tap as a backup gateway** once monthly volume justifies the
   integration cost.

---

## 5. What the code does, step by step

```
1. Customer fills BookingFormModal.
2. createBooking() inserts a row in `bookings` (status='pending', payment_status='unpaid').
3. PaymentMethodChooser renders: [💳 Card] [🏦 Bank transfer].

   ────── Card path (Moyasar) ──────

4. MoyasarForm mounts.
5. MoyasarForm.tsx loads window.Moyasar SDK on demand from
   https://cdn.moyasar.com/mpf/1.7.3/moyasar.js.
6. Moyasar.init({amount: deposit*100, callback_url: …, …}) injects the
   card form into the page.
7. Customer enters card → Moyasar handles 3DS → success redirect to
   our callback URL with ?moyasar_id=charge_xxx.
8. App.tsx's effect picks up the query param, calls
   verifyMoyasarPayment(charge_id), updates the booking to
   payment_status='paid' status='confirmed'.
9. Booking-detail modal shows confirmation + contract/invoice download.

   ────── Transfer path ──────

4. BankTransferPayment renders IBAN + copy buttons + contract preview.
5. Customer transfers via Al Rajhi app.
6. Customer clicks "Mark as awaiting transfer" → booking gets
   payment_method='transfer', a status flag, awaiting admin confirmation.
7. Today: admin manually confirms after seeing WhatsApp receipt.
   Tomorrow: WhatsApp automation closes the loop (see whatsapp.md).
```

---

## 6. Audit log of payment-related state transitions

Every payment-status change should be auditable. Today this is implicit
(only the latest state is stored on `bookings`). A small future enhancement:

```sql
create table public.payment_events (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references bookings(id) on delete cascade,
  event         text not null,        -- 'charge_initiated', 'charge_succeeded', 'charge_failed', 'refunded'
  amount        integer,
  gateway       text,                 -- 'moyasar', 'tap', 'transfer'
  gateway_ref   text,
  payload       jsonb,                -- full webhook body
  created_at    timestamptz default now()
);
```

Useful when ZATCA or the bank asks why a particular booking was paid /
refunded six months later.
