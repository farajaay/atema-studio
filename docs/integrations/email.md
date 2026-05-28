# Email — Zoho Mail SMTP

Booking-confirmation email sent from **atema@atemastudio.xyz** via Zoho
Mail SMTP (`smtp.zoho.com:465`, implicit TLS, app-password auth).

This is the **transactional** plumbing — one email goes out per booking,
immediately after the row is inserted by `create-booking`. Replies land
back in the Zoho inbox naturally because `Reply-To` is the sender mailbox.

The full lifecycle (deposit received, mood-board ready, shoot-day-tomorrow,
etc.) still rides on WhatsApp — see `wa-platform.md`. Email is intentionally
narrow today.

---

## 1. Architecture (one screen)

```
BookingPage  →  create-booking Edge Fn
                       │
                       ├─ insert into bookings (existing)
                       ├─ send-whatsapp call    (existing, fire-and-forget)
                       └─ sendEmail()           (NEW, fire-and-forget)
                              │
                              ├─ Zoho SMTP  ──→  atema@atemastudio.xyz
                              │                  (reply-to = same)
                              └─ audit row in email_messages
```

- **`_shared/email.ts`** — thin denomailer wrapper. Validates the
  recipient, opens a single-shot SMTP session, logs every attempt (sent /
  skipped / failed) into `email_messages`. Never throws.
- **`_shared/email-confirmation.ts`** — pure-string bilingual template
  builder. No DOM, no React. Inline-styled and table-based — Outlook-safe.
- **`email_messages`** table — audit log mirroring `wa_messages`. Service
  role writes; authenticated admin reads.

Why fire-and-forget: a flaky SMTP session must never roll back a
successful booking insert. If sending fails the bride is still booked,
the admin sees the failure row in `email_messages`, and Fatima can resend
manually from the inbox.

---

## 2. Owner setup — do these once, in order

### 2.1 Verify the domain is connected in Zoho Mail

This was done when the mailbox was provisioned. Confirm at
<https://mail.zoho.com> → Settings → Domains → `atemastudio.xyz` shows
**Verified**. If not, follow Zoho's domain wizard before continuing.

### 2.2 Add an app-specific password

Zoho rejects the mailbox password over SMTP when 2FA is on. Generate a
dedicated app password:

1. Sign in at <https://accounts.zoho.com>.
2. **Security → App Passwords → Generate New Password.**
3. Name it `ATEMA STUDIO – Supabase` so it's revocable later.
4. Copy the 16-character password (no spaces). You'll paste it into
   Supabase in step 2.4.

### 2.3 DNS records (Namecheap, atemastudio.xyz)

Add these to the same DNS zone where the A records for GitHub Pages live.
Without them, brides on Gmail / Outlook will see the email land in spam.

| Type  | Host                | Value                                                                                              |
| ----- | ------------------- | -------------------------------------------------------------------------------------------------- |
| TXT   | `@`                 | `v=spf1 include:zoho.com -all`                                                                     |
| TXT   | (from Zoho admin)   | DKIM record — Zoho Mail → Settings → Mail Accounts → Domains → **DKIM** → **Add Selector** → copy. |
| TXT   | `_dmarc`            | `v=DMARC1; p=none; rua=mailto:atema@atemastudio.xyz`                                               |

Notes:

- **SPF:** if the apex already has a TXT starting with `v=spf1`, merge
  the `include:zoho.com` into that single record — multiple SPF records
  invalidate the whole domain.
- **DKIM:** the host name is selector-specific (Zoho will show it after
  you click **Add Selector**, e.g. `zmail._domainkey`). Copy the host
  name and the long `v=DKIM1; k=rsa; p=…` value exactly.
- **DMARC:** start with `p=none` so we *monitor* before enforcing. Upgrade
  to `p=quarantine` after a week of clean reports, then `p=reject`.

Propagation is usually under 30 min on Namecheap; sometimes hours.

### 2.4 Supabase secrets

Set these via `supabase secrets set` (or in the dashboard, *Edge
Functions → Manage Secrets*):

```
ZOHO_SMTP_HOST       smtp.zoho.com
ZOHO_SMTP_PORT       465
ZOHO_SMTP_USER       atema@atemastudio.xyz
ZOHO_SMTP_PASSWORD   <16-char app password from step 2.2>
ZOHO_SMTP_FROM_NAME  ATEMA STUDIO
ZOHO_SMTP_FROM       atema@atemastudio.xyz
SITE_ORIGIN          https://atemastudio.xyz
```

`SITE_ORIGIN` is used to build the `/#/manage/<token>` CTA link. Override
if previewing against a staging URL.

### 2.5 Run the migration

In the Supabase SQL editor:

```sql
\i database/migrations-2026-05-email.sql
```

(Idempotent — safe to re-run.)

### 2.6 Deploy the function

```
supabase functions deploy create-booking
```

The shared modules (`_shared/email.ts`, `_shared/email-confirmation.ts`)
ship with the function — no separate deploy needed.

---

## 3. Smoke test

1. Submit a booking from <https://atemastudio.xyz/#/book> with a real
   email you control.
2. Watch in Supabase **Edge Logs → create-booking** — you should see a
   `[email]` log line, or no error.
3. Check the recipient inbox. Latency is usually under 10 seconds.
4. Check **Supabase → Tables → `email_messages`** — there should be one
   row with `status = 'sent'`.
5. Reply to the email; confirm the reply lands in the Zoho inbox.

If the email goes to spam: re-check DKIM is signed (Zoho dashboard shows
a green tick next to the selector once DNS is verified) and that the SPF
record is the *only* SPF record on the apex.

---

## 4. Failure modes

| What you see                                                | What it means                                            | Fix                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `email_messages.status = 'skipped'`, error `no_valid_recipient` | Bride left email blank or it failed our format check | Nothing to fix — booking still succeeded, follow up by WA.                         |
| `status = 'skipped'`, error `smtp_credentials_unset`        | Supabase secrets not configured yet                      | Set the secrets in §2.4 and redeploy.                                              |
| `status = 'failed'`, error `Invalid login: 535 Authentication failed` | App password rejected by Zoho                  | Regenerate the app password (step 2.2), update the secret, redeploy.               |
| `status = 'failed'`, error `Connection timed out`           | Outbound SMTP blocked from Supabase region               | Open a Supabase support ticket — port 465 should be allowed by default.            |
| All emails land in spam                                     | SPF/DKIM/DMARC misconfigured                             | Re-verify §2.3; check at <https://www.mail-tester.com>.                            |

---

## 5. What's NOT built (deliberate scope)

- **Lifecycle emails** (deposit received, final-payment due, mood-board
  ready, shoot-day tomorrow). WhatsApp covers these. Add later only if
  brides ask.
- **PDF attachments** (contract + invoice). The bride generates these
  client-side from the booking flow and the manage page; attaching them
  in email would require porting the generators server-side. Out of scope
  for now.
- **Channel preference** (WhatsApp vs Email vs Both). When the Telegram
  bot lands, that's the right moment to introduce a `comm_pref` column
  and let the bride pick.
- **Admin compose / outbox view.** Audit reads happen via the
  `email_messages` table directly until volume justifies UI.

---

*Last updated: 2026-05-28 — booking confirmation via Zoho Mail SMTP shipped.*
