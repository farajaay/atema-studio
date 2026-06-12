# ATEMA STUDIO — Full System Review, Gap Analysis & Improvement Plan

> **Review date:** 2026-06-12
> **Commit reviewed:** `da0fcfe` (tip of `master`)
> **Verification run:** `npm test` — 14 files / **114 tests passing** · `npm run build` — clean (type-check + Vite/Rolldown)
> **Scope:** technical architecture · security posture · commercial/pricing · branding · social & trust dimension

---

## 1. Executive summary

The platform is in **good launch-ready shape**. All CRITICAL and HIGH
security findings from the May audits are patched and verified
non-regressed. The June work (feature flags, top-up payments, hardened
payment verification, manage-link delivery, RLS fixes) closed the last
functional gaps in the self-service loop. The build and full test suite
pass clean.

The three most consequential observations of this review:

1. **Documentation has drifted behind the code** — `PROFITABILITY.md`
   still shows the pre-overhaul loss-making price table, and `CLAUDE.md`
   lists the Studio P&L dashboard and `/policy` page as "not built" when
   both are shipped and wired. Anyone (human or AI) planning from the
   docs will mis-prioritise.
2. **Margins are real but thin (7–12%) on the video tiers**, and the
   single biggest commercial lever remains bringing videography
   in-house (documented but not yet actioned).
3. **The brand's digital footprint is one channel wide** (Instagram
   only) in a market where Snapchat, TikTok and WhatsApp status drive
   wedding-vendor discovery. The product is ahead of the distribution.

---

## 2. Current project status

### 2.1 Repository & CI/CD

| Item | State |
|---|---|
| Branch `master` | clean, tip `da0fcfe` |
| Tests | 114/114 passing (14 suites, 1,098 lines of test code) |
| Build | `tsc -b && vite build` clean |
| Deploy pipeline | `.github/workflows/deploy.yml` — test-gated auto-publish `master → gh-pages` |
| Other workflows | `test.yml`, `supabase-functions.yml` (auto on function changes), `supabase-migrations.yml` (manual), `supabase-secrets.yml` (manual) |
| `npm audit` | clean at last audit (0 findings / 263 deps) |
| Dependencies | current major versions: React 19, Vite 8, TS 6, Supabase JS 2.105, Vitest 4 |

### 2.2 What shipped recently (June 2026)

- Feature flags: VAT, payment methods, WhatsApp gated by admin toggles
  (`migrations-2026-06-feature-flags.sql`) — nothing customer-visible
  until the owner switches it on.
- Top-up payment flow after package upgrades (`topup_amount_due` +
  Moyasar `purpose=topup` + `verify-payment` clearing).
- M-11 closed: payment verification is server-side
  (`verify-payment` Edge Fn + `MOYASAR_SECRET_KEY`); URL params are
  optimistic-UI only.
- Manage-link WhatsApp delivery at booking time.
- Booking fallback bug fix + remaining RLS migrations
  (`migrations-2026-05-bookings-rls-fix.sql`, `migrations-2026-06-rls-remaining.sql`).
- Promo modal artwork, image re-optimisation, mobile overflow fix,
  settings-driven homepage payment strip.

### 2.3 Architecture (as verified, not just as documented)

```
React 19 + Vite + TS  (HashRouter, GH Pages, custom domain atemastudio.xyz)
   ├─ 9 Edge Functions: create-booking · change-booking · verify-payment ·
   │    discount-preview · send-whatsapp · wa-webhook · wa-receipt ·
   │    wa-reminders · (+ _shared pure engines: pricing, reschedule, otp,
   │    change, wa, email, stationery, validation, signature, receipt)
   ├─ Supabase Postgres: 21 migrations + 4 seeds, RLS-on, RPC-mediated
   │    anon access (get_booking_by_token, get_mood_board_by_token,
   │    preview/redeem_discount_code, mark_mood_board_viewed)
   ├─ Payments: Moyasar (card) + Al Rajhi transfer w/ Claude-Vision
   │    receipt OCR; server-side total recompute on every money path
   └─ Comms: Meta WhatsApp Cloud API (lifecycle reminders, cron */30) +
        Zoho SMTP confirmation email; one stationery token map across
        contract / ZATCA invoice / email / policy / legal popups
```

Frontend: ~17,000 lines of TS/TSX. Admin routes lazy-loaded. Two screen
themes (Couture Noir / Atelier Ivory) + one stationery palette.

### 2.4 Security posture (re-checked against `docs/bugs.md`)

- **CRITICAL:** none open. C-1 (XSS/`esc()`), C-2 (validation), C-3
  (server-side totals) hold.
- **HIGH:** all fixed — H-6 (mood-board PII enumeration), H-7/H-7b
  (discount re-validation/display), H-9 (loose anon SELECT on bookings).
- **Open, all low-stakes:** M-1 (guard comment on
  `dangerouslySetInnerHTML` constants), L-3 (`@types/node` bump), L-5
  (SSR guard), L-6 (VAT-reg placeholder on invoice), L-9 (admin policy
  assumption doc), L-10 (dead `ref()` generator in fallback path).
- Self-service security design is sound: 160-bit capability tokens,
  RPC-only anon reads, salted-hash OTP w/ TTL + lockout + constant-time
  compare, service-role-only `booking_otps`, audit table
  `booking_changes`.

---

## 3. Gap analysis

### 3.1 Technical gaps

| # | Gap | Evidence | Impact |
|---|---|---|---|
| T1 | **Doc drift** — `PROFITABILITY.md` §4 shows pre-overhaul prices/losses; `CLAUDE.md` §6 lists Studio P&L + `/policy` as not built (both shipped: `StudioPLDashboard.tsx` wired at `AdminDashboard.tsx:481`, `PolicyPage.tsx` live) | files vs code | Planning errors, re-build risk |
| T2 | **`BookingPage.tsx` is a 1,906-line monolith** (next largest file is 634) | `wc -l` | Slows every future booking-flow change; highest-churn file in repo |
| T3 | **Edge-function glue untested** — pure engines have 114 tests, but the request/response + Supabase glue of `create-booking`, `change-booking`, `verify-payment` has none | test inventory | Regressions surface only in production |
| T4 | **Contract/invoice regeneration after a change** not wired — an upgraded booking's PDF artifacts show the original package | CLAUDE.md §13g, confirmed | Legal/billing artifact mismatch after upgrades |
| T5 | `package.json` metadata is stale boilerplate (`homepage` points to github.io, Vite-template description, ISC license) | package.json | Cosmetic, but leaks pre-domain history |
| T6 | Operational unknowns owner-side: pending SQL applied? secrets set? Meta templates approved? LAUNCH15 likely expired (20-day window from ~May) | CLAUDE.md §6 | Features silently dormant if not done |
| T7 | No uptime/error monitoring — failures in fire-and-forget paths (email, WA) are visible only in `email_messages`/`wa_messages` tables if checked | code review | Silent comms failures |

### 3.2 Commercial / pricing gaps

Current list (post-overhaul, margin per migration cost model):

| Tier | Price (SAR) | Modelled margin |
|---|---|---|
| Custom Foundation (1h base) | 1,800 | ~+30% |
| Engagement | 2,500 | +25% |
| Classic | 5,200 | +12% |
| Royal ★ | 10,500 | +8% |
| Signature | 12,500 | +12% |
| ATEMA Couture | 19,500 | +7% |

| # | Gap | Detail |
|---|---|---|
| C1 | **Videographer outsourcing caps margin** at 7–8% on the flagship tiers. In-house video (training + second body, ~one-time cost) converts Royal/Signature into the highest-margin tiers — already identified in PROFITABILITY.md, not yet actioned. |
| C2 | **No installment/payment-plan option.** KSA wedding spend is routinely staged; a 50% deposit + balance-before-event structure (Moyasar supports multi-charge) lowers the psychological barrier at 10.5k–19.5k price points. |
| C3 | **Classic → Royal gap is 2× (5,200 → 10,500)** with no rung between. A "Classic + short video" bundle exists implicitly via add-ons (5,200 + 3,400 = 8,600) but isn't merchandised as a tier — brides won't assemble it themselves. |
| C4 | **No seasonal/day-of-week yield management.** Thursday and wedding-season dates sell themselves; off-season weekdays don't. The calendar already knows the date — premium/off-peak adjustments are one migration away. |
| C5 | **No post-booking revenue motion**: anniversary/maternity re-booking offers, gift cards, engagement→wedding upgrade credit ("your engagement fee counts toward your wedding package within 18 months" — locks in the bigger booking). |
| C6 | The P&L engine's `expectedBookingsPerYear=35` and `ownerHourlyRate=150` need their first annual recalibration ritual scheduled (doc §7 defines it; nothing schedules it). |

### 3.3 Branding gaps

Strengths first: the dual-palette system, stationery convergence, FAB
monogram rules, and the Arabic-first editorial voice are genuinely
distinctive and consistently enforced in code. The gaps are around the
edges:

| # | Gap | Detail |
|---|---|---|
| B1 | **`.xyz` TLD undercuts the luxury signal.** For a brand whose stationery is this considered, `atema.studio` or a `.sa`/`.com` reads materially more trustworthy in WhatsApp link previews — exactly where most brides first meet the URL. (Migration is cheap now; expensive after print collateral exists.) |
| B2 | **Single social channel** (Instagram in footer). Snapchat + TikTok dominate KSA wedding discovery; a WhatsApp Channel suits the clientele's privacy expectations. schema.org `sameAs` needs the real profile list. |
| B3 | **No Google Business Profile / Maps presence** referenced anywhere — the highest-intent local search surface ("مصورة عرايس الجبيل"). |
| B4 | **Testimonials are seeded copy**, not sourced client words. A consent-based, first-name-only (or anonymous "bride of …") testimonial pipeline keeps the PII discipline while adding real social proof. |
| B5 | **Email deliverability trust**: confirm SPF/DKIM/DMARC are fully aligned for `atemastudio.xyz` on Zoho — a luxury brand's confirmation email landing in spam is a brand event, not an IT event. |

### 3.4 Social-engineering & trust gaps (the human attack surface)

The cryptography is strong; the remaining risk is people, not math:

| # | Gap | Detail |
|---|---|---|
| S1 | **OTP messages don't warn against sharing.** The step-up OTP is the only thing standing between a leaked manage-link and a paid downgrade/upgrade mess. The WA template should carry "لن نطلب منك هذا الرمز أبداً — لا تشاركيه مع أحد" (we will never ask for this code — never share it). |
| S2 | **No impersonation defence for customers.** All money flows through WhatsApp/IBAN. A fraudster posing as ATEMA with a different IBAN is the realistic attack. Mitigations: publish the official WhatsApp number + IBAN on `/policy` ("we only ever use these"), pursue the verified WhatsApp Business badge, and state "the IBAN never changes — verify on our site" inside the transfer instructions. |
| S3 | **Receipt OCR is advisory, not authoritative** — correct design, but the manual states it nowhere as a rule. Document that a human always confirms funds against the bank statement before status → `paid` (forged-receipt resistance). |
| S4 | **Single-admin single-point-of-failure**: one Supabase login controls all PII and payouts. Enforce a hardware-key/2FA policy on the Supabase, GitHub, Meta and Zoho accounts; document recovery if the owner's phone (WA + OTP receiver) is lost. |
| S5 | Capability links (manage/board tokens) live in WhatsApp threads forever. Acceptable trade-off, but consider expiring manage tokens after the event date + 30 days. |

---

## 4. Improvement plan (phased, effort-estimated)

### Phase 0 — Truth & housekeeping (≈ 1 day, do first)
1. **Re-write `PROFITABILITY.md` §4** with the post-overhaul price table; update `CLAUDE.md` §6 (Studio P&L + `/policy` are DONE). *(T1)*
2. Fix `package.json` metadata (homepage → atemastudio.xyz, real description). *(T5)*
3. Close trivial tracker items: M-1 guard comment, L-3 bump, L-10 comment/removal. 
4. **Owner checklist sweep**: confirm pending migrations applied, secrets set, Meta templates approved, Moyasar live-mode state; retire/replace expired LAUNCH15. *(T6)*
5. Add the OTP "never share" line + official-IBAN/anti-impersonation copy to WA templates and `/policy`. *(S1, S2)* — copy change, minutes of work, real fraud mitigation.

### Phase 1 — Revenue protection (≈ 1 week)
6. **Contract/invoice regeneration after a package change** — the artifact gap with legal exposure. *(T4)*
7. **Edge-function glue tests** with a mocked Supabase client for `create-booking`, `change-booking`, `verify-payment` — the three money paths. *(T3)*
8. **Refund-deposit button** in the admin booking modal (already parked in CLAUDE.md).
9. Lightweight failure visibility: an admin badge when `email_messages`/`wa_messages` has rows in `failed` state in the last 7 days. *(T7)*
10. Document the human receipt-verification rule in `docs/MANUAL.md`; set 2FA policy on the four operator accounts. *(S3, S4)*

### Phase 2 — Commercial growth (≈ 2–3 weeks, sequenced with owner)
11. **Installment payments** — 50% deposit / balance N days pre-event; Moyasar multi-charge + a `payment_schedule` migration. *(C2 — likely the single highest-conversion change at current price points)*
12. **Merchandise a "Classic Cinema" rung (~8,800 SAR)** between Classic and Royal (Classic + short film), closing the 2× gap. One seed row, zero engine work. *(C3)*
13. **Seasonal/weekday yield pricing** — `date_premiums` table + server-side recompute awareness. *(C4)*
14. **Engagement→wedding credit + gift cards** as retention/lock-in motions. *(C5)*
15. **In-house videography business case** — one-page worked model for Fatima (gear + training cost vs. 3,375–8,100 SAR outsourced per booking); flips Royal/Signature to top-margin tiers. *(C1)*
16. Calendar reminder + checklist for the annual P&L recalibration ritual. *(C6)*

### Phase 3 — Brand & distribution (parallel, mostly non-code)
17. **Domain decision** — evaluate `atema.studio`/`.com`/`.sa` before print collateral locks `.xyz` in. *(B1)*
18. **Channel build-out**: Snapchat + TikTok profiles, WhatsApp Channel, Google Business Profile; update footer + schema.org `sameAs`. *(B2, B3)*
19. **Consent-based testimonial pipeline** (post-delivery WA ask → first-name-only quote) replacing seeded copy. *(B4)*
20. SPF/DKIM/DMARC verification pass on Zoho. *(B5)*
21. Verified WhatsApp Business badge once Meta Business verification completes. *(S2)*

### Phase 4 — Scale (only when volume justifies; unchanged from parking lot)
- AI concierge WA pilot → voice-note transcription → `/admin/conversations` monitor → Tap Payments (Mada volume trigger).
- `BookingPage.tsx` decomposition *(T2)* — schedule it as the prerequisite of the next big booking-flow feature rather than as standalone refactor.

---

## 5. Scorecard

| Dimension | Grade | One-line verdict |
|---|---|---|
| Architecture | **A−** | Clean separation, RPC-mediated access, single-sourced policy engines; one monolith file. |
| Security | **A−** | All criticals/highs patched; remaining risk is human-layer (OTP sharing, impersonation). |
| Code quality & tests | **B+** | 114 tests on the pure cores; edge glue and the 1.9k-line page are the soft spots. |
| Documentation | **B** | Exceptional breadth, but drift in 2 high-traffic docs undermines it. |
| Pricing & unit economics | **B+** | Now margin-positive everywhere; thin on flagships, no installments, one missing rung. |
| Branding | **A−** | Token-enforced design system is rare at this scale; TLD + single-channel footprint lag the product. |
| Distribution & social | **C+** | Instagram-only in a Snapchat/TikTok market; no Maps presence; seeded testimonials. |
