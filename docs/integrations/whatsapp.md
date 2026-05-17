# WhatsApp Integration — Design & Process Map

> **Status:** _Designed, not yet implemented._
> This document is the reference blueprint the owner (and an integrator) can
> hand to an engineer or no-code automator to build out. Estimated effort:
> 2–3 days of build + 1 day of WhatsApp Business verification with Meta.

---

## 1. Goal in one paragraph

When a customer pays via bank transfer, they send the bank's receipt to ATEMA
on WhatsApp. Today that triggers a manual chain (admin opens the receipt →
opens the admin panel → marks the booking paid → replies to the customer →
sends the contract). **Automate that chain end-to-end** so:

1. The customer gets an instant confirmation reply with their contract.
2. The booking row in Supabase flips to `payment_status = paid` automatically.
3. The owner (Fatima) gets a one-line summary notification, no action needed.

---

## 2. Recommended tech stack

| Concern | Recommended | Why |
|---|---|---|
| WhatsApp transport | **Wati** (or 360dialog / MessageBird) | Official Meta BSP, supports KSA, simpler than raw Cloud API, has built-in templates and a JS SDK. |
| Receipt extraction | **OpenAI GPT-4o-mini Vision** or **Google Document AI** | Reads bank-transfer screenshots (Al Rajhi, STC Pay, …) and extracts `amount` / `date` / `from` / `reference` in one call. Vision models handle the wild variety of receipt layouts better than tuned OCR. |
| Workflow / glue | **Supabase Edge Function (Deno)** + a small **Cron** job | Keeps everything on Supabase, no new vendor. Edge Function receives the WA webhook, calls OpenAI, updates the booking, fires back the WA template message. |
| Owner notifications | **Same WA channel** + email via Supabase auth.users | Send a "✓ Booking confirmed: ATEMA-260520-K9P3 · 4,500 SAR · فاطمة بوحسن" line to Fatima's WhatsApp business app. |

Alternative low-code stack: **n8n** (self-hosted on a 5 USD/mo VPS) or
**Make.com** — drag-and-drop the same flow without writing Deno. Slower at
scale (>100 receipts/day) but zero engineering time.

---

## 3. Process map — happy path

```
┌──────────────────────────────────────────────────────────────────┐
│                       CUSTOMER on WhatsApp                       │
│       sends a photo/PDF of the bank transfer receipt             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼  (Wati webhook fires)
┌──────────────────────────────────────────────────────────────────┐
│            SUPABASE EDGE FUNCTION  /wa-receipt                   │
│                                                                  │
│  1.  Pull message metadata: sender phone, media URL, timestamp.  │
│  2.  Download the attachment to a Supabase Storage bucket        │
│      `receipts/` (signed URL).                                   │
│  3.  Call OpenAI Vision with the attachment + this prompt:       │
│                                                                  │
│      "Extract from this bank receipt JSON:                       │
│       { amount: number, currency: 'SAR'|other,                   │
│         date: 'YYYY-MM-DD', sender_name: string,                 │
│         reference: string, beneficiary: string }"                │
│                                                                  │
│  4.  Look up the matching booking:                               │
│       SELECT * FROM bookings                                     │
│       WHERE customer_phone = $sender_phone                       │
│         AND payment_status = 'unpaid'                            │
│         AND ABS(deposit - $extracted_amount) < 1                 │
│       ORDER BY created_at DESC LIMIT 1                           │
│                                                                  │
│  5.  Match decision tree:                                        │
│       ┌─ exact match (phone + amount) ── auto-confirm            │
│       ├─ phone match, amount within ±5% ── flag for admin OK     │
│       └─ no match  ───────────────────── flag for admin review   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
   ┌────────────────┐ ┌───────────────┐ ┌──────────────────┐
   │ auto-confirm   │ │ admin-review  │ │ unmatched receipt│
   │ (best case)    │ │ (likely match)│ │                  │
   └────────┬───────┘ └───────┬───────┘ └──────────┬───────┘
            │                 │                    │
            │                 ▼                    ▼
            │      WhatsApp to OWNER:    WhatsApp to OWNER:
            │      "Likely match.        "Unrecognised receipt
            │       Approve? [yes/no]"    from +9665…
            │                              Booking? [list]"
            │
            ▼
   UPDATE bookings SET payment_status='paid',
                       payment_method='transfer',
                       payment_ref=$reference,
                       status = CASE WHEN status='pending'
                                     THEN 'confirmed' ELSE status END
   WHERE id = $matched_booking_id;
            │
            ▼
   INSERT INTO contracts + invoices (auto-generate via existing
   services/contract.ts + services/invoice.ts logic, called from
   the Edge Function with a shared TS module).
            │
            ▼
   WhatsApp template message to CUSTOMER (pre-approved with Meta):
       "تم تأكيد حجزك ✓
        رقم الحجز: ATEMA-260520-K9P3
        الباقة: الباقة الملكية
        التاريخ: 12 يونيو 2026
        المدفوع: 3,450 ر.س
        المتبقي: 3,450 ر.س
        📎 العقد:    https://farajaay.github.io/.../contract/ATEMA-260520-K9P3
        📎 الفاتورة: https://farajaay.github.io/.../invoice/ATEMA-260520-K9P3
        نشرّفنا برؤيتك يوم المناسبة 🤍"
            │
            ▼
   WhatsApp ping to OWNER (Fatima):
       "✓ ATEMA-260520-K9P3 · 3,450 SAR · فاطمة محمد ع.
        Bank transfer confirmed. Event 2026-06-12 (الباقة الملكية)."
```

---

## 4. Edge cases the flow must handle

| Scenario | Behaviour |
|---|---|
| Receipt sent from a phone that has no booking | Flag → owner; ask which booking it belongs to via interactive WhatsApp list message. |
| Customer sent the wrong amount | If diff < 5%, ask owner to approve; if >5%, treat as unmatched. |
| Customer sends multiple receipts (deposit + final) | Match each to the corresponding booking row's `deposit` or `total - deposit` due. |
| Receipt is unreadable (blurry / cropped) | Vision returns confidence < 0.6 → ask the customer "نحتاج صورة أوضح من فضلك". |
| Customer messages something other than a receipt | Fallback handler: forward to owner, send "تم استلام رسالتك، سيتم الرد قريباً". |
| WhatsApp 24-hour service window expires before owner approves | Use a pre-approved Meta template message for re-engagement (templates are checked into a `wa-templates/` folder in the repo). |
| Receipt is a PDF, not an image | Same flow — OpenAI Vision API accepts PDF + image inputs since 2024. |

---

## 5. Database additions required

A small migration to support the automation:

```sql
-- Audit log for every WA message we process (idempotency + debugging)
create table if not exists public.wa_messages (
  id              uuid primary key default gen_random_uuid(),
  wa_message_id   text unique not null,
  from_phone      text not null,
  media_url       text,
  raw_payload     jsonb,
  extracted       jsonb,           -- OpenAI Vision output
  matched_booking uuid references bookings(id),
  confidence      numeric(4,2),
  status          text not null check (status in
                  ('received','auto_confirmed','pending_review','unmatched','failed')),
  notes           text,
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);

-- Payment reconciliation columns on bookings
alter table public.bookings
  add column if not exists payment_ref      text,
  add column if not exists payment_received_at timestamptz,
  add column if not exists payment_evidence_url text;  -- signed URL to receipt

-- RLS: owner-only
alter table public.wa_messages enable row level security;
create policy "Admin reads wa_messages" on public.wa_messages
  for all using (auth.role() = 'authenticated');
```

---

## 6. Environment variables to set

```
# Wati (or 360dialog)
WATI_API_KEY=…
WATI_WEBHOOK_SECRET=…
WATI_PHONE_ID=…

# OpenAI (vision extraction)
OPENAI_API_KEY=sk-…

# Optional: Fatima's WhatsApp business number for owner pings
OWNER_WA_NUMBER=+9665…
```

These live in **Supabase project Secrets**, not in the front-end `.env`.
The Edge Function reads them via `Deno.env.get()`.

---

## 7. Cost estimate at typical volume

Assuming **30 bookings/month** ≈ **60 WA receipts** (deposit + final):

| Line item | Unit cost | Monthly |
|---|---|---|
| Wati (Starter plan, KSA region) | $39 / mo flat | **$39** |
| Meta WhatsApp conversation fees (Saudi marketing template) | ~$0.10 / convo | **$6** |
| OpenAI Vision (gpt-4o-mini @ ~1k tokens per receipt) | ~$0.002 / call | **$0.12** |
| Supabase Edge Function invocations | Free under 500k | **$0** |
| Supabase Storage (receipts bucket) | Free under 1 GB | **$0** |
| **Total** | | **≈ $45 / mo** |

At 100 bookings/month you cross into Wati Pro (~$99/mo) — still under
$120/mo total.

---

## 8. Build sequence (recommended)

1. **Day 1 morning** — Provision Wati, verify ATEMA's WhatsApp business
   number, create the message templates in Meta Business Manager
   (require pre-approval; budget 24 hours).
2. **Day 1 afternoon** — Stand up the Edge Function skeleton, wire the Wati
   webhook, log incoming messages to `wa_messages`.
3. **Day 2 morning** — Add OpenAI Vision extraction, the matching SQL, and
   the auto-confirm code path.
4. **Day 2 afternoon** — Add the admin-review + unmatched fall-back paths,
   the owner notification templates.
5. **Day 3 morning** — End-to-end test with 5 real Al-Rajhi receipts. Tune
   the extraction prompt as needed.
6. **Day 3 afternoon** — Go live. Watch the `wa_messages` table for the first
   week; you'll typically need 2–3 prompt tweaks.

---

## 9. Manual fallback (today, no automation)

Until the automation is built, the team follows this manual SOP:

1. Customer sends receipt via WhatsApp.
2. Owner opens **Admin Dashboard → Bookings → finds the booking**.
3. Clicks **Edit** → sets `Payment status = Paid` and `Status = Confirmed`.
4. Downloads the contract + invoice from the bookings detail modal (the
   admin UI already exposes the View + Download buttons).
5. Forwards both files back to the customer on WhatsApp.

This is the workflow the automation is replacing.
