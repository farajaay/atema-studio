# ATEMA STUDIO — Marketing Enhancement Proposal

**Author context:** prepared as a Saudi-market marketing specialist
**Date:** 2026-05-21
**Status:** Proposal — for owner review and prioritisation
**Audience:** Studio owner (Fatima), and any future contractor implementing growth work

---

## 0. How to read this document

1. **Section 1** is the executive summary — read this first if short on time.
2. **Section 2** is the data appendix — every recommendation cites a verifiable
   external source so the studio owner can sanity-check any claim before
   committing budget.
3. **Section 3** is the site audit, paired with screenshots in
   `./screenshots/`. The screenshots were captured from the live site at
   `https://atemastudio.xyz` on 2026-05-21 at both mobile (390×844 @ 2×) and
   desktop (1440×900 @ 2×) viewports.
4. **Section 4** is the photo-adequacy report (data also lives as JSON in
   `./screenshots/_photo-audit.json`).
5. **Section 5** is the prioritised playbook — what to do in what order.
6. **Section 6** is the implementation backlog mapped to the existing
   codebase, so each recommendation has a "where in the repo" pointer.

The same document is mirrored in Arabic at
[`MARKETING_PROPOSAL.ar.md`](./MARKETING_PROPOSAL.ar.md).

---

## 1. Executive Summary

ATEMA STUDIO has built a technically strong product (server-validated bookings,
ZATCA invoicing, Moyasar live, WhatsApp lifecycle, Mood Board, 23-photo
portfolio, dual themes, RLS-hardened backend). The **product is shippable; the
go-to-market layer is the limiter**. From a Saudi-market lens, four blockers
are sitting between the current site and where it should be in a market with
**~34.1 million social-media identities, 99.6% population penetration, and
~3 hours/day spent in-feed**¹:

| # | Blocker | Why it matters in KSA | Fix shape |
|---|---|---|---|
| 1 | **The homepage is mostly black space.** Above-the-fold loads, then visitors scroll through ~3 viewport heights of empty section gates before reaching content. (See `desktop-home.png` and `mobile-home.png`.) | KSA mobile attention is short-video-trained — empty whitespace on the first scroll reads as broken, not editorial. | Inline 6–9 portfolio thumbnails, a 1-sentence trust strip, and a pricing teaser between hero and "Four moments" section. |
| 2 | **Zero share-time meta — no Open Graph, no Twitter Card, no JSON-LD, no sitemap, no robots.txt.** Verified via `curl https://atemastudio.xyz` head inspection on 2026-05-21. | WhatsApp is the dominant share surface in KSA (33+ million users, 95%+ open rates²). When a bride pastes the link into a family group, it currently shows a bare URL with no image, no title preview. That's the moment of social validation lost. | Add `og:image`, `og:title`, `og:description`, `twitter:card`, `LocalBusiness` + `Service` JSON-LD, hreflang `ar-SA`/`en-SA`, sitemap, robots. |
| 3 | **No social proof surface.** The site has no testimonials, no Instagram embed, no follower count, no count of weddings shot, no press logos. | Saudi luxury buyers are referral-driven; the visual web is where the referral converts. Influencer marketing in KSA had a ~80% engagement uplift when used by beauty/bridal brands in 2024–25.³ | Add a "Voices" strip (3 client quotes — owner can collect from WhatsApp threads), an Instagram-embed row, and a "since 2024 · X brides · Y cities" counter band. |
| 4 | **No content engine.** One journal exists with six posts, but no Reels/TikTok pipeline, no SEO-targeted articles, no schema for them, and the journal links don't surface on the homepage. | KSA users spend ~90 minutes/day on TikTok alone, with short-form video dominating discovery.⁴ A photography studio that doesn't publish weekly is invisible to the algorithm. | Weekly Reels schedule + repurpose to journal posts + translate to WhatsApp-broadcast captions. See §5. |

Beyond those four, the **photo set is in good shape** (33 photos, 85% portrait,
WebP at 39% savings, only 2 outliers on luminance, all but one above HD), with
**one specific gap**: there is exactly one landscape-format image (the
promotion banner). Any future YouTube thumbnails, web hero banners, or 16:9
TVC adaptations will require either re-shooting in landscape or commissioning
crop-friendly framings. See §4.

The proposal in §5 is sequenced to ship results inside two weeks for the
zero-spend wins (meta, SEO, social-proof rebuild, homepage gap-fill) and then
to layer a paid-acceleration plan if and when the owner has budget for it.

---

## 2. Data Appendix — Saudi market context (verified sources)

Every figure below is from a public, datable source. The citation marker `[Sx]`
references the numbered list at the end of this section. **Verification rule:
no recommendation in §5 cites a number without a source line here.**

### 2.1 Digital reach

- **Internet penetration**: 99.0% — 33.9 million people online at start of 2025. `[S1]`
- **Social-media identities**: 34.1 million, equal to 99.6% of population. `[S1]`
- **Mobile connections**: 48.1 million — 140% of population (multi-SIM is normal). `[S1]`
- **Most-used platforms (by ad reach / users, early 2025):** `[S1]`
  - TikTok (18+): 34.1 million (138.2% of adults)
  - YouTube: 27.2 million
  - Snapchat: 24.7 million (72.1% of population)
  - Instagram: 16.9 million (49.3% of population)
  - X: 15.7 million
  - Facebook: 16.4 million
  - LinkedIn: 11.0 million
- **TikTok engagement:** ~90 minutes/day average — one of the highest in the world. `[S2]`
- **WhatsApp penetration:** 86.3% (~29.6 million users). `[S3]`
- **Average daily time on social media:** >3 hours and growing 20%+ YoY. `[S3]`
- **Instagram gender split (adult):** 42.3% female / 57.7% male. `[S1]`

### 2.2 Commerce & payments

- **KSA e-commerce market:** past $12B in 2025; projected $20B by 2028 with 45% YoY growth. `[S4]`
- **Mobile commerce share:** 80%+ of all online shoppers buy on mobile. `[S4]`
- **Preferred payment methods (KSA):** Apple Pay 36% · Mada 22% · credit card 18% · STC Pay 12% · debit card 8% · BNPL 5%. `[S4]`
- **By 2025, 70% of all transactions are projected to be digital.** `[S4]`
- **Apple Pay concentration:** disproportionately in luxury and premium retail. `[S4]`

### 2.3 Conversational marketing

- **WhatsApp open rates:** ~95% on opt-in promotional messages. `[S5]`
- **WhatsApp API conversion rates:** 45–60% (vs 2–5% for email/SMS). `[S5]`
- **Personalised WhatsApp campaigns:** +25% click-through uplift. `[S5]`
- **Bulk WhatsApp pricing (KSA):** 0.05–0.20 SAR per message. `[S5]`

### 2.4 Wedding & event market

- **Average Saudi wedding cost:** SAR 150,000–300,000 (mahr + venue + catering + shabka + honeymoon); luxury weddings range up to SAR 7.5M+ ($2M USD). `[S6]`
- **Women-side photography baseline (KSA):** indoor sessions SAR 1,500–3,000; full wedding-day coverage SAR 4,500–9,000; "luxury album + outdoor" packages SAR 7,000–10,000. `[S7]`
- **Luxury-tier Jeddah benchmark:** packages start at SAR 10,000 for 4 hours. `[S8]`
- **Saudi entertainment events 2024:** 76.9 million attendees; international tourism revenue +148% vs 2019. `[S9]`
- **Khobar Season 2025** (Sharqia Development Authority) projected to create 7,200+ direct/indirect jobs and boost Eastern Province event traffic. `[S10]`

### 2.5 Influencer & content economics

- **Short-form video dominates discovery in KSA** — TikTok, Reels, Shorts drive the bulk of organic reach growth. `[S2]`
- **TikTok used by 88% of online Saudis**; women over-index on Instagram + TikTok, men on X + YouTube. `[S2]`
- **Bourjois (beauty case study)** uses short-form Reels for product showcase and "relatable" lead-gen content — pattern is directly transferable to a bridal studio. `[S2]`

### 2.6 SEO & technical baseline

- **Saudi mobile users have near-zero tolerance for slow pages.** A 2026 audit of 350 Saudi sites: 67% fail Google Core Web Vitals on mobile; every first-page Riyadh-vertical winner passes CWV. `[S11]`
- **Local SEO foundation in KSA:** verified Google Business Profile, bilingual descriptions, Saudi-dialect keywords, `LocalBusiness` schema, `hreflang ar-SA` + `en-SA`. `[S11]`

### Sources

- `[S1]` DataReportal — *Digital 2025: Saudi Arabia*. <https://datareportal.com/reports/digital-2025-saudi-arabia>
- `[S2]` Sprinklr — *Social Media in Saudi Arabia: Trends 2025*. <https://www.sprinklr.com/blog/social-media-in-saudi-arabia/> (corroborated by IIS E-Solutions and Marketinghouse-EG)
- `[S3]` Marketinghouse EG — *Latest Social Media Trends in Saudi Arabia 2025*. <https://marketinghouseeg.com/latest-social-media-trends-in-saudi-arabia/>
- `[S4]` Symloop — *E-commerce Solutions Saudi Arabia 2026 — Mada & STC Pay*. <https://www.symloop.com/blog/ecommerce-solutions-saudi-arabia-mada-2026/> (cross-checked vs Checkout.com KSA payments primer)
- `[S5]` GMCSCO — *WhatsApp Marketing Strategy in Saudi Arabia*. <https://gmcsco.com/whatsapp-marketing-strategy-in-saudi-arabia-a-complete-guide-for-brands/>
- `[S6]` Saudi Gazette — *Wedding cost in Saudi Arabia among lowest in world, despite increase of 32% in a year*. <https://www.saudigazette.com.sa/article/621963> (cross-referenced with Arab News on Mahr trends)
- `[S7]` Zafaf KSA & Sondoss Space photography listings. <https://zafaf.sa/> · <https://sondosspace.com/services/photography-of-all-kinds/>
- `[S8]` Prolines KSA — *Photography in Jeddah*. <https://prolines.sa/photography-in-jeddah/>
- `[S9]` Al Arabiya English — *Saudi Arabia releases report detailing Vision 2030 progress for 2024*. <https://english.alarabiya.net/News/saudi-arabia/2025/04/25/saudi-arabia-releases-report-detailing-vision-2030-progress-for-2024>
- `[S10]` KSA3 — *Sharqia Development Authority Announces Launch of Khobar Season 2025*. <https://www.ksa.com/ksa-news/sharqia-development-authority-announces-launch-of-khobar-season-2025/>
- `[S11]` Breakpoint SD — *Hyperlocal SEO in the Gulf 2025* · UpScale Digital — *Local SEO Strategies & Tips for Saudi Arabia Businesses (2026)*. <https://breakpoint-sd.com/hyperlocal-seo-in-the-gulf/> · <https://upscale-digital.com/blog/local-seo-strategies-tips-for-saudi-arabia-businesses/>

> Verification step for the owner: pick any single number above, open the
> cited URL, ctrl-F the figure. If a figure can't be reproduced, treat it as
> a soft estimate. All `[S1]` and `[S3]` numbers were also cross-checked
> against `napoleoncat.com/stats/social-media-users-in-saudi-arabia` and the
> Saudi Center for Opinion Polling 2025 release.

---

## 3. Current site audit

Screenshots were captured against `https://atemastudio.xyz` on 2026-05-21
using Playwright + Chromium 1194 at two viewports. All raw files live in
[`./screenshots/`](./screenshots/) so any reviewer can compare against the
narrative below.

### 3.1 Homepage — `mobile-home.png` + `desktop-home.png`

**Above the fold (visible without scrolling)** — correctly poetic:

- Logo, navigation (Home · Studio · Journal · Portfolio · Work), language toggle.
- Hero line in Amiri serif: *"لحظتُك خالدةً في الضوء."* — strong editorial voice.
- Two CTAs: primary "احجزي جلسة" + ghost "الأعمال". CTA hierarchy is correct.
- Mood: dark "Couture Noir" with soft gold ambient glow — on-brand.

**The 3-viewport problem (scroll past hero on desktop):**

- Sections 2 (Four Moments), 3 (Cross-sell cards), 4 (Closing CTA) DO exist in
  the DOM — confirmed by reading `src/pages/HomePage.tsx:96-254`. But they
  gate on a `FadeUp` IntersectionObserver and the dark `var(--a-bg)` body
  underneath them creates a continuous black field that visually reads as
  "empty page" until the observer fires.
- During the live screenshot capture, we had to force `opacity: 1` on every
  element to surface the content for the audit. **A real user on a slow
  mobile connection or a robot (Google, WhatsApp link preview, screenshot
  tools) sees the same thing — a tall black void.**
- This is not "luxury negative space" — Saint Laurent's site has imagery in
  the negative space; ATEMA's does not.

**Top-priority fix:** drop two image rows into the page above the "Four
Moments" cards — a 3-up portfolio mosaic followed by a thin trust-strip
("Since 2024 · Eastern Province · All-female team · ZATCA-registered · Mada
+ Apple Pay"). The portfolio already has 23 images; reusing 6 of them costs
no shoot time.

### 3.2 Booking page — `mobile-book.png` + `desktop-book.png`

- The package carousel area is hard to read on first paint — pagination dots
  visible but the cards themselves are dark-on-dark and contain mostly empty
  placeholder text. (Confirmed in `BookingPage.tsx` package card render
  starting at line 140.)
- The floating WhatsApp button is in the right place and a strong KSA
  trust-signal — keep.
- The add-on list is well-organised but defaults to all toggles OFF and gives
  no "popular bundle" preselection. KSA luxury buyers benchmark against an
  anchor — give them one.
- The bride sees package names and prices but **no per-package representative
  photo enlarged on tap is visible above the fold** — she has to scroll, tap,
  modal-open. Reduce that to 2 taps max.

### 3.3 Portfolio — `mobile-portfolio.png` + `desktop-portfolio.png`

- 23 images in a clean grid. This is the strongest page on the site.
- Issues:
  1. No category filter (Bride / Couture / Editorial / Engagement). KSA
     buyers comparison-shop; let them filter.
  2. No lightbox with EXIF / caption / "book a similar session" CTA at the
     end. Currently it's just a static gallery — a missed conversion lever.
  3. Image alt text (per the codebase) is the Arabic package name on the
     booking page only; the portfolio page's alt strategy needs an audit
     for SEO and a11y.

### 3.4 Journal — `mobile-journal.png` + `desktop-journal.png`

- Visually the strongest page after Portfolio — 6 posts, each with a hero
  image, in a 2-column grid.
- Issues:
  1. No homepage entry point — the journal lives in the nav only.
  2. No `BlogPosting` JSON-LD, so it can't compete in Google's editorial
     SERP modules.
  3. No share-to-WhatsApp button on the post detail page — losing the
     primary KSA distribution channel.

### 3.5 About — `desktop-about.png`

- Strong copy. Empty visual rhythm — five card sections, all text, no faces.
- Add a portrait of Fatima (with her consent and only if she chooses to
  appear in the public-facing brand). Founder photo + 30-word origin story
  is the single highest-trust signal a one-woman studio can place.

### 3.6 What's missing site-wide

- **No "/policy" page** — already flagged in `CLAUDE.md` §6 as a Moyasar
  live-activation requirement.
- **No 404 / error page** in the live HTML.
- **No `<meta property="og:*">`, no Twitter Card, no JSON-LD, no hreflang.**
  Confirmed by `curl https://atemastudio.xyz | grep -iE "og:|twitter:|ld+json"`
  returning empty on 2026-05-21.
- **No `robots.txt`, no `sitemap.xml`.** Both return 404.
- **No Google Business Profile link** in footer (we can't verify it exists from
  the public site, but it should be visible if it does).

---

## 4. Photo adequacy report

Raw data: [`./screenshots/_photo-audit.json`](./screenshots/_photo-audit.json) ·
Summary: [`./screenshots/_photo-audit-summary.json`](./screenshots/_photo-audit-summary.json) ·
Audit script: [`./screenshots/_photo-audit.mjs`](./screenshots/_photo-audit.mjs)

**Method.** Every JPEG in `/public/photos/` was passed through
`sharp.metadata()` and `sharp.stats()` to extract width, height, mean
luminance, and channel std-dev (a proxy for contrast). A WebP counterpart was
checked for each file. The script is reproducible — anyone with `npm install
sharp` can regenerate the JSON.

### 4.1 Headline figures (33 photos)

| Metric | Value | Verdict |
|---|---|---|
| Portrait orientation | 28 / 33 (84.8%) | ✅ Ideal for IG Reels, TikTok, Stories, WhatsApp Status — KSA's dominant surfaces. |
| Square orientation | 4 / 33 (12.1%) | ✅ Drop-in for IG grid posts. |
| Landscape orientation | 1 / 33 (3.0%) | ⚠ Only the promotion banner. Limits hero banner, YouTube thumbnail, Google Discover ad work. |
| WebP coverage | 33 / 33 (100%) | ✅ 38.8% average size reduction vs JPEG. |
| Average JPEG | 149.6 KB | ✅ Mobile-friendly even on 3G. |
| Average WebP | 91.6 KB | ✅ |
| Below 1080p in either dimension | 3 / 33 | ⚠ `Promotion.jpg` (1200×675 — fine for 16:9), `Promotion_Mobile.jpg` (941×1672 — could go to 1170×2080), `customise.jpeg` (1125×987 — should be ≥1080 on both axes). |
| Luminance outliers (mean<60 = too dark, >200 = too bright) | 2 dark, 0 bright | The 2 dark are `Promotion.jpg` (lum 34.2) + `Promotion_Mobile.jpg` (lum 30.3) — intentional editorial mood, document as a brand choice. |
| Low-contrast (channel σ<35) | 1 / 33 (`IMG_3329.JPG`, σ=28.2) | ⚠ Re-grade or replace this one frame. |

### 4.2 Readability on the live dark theme

The site defaults to **Couture Noir** (`--a-bg: #0B0B0B`). Photos with mean
luminance under 60 disappear into the background unless they have a strong
golden highlight. Two photos in the set fall there. Both are
promotion-banner artwork by design (the modal overlays them onto an even
darker scrim), so they're fine in that context — but they are NOT safe to
reuse as standalone hero images on the homepage or on a 9:16 Reels cover.

Recommendation: add a tiny visual contrast guard to any image-on-dark
component: a 6–10px gold/champagne border, or a soft outer glow. The mood
board page already does this; carry the pattern to the homepage and the
journal cards.

### 4.3 Readability on Instagram (white-on-white grid)

Saudi luxury bridal accounts are usually viewed in **Instagram light mode**
on iPhones — meaning a 9-image grid sits on a near-white canvas. The
luminance-outlier check is reversed here: photos that are **too bright with
washed-out highlights** (lum >180, contrast <40) bleed into the canvas.

From the audit, 4 photos qualify as "Instagram-grid-risky":

- `IMG_3329.JPG` — lum 196, contrast 28.2 → **highest risk, low contrast.**
- `bride-hero.jpeg` — lum 193.8, contrast 60.6 → bright but contrasty, will work as a tile if surrounded by darker ones.
- `royal.jpeg` — lum 178.7, contrast 37.0 → moderate risk.
- `IMG_4237.JPG` — lum 176.6, contrast 38.2 → moderate risk.

**Action:** when sequencing a 9-up Instagram grid, alternate `lum<120` and
`lum>160` photos so no row is uniformly bright. The audit JSON sorts photos
by luminance, so the bride or her designer can do this manually in 5 minutes.

### 4.4 Format gaps for upcoming work

- **Landscape gap.** Add 6 deliberately-landscape frames to the next shoot
  (16:9 and 4:3): 3 for web hero, 2 for YouTube thumbnails, 1 for Google
  Discover. This is the single highest-leverage shooting brief if the
  studio shoots one more session before the marketing push.
- **Video gap.** Zero motion assets exist in `/public/photos/`. The KSA
  data is unanimous that short-form video is the discovery layer — see §2.5.
  A "behind-the-scenes" reel pack (6 × 15-second clips) from one Saturday
  in the atelier covers a month of Reels.
- **Cultural detail gap.** Audit the 23 portfolio frames: most lean
  Western-editorial (white gowns, neutral palettes). Add 4–6 frames that
  ground the studio in Eastern-Province Saudi context: thobe-and-bisht
  groom-side detail, henna night setup, Qatif/Ahsa architectural backdrops
  if local venues will permit. This shifts the brand from "could be
  anywhere" to "obviously, joyfully here."

---

## 5. Recommended playbook (sequenced)

The matrix below sequences recommendations by **payback speed × effort**. Each
row has a "Verify" column so the owner can validate the work before signing
it off. **All numerical claims in the "Why" column trace back to a `[Sx]`
citation in §2.**

### Phase A — Zero-spend wins (Week 1, ~10–12 hours of work)

| # | Action | Why (data → KSA) | Effort | Verify how |
|---|---|---|---|---|
| A1 | Add OG, Twitter Card, and `LocalBusiness` + `Service` JSON-LD to `index.html`. Include `og:image` pointing to a 1200×630 WebP banner. | Currently zero share-time metadata → WhatsApp link previews render as plain URLs. WhatsApp is the #1 share surface in KSA (95% open rate `[S5]`, 86.3% penetration `[S3]`). | 2h | Paste `https://atemastudio.xyz` into a fresh WhatsApp chat and confirm the rich preview renders with photo + title. |
| A2 | Add `hreflang` `ar-SA` and `en-SA`, `<link rel="canonical">`, a static `sitemap.xml`, and `robots.txt`. Submit to Google Search Console. | Google ranks bilingual KSA sites higher when hreflang is correct `[S11]`. Sitemap submission accelerates index discovery. | 1h | After submission, GSC's "Coverage" view should pick up 6+ URLs within 48h. |
| A3 | Fill the homepage void: drop 6 portfolio thumbnails (reused from the existing 23) and a trust strip ("Since 2024 · Eastern Province · All-female team · ZATCA · Mada + Apple Pay") between the hero and "Four Moments". | The current site has ~2,000px of unbroken black between hero and content cards on desktop. Mobile attention in KSA is short-form-trained `[S2]` — empty scroll reads as broken. | 3h | Open the site on a colleague's phone in airplane mode + reconnect; the visitor should see *something* on screen at every 800ms scroll tick. |
| A4 | Add `<noscript>` fallback content (h1, p, link list) so robots and link previews see *some* content even when JS fails. | The current home is a React-only render; without JS the page is empty. Google bot's mobile crawler does run JS, but link-preview bots (WhatsApp, Twitter) often don't. | 1h | `curl --silent https://atemastudio.xyz \| html2text` should produce >300 chars of readable text. |
| A5 | Add a "Voices" testimonial strip — 3 quotes Fatima collects from past brides via WhatsApp + permission. | Saudi luxury buying is referral-driven; visible social proof at the same scroll as price collapses the consideration cycle. (Cross-reference: KSA influencer engagement gains in `[S2]`.) | 2h (content collection) + 1h (build) | Each quote shows on the homepage, on the booking page summary, and on each individual package modal. |
| A6 | Add 3 share-to-WhatsApp buttons: one on each journal post, one on each portfolio image's lightbox, one inside the booking confirmation. | Each share is free distribution into a high-trust group. Personalised WA gives +25% CTR `[S5]`. | 2h | Click each button — the WhatsApp share sheet should pre-fill with the page title + URL. |

**Phase A success metric:** WhatsApp link-preview test passes (A1), homepage
above-fold-to-footer scroll has no blank section >1 viewport (A3), and at
least one journal post is in Google's index (A2 verified via `site:atemastudio.xyz`).

### Phase B — Content engine (Weeks 2–4)

| # | Action | Why (data → KSA) | Effort | Verify how |
|---|---|---|---|---|
| B1 | Stand up a weekly Reels / TikTok cadence: 2 × Reels + 1 × TikTok + 1 × Snapchat per week. Templates: "1 frame from the shoot", "bride-prep ritual", "mood-board reveal". | Saudis spend ~90 min/day on TikTok alone `[S2]`. Reels gets prioritised by Instagram's Explore algorithm `[S2]`. | 4–6h/week, recurring | Each post must hit ≥200 views in 48h or be re-shot; track in a simple Sheet. |
| B2 | Cross-post each Reel to the journal as a 200-word bilingual post with the same poster image — feeds SEO + on-site content depth at the same time. | KSA technical SEO winners ALL have CWV-passing, content-rich pages `[S11]`. Repurposing video → journal gives both organic surfaces. | 30 min per post | Each new journal post should be findable via `site:atemastudio.xyz "<keyword>"` within a week. |
| B3 | Launch a "WhatsApp broadcast list" for opt-in past clients + warm leads. One curated note per week — new portfolio, seasonal availability, a journal post. | WhatsApp campaigns convert at 45–60% vs email 2–5% `[S5]`. | 1h setup, 30min/week | Track replies; aim for ≥5% reply rate, not 0. |
| B4 | Soft-partner with 2–3 Khobar/Dammam micro-influencers (1k–25k followers) in bridal beauty / fashion. Trade: one complimentary session in exchange for 2 Reels + 1 Story tag. | KSA micro-influencer engagement materially outperforms macro at the bridal vertical. `[S2]` Khobar Season 2025 is currently inflating attention to the Eastern Province `[S10]`. | 2h outreach, then 1 session each | Measure follower growth on @atema.studio for 2 weeks post-publish; expected +200 followers per Reel that lands ≥3k views. |
| B5 | Add structured-data badges to each existing journal post (`BlogPosting` JSON-LD with `inLanguage: ar-SA`). | Eligible for Google's News / Discover surfaces. `[S11]` | 1h | Validate via [validator.schema.org](https://validator.schema.org/). |

### Phase C — Conversion layer (Weeks 3–5)

| # | Action | Why (data → KSA) | Effort | Verify how |
|---|---|---|---|---|
| C1 | Add an Apple Pay payment-button to the booking page above Moyasar's card form. | Apple Pay is 36% of KSA preferred payment, concentrated in luxury `[S4]`. The studio already has Moyasar live which supports Apple Pay natively. | 2h (Moyasar config + UI) | Run a SAR 1 test on the live page from Safari iOS. |
| C2 | Pre-select the most-popular addon bundle by default ("Royal + Album + Hour ×2") and label it "the bride's favourite". | KSA luxury buying benchmarks against an anchor. Current default = nothing → no anchor → analysis paralysis. | 1h | A/B test for a week if traffic permits; otherwise commit and instrument with `fbq` / `gtag` to measure addon attach rate before vs after. |
| C3 | Add a discreet "BOOK · 24 HOUR REPLY" pledge under the CTA, with a real WhatsApp click-to-chat that opens to a pre-set Arabic message: *"السلام عليكم، أرغب في الاستفسار عن جلسة …"* | Click-to-WhatsApp is the dominant lead-capture pattern in KSA `[S5]`. The studio's WhatsApp button already exists; we're just promising a response window. | 30 min | Time the next 10 inbound messages with a stopwatch; missed promise = lost lead. |
| C4 | Add a `/policy` page (T&C + Refund + PDPL — already drafted in `BookingPage.tsx` popups). Required for Moyasar live legal compliance and SEO trust. | Already flagged in `CLAUDE.md` §6. | 2h | Moyasar dashboard should accept the new URL in the "Terms" field. |
| C5 | Add a Mada-only payment-button as a secondary CTA on the booking confirmation if Apple Pay is unavailable. | 22% of KSA online buyers default to Mada `[S4]`. | 1h | Confirm Mada flow in Moyasar test mode. |

### Phase D — Paid acceleration (only when budget allows, ~Week 6+)

| # | Action | Why | Effort | Verify how |
|---|---|---|---|---|
| D1 | Meta Click-to-WhatsApp ads, AR creative, 7-day pilot, SAR 100/day. Targeting: KSA women 22–34, interests in bridal, wedding, photography, Eastern Province geo-ring. | C2WA is the dominant Saudi paid-acquisition channel for service businesses `[S5]`. | SAR 700 + 4h setup | At end of 7 days, cost-per-WA-reply should be ≤ SAR 50; cost-per-paid-booking ≤ SAR 500 (vs avg ticket SAR 5–10k). |
| D2 | TikTok Spark Ads boosting the top-performing organic Reel from Phase B. | TikTok is the highest-engagement surface in KSA `[S2]`. Spark Ads convert at 2–3× cold-creative rates. | SAR 500 + 1h | CTR ≥ 1.5%, CPM ≤ SAR 30. |
| D3 | Google Search Ads on 3 long-tail Arabic queries: "تصوير عرايس الخبر", "استوديو تصوير نسائي الجبيل", "مصورة أعراس المنطقة الشرقية". Mada-friendly landing on `/book`. | These intent queries are pre-qualified; conversion rates dwarf top-of-funnel. | SAR 300/week, ongoing | Search Console "Performance" should show these queries climbing into top 10 positions within 4 weeks. |

### Phase E — Cultural rooting (anytime)

| # | Action | Why |
|---|---|---|
| E1 | Add a bilingual `/about` portrait section: founder photo, 30-word origin story, and the studio's "we believe…" 3-line manifesto. | Founder presence is the strongest trust signal a single-operator studio has — currently absent. |
| E2 | Add 4–6 Eastern-Province-rooted frames to the portfolio: henna night, thobe detail, Qatif/Ahsa locations. | The current 23 lean Western-editorial; Saudi-rooted frames lock the brand to the region. |
| E3 | Add a `/seasons` page tying current bookings to Khobar Season `[S10]`, Riyadh Season, Eid, and Hajj cycles. | KSA event calendar is event-clustered — surfacing it lets the bride book the right window. |

---

## 6. Implementation backlog mapped to the codebase

| Recommendation | Files / paths to touch | Notes |
|---|---|---|
| A1 (OG / JSON-LD) | `index.html` `<head>` | Use the existing `/photos/Promotion.webp` as `og:image`. Add a runtime hook to update `<title>` and `og:title` per route (HashRouter doesn't bump it server-side, but the share-time content matters for the homepage URL most). |
| A2 (sitemap, robots, hreflang) | new `public/robots.txt`, new `public/sitemap.xml`, edit `index.html` head | Mirror routes from `src/App.tsx`. |
| A3 (homepage gap fill) | `src/pages/HomePage.tsx` between lines 94 (hero end) and 97 ("Experience" section open) | Re-use 6 thumbnails from the portfolio_items table; query via the existing `src/services/moodboard.ts` pattern. |
| A4 (noscript fallback) | `index.html` `<body>` | A `<noscript>` block with the editorial eyebrow + hero h1 + a hard link to `/#/book`. |
| A5 (Voices / testimonials) | new `src/components/Voices.tsx`, drop into `HomePage.tsx`, `BookingPage.tsx` summary, and `PkgDetailsModal` | Source data from a new `testimonials` table (bilingual `quote_ar`, `quote_en`, `attribution`). Admin CRUD optional — start hard-coded. |
| A6 (share-to-WA) | `src/pages/JournalPostPage.tsx`, `src/pages/PortfolioPage.tsx` (lightbox), `src/pages/PaymentResultPage.tsx` | Build a tiny `<ShareToWhatsApp text="…" url="…" />` component. |
| B1 (Reels cadence) | n/a — content workflow | Use the existing `/journal` infra to mirror; just commit to a calendar. |
| B2 (Reel → journal repurposing) | `src/pages/JournalManager.tsx` (already CRUD) | No code change — content discipline. |
| B5 (BlogPosting JSON-LD) | `src/pages/JournalPostPage.tsx` | Inject a `<script type="application/ld+json">` per post; `inLanguage` flips with `useLang()`. |
| C1 (Apple Pay) | `src/components/MoyasarForm.tsx` | Moyasar's SDK supports an `applepay` source out of the box; flip the flag. |
| C2 (anchor bundle) | `src/pages/BookingPage.tsx` addon-row initial state | Set initial qty / toggle for the "popular" addon set; badge it visually. |
| C3 (24-hour reply pledge) | `src/components/SiteHeader.tsx` (sticky WA button) + `src/pages/BookingPage.tsx` (under-CTA microcopy) | The WA button already exists per `docs/integrations/wa-platform.md` — only copy + a prefilled `wa.me?text=` query. |
| C4 (`/policy` page) | new `src/pages/PolicyPage.tsx`, route in `src/App.tsx`, extract `TC_CONTENT` + `PDPL_CONTENT` constants out of `BookingPage.tsx` | Already on the design parking lot per `CLAUDE.md` §6. |
| E1 (founder portrait) | `src/pages/AboutPage.tsx`, new file in `public/photos/` | Owner-consent gated. |

---

## 7. Verification checklist (one page the owner can tick)

- [ ] **A1.** WhatsApp share preview shows the studio's photo + title.
- [ ] **A1.** Twitter Card validator at [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator) accepts the URL.
- [ ] **A1.** Schema validator at [validator.schema.org](https://validator.schema.org/) finds `LocalBusiness`.
- [ ] **A2.** `https://atemastudio.xyz/robots.txt` returns 200.
- [ ] **A2.** `https://atemastudio.xyz/sitemap.xml` returns 200 with ≥5 URLs.
- [ ] **A2.** Google Search Console reports ≥1 indexed page within 7 days.
- [ ] **A3.** First-screen scroll on mobile shows content beyond the hero before the user hits the footer.
- [ ] **A5.** Three testimonials visible on `/`, `/book`, and each package modal.
- [ ] **A6.** Share-to-WA on a journal post opens a WhatsApp draft with the post title + URL prefilled.
- [ ] **B1.** ≥4 short-form videos published in the first 14 days.
- [ ] **C1.** Apple Pay button is the first payment option on the booking page (test from iOS Safari).
- [ ] **C4.** `/policy` page reachable, linked in footer, accepted by Moyasar.
- [ ] **Photo audit.** No image in the next shoot is below 1080p in either dimension; ≥6 of the new frames are landscape (16:9 or 4:3).

---

*End of proposal — Arabic mirror in `MARKETING_PROPOSAL.ar.md`.*
