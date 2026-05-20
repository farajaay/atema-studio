# Discount Codes — Design & Implementation Plan

> Status: **plan / proposal** (2026-05-20). Pre-implementation.
> Owner: Fatima · Engineering: Claude

## 0. Why this exists

Three real use-cases:

1. **Seasonal promotions** — Ramadan, National Day, Black-Friday-style
   anniversary specials.
2. **Influencer / partner codes** — invite a small number of trusted
   creators to share a code, attribute revenue back to each one.
3. **Recovery & goodwill** — when a session gets rescheduled, when a
   bride brings a friend, when a complaint needs a gesture.

A discount code is the smallest tool that solves all three without
inventing three different mechanisms.

## 1. Scope (what's in, what's out)

**In scope:**

- Two discount types: **percentage** (e.g. `10%`) and **flat SAR** (e.g.
  `500 SAR off`).
- Admin-defined codes (human-readable like `RAMADAN25`, `FATIMA10`).
- A validity window (`valid_from` → `valid_to`).
- A global usage cap per code (`max_uses`, e.g. first 50 uses).
- A minimum subtotal floor (e.g. only valid when subtotal ≥ 4 000 SAR).
- Application during the customer booking flow.
- Server-side validation + atomic usage increment via the
  `create-booking` Edge Function (no client-side trust).
- Audit trail on every booking row that used a code.
- Visibility on contract + invoice + admin booking detail.
- A simple admin CRUD page at `/admin/discount-codes`.

**Out of scope (this iteration):**

- Per-customer one-use enforcement *unless explicitly chosen below.*
- Stacking multiple codes on one booking. Brides can apply **one code at
  most**. Luxury convention; also simpler audit.
- Auto-generated single-use codes (e.g. "thank you for your purchase,
  here's a code for next time"). Can be added later as a button in the
  admin codes manager.
- Tiered discounts (e.g. "10% off Royal, 20% off Couture") — for now a
  code applies uniformly to whatever subtotal qualifies. Tier-specific
  codes can be done with a single `applies_to_package_ids` column later.

## 2. Data model

### 2.1 New table — `discount_codes`

```sql
create table public.discount_codes (
  code             text primary key,                -- e.g. 'RAMADAN25', stored UPPER
  description      text,                            -- admin-only label
  kind             text not null check (kind in ('percent','flat')),
  value            integer not null check (value > 0),
                                                     -- percent: 1..100
                                                     -- flat:    SAR amount
  max_discount     integer,                          -- cap for percent codes (nullable)
  min_subtotal     integer default 0 check (min_subtotal >= 0),
  valid_from       timestamptz default now(),
  valid_to         timestamptz,                      -- nullable = no upper bound
  max_uses         integer,                          -- nullable = unlimited
  used_count       integer not null default 0,
  active           boolean not null default true,
  created_by       uuid,                             -- admin auth.uid()
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index discount_codes_active_idx on public.discount_codes(active);
```

**Why `code` is the primary key:** human-typed, case-insensitive
match, never reassigned. We store UPPER, match UPPER. No surrogate
UUID — the natural key IS the lookup key.

### 2.2 Three new columns on `bookings`

```sql
alter table public.bookings
  add column if not exists discount_code   text references public.discount_codes(code),
  add column if not exists discount_amount integer default 0
       check (discount_amount >= 0),
  add column if not exists discount_kind   text
       check (discount_kind in ('percent','flat'));
```

- `discount_code` — the redeemed code (kept even after the code itself
  is deleted? No — FK with `on delete set null` so historical bookings
  survive code deletion).
- `discount_amount` — the **absolute SAR amount removed from subtotal**
  for this booking. Freezing this here means the booking's totals
  never re-compute if the code definition changes later.
- `discount_kind` — copy of the code's kind at apply time (for the
  invoice line "10% off" vs "500 SAR off" wording).

### 2.3 Redemption function (atomic increment)

```sql
create or replace function public.redeem_discount_code(
  p_code text,
  p_subtotal integer
) returns table (
  applied_amount integer,
  applied_kind   text,
  reason         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.discount_codes%rowtype;
  amount integer := 0;
begin
  -- Case-insensitive lookup + row lock for the duration of this txn.
  select * into c from public.discount_codes
   where code = upper(trim(p_code))
   for update;

  if not found then
    return query select 0, null::text, 'not_found';
    return;
  end if;
  if not c.active then
    return query select 0, c.kind, 'inactive';
    return;
  end if;
  if c.valid_from is not null and now() < c.valid_from then
    return query select 0, c.kind, 'not_yet_active';
    return;
  end if;
  if c.valid_to is not null and now() > c.valid_to then
    return query select 0, c.kind, 'expired';
    return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select 0, c.kind, 'exhausted';
    return;
  end if;
  if p_subtotal < coalesce(c.min_subtotal, 0) then
    return query select 0, c.kind, 'below_min_subtotal';
    return;
  end if;

  -- Compute amount.
  if c.kind = 'percent' then
    amount := floor(p_subtotal * c.value / 100.0);
    if c.max_discount is not null and amount > c.max_discount then
      amount := c.max_discount;
    end if;
  else
    amount := least(c.value, p_subtotal);
  end if;

  -- Atomically increment usage. This is the redemption.
  update public.discount_codes
     set used_count = used_count + 1,
         updated_at = now()
   where code = c.code;

  return query select amount, c.kind, 'ok';
end;
$$;

grant execute on function public.redeem_discount_code(text, integer)
  to service_role;
```

Two important properties:

1. **`security definer` + `service_role`-only grant** — only the
   `create-booking` Edge Function can call this. The anon role
   cannot. Brides can't loop-call it.
2. **`for update` row lock + same-transaction increment** —
   concurrent redemptions can't both consume the last seat of a
   `max_uses=50` code.

The function is the **only place** `used_count` is incremented.

## 3. Customer UX

### 3.1 Where it appears

After packages + addons, **just above the running total**, inside the
booking sticky-summary panel. NOT inside the booking form modal —
applying the code shouldn't require committing personal details yet.

```
┌─ ملخص حجزك ────────────────────────────────┐
│  الباقة الملكية            6 900 ر.س         │
│  ساعة إضافية               700 ر.س           │
│  ─────────────────────────────────────────  │
│  المجموع الفرعي           7 600 ر.س         │
│                                              │
│  [ كود خصم؟ … ] [ تطبيق ]                  │
│                                              │
│  ✓ RAMADAN25 — خصم 25% (1 900 ر.س)         │  ← when applied
│                                              │
│  ضريبة 15%                  855 ر.س         │
│  ─────────────────────────────────────────  │
│  المجموع                  6 555 ر.س         │
│                                              │
│  [ احجزي الآن ]                              │
└──────────────────────────────────────────────┘
```

### 3.2 States

| State | UI |
|---|---|
| Empty | input field + `تطبيق` button |
| Validating | spinner inside the button |
| Applied (success) | green pill with code + saving amount + ✕ to remove |
| Not found | red helper text: `الكود غير صحيح` |
| Expired | red helper text: `انتهت صلاحية الكود` |
| Below minimum | amber helper text: `الكود متاح للحجوزات فوق X ر.س` |
| Exhausted | red helper text: `تم استنفاد عدد مرات استخدام الكود` |
| Inactive | red helper text: `هذا الكود لم يعد متاحاً` |

All messages bilingual via existing `useLang()` pattern.

### 3.3 When the brid e submits

The discount is **carried in the booking form state** until submit. On
submit:

1. Client posts `{ ..., discount_code: 'RAMADAN25' }` to the
   `create-booking` Edge Function.
2. Edge Function calls `redeem_discount_code(code, subtotal)`.
3. If the function returns `reason='ok'` and a matching `amount`, the
   booking row is inserted with the three discount columns populated
   and a recomputed `subtotal/vat/total`.
4. If validation fails server-side (e.g. code became exhausted in the
   12 seconds between client-validate and submit), the Edge Function
   returns a structured error; the client re-displays the state error
   and the booking is NOT inserted.

The **client-side validate** is only there for instant feedback. The
**server-side validate** is the source of truth. This is the same
pattern as Patch C-3 (server-side total recomputation).

## 4. Admin UX

A new route `/admin/discount-codes`, lazy-loaded next to
PackagesManager / PortfolioManager / JournalManager.

### 4.1 List view (always shown)

| Code | Type | Value | Status | Used | Until | Actions |
|---|---|---|---|---|---|---|
| RAMADAN25 | % | 25 | Active | 12 / 50 | 2026-04-30 | ✏ ⏸ 🗑 |
| FATIMA10 | flat | 500 | Active | 3 / ∞ | — | ✏ ⏸ 🗑 |
| WELCOME15 | % | 15 | Paused | 7 / ∞ | — | ✏ ▶ 🗑 |

`✏` edit · `⏸/▶` pause/resume (toggles `active`) · `🗑` delete (only if `used_count = 0`).

### 4.2 Edit form

Same fields as the table:
- Code (UPPER, required, unique)
- Description (admin-only, optional)
- Type — percent / flat
- Value — number, validated against type
- Max discount cap (only when type = percent)
- Min subtotal floor (optional, default 0)
- Valid from / valid to (optional)
- Max uses (optional, ∞ if blank)
- Active toggle

### 4.3 Analytics depth — **TBD by scoping question 2**

Two options, picked by Fatima:

**Option A — Simple CRUD only.** Just the list above with usage count.
~3 hours to build.

**Option B — Full analytics.** List + per-code drill-down panel:

- Mini KPI strip: # redemptions, total discount given, total revenue
  attributed (subtotals from bookings using this code).
- Table of every booking that used the code (booking_ref, customer
  name, date, amount discounted, current status).
- Click a booking → opens the existing booking modal.
- Used in conjunction with the Studio-wide P&L dashboard to see
  whether a campaign actually moved net profit (the dashboard already
  treats discount_amount as a revenue reduction; see §6).

~6–7 hours to build.

## 5. Security model

The bride **cannot insert a fraudulent booking** with a fake discount.
Belt + braces:

1. **`discount_codes` SELECT is admin-only.** Anon cannot list codes,
   probe them by attempting reads, or harvest a snapshot of valid
   codes. (`grant select on discount_codes to authenticated` only.)
2. **`discount_codes` is never written by anon.** Only authenticated
   admins can INSERT/UPDATE/DELETE.
3. **`used_count` is never written by anon either.** Only the
   `redeem_discount_code` RPC mutates it, and the RPC is
   `service_role`-only.
4. **The `create-booking` Edge Function is the single redemption
   path.** It uses the service-role key, validates the code via the
   RPC, recomputes totals from authoritative `packages` + `addons` +
   the function's returned `applied_amount`, and writes the booking.
5. **The booking row stores the absolute applied amount**, not the
   percentage. So even if `RAMADAN25` is later edited from 25% to
   10%, this booking's historical record still shows the 25% it
   originally got.

Combined with the RLS hardening from
`migrations-2026-05-rls-hardening.sql`, the result is:

- Brides type a code → client validates *cosmetically* by querying
  via an Edge Function (NOT the table directly; see §5.1) → see
  instant feedback.
- On submit, the server validates and redeems atomically.
- No way for a bride to forge `discount_amount` in the request:
  the Edge Function ignores client-supplied amounts and uses the
  RPC's authoritative result.

### 5.1 The "preview" Edge Function

Because `discount_codes` is admin-only, the client can't read codes
directly. We expose a tiny **preview** endpoint that takes
`{ code, subtotal }` and returns the redemption *forecast* — the
applied amount, the reason if invalid, but **does NOT increment
`used_count`**. This is what the client-side validate call hits.

Two endpoints, sharing one Edge Function:

- `POST /functions/v1/discount-preview` → forecast only, no
  redemption.
- (existing) `POST /functions/v1/create-booking` → the actual
  redemption, atomic with booking insert.

Rate-limit `discount-preview` to ~5 calls/second/IP (Supabase Edge
Functions provide built-in rate limiting via `Deno.serve` middleware).

## 6. Impact on existing systems

### 6.1 Booking totals

Current formula in `create-booking`:

```
subtotal = base + addons
vat      = subtotal × 0.15
total    = subtotal + vat
```

New formula:

```
gross_subtotal     = base + addons
discount_amount    = redemption.applied_amount    // could be 0
net_subtotal       = gross_subtotal - discount_amount
vat                = net_subtotal × 0.15
total              = net_subtotal + vat
```

Important: VAT is computed on the **discounted subtotal**. This is
how Saudi ZATCA treats discounts in Phase 1 simplified tax invoices
— the QR code's tag 4 (total incl VAT) and tag 5 (VAT amount) both
reflect the discounted amounts. The invoice template needs to show
the discount line *before* the VAT line.

### 6.2 Contract + invoice

Three small additions to the template:

```
الإجمالي الفرعي        7 600 ر.س
خصم — RAMADAN25 (25%)  (1 900 ر.س)        ← new line, only when applied
الإجمالي بعد الخصم      5 700 ر.س         ← new line, only when applied
ضريبة القيمة المضافة     855 ر.س
المجموع                6 555 ر.س
```

Both the discount line and the post-discount subtotal are gated on
`booking.discount_amount > 0`.

### 6.3 P&L dashboard

The Studio-wide P&L dashboard (`src/services/pnl.ts`) reads
`booking.subtotal` — which under the new model is the *net*
subtotal (post-discount). So **the P&L already reflects discount
impact correctly** without any code change. The discount is invisible
in the P&L; it just shows as lower revenue.

Future enhancement (Option B in §4.3): a per-code analytics table
that surfaces "this code cost us 12 × 1 900 = 22 800 SAR in
discounts but brought 60 800 SAR of net revenue we wouldn't have
otherwise had."

### 6.4 Admin booking modal

The booking detail modal in `AdminDashboard.tsx` gains one row
between the financials block and the status block:

```
خصم مطبّق:  RAMADAN25 — 25%  (–1 900 ر.س)
```

Only rendered when `discount_code` is set.

## 7. Files touched (preview)

```
database/migrations-2026-05-discount-codes.sql         NEW
src/services/discount.ts                                NEW
src/components/DiscountInput.tsx                        NEW
src/pages/DiscountCodesManager.tsx                      NEW
supabase/functions/discount-preview/index.ts            NEW
supabase/functions/create-booking/index.ts              MOD
src/pages/BookingPage.tsx                               MOD (input near total)
src/services/contract.ts                                MOD (discount line)
src/services/invoice.ts                                 MOD (discount line + ZATCA tags)
src/pages/AdminDashboard.tsx                            MOD (modal line + nav link)
src/App.tsx                                             MOD (route)
src/hooks/useAdminData.ts                               MOD (Booking type)
docs/integrations/discount-codes.md                     NEW (this doc)
docs/MANUAL.md                                          MOD (new §13e section)
CLAUDE.md                                               MOD (new convention)
```

Approximate effort: **~6 hours** for the simple-CRUD path (option A
in §4.3), **~9 hours** for full analytics (option B). DB migration +
service layer + customer UI + Edge Function are the same in either
case; only the admin page differs.

## 8. Rollout plan

1. **Code:** ship in one commit (atomic, easier to revert).
2. **DB:** run `migrations-2026-05-discount-codes.sql` in Supabase
   SQL editor.
3. **Edge Functions:** deploy `discount-preview` + the updated
   `create-booking`:
   ```
   supabase functions deploy discount-preview create-booking
   ```
4. **First test code:** Fatima creates `TEST10` (10%, max_uses=1) in
   the admin panel.
5. **Smoke test:** book a small package end-to-end with `TEST10`.
   Verify discount on invoice + admin modal + P&L.
6. **Production:** create the first real campaign code.

## 9. Open questions (must answer before §3 implementation)

1. **Per-customer enforcement?** Do we cap to **one redemption per
   phone number**, or allow the same bride to use the same code on
   multiple bookings (only `max_uses` total caps it)?
2. **Admin UI depth?** Simple CRUD (option A, ~3 hr) or full
   analytics (option B, ~6–7 hr)?

Both questions surfaced inline in the next message to Fatima.

---

*— end of plan —*
