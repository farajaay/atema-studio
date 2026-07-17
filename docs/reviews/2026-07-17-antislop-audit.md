# ATEMA Studio — Anti-Slop Design Audit (Home Page)

> **Date:** 2026-07-17
> **Base reviewed:** `master` at the branch point of `preview/antislop-home-redesign`
> **Law applied:** `anti-slop-design-law.md` (source: pols.dev/slop.md), supplied by the owner
> **Scope:** `src/pages/HomePage.tsx` — structure, hero, section composition, cards, buttons, motion.
> Colors, brand fonts, and copy meaning were held fixed by instruction; nothing here proposes a new
> palette or typeface.
> **Deliverable:** a real, working preview route — `/#/preview-thread-bc15d231` — not linked from
> any nav, excluded from `public/sitemap.xml`, disallowed in `public/robots.txt`, and tagged
> `noindex, nofollow` at runtime. Component: `src/pages/AntislopPreviewPage.tsx`.

---

## Result

| Gate | Result |
|---|---|
| `npx tsc -b` | PASS |
| `npx vite build` | PASS — `AntislopPreviewPage` code-splits into its own 19.8 kB (6.3 kB gz) lazy chunk, not in the main bundle |
| `npx eslint src/pages/AntislopPreviewPage.tsx src/App.tsx` | PASS, no warnings |
| Local preview smoke (desktop 1400px, mobile 420px, full scroll pass) | PASS — reveal-on-scroll fires correctly, `<meta name="robots" content="noindex,nofollow">` injected on mount and removed on unmount, no console/page errors |

Nothing in `master`'s live routes, nav, sitemap, or robots allow-list changed. The only behavior
change on every *existing* route is zero: `App.tsx` gained one new lazy `<Route>` and one
string check in `showPromotion`, both additive.

---

## Findings against `HomePage.tsx` (production, unchanged by this branch)

Grounded in the file, not a screenshot — line numbers are current as of this branch's base commit.

| # | Finding | Evidence | Law reference |
|---|---|---|---|
| 1 | Hero opens on a CSS gradient with no photograph; the first real image is a scroll below the fold. | `HomePage.tsx:49-119` — hero background is two stacked gradients, zero `<img>`. | "The hero is a thesis" (general design principle) — for a photography studio, the work itself is the most characteristic thing in its world. |
| 2 | Centering is the default structure of the page, not a chosen moment. | `textAlign:'center'` / `justifyContent:'center'` at `:51-52` (hero), `:184` (trust strip), `:228` (Experience heading), `:352` (closing CTA). | "Nothing actually centered" / "content flung to far edges by default, not by design" family of tells — more precisely, centering used as the page's only structural idea. |
| 3 | Two different jobs — explaining a facet vs. navigating to a page — share identical card chrome: same border, same padding, same hover-lift. | Experience cards `:255-260`; cross-sell cards `:306-312` (`onMouseEnter`/`onMouseLeave` hover-lift at `:313-319`). | "Hairline light border on boxes," "Card hover-lift (rise + bloom shadow + glowing border)," "one label treatment everywhere." |
| 4 | The one thing that should be unique to ATEMA — the photography — is delivered as a uniform 3∶4 grid, no rhythm, interchangeable with any bridal-studio template. | `:132-159`, `gridTemplateColumns: repeat(6,1fr)`, identical `aspectRatio:'3/4'` on every thumb. | "No signature artifact decided first" / "same skeleton, recolored." |
| 5 | Two buttons, one filled one ghost, appear together at every call to action. | Hero actions `:97-106`; the pattern repeats at header and closing CTA in the surrounding component tree. | "Fill-plus-outlined button pair" — named explicitly as banned. |
| 6 | Section heads all use the same kicker-then-heading skeleton with no variation. | `.ornament` eyebrow + `.display-serif` heading precedes every section: Experience `:222-233`, cross-sell block, closing CTA `:354-365`. | "Kicker-plus-serif-H2 section head," and the law's own rule: "if your page is built from a known slop skeleton, change it — vary composition by section." |

**Not flagged, and deliberately kept as-is in the preview:** the two-palette token system
(`src/theme/themes.ts`), the single restrained `FadeUp` motion component, the already-sharp
2–4px corner radii (not the banned "rounded-lg everywhere" default), and the site's real,
non-placeholder copy.

---

## What the preview route changes

One signature artifact, decided first: a single hand-drawn gold thread (SVG path, `#aslp-thread`
/ `#aslp-thread-v` in `AntislopPreviewPage.tsx`), grounded in the brand's own language —
`design.md` describes Couture Noir as "black silk, champagne gold." It appears at exactly three
points (hero, the Experience facet list, the closing CTA) and nowhere else.

| Finding above | Fix in the preview |
|---|---|
| 1 — textless hero | Full asymmetric hero: an image plate (top-aligned) and the headline (bottom-aligned) share one field instead of a centered text-on-gradient block; the thread is the only element that visibly crosses between them. |
| 2 — centering as default | No section centers its content block. Hero and Experience are asymmetric two-column; Work and Explore are left-set; CTA stands alone, unlabeled by a separate kicker row. |
| 3 — identical card chrome for different jobs | All hairline borders on cards removed; differentiation is tone-only. The three Experience facets that follow the lead card are strung on the vertical thread instead of a colored accent rail. |
| 4 — generic photo grid | Replaced with an asymmetric "contact sheet" filmstrip — uneven frame widths, a larger lead frame, real frame-code ticks (`ATM—001`…) instead of decorative numbering. |
| 5 — filled+ghost button pair | One button style (`.btn`, filled gold) for true actions only. Every secondary action is a bare text link with an arrow — no ghost/outline twin anywhere on the page. |
| 6 — repeated kicker+H2 skeleton | Each section's heading lives inside its own content instead of a separate label row above it: the Work heading is one frame in the filmstrip; the Experience heading lives inside the lead card. |

Colors: every hex in `AntislopPreviewPage.tsx` is copied verbatim from `src/theme/themes.ts`
(Couture Noir). No new color was introduced. Fonts: the page reuses the site's already-loaded
Amiri (wordmark) and Tajawal (headings/body) — no `@font-face` change, no new font request.

---

## Open decision for the owner

The supplied law bans Google-default fonts as a *signature* type choice (Cormorant Garamond named
explicitly). It does not name Tajawal or Amiri — but they are Google Fonts, and they are also
ATEMA's actual documented brand typefaces (`docs/design.md` §2, §7). This branch keeps them,
since swapping the brand's real typeface is a bigger call than a structural preview should make
unilaterally. Flagged in-page (`#aslp-notes`) and here for a decision before this goes further.

---

## Access

`https://atemastudio.xyz/#/preview-thread-bc15d231` once this branch is deployed. The random
suffix is the only access control — it is not linked from anywhere, and should not be pasted into
chat tools, tickets, or anywhere else that might get indexed. Treat the URL itself as the
share mechanism until the redesign is approved or rejected.
