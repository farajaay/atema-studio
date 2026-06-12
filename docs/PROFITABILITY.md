# Package Profitability — Calculation & Rationale

> How ATEMA Studio measures the real profitability of every booking.
> The numbers in this doc come from `src/services/pl/config.ts` and the
> engine in `src/services/pl/engine.ts`.

---

## 1. Why we bother

A booking can look profitable on paper ("3,450 SAR for a Royal package — great!")
and still **lose money** in practice because:

1. The owner's time isn't free. If a Royal takes 26 hours of work end-to-end
   and Fatima's target hourly rate is 150 SAR/hr, that's 3,900 SAR of owner
   labour alone — already above the deposit.
2. The album and storage have real **cost-of-goods**.
3. Every booking carries a slice of overhead: camera depreciation, lighting
   depreciation, Adobe + DaVinci subscriptions, etc.

The P&L engine quantifies all of this so the admin can answer one question
on every booking: **"Did this booking actually make me money?"**

---

## 2. Cost configuration (`DEFAULT_COST_CONFIG`)

The baseline costs, all in SAR. These are admin-editable per-booking in the
admin panel's P&L tab.

| Variable | Default | Rationale |
|---|---|---|
| `ownerHourlyRate` | 150 | Target take-home rate for Fatima's time. Below this, she's working at a loss vs. comparable freelance work. |
| `ownerWorkHoursPerBooking` | 24 | Default used when no per-booking detail is provided. The engine usually computes this dynamically from `calculateOwnerHours()`. |
| `cameraValue` | 28,000 | Sony A7 IV + lens kit. |
| `cameraLifespanYears` | 8 | Conservative — pro bodies depreciate over 6–10 years. |
| `lightingValue` | 5,000 | Godox AD400Pro × 2 + stands + modifiers. |
| `lightingLifespanYears` | 5 | Bulbs and batteries are the limiting factor. |
| `photoshopMonthly` | 75 | Adobe CC Photography plan. |
| `videoLicenseMonthly` | 86 | DaVinci Resolve Studio amortised + Frame.io. |
| `assistantHourlyRate` | 110 | Local assistant photographer day rate / 8. |
| `videographerHourlyRateDefault` | 450 | Freelance videographer for video-included packages. |
| `albumA4Cost` | 450 | Prophoto / Cypress lay-flat A4, 10 pages. |
| `albumA3Cost` | 700 | Same supplier, A3 lay-flat 12 pages. |
| `albumCoverBoxCost` | 300 | Custom presentation box with FAB monogram. |
| `storageUnitCost` | 80 | Branded USB drive in velvet sleeve. |
| `fuelCostPerKm` | 0.50 | Current Saudi 91 octane fuel cost / car efficiency. |
| `wearAndTearPerKm` | 0.15 | Tyres, oil, depreciation per km. |
| `expectedBookingsPerYear` | 35 | Realistic capacity at current studio + lead-gen pace. Used to amortise overhead. |
| `vatRate` | 0.15 | Saudi standard VAT. |

---

## 3. The calculation, layer by layer

### Layer 1 — Revenue
```
revenueExVat   = booking.price + addons_total + travel_fee_charged
              ─── if vat_enabled ───
revenueIncVat  = revenueExVat × 1.15
vatAmount      = revenueExVat × 0.15
```

### Layer 2 — Overhead allocation (`calculateOverhead`)
The engine spreads ATEMA's fixed costs across the expected 35 bookings/year:

```
cameraDepreciation     = 28,000 / 8        = 3,500 SAR / year
lightingDepreciation   = 5,000 / 5         = 1,000 SAR / year
photoshopAnnual        = 75 × 12           = 900 SAR / year
videoLicenseAnnual     = 86 × 12           = 1,032 SAR / year

allocatedDepreciation  = (3,500 + 1,000) / 35  = 129 SAR / booking
allocatedSoftware      = (900 + 1,032) / 35    = 55 SAR / booking
totalOverhead          = 184 SAR / booking
```

If actual yearly bookings drop below 35 the per-booking overhead share goes
up — the admin should re-tune `expectedBookingsPerYear` annually based on the
prior year's count.

### Layer 3 — Owner time (`calculateOwnerHours`)
This is where most bookings hide their real cost. The engine sums:

```
onsite        = coverageHours              # e.g. 5 for Royal
prep          = prepHours + 2              # 2hr baseline travel+setup
editing       = coverageHours × 2.4        # editing scales with shoot length
albumDesign   = 3 if albumIncluded else 0
miniAlbum     = 1.5 if miniFamilyAlbum else 0
videoEdit     = 4 if includesVideo else 0
communication = 2 hours (calls, emails, briefing)
───────────────────────
totalOwnerHours = clamp(sum, min = 5 hours)
```

Royal example:
```
5 + (0+2) + (5×2.4) + 3 + 1.5 + 4 + 2 = 25.5 hours
costOwnerTime = 25.5 × 150 = 3,825 SAR
```

### Layer 4 — Direct costs
- **Team** — assistant + videographer paid per hour, only when included.
  Royal: assistant 110 × 5 = 550; videographer 450 × 5 = 2,250.
- **Album** — base cost + extra pages (45 SAR/page over 10) + mini album
  (200 SAR) + presentation box (300 SAR).
- **Storage** — 80 SAR per branded USB unit (+ any extras).
- **Travel** — 0.65 SAR/km round trip (fuel + wear).

### Layer 5 — Aggregates
```
directCosts       = team + album + storage + travel
revenueAfterCogs  = revenueExVat - directCosts
directMargin      = revenueAfterCogs / revenueExVat
operatingProfit   = revenueAfterCogs - totalOverhead
operatingMargin   = operatingProfit / revenueExVat
trueProfit        = operatingProfit - costOwnerTime   ← THE NUMBER THAT MATTERS
trueMargin        = trueProfit / revenueExVat
```

`trueProfit` is what's left after paying yourself a fair hourly rate. If it's
positive, the booking made money on top of compensating your time. If it's
negative, you essentially worked below your target wage on this booking.

---

## 4. Worked examples (current price list)

> **Updated 2026-06-12.** The May-2026 pricing overhaul
> (`database/migrations-2026-05-pricing-overhaul.sql`) repriced every tier
> against this cost model. The previous table — kept in git history — showed
> 5 of 6 tiers with **negative** true profit; that is what the overhaul fixed.
> The cost columns below come from the overhaul migration's worked math
> (assistant at 110/hr for shoots >2h, printing at supplier cost × 1.25,
> video at hours × 450 × 1.5, owner at 150/hr, Jubail travel, no add-ons).

| Package | Price | Fully-loaded cost | True profit | True margin |
|---|---|---|---|---|
| Custom Foundation (1h base) | 1,800 | ~1,374 | **+426** | +24% |
| Engagement | 2,500 | 1,884 | **+616** | +25% |
| Classic | 5,200 | 4,638 | **+562** | +11% |
| Royal | 10,500 | 9,708 | **+792** | +8% |
| Signature | 12,500 | 11,184 | **+1,316** | +11% |
| ATEMA Couture | 19,500 | 18,169 | **+1,331** | +7% |

**Reading this table:**

- **Every tier now clears its fully-loaded cost**, including Fatima's
  owner time at 150 SAR/hr. Nothing in the catalogue is a structural
  loss-maker any more.
- **Margins on the video tiers (Royal, Signature, Couture) are the
  thinnest (7–8%)** because the outsourced videographer is priced
  through at cost + 50%. The price covers the cost, but the *margin
  ceiling* stays low while video is hired out.
- **The entry tiers carry the fattest percentage margins** (~25%) —
  by design, since their absolute profit is small and they exist to
  start relationships that upgrade.

### The remaining levers the owner can pull

1. **Bring videography in-house** (training + a second body) — converts
   the 450/hr pass-through into owner margin and makes Royal/Signature
   the most profitable tiers per hour. This is the single biggest open
   commercial lever.
2. **Track real overhead annually** — if actual bookings/year run higher
   than 35, per-booking overhead drops and every tier improves; if lower,
   the thin video-tier margins are the first to go red.
3. **Mind the warning chips** (§5) on discounted bookings — a 15%
   discount on Royal (-1,575 SAR) is double its true profit. Percent
   codes should be capped below each tier's true-profit figure.

---

## 5. The four warning states the engine flags

Surfaced as banners in the admin booking detail modal:

| Warning code | Trigger | Owner interpretation |
|---|---|---|
| `hourly_rate_below_target` | trueProfit < 0 | "This booking didn't cover your time at 150/hr." |
| `thin_margin` | trueMargin < 10% (and ≥ 0) | "Profitable, but no buffer for surprises." |
| `not_covering_overhead` | operatingProfit < 0 | "Doesn't even cover this booking's share of camera + software." |
| `below_direct_cost` | directMargin < 0 | "You're paying out more than you charged." |

The first warning (`hourly_rate_below_target`) is the most important for
pricing decisions. The fourth (`below_direct_cost`) should never happen — if
it does it's almost always because a customer was given an unrecorded
discount.

---

## 6. How the admin actually uses this

1. Open the admin dashboard, click any booking, switch to the **P&L tab**.
2. Top of the tab: revenue, direct margin, operating margin, true margin —
   with the warning chips lit where applicable.
3. Below: an editable cost-inputs section. Tweak `coverageHours`,
   `includesVideographer`, `albumIncluded`, etc. — the numbers update live.
   Use this when a booking deviates from the package default (e.g. customer
   added 2 extra hours; or the videographer was cancelled).
4. Below that: a cost waterfall showing where every Riyal of revenue went.

This view is per-booking, not aggregate. A separate "Studio P&L" admin page
that rolls all bookings into monthly/quarterly views is a parked enhancement.

---

## 7. Annual recalibration (suggested ritual)

Once a year (December is good — quiet season):

1. Pull last year's actual booking count → update `expectedBookingsPerYear`.
2. Review gear purchases → update `cameraValue`, `lightingValue`.
3. Check Adobe + DaVinci billing → update `photoshopMonthly`,
   `videoLicenseMonthly`.
4. Audit travel claims → update `fuelCostPerKm` (it rises with fuel prices).
5. Decide if `ownerHourlyRate` deserves a raise — Fatima's skill level and
   reputation should pull this up over time.
6. Re-run the package examples (§4 of this doc) with the new numbers and
   adjust the printed price list if any tier shows red.
