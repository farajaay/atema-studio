# Marketing Enhancement Proposal — 2026-05

A bilingual, data-driven marketing audit and growth proposal for ATEMA STUDIO,
prepared from a Saudi-market specialist's lens.

## Files

| File | What it is |
|---|---|
| [`MARKETING_PROPOSAL.en.md`](./MARKETING_PROPOSAL.en.md) | Full proposal in English. Executive summary → data appendix → site audit → photo report → playbook → backlog mapping → owner checklist. |
| [`MARKETING_PROPOSAL.ar.md`](./MARKETING_PROPOSAL.ar.md) | النسخة العربية الكاملة. Mirror of the English document. |
| [`PHOTO_ADEQUACY.md`](./PHOTO_ADEQUACY.md) | Standalone bilingual photo-adequacy / readability report. Mostly a re-cut of §4 from the main proposal for anyone who only wants the photo verdict. |
| [`screenshots/`](./screenshots/) | Live-site screenshots (mobile + desktop) captured 2026-05-21 against `https://atemastudio.xyz`. Raw photo-audit JSON also lives here. |
| [`screenshots/_capture.mjs`](./screenshots/_capture.mjs) | Reproducible Playwright capture script. Set `AUDIT_BASE` env var to point at a different host (local preview, staging, prod). |
| [`screenshots/_photo-audit.mjs`](./screenshots/_photo-audit.mjs) | Reproducible photo-adequacy audit using `sharp`. Outputs `_photo-audit.json` and `_photo-audit-summary.json`. |

## How to reproduce

```bash
# Build + serve locally OR point at the live site.
npm run build
npm run preview -- --port 4173 --host 127.0.0.1 &

# Screenshots (any URL — defaults to localhost preview).
AUDIT_BASE=https://atemastudio.xyz \
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node docs/marketing-proposal-2026-05/screenshots/_capture.mjs

# Photo audit.
node docs/marketing-proposal-2026-05/screenshots/_photo-audit.mjs
```

## Verification stance

The proposal is built on a strict "no claim without a source" rule. Every
numerical fact in the English doc and the Arabic doc carries a `[Sx]` marker
that resolves to a public URL in the Sources block at the end of §2.

The owner should be able to sanity-check any claim in under 30 seconds:
follow the link, ctrl-F the figure, decide whether to trust it.

## Status

### Shipped in this branch

The following Phase A / B / C items from the main proposal are implemented.
After-fix screenshots live in [`./screenshots/after-fixes/`](./screenshots/after-fixes/)
for before/after comparison.

| # | What shipped | Files touched |
|---|---|---|
| A1 | Open Graph, Twitter Card, JSON-LD (`LocalBusiness` + `PhotographyBusiness` + `Service` + `WebSite`), canonical URL, hreflang `ar-SA` + `en-SA` + `x-default`, `theme-color`. | `index.html` |
| A2 | `public/robots.txt`, `public/sitemap.xml` (6 URLs with hreflang siblings). | `public/robots.txt`, `public/sitemap.xml` |
| A3 | Homepage gap-fill: 6-up portfolio thumb strip (first-paint visible, NOT gated on FadeUp) + 4-item trust band (all-female team · location · ZATCA · payment methods). | `src/pages/HomePage.tsx` |
| A4 | `<noscript>` fallback with editorial wordmark, hero copy, nav links, WhatsApp CTA. | `index.html` |
| A6 | `<ShareToWhatsApp />` component, wired into the bottom of every journal post. | `src/components/ShareToWhatsApp.tsx`, `src/pages/JournalPostPage.tsx` |
| B5 | `BlogPosting` JSON-LD on each journal post (Arabic/English `inLanguage` follows the language toggle). | `src/pages/JournalPostPage.tsx` |
| C4 | Public `/policy` page (Terms + PDPL). Bilingual. Footer link added. Shared copy module so the in-flow booking popups and the public page can't drift. | `src/pages/PolicyPage.tsx`, `src/App.tsx`, `src/components/SiteFooter.tsx`, `src/content/legal.ts`, `src/pages/BookingPage.tsx` |

### Deliberately not shipped (owner / config required)

| # | Why parked |
|---|---|
| A5 (Voices testimonials) | Needs 3 real bride quotes from Fatima's WhatsApp + explicit consent. Component scaffold not added — easier to drop in once copy exists. |
| C1, C5 (Apple Pay / Mada buttons) | Needs Moyasar dashboard config + a SAR 1 test charge from real iOS Safari. Toggle is in the Moyasar SDK; flipping it without testing is the riskiest line in the booking flow. |
| C2 (anchor bundle) | Needs Fatima's call on which addon set to flag as "the bride's favourite". |
| C3 (24-hour reply pledge) | Needs Fatima's commitment to that SLA before the copy goes up. |
| D phases (paid acceleration) | Budget decision. |
| E1 (founder portrait) | Owner-consent gated. |
| E2 (Eastern-Province-rooted frames) | Requires a new shoot. |

### Status re-check — 2026-07-04 (pre-launch)

Live-verified and reconciled with the July launch decisions:

| # | May status | July reality |
|---|---|---|
| A1/A2/A4/A6, B5, C4 | shipped | **still live** — robots/sitemap 200 (sitemap now also lists `/films`), OG + JSON-LD present, share buttons working. |
| A5 (Voices) | parked pending real quotes | ⚠ **A placeholder carousel shipped anyway** (`Testimonials.tsx`, live on the booking page) with *fictional named quotes* marked `TODO[CONTENT]`. **Replace with 3 real consented quotes or hide before launch** — invented testimonials on a commercial surface is a trust/compliance hazard. |
| C1/C5 (Apple Pay / Mada) | parked on Moyasar config | **Superseded** — cards deferred entirely (transfer-only launch). The admin settings flags + `allowedMethods` plumbing already exist; when cards activate, these become config flips, not code. |
| C2 (anchor bundle) | owner call | still open — one hour of code once Fatima names the bundle. |
| C3 (24h reply pledge) | owner commitment | still open — copy only. |
| D1–D3 (paid) | budget-gated | still budget-gated. Note: **D1 (Click-to-WhatsApp ads) is NOT blocked by the missing Meta send-approval** — inbound wa.me chats land on the studio phone regardless. |
| E1 (founder portrait) | consent-gated | ✅ **done since** — portrait + origin story live on `/about`. |
| E2 (Eastern-Province frames) | needs a shoot | still open; the July pool/films are couture-editorial, not region-rooted. |
| E3 (/seasons page) | — | still parked. |

New assets since May that the proposal predates: the public **/films** page
(ready-made Reels source), the album-cover ritual with photographic mockups
(post-delivery content), and dual-channel notifications. The companion
execution piece is the owner's Arabic workbook
(*دليل صياغة استراتيجية التسويق*, PDF, 2026-07-04) — this proposal is the
market evidence; the workbook is the drafting sheet.

### How to verify the shipped items

1. **Share preview:** paste `https://atemastudio.xyz/` into a fresh WhatsApp chat after the deploy reaches gh-pages. The preview should render with the Promotion artwork + title + description.
2. **Schema:** drop the same URL into <https://validator.schema.org/>. Expect `LocalBusiness`, `Service`, and `WebSite` nodes to validate.
3. **robots / sitemap:** `curl https://atemastudio.xyz/robots.txt` and `…/sitemap.xml` should both return 200.
4. **Homepage gap-fill:** open the home in airplane mode → reconnect. The portfolio thumb row and trust strip should appear at first paint, no IntersectionObserver delay.
5. **/policy:** navigate to `https://atemastudio.xyz/#/policy`. Both Terms and PDPL sections render. Footer link present on every page.
6. **Journal share:** open any journal post. The WhatsApp share button at the end pre-fills `<post title>\n<post URL>` when tapped.
