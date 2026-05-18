# ATEMA Studio — WhatsApp Smart Lifecycle Platform

> **Status:** Code shipped. Pending: Meta Business verification, template
> approval, secret configuration, function deploy, cron scheduling. After
> those operational steps, the platform runs unattended.

This doc supersedes the original draft at `docs/integrations/whatsapp.md`
(which proposed Wati). The actual implementation uses **Meta WhatsApp
Cloud API directly + Supabase Edge Functions + Anthropic Claude Vision**
— same outcome, no third-party BSP in the middle, ~40% lower running cost.

---

## 1. What the platform does, end to end

```
┌────────── Customer journey ───────────┐    ┌────── ATEMA backend ─────────┐
│                                       │    │                              │
│  Books on the website                 │───►│  create-booking Edge Fn       │
│                                       │    │     ↓ (already shipped)       │
│  Sends bank-transfer receipt          │───►│  wa-webhook                   │
│  via WhatsApp                         │    │     ↓                         │
│                                       │    │  wa-receipt                   │
│  Receives:                            │◄───│     ↓ Claude Vision           │
│   • instant payment confirmation      │    │     ↓ amount match            │
│   • contract + invoice                │    │     ↓                         │
│                                       │    │  bookings.payment_status      │
│                                       │    │       → 'paid' / 'confirmed'  │
│                                       │    │                              │
│  72 hours before the shoot   ◄────────│────│  wa-reminders cron            │
│  48 hours before             ◄────────│────│     fires every 30 min        │
│  24 hours before             ◄────────│────│     reads bookings + sent log │
│  2 hours after               ◄────────│────│     sends Meta templates      │
│  30 days after               ◄────────│────│                              │
│  1-year anniversary          ◄────────│────│                              │
│                                       │    │                              │
└───────────────────────────────────────┘    └──────────────────────────────┘
```

Every customer message and every reminder is persisted in `wa_messages` /
`wa_reminders_sent`. The admin can review live conversations and intervene
manually at any time.

---

## 2. Files in this repo

| File | Role |
|---|---|
| `database/migrations-2026-05-wa.sql` | Creates `wa_messages` + `wa_reminders_sent`, adds reminder columns to `bookings`. **Run once** in Supabase SQL editor. |
| `supabase/functions/_shared/wa.ts` | Meta Cloud API wrapper (sendText, sendTemplate, fetchMediaUrl, signature verification, phone normalisation). |
| `supabase/functions/wa-webhook/index.ts` | Receives Meta webhook → verifies signature → audits to DB → routes images to `wa-receipt`, texts to owner forwarder. |
| `supabase/functions/wa-receipt/index.ts` | Downloads receipt media → Claude Vision JSON extraction → matches against booking deposit → auto-confirms or flags for review. |
| `supabase/functions/wa-reminders/index.ts` | Cron-fired every 30 min. Decides which of the six lifecycle reminders is due per booking, sends Meta templates, logs idempotency. |
| `supabase/functions/create-booking/index.ts` | Already shipped (Patch C-3). Inserts the booking row that everything else keys off. |
| `supabase/functions/send-whatsapp/index.ts` | Legacy convenience wrapper kept for the immediate post-booking notification. Will be folded into `wa-send` later. |

---

## 3. Database schema additions

`migrations-2026-05-wa.sql` adds:

```sql
wa_messages (
  id, wa_message_id, from_phone, to_phone, direction,
  message_type, body, media_url, matched_booking, extracted,
  status, notes, raw_payload, created_at, resolved_at
)

wa_reminders_sent (
  id, booking_id, reminder_kind, sent_at, wa_message_id,
  UNIQUE (booking_id, reminder_kind)
)

bookings  -- extended
  + wa_reminders_enabled  boolean default true
  + wa_last_reminder_at   timestamptz
  + payment_evidence_url  text
  + payment_received_at   timestamptz
```

`wa_reminders_enabled` is the per-customer opt-out switch. Surface it as a
toggle in the booking detail admin modal so staff can disable reminders
for specific clients (e.g. a VIP wedding planner who handles their own
comms).

---

## 4. Operational prerequisites — what you (Fatima) need to do

### 4.1 Meta Business verification (one-time, ~24–72h)

1. Go to <https://business.facebook.com> and create / claim ATEMA's
   business asset.
2. Add a **WhatsApp Business Account** under the asset.
3. Add ATEMA's phone number (Fatima's existing 054 832 3496 OR a new
   dedicated business number — recommended).
4. Pass verification (Meta will ask for ATEMA's commercial registration —
   you already have it).
5. Once verified, in **WhatsApp → API Setup**, note these values:
   - **Phone number ID** → `META_WA_PHONE_ID`
   - **WhatsApp Business Account ID** (informational)
6. Generate a **permanent access token** (System User → Generate Token).
   Save it as `META_WA_ACCESS_TOKEN`. Never expires unless you rotate.

### 4.2 Webhook configuration

In **Meta Business → WhatsApp → Configuration**:

- **Callback URL:** `https://<your-project>.supabase.co/functions/v1/wa-webhook`
- **Verify token:** any string you choose, e.g. `atema_2026_K9P3X` —
  save the same string as the `META_WA_VERIFY_TOKEN` secret in Supabase.
- **Subscribe to:** `messages` only (for now).
- Click **Verify and save** — Meta will hit your webhook with `GET`;
  the function responds with the challenge if the verify-token matches.

### 4.3 App secret for signature verification (recommended)

In **Meta Business → App Settings → Basic** copy the App Secret and save
it as `META_WA_APP_SECRET`. The webhook function will verify every
incoming POST's `X-Hub-Signature-256` header, rejecting spoofed traffic.
If you skip this for dev, the function logs a warning and accepts anyway.

### 4.4 Anthropic API key for receipt vision

1. Get an API key from <https://console.anthropic.com>.
2. Save it as `ANTHROPIC_API_KEY` in Supabase secrets.

### 4.5 Owner notification number (optional but recommended)

Save Fatima's WhatsApp number as `OWNER_WA_NUMBER` (E.164,
`+966548323496`). Receipts that need review, unmatched payments, and
inbound customer texts get forwarded here so Fatima sees them in the
ATEMA Studio WhatsApp Business app.

### 4.6 Cron secret

Generate a long random string for `CRON_SECRET`. Set it as a Supabase
secret AND in your scheduler's Authorization header.

---

## 5. Supabase secrets to set

```bash
supabase secrets set META_WA_PHONE_ID="..."
supabase secrets set META_WA_ACCESS_TOKEN="EAAG..."
supabase secrets set META_WA_VERIFY_TOKEN="atema_2026_K9P3X"
supabase secrets set META_WA_APP_SECRET="..."          # optional but recommended
supabase secrets set OWNER_WA_NUMBER="+966548323496"   # optional
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
```

---

## 6. Meta message templates — submit before going live

Open **Meta Business → WhatsApp → Message Templates → Create**. For each
of the six lifecycle reminders, copy-paste the body verbatim. Variables
are `{{1}}, {{2}}, …`. Category: **UTILITY** (lower cost, no marketing
opt-in required).

> ⚠️ Approval typically takes **15 minutes to 24 hours**. Submit all six on
> day 1 so they're ready when you flip the cron on.

### 6.1 `atema_pre_72h` · Utility · Arabic

**Body:**
```
{{1}}، باقي ٣ أيام على جلستك في ATEMA ✨
تاريخ المناسبة: {{2}}

تذكير لطيف: هذي آخر فرصة لإضافة لمسات تكمل تجربتك:
• ساعة تصوير إضافية
• تغطية ليلة الحناء
• فيديو سينمائي
• الملفات الخام

أيّ تعديل آخر يسعدنا 💌
```
**Buttons:** `URL` → label "أضف لمستك" → `https://farajaay.github.io/atema-studio/#/book?ref={{1}}`

---

### 6.2 `atema_pre_48h` · Utility · Arabic

**Body:**
```
{{1}}، تذكير قبل ٤٨ ساعة من جلسة ATEMA 📍

تاريخ: {{2}}
المكان: {{3}}

سنصلك قبل الموعد بنصف ساعة. لأي تواصل عاجل: 0548323496.
```

---

### 6.3 `atema_pre_24h` · Utility · Arabic

**Body:**
```
{{1}}، استعدادات اليوم الأخير قبل جلستك 🌸

سنصل تمام {{2}} غداً.

نصائح من الستوديو:
• نوم جيد وشرب ماء كافٍ
• تجهيز الفساتين على مشجب
• إكسسوارات في صندوق صغير لسهولة التغيير
• الكوشة جاهزة قبل وصول الفريق بساعة

نشوفك مع أجمل اللحظات 🤍
```

---

### 6.4 `atema_post_2h` · Utility · Arabic

**Body:**
```
{{1}}، شكراً لرؤيتك اليوم 🌷
كان وقتاً جميلاً مع فريق ATEMA.

الصور المعدّلة: خلال ١٢٠–١٨٠ يوم
الفيديو السينمائي: خلال ١٢٠ يوم
معاينة سريعة (٥ صور مختارة): خلال ٧ أيام

نتمنى لكِ أحلى الذكريات 🤍
```

---

### 6.5 `atema_post_30d` · Utility · Arabic

**Body:**
```
{{1}}، مرّ شهر على جلستك مع ATEMA 📸

نتمنى أن الصور أعجبتك. تجربتك تهمنا — لو تكرمتي بمشاركتنا رأيك
عبر تقييم سريع، يسعدنا.
شكراً لثقتك 🌹
```
**Buttons:** `URL` → "اكتبي تقييم" → Google review URL.

---

### 6.6 `atema_anniversary_1y` · Marketing · Arabic

> Note: this template is **MARKETING** category (not utility), because
> it's promotional. Meta requires the customer to have opted in (which is
> implicit when they book — but you can add an explicit opt-in checkbox
> to the booking form if you want airtight consent).

**Body:**
```
{{1}}، سنة كاملة مرّت على جلستك مع ATEMA 💕
بمناسبة ذكرى يومك المميّز، نقدّم لكِ خصماً حصرياً ١٥٪ على
أي باقة مخصّصة — تكفي تذكير وقت الحجز.

كود الخصم: LOYAL15 (ساري ٣٠ يوم)

نشتاق نشوفك من جديد 🌷
```
**Buttons:** `URL` → "احجزي بـ ١٥٪ خصم" → `https://farajaay.github.io/atema-studio/#/book?coupon=LOYAL15`

---

## 7. Cron scheduling

Two options for firing the reminders cron every 30 minutes:

### Option A — supabase-cron (recommended)

```sql
-- in Supabase SQL editor (requires pg_cron extension)
select cron.schedule(
  'atema-wa-reminders', '*/30 * * * *',
  $$
    select net.http_post(
      url := 'https://<your-project>.functions.supabase.co/wa-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>'
      )
    );
  $$
);
```

### Option B — cron-job.org (free, simpler)

- URL: `https://<your-project>.supabase.co/functions/v1/wa-reminders`
- Method: POST
- Header: `Authorization: Bearer <CRON_SECRET>`
- Schedule: every 30 minutes

Either way, the function returns a JSON summary you can inspect in the
cron dashboard.

---

## 8. Deploy steps

```bash
# 1. SQL migration (one-time)
#    Paste database/migrations-2026-05-wa.sql into Supabase SQL editor.

# 2. Set all secrets (from §5)

# 3. Deploy the three new Edge Functions
supabase functions deploy wa-webhook   --no-verify-jwt   # public webhook
supabase functions deploy wa-receipt                       # internal-only
supabase functions deploy wa-reminders                     # cron target

# 4. Configure Meta webhook → point at wa-webhook
#    (per §4.2)

# 5. Submit all six templates to Meta (per §6) and wait for approval

# 6. Schedule the cron (per §7)

# 7. Test by sending an Al-Rajhi receipt photo from a phone that has a
#    pending booking. You should see:
#      - wa_messages row inserted with status='received' → 'processing' → 'auto_confirmed' / 'needs_review'
#      - if auto_confirmed: customer gets the WhatsApp "تم استلام الدفعة" reply
#        and the bookings row flips to payment_status='paid'.
```

---

## 9. What "auto-confirm" actually means

A receipt is **auto-confirmed** when ALL of these hold:

1. The sender's phone matches a non-cancelled booking exactly.
2. Claude Vision returned `confidence ≥ 0.7`.
3. The extracted amount is within ±1 SAR of the booking's outstanding
   deposit (if `payment_status = 'unpaid'`) OR final-instalment due.

Anything else → `needs_review`. Owner gets a WhatsApp ping. Customer gets
a neutral "تم استلام الصورة، سيتم المراجعة" reply so they're not left
guessing.

A partial-match (within 5%) is logged with `notes = 'partial_match'` so
Fatima can confirm with one click in the admin panel.

---

## 10. Cost estimate at realistic volume

Assume 30 bookings/month, average 2 WA receipts each (deposit + final),
six reminders per booking:

| Line item | Unit cost | Monthly |
|---|---|---|
| Meta Cloud API conversations — UTILITY templates | ~$0.04 / convo | **$7.20** (180 reminders) |
| Meta Cloud API conversations — MARKETING templates | ~$0.10 / convo | **$3** (anniversary, ~30/mo) |
| Anthropic Claude 3.5 Sonnet Vision (receipts) | ~$0.015 / image | **$0.90** |
| Supabase Edge Functions | Free under 500k invocations | **$0** |
| Supabase Storage (none, we pass-through Meta URLs) | — | **$0** |
| Supabase pg_cron | Free | **$0** |
| **TOTAL** | | **≈ $11 / month** |

At 100 bookings/month: ~$35/mo. Cost scales linearly with booking volume.

---

## 11. What the admin should monitor

A small `/admin/conversations` page (not built yet — parked for v2)
would show:

- Recent inbound messages grouped by phone
- Receipts pending review (status='needs_review')
- Bookings with reminders sent this week
- Failures (status='failed' in wa_messages)

Until that exists, query directly:

```sql
-- Receipts needing review:
select created_at, from_phone, extracted, notes
  from public.wa_messages
 where status = 'needs_review' order by created_at desc limit 50;

-- Reminders sent this week:
select b.booking_ref, b.customer_name, r.reminder_kind, r.sent_at
  from public.wa_reminders_sent r
  join public.bookings b on b.id = r.booking_id
 where r.sent_at > now() - interval '7 days'
 order by r.sent_at desc;
```

---

## 12. Roadmap — what's NOT in this rollout

| Item | Status | Why deferred |
|---|---|---|
| Conversational concierge (browse packages on WhatsApp) | Not built | User-selected scope is reminders, not concierge |
| AI mood board | Not built | Same |
| Voice-note → brief transcription | Not built | Adds complexity; revisit after baseline is stable |
| `/admin/conversations` live monitor UI | Not built | Operationally low-priority; SQL queries cover for now |
| Customer reminder opt-out checkbox at booking time | Not built | Currently every booking opts in via DB default; add as a small form change later |
| Two-way customer chat (manual reply from admin UI) | Not built | Fatima can reply from her WhatsApp Business app directly |

---

## 13. Privacy + PDPL notes

- Every inbound media gets stored in `wa_messages.media_url` as the Meta
  CDN URL (signed, expires in 30 days). We do **not** copy the bank
  receipt image into Supabase Storage — minimises data residency
  exposure.
- The Claude Vision extraction call sends only the image bytes + a system
  prompt; the response is the extracted JSON which we persist in
  `wa_messages.extracted`. We don't send customer names or other PII to
  Claude.
- Reminders contain only the customer's first name + event date — never
  the booking total or payment information.
- Customers can be opted out by setting `bookings.wa_reminders_enabled =
  false`. A booking edit UI toggle for this is a small future change.

---

## 14. Security posture

- Webhook signature verified via HMAC-SHA256 against `META_WA_APP_SECRET`.
  Spoofed POSTs are rejected with 401.
- Cron endpoint requires `Authorization: Bearer <CRON_SECRET>`.
- All Edge Functions use the Supabase service role internally; the RLS
  policies on `wa_messages` / `wa_reminders_sent` only allow read by
  authenticated admins.
- Anthropic API key never leaves Supabase secrets; not bundled into the
  front-end.
- No Meta access token is ever returned to the customer's browser.

---

## 15. Failure modes + how the system recovers

| Failure | Behaviour |
|---|---|
| Meta API returns 5xx | The send fails; the reminder is **not** logged in `wa_reminders_sent`; next cron run retries it. |
| Claude Vision returns malformed JSON | Receipt is flagged `needs_review`; owner gets the photo. |
| Customer sends a receipt but has no booking | Inbound text reply ("شكراً لرسالتك") + audit log row. No crash. |
| Cron fires twice (e.g. retries) | `UNIQUE (booking_id, reminder_kind)` constraint blocks duplicates at the DB level. |
| Phone number on booking is malformed | Send call returns null silently; cron logs `ok: false` for that booking. Owner can fix the phone and the cron picks it up on the next 30-min run. |
| Webhook called before signature verification configured | Function falls back to "accept and log" mode with a warning. Tighten in production. |

---

## 16. Where it lives in the code

```
docs/integrations/wa-platform.md          ← you are here
docs/integrations/whatsapp.md             ← original draft, superseded
docs/integrations/payments.md             ← Moyasar + Tap audit
database/migrations-2026-05-wa.sql        ← run once
supabase/functions/_shared/wa.ts          ← Meta Cloud API wrapper
supabase/functions/wa-webhook/index.ts    ← inbound webhook
supabase/functions/wa-receipt/index.ts    ← Claude Vision auto-confirm
supabase/functions/wa-reminders/index.ts  ← cron lifecycle
```
