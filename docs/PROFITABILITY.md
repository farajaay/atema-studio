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

Assuming Jubail (free travel), no add-ons, all VAT-on:

| Package | Price | Owner hrs | Direct costs | Overhead | Owner cost | True profit | True margin |
|---|---|---|---|---|---|---|---|
| Engagement (1,800) | 1,800 | 11.8 | 80 | 184 | 1,770 | **-234** | -13% |
| Customise (2,200) | 2,200 | 14.2 | 80 | 184 | 2,130 | **-194** | -9% |
| Classic (4,200) | 4,200 | 18.6 | 1,310 | 184 | 2,790 | **-84** | -2% |
| Royal (6,900) | 6,900 | 25.5 | 3,710 | 184 | 3,825 | **-819** | -12% |
| Signature (8,500) | 8,500 | 27.4 | 4,790 | 184 | 4,110 | **-584** | -7% |
| Couture (14,000) | 14,000 | 34.5 | 7,650 | 184 | 5,175 | **+991** | +7% |

**Reading this table:**

- **Engagement at 1,800 SAR is structurally unprofitable.** It's a loss
  leader / entry-point package. Fine as a brand-awareness vehicle, but the
  studio should not aim to fill its calendar with these.
- **Royal at 6,900 SAR shows -819 true profit** — but only because the
  videographer fee (2,250 SAR) is the real margin killer. If ATEMA can shoot
  the cinematic with in-house equipment instead of hiring out, Royal flips
  to +1,431 true profit.
- **Couture at 14,000 is genuinely profitable** at +991 true profit (7%
  margin) and that's with conservative cost assumptions.

### The fix — three levers the owner can pull

1. **Raise the Engagement price to 2,400 SAR** — same true-profit math
   yields +366 instead of -234. The package is still the cheapest entry point
   and won't deter customers who already chose ATEMA.
2. **Bring videographer in-house** (training + a second camera) — turns Royal
   and Signature from loss-makers into the studio's most profitable per-hour
   tiers.
3. **Track real overhead** annually — if actual bookings/year run higher than
   35, per-booking overhead drops and every tier improves.

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
