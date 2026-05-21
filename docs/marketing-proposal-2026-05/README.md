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

## Status — not yet implemented

Nothing in `src/` was changed for this proposal. It is documentation only.
The "Implementation backlog mapped to the codebase" section (§6 of the main
proposal) lists the exact files each recommendation would touch when work
begins.
