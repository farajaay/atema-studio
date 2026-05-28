# ATEMA Studio — Design System & Process

> **One page to answer:** which palette do I use, which font, what's
> ATEMA-on-brand, and where do I add the next surface?
>
> Maintained alongside `src/theme/themes.ts`, `src/theme/stationery.ts`,
> and `index.html`. If a value here disagrees with code, the code wins —
> please open a PR to fix this doc.

---

## 1. Two palettes, by purpose

ATEMA runs **two parallel design systems**, picked by what kind of
surface you are building.

| Surface | Palette | Lives in | Theme-toggleable? |
|---|---|---|---|
| **Screen** — public site, admin panel, booking flow, mood board page, manage page | Couture Noir (default) + Atelier Ivory | `src/theme/themes.ts` + `getBookingPalette()` + CSS custom properties on `:root` | **Yes.** Admin → Settings → Theme card. Persists across visits via `localStorage`. |
| **Stationery** — contract, ZATCA tax invoice, booking-confirmation email, public `/policy` page, T&C / PDPL popups inside the booking flow | One canonical "couture letterhead" — cream paper, deep umber ink, champagne + gold accents, noir gradient for headers and CTA pills | `src/theme/stationery.ts` (mirrored at `supabase/functions/_shared/stationery.ts` for the email Edge Function) | **No.** Printed/sent artifacts always wear the same dress regardless of the admin's screen-theme choice. |

The two palettes share family resemblance (gold accents, deep ink, cream
warmth) but they are **not** the same hex values and should not be
cross-pollinated. Stationery is optimised for **print legibility** on
cream paper; screen palettes are optimised for **on-glass contrast**.

---

## 2. The screen palette (Couture Noir + Atelier Ivory)

Defined in [`src/theme/themes.ts`](../src/theme/themes.ts). Authoritative table:

| Token | Couture Noir (default) | Atelier Ivory |
|---|---|---|
| `bg` | `#0B0B0B` true black | `#F5EDE4` ivory |
| `surface` | `#141414` | `#FFFFFF` white |
| `surfaceAlt` | `#1C1C1C` | `#FBF6EE` |
| `heading` | `#EFE3D1` ivory | `#1A1A1A` editorial black |
| `text` | `#D8CDB9` | `#4A3728` |
| `gold` | `#D4AF7A` champagne | `#8C6B4F` deep bronze |
| `goldDeep` | `#BB864B` | `#6B5440` |
| `border` | `rgba(212,175,122,0.14)` | `rgba(214,191,163,0.4)` |
| `overlay` | `rgba(0,0,0,0.78)` | `rgba(20,13,8,0.55)` |

**Rule:** never hard-code these hexes in components. Use the CSS custom
properties declared in `index.html` (e.g. `var(--a-bg)`, `var(--a-gold)`)
or read from `getBookingPalette(themeName)` in screens that pre-date the
custom-properties era (`BookingPage.tsx`, `AdminDashboard.tsx`).

**The Lucide-icon exception:** `<Icon color="..." />` is an SVG
presentation attribute; it does not resolve CSS variables. Use a literal
hex (e.g. `color="#D4AF7A"`) **at icon sites only**.

The screen palette uses **`Cormorant Garamond`** for English display
headlines (paired with **`Amiri`** for Arabic) and **`Tajawal`** for body
text in both languages.

---

## 3. The stationery palette (printable + sendable surfaces)

Defined in [`src/theme/stationery.ts`](../src/theme/stationery.ts) and
mirrored in [`supabase/functions/_shared/stationery.ts`](../supabase/functions/_shared/stationery.ts)
(the email Edge Function can't reach into `src/`). **When you change a
value, change both files.**

### 3.1 Token map

| Group | Token | Hex | Used for |
|---|---|---|---|
| Surface | `paper` | `#F9F5F0` | Page background + nested cream panels |
| | `paperAlt` | `#FBF6EE` | Slightly lifted inner panel (footers, etc.) |
| | `paperWarn` | `#FFF8F0` | "Deposit non-refundable" inset |
| | `card` | `#FFFFFF` | Main document card |
| Ink | `ink` | `#2C2218` | Body text — deep umber, not pure black |
| | `inkSoft` | `#4A3728` | Sub-body, `<h3>` |
| | `inkMuted` | `#8C6B4F` | `<h2>`, labels, link gold (= `goldDeep`) |
| | `inkFaint` | `#B09880` | Tertiary labels, placeholders |
| Accents | `goldChampagne` | `#C9B393` | Frame borders, signature dashes, stamps |
| | `goldDeep` | `#8C6B4F` | Warm gold text + links |
| | `goldHi` | `#E8D9C5` | Pale champagne — text on noir backgrounds |
| | `borderHair` | `#E8D9C5` | Hairline divider on cream |
| | `borderDash` | `#D6BFA3` | Dashed accents (QR section, etc.) |
| Noir | `noir` | `#1A1A1A` | CTA pills, header gradient start, table headers |
| | `noirMid` | `#2C2C2C` | Header gradient mid |
| | `noirWarm` | `#4A3728` | Header gradient end |
| | `noirGrad` | `linear-gradient(135deg,#1A1A1A,#2C2C2C,#4A3728)` | The single header gradient used across all stationery |
| Warning callout | `warnInk` | `#5C3D1E` | Text inside `.important` insets |
| | `warnAccent` | `#8C6B4F` | 3px side border on `.important` insets |
| Status badges | `okBg` / `okInk` / `okBorder` | `#EAF2EC` / `#3F6B53` / `#B7CFC0` | "Paid" badge on the invoice (muted forest) |
| | `warnBg` / `warnIn` / `warnBorder` | `#FBF1E5` / `#A07043` / `#DFC0A0` | "Awaiting transfer" badge (burnished gold) |
| Shadows | `shadow` | `0 4px 24px rgba(0,0,0,0.08)` | Card lift |
| | `cardShadow` | `0 6px 32px rgba(26,26,26,0.08)` | Stronger card lift (invoice) |

### 3.2 Stationery typography

| Token | Value | When to use |
|---|---|---|
| `fontWordmark` | `'Amiri', serif` | The brand wordmark **"ATEMA STUDIO"** — in any script. The spaced-letter serif IS the wordmark. |
| `fontDisplayAr` | `'Amiri', serif` | Arabic display headlines, section titles in Arabic |
| `fontDisplayEn` | `'Cormorant Garamond', serif` | English display headlines (other than the wordmark) |
| `fontBody` | `'Tajawal', sans-serif` | Body text in both languages. Tabular numerals via `font-feature-settings:"tnum" 1`. |

**Inter is not used in stationery.** Earlier iterations mixed it in for
ledger numbers on the tax invoice; this is now Tajawal with `tnum`.

### 3.3 The font import

When generating a stationery HTML document, inline the canonical
`@import` URL once in the `<style>` block:

```ts
import { STATIONERY, STATIONERY_FONTS_IMPORT } from '../theme/stationery';

const html = `
<style>
  ${STATIONERY_FONTS_IMPORT}
  body { font-family: ${STATIONERY.fontBody}; color: ${STATIONERY.ink}; }
  /* … */
</style>
`;
```

`STATIONERY_FONTS_IMPORT` registers Amiri + Cormorant Garamond + Tajawal
in one HTTP request.

---

## 4. The FAB couture monogram

A small circular **FAB** monogram sits faintly in the corner of every
printable document (contract + tax invoice). It is a **brand-usage rule**:

- ✅ Permitted on printable contracts, invoices, T&C pages, physical
  gifts, branded bags / packaging.
- ❌ Never on the public website chrome, email signatures, social posts,
  or in-app surfaces.

The monogram lives inline in `contract.ts` and `invoice.ts` as a
`<div class="fab-monogram">FAB</div>` styled against the noir header.

---

## 5. Five surfaces, one stationery palette

These five all source from `STATIONERY` so they stay visually unified:

| Surface | File | Renders where |
|---|---|---|
| Booking contract | `src/services/contract.ts` | Generated in-browser at booking time, opened in a new tab, printable. Saved to `contracts` table. |
| ZATCA tax invoice | `src/services/invoice.ts` | Same lifecycle as contract. Includes Phase-1 base64 TLV QR. |
| Booking-confirmation email | `supabase/functions/_shared/email-confirmation.ts` | Sent from `atema@atemastudio.xyz` via the `create-booking` Edge Function. Bilingual HTML + plaintext. |
| Public policy page | `src/pages/PolicyPage.tsx` | `/#/policy` — renders T&C + PDPL content blocks on a cream-card surface. |
| Booking-flow T&C / PDPL popups | `src/content/legal.ts` consumed by `src/pages/BookingPage.tsx` | Inline modals during the booking form step. Same HTML content blocks as `/policy`. |

Adding a sixth printable/sendable surface? Import `STATIONERY` (or its
Deno mirror for an Edge Function), use the tokens, register the font
import once via `STATIONERY_FONTS_IMPORT`. **Don't introduce new hex
literals or fonts** — that's how palette drift starts.

---

## 6. Motion

A single `FadeUp` component (`src/components/FadeUp.tsx`) drives all
cinematic reveals on the public site. It uses
`IntersectionObserver` + `cubic-bezier(0.22, 0.61, 0.36, 1)` easing,
700ms default. It respects `prefers-reduced-motion`.

Don't add ad-hoc CSS animations or motion libraries; thread state
changes through `FadeUp` when you need an entrance.

---

## 7. Bilingual & RTL conventions

- **Arabic is primary.** Default `dir` is `rtl` on `<html>` when
  `lang === 'ar'`. The `useLang()` hook (`src/hooks/useLang.ts`) is the
  single source for `lang` + `dir`.
- **Every new DB table that stores user-visible strings ships
  `_ar` + `_en` columns.** No exceptions. See `packages`, `addons`,
  `portfolio_items`, `journal_posts`.
- **Arabic display headlines fall back to Tajawal**, not Amiri, on the
  public site (style decision: Amiri italic reads as wedding-invitation
  on stationery but feels heavy as a screen H1). The rule lives in
  `index.html` under `[dir="rtl"] .display-serif`.
- **Stationery is bilingual on the same artifact.** The contract is
  Arabic-only (legal document); the invoice and email show both
  languages side-by-side; T&C/PDPL have separate AR + EN string
  exports in `legal.ts`.

---

## 8. The convergence story (2026-05-28)

Before this iteration, the four printable + sendable surfaces drifted
across **four cream backgrounds** (`#F9F5F0` / `#F5EDE4` / `#f4ede4` /
`#FDFBF6`), **two body inks** (`#2C2218` / `#1A1A1A`), **three display
serifs** (Amiri / Cormorant Garamond / Inter), and on the invoice, **off-
brand Tailwind status badges** (`#d1fae5` / `#fef3c7`).

A single canonical `STATIONERY` module replaced the drift. The four
files (`contract.ts`, `invoice.ts`, `email-confirmation.ts`,
`PolicyPage.tsx`) plus the shared content (`legal.ts`) now reference
tokens by name. Inter was dropped; tabular numerals come from Tajawal
with `font-feature-settings:"tnum" 1`. Tailwind badges were replaced
with muted forest + burnished gold tones that sit on the stationery
palette.

The fix is one source of truth. The next time someone changes a token,
one file moves and every artifact updates in lockstep.

---

*Last updated: 2026-05-28 (stationery palette convergence — commit `a2866ae`)*
