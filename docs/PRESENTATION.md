# ATEMA Studio — Owner's Presentation

> One-slide-per-section walkthrough Fatima can flip through with a client,
> investor, or new team member. Each section maps to a single slide.
> Markdown so it converts cleanly to PowerPoint via Marp / Pandoc, or to
> PDF via the same.

---

## Slide 1 — Cover

**ATEMA STUDIO**
*استوديو تصوير نسائي حصري — الجبيل، المملكة العربية السعودية*

Luxury bilingual photography booking platform
*Capturing moments, elevating memories.*

---

## Slide 2 — What ATEMA is, in one breath

A modern, bilingual booking and operations platform for a luxury women-only
photography studio in the Eastern Province of Saudi Arabia.

- **Self-service booking** for the customer
- **Single-pane admin** for the owner
- **ZATCA-compliant invoicing** out of the box
- **Couture Noir** visual identity end-to-end

---

## Slide 3 — Tech at a glance

| Layer | What we use | Why |
|---|---|---|
| Front-end | React 19 + Vite + TypeScript | Modern, fast, type-safe |
| Hosting | GitHub Pages | Zero-cost, instant deploy |
| Database / Auth / Storage | Supabase (Postgres) | KSA-aligned, RLS-secure |
| Payments | Moyasar (cards) + Al Rajhi (transfer) | Saudi-licensed, low friction |
| Theming | CSS custom properties | Theme switches in milliseconds, no rebuild |

---

## Slide 4 — Customer journey (one breath)

```
Lands on /  →  Sees promo modal  →  Clicks "Design Your Package"
            →  /book  →  Picks a tier or customises
            →  Adds add-ons  →  Fills booking form
            →  Picks Card OR Bank transfer
            →  Receives contract + ZATCA invoice (download or print)
```

Average flow length: **~90 seconds end-to-end** on a fast connection.

---

## Slide 5 — The two themes

**Couture Noir** *(default)*
Deep black silk, champagne gold, cinematic spacing, Cinzel display type.
Inspired by Saint Laurent.

**Atelier Ivory** *(alternative)*
Soft ivory, warm bronze, classic editorial. The original ATEMA look.

Switchable from the admin Settings panel — choice persists across visits.
Theme tokens live in CSS custom properties so switching is **near-instant**
with zero re-paint storm.

---

## Slide 6 — The six packages

| Package | Price | Duration | Highlight |
|---|---|---|---|
| باقة الخطوبة | 1,800 | 2h | Engagement entry point + Save the Date |
| الباقة المخصّصة | 2,200 | 3h | Flexible JPG-only customise |
| الباقة الكلاسيكية | 4,200 | 4h | A4 album + USB |
| الباقة الملكية | 6,900 | 5h | + Cinematic video, mini album, same-day preview |
| باقة التوقيع | 8,500 | 6h | + Premium A3 album, bride-prep session |
| ATEMA Couture | 14,000 | 8h | The full luxury — henna night + wall art |

Plus **11 à-la-carte add-ons** (extra hour, full cinematic, raw files,
second photographer, henna night, etc.).

---

## Slide 7 — Profitability discipline

Every booking gets a real-time P&L view in the admin panel:

```
Revenue (ex-VAT)
  – Direct costs (team, album, storage, travel)
  – Overhead share (depreciation, software)
  – Owner time at target hourly rate (150 SAR/hr)
  ───────────────────────
  = TRUE PROFIT          ← the number that matters
```

The engine flags four warnings: thin margin, no overhead coverage, below
direct cost, **owner hourly rate not met**.

See `docs/PROFITABILITY.md` for the full model and worked numbers.

---

## Slide 8 — Calendar & availability

- **Admin** sees the full monthly calendar with booking pills, blocked dates,
  and a status legend.
- **Customer** sees the same dates as either **selectable** (gold pill on
  click) or **unavailable** (strikethrough, dashed border, generic tooltip).
- Customer **never sees PII** — no client names, no booking refs.
- Admin can **block any date** with a reason (vacation, maintenance, manual
  hold) right from the calendar.

**Privacy posture:** safe. Same pattern as OpenTable, Calendly, Booking.com.

---

## Slide 9 — Payments status

| Channel | Status | Effort to launch |
|---|---|---|
| Bank transfer | ✅ Live today | None |
| Moyasar cards | ⚠️ Wired, awaiting key | 1 hour of admin work |
| WhatsApp auto-confirm | ⛔ Designed, not built | 2–3 days engineering |

See `docs/integrations/payments.md` and `docs/integrations/whatsapp.md`
for full readiness notes and the WhatsApp automation blueprint.

---

## Slide 10 — Compliance & paperwork

- **ZATCA Phase-1** Simplified Tax Invoice with TLV-encoded base64 QR
  embedded in every invoice.
- **VAT toggle** at the system level — turn on/off without code change;
  per-booking VAT is frozen at creation so historical contracts stay accurate.
- **Formal contract** auto-generated in Arabic, full Saudi commercial-law
  language (payment, cancellation, IP, PDPL).
- **PDPL notice** (Saudi data protection) surfaced in the booking flow.

---

## Slide 11 — Editorial surfaces (not just booking)

| Page | Purpose |
|---|---|
| `/` | Cinematic editorial home, hero + 4-step experience storyboard |
| `/portfolio` | Filterable gallery (bride / family / maternity / couture / editorial) |
| `/journal` | Editorial blog ("Notes from the Atelier") |
| `/about` | Atelier story page |
| `/book` | The booking flow |

Each gets the noir aesthetic, FadeUp scroll reveals, and the same shared
header / footer chrome. Admins manage portfolio + journal content via their
own dashboards.

---

## Slide 12 — Performance posture

Original homepage payload: **7.66 MB** of photos.
Optimised payload: **689 KB** WebP / **967 KB** JPEG. **-91%.**

How:
- `scripts/optimise-images.mjs` (one-shot sharp pipeline)
- `<picture>` with WebP source + JPEG fallback
- `loading="lazy"` + `decoding="async"` + explicit `width/height` (no CLS)
- `<link rel="preload" as="image" type="image/webp" media="…">` for the
  promotion modal — preloads in parallel with the JS bundle

First contentful paint ≈ 1.4 s on 4G.

---

## Slide 13 — Operating cost at scale

| Line item | Monthly cost |
|---|---|
| GitHub Pages hosting | $0 |
| Supabase (Free tier covers ATEMA easily) | $0 |
| Moyasar (per-transaction fees) | ~$25–80 (volume-dependent) |
| **Optional** Wati WhatsApp + OpenAI Vision | ~$45 |
| **Total (with full automation)** | **≈ $45–125 / month** |

Scales linearly. At 100 bookings/month total infra cost is still under
$200/month.

---

## Slide 14 — Roadmap, parked

1. **WhatsApp receipt automation** — blueprint ready, see whatsapp.md
2. **Tap Payments** as a secondary gateway (cheaper Mada fees)
3. **`/policy` public page** (T&C + refund + PDPL) — required for Moyasar
   live activation
4. **Studio-wide P&L dashboard** (monthly aggregate rollup)
5. **SMS reminders** 48h before each booked event
6. **Multi-language SEO** (current setup is hash-routed; would need SSR for
   real SEO impact)

---

## Slide 15 — Where to look

- **Code:** <https://github.com/farajaay/atema-studio>
- **Live site:** <https://farajaay.github.io/atema-studio>
- **Manual:** `docs/MANUAL.md` in repo
- **P&L model:** `docs/PROFITABILITY.md`
- **WhatsApp blueprint:** `docs/integrations/whatsapp.md`
- **Payments status:** `docs/integrations/payments.md`

---

## Slide 16 — Close

**ATEMA Studio.**
The booking platform that treats both the bride and the studio with care.

*Designed in detail. Coded with discipline. Documented for the long run.*
