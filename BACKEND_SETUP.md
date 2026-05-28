# ATEMA STUDIO — Backend Setup Guide

> First-time wiring of every server-side dependency: Supabase database,
> Edge Functions, Moyasar payments, Meta WhatsApp Cloud API, and Zoho Mail
> SMTP for the booking-confirmation email.

For the day-to-day operating manual (admin panel, calendar, P&L, mood
board, customer self-service), see [`docs/MANUAL.md`](./docs/MANUAL.md).

---

## 1. Supabase database

1. Create a project at <https://app.supabase.com>.
2. In **SQL Editor**, run the migrations in this order — each is idempotent:

   ```sql
   -- Base schema (run once)
   \i database/schema.sql
   \i database/admin-setup.sql
   \i database/app-settings.sql

   -- 2026-05 iteration migrations (all idempotent, safe to re-run)
   \i database/migrations-2026-05.sql
   \i database/migrations-2026-05-branding.sql
   \i database/migrations-2026-05-custom-domain.sql
   \i database/migrations-2026-05-wa.sql
   \i database/migrations-2026-05-moodboard.sql
   \i database/migrations-2026-05-booking-changes.sql
   \i database/migrations-2026-05-booking-changes-otp.sql
   \i database/migrations-2026-05-rls-hardening.sql
   \i database/migrations-2026-05-discount-codes.sql
   \i database/migrations-2026-05-launch-code.sql
   \i database/migrations-2026-05-email.sql

   -- Seeds (UPSERT-by-stable-id, so foreign keys survive)
   \i database/seed-packages-2026-05.sql
   \i database/seed-journal-2026-05.sql
   \i database/seed-portfolio-2026-05-expanded.sql
   ```

3. Copy the **Project URL** and **anon public key** from
   *Project Settings → API* into a `.env` file at the repo root:

   ```ini
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_MOYASAR_PUBLISHABLE_KEY=pk_live_...      # or pk_test_... while testing
   ```

   If `VITE_MOYASAR_PUBLISHABLE_KEY` is missing or contains
   `your_key_here`, the booking flow auto-skips card payment and goes
   straight to bank transfer.

---

## 2. Deploy Supabase Edge Functions

```bash
# Install + login (once)
npm install -g supabase
supabase login

# Link this repo to the project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all functions
supabase functions deploy create-booking
supabase functions deploy change-booking
supabase functions deploy discount-preview
supabase functions deploy wa-webhook
supabase functions deploy wa-receipt
supabase functions deploy wa-reminders
supabase functions deploy send-whatsapp
```

---

## 3. Supabase secrets

```bash
# Service-role key (required — used by create-booking + change-booking)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Site origin (used in emails + manage links)
supabase secrets set SITE_ORIGIN=https://atemastudio.xyz

# Meta WhatsApp Cloud API
supabase secrets set META_WA_TOKEN=<permanent-access-token>
supabase secrets set META_WA_PHONE_NUMBER_ID=<phone-number-id>
supabase secrets set META_WA_VERIFY_TOKEN=<your-webhook-verify-token>
supabase secrets set META_WA_APP_SECRET=<app-secret-for-HMAC>
supabase secrets set OWNER_WA_NUMBER=+966548323496

# Anthropic Claude Vision (used by wa-receipt for OCR)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Reminders cron secret
supabase secrets set CRON_SECRET=<random-32-chars>

# Zoho Mail SMTP (booking-confirmation email)
supabase secrets set ZOHO_SMTP_HOST=smtp.zoho.com
supabase secrets set ZOHO_SMTP_PORT=465
supabase secrets set ZOHO_SMTP_USER=atema@atemastudio.xyz
supabase secrets set ZOHO_SMTP_PASSWORD=<16-char-app-password>
supabase secrets set ZOHO_SMTP_FROM_NAME="ATEMA STUDIO"
```

See [`docs/integrations/email.md`](./docs/integrations/email.md) for the
end-to-end Zoho Mail setup (DNS records, app password, SPF/DKIM/DMARC).

---

## 4. Payments — Moyasar (cards) + Al Rajhi (transfer)

### 4.1 Moyasar

1. Register at <https://moyasar.com> as a Saudi merchant.
2. From the dashboard, copy the **publishable key** into
   `VITE_MOYASAR_PUBLISHABLE_KEY` (step 1).
3. Set the **callback URL** to `https://atemastudio.xyz/?moyasar_id={id}`.
4. While testing, use a `pk_test_*` key — the booking flow handles both.

See [`docs/integrations/payments.md`](./docs/integrations/payments.md)
for the full live-activation checklist (KYC docs, supported methods,
fees).

### 4.2 Bank transfer

Hard-coded in `src/components/BankTransferPayment.tsx`:

| Field | Value |
|---|---|
| Bank | Al Rajhi Bank |
| Beneficiary | فاطمة بوحسن / Fatima Bohassan |
| Account | `329608010885626` |
| IBAN | `SA0380000000329608010885626` |
| WhatsApp | `+966 54 832 3496` |

---

## 5. WhatsApp — Meta Cloud API (NOT Twilio)

This project uses the **Meta WhatsApp Cloud API directly** for lifecycle
reminders and customer receipt auto-extraction (via Claude Vision OCR).
Twilio is **not** used.

The setup involves Meta Business verification, a phone-number signature,
6 templates submitted for approval, and a cron-fired Edge Function. The
end-to-end procedure lives at
[`docs/integrations/wa-platform.md`](./docs/integrations/wa-platform.md)
— follow it in order.

After Meta + Supabase secrets are configured, schedule the reminders
cron in Supabase:

```
*/30 * * * *   →  supabase functions invoke wa-reminders --no-verify-jwt
```

---

## 6. Email confirmation — Zoho Mail SMTP

Every booking with a valid `customer_email` receives a bilingual
confirmation from `atema@atemastudio.xyz`. Setup is documented at
[`docs/integrations/email.md`](./docs/integrations/email.md):

1. Verify the `atemastudio.xyz` domain in Zoho Mail.
2. Generate an app-specific password at <https://accounts.zoho.com>.
3. Add DNS records for SPF / DKIM / DMARC (so messages don't land in spam).
4. Set the Zoho secrets in step 3 above.
5. Smoke-test with a real booking to an inbox you control.

---

## 7. Frontend deploy

**Auto-deploys on push to `master`** via the GitHub Actions workflow at
`.github/workflows/deploy.yml`. The workflow runs tests, builds, and
publishes `dist/` to the `gh-pages` branch. GitHub Pages serves
<https://atemastudio.xyz> from `gh-pages`.

For an emergency redeploy without a code change, hit **Run workflow** on
the [Actions tab](https://github.com/farajaay/atema-studio/actions/workflows/deploy.yml).

For a local deploy (rarely needed):

```bash
npm run build
npm run deploy        # gh-pages -d dist
```

---

## 8. DNS — atemastudio.xyz (Namecheap)

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `farajaay.github.io` |
| TXT | `@` | `v=spf1 include:zoho.com -all` |
| TXT | (Zoho-supplied) | DKIM `v=DKIM1; k=rsa; p=...` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:atema@atemastudio.xyz` |

`public/CNAME` already pins `atemastudio.xyz` so the value survives the
gh-pages publish. In **GitHub → Settings → Pages**, the custom domain
should show `atemastudio.xyz` with **Enforce HTTPS** ticked.

---

## 9. Verifying the wiring

1. **Site:** <https://atemastudio.xyz> loads, the noir theme paints
   before React mounts.
2. **Booking insert:** Submit a test booking; a new row appears in
   **Supabase → bookings**.
3. **WhatsApp:** Receive the booking-confirmation template at the
   `OWNER_WA_NUMBER`.
4. **Email:** Receive a bilingual confirmation in your inbox. Audit row
   in **Supabase → email_messages** with `status='sent'`.
5. **Reminders cron:** Wait ~30 min, check **Supabase → Edge Logs →
   wa-reminders** for the heartbeat. (No reminders will fire until a
   booking is within the trigger window — see `wa-platform.md` §3.)
6. **Self-service:** Open `https://atemastudio.xyz/#/manage/<token>`
   with a real token from a real booking; the page loads with the
   booking summary.

If any of these fails, the matching integration doc covers the
diagnostic path.

---

*Last updated: 2026-05-28 — email + CI auto-deploy added*
