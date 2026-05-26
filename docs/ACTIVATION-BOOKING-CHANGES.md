# Activation — Customer self-service booking changes

> Deployment checklist for the **reschedule + package/add-on change** feature
> (`/#/manage/<token>` + the `change-booking` Edge Function). All code is on the
> branch and tested, but **nothing is live until the steps below are run** from
> a machine with the Supabase CLI. Run them in order.
>
> Feature reference: [`MANUAL.md` §13g](./MANUAL.md). Conventions:
> [`CLAUDE.md` §4.9](../CLAUDE.md).

---

## 0. Prerequisites

- Supabase CLI installed and logged in (`supabase login`), project linked
  (`supabase link --project-ref <ref>`).
- Repo checked out on the feature branch, `npm install` done.
- For OTP / confirmation texts to actually send, the WhatsApp Cloud API
  secrets must already be set (`META_WA_*`, `OWNER_WA_NUMBER`) — see the
  WhatsApp activation list in `CLAUDE.md` §6. Without them the booking change
  still applies; only the WhatsApp message is skipped.

---

## 1. Run the database migrations

In the **Supabase SQL editor**, paste and run each file **in this order**
(both are idempotent — safe to re-run):

1. `database/migrations-2026-05-booking-changes.sql`
   - Adds `bookings.manage_token` (160-bit secret, defaulted) +
     `reschedule_count`, **backfills a token onto every existing booking**,
     creates the `booking_changes` audit table, and the
     `get_booking_by_token()` read RPC.
2. `database/migrations-2026-05-booking-changes-otp.sql`
   - Creates `booking_otps` (salted-hash step-up codes), RLS-on with no
     anon/authenticated policies.

Each file ends with a `select … as section` verification line — confirm it
returns the expected table/column names.

---

## 2. Deploy the Edge Function

```bash
supabase functions deploy change-booking
```

This is the only path that writes a change (service-role). It handles three
actions: `reschedule`, `request_otp`, `change_package`.

---

## 3. Deploy the site

```bash
npm run build      # tsc -b && vite build (must pass clean)
npm run deploy     # publishes dist/ to gh-pages
```

This ships the new `/#/manage/<token>` page.

---

## 4. Verify (smoke test)

Use a real booking row (grab its `manage_token` from the Supabase table editor):

1. Open `https://atemastudio.xyz/#/manage/<token>` — the booking summary should
   render (proves `get_booking_by_token` works and RLS is correct).
2. **Reschedule:** pick a free date ≥ 7 days out and within 30 days of the
   original → confirm. The date should move, `reschedule_count` should become
   `1`, and a row should appear in `booking_changes`.
3. **Change package:** tap *Send verification code* → a 6-digit code should
   arrive on the booking's WhatsApp (requires the WA secrets) → enter it →
   confirm. The booking totals should update and a `kind='package'` audit row
   should appear.

Spot-check the negative paths: a date < 7 days out should be blocked; a wrong
OTP should be rejected; a 6th wrong attempt should lock out.

---

## 5. Not yet wired (deliberate follow-ups)

These are **not** part of this activation — they are separate slices to build
later (see `CLAUDE.md` §6):

- **Manage-link delivery** — auto-texting `/#/manage/<token>` at booking time.
  Until then, share the link manually.
- **Top-up payment collection** — an upgrade flags the balance due and notifies,
  but does not yet open a Moyasar/transfer flow to charge the difference.
- **Contract/invoice regeneration** after a change (generators are client-side).
- **WhatsApp OTP template** — if you want the code sent as an approved template
  rather than a session message, submit one to Meta.

---

## Rollback

- The migrations only **add** columns/tables and one RPC; they don't alter
  existing booking behaviour. To disable the feature, stop linking customers to
  `/#/manage/<token>` (the page is harmless without the link) or remove the
  route in `src/App.tsx` and redeploy.
- `manage_token` and `reschedule_count` can stay; they're inert if unused.
