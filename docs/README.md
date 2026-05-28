# ATEMA Studio — Documentation Index

This folder is the single source of truth for how the ATEMA Studio platform
works, what it costs, and how to extend it.

| Document | Audience | Purpose |
|---|---|---|
| [`MANUAL.md`](./MANUAL.md) | Owner + developers | Master operational handbook — brand, IA, booking flow, self-service changes (§13g), calendar, settings, schema, deployment, performance, code map |
| [`design.md`](./design.md) | Developers + brand owners | The design system — the two screen palettes (Couture Noir + Atelier Ivory), the stationery palette for printable + sendable artifacts, typography, FAB monogram rule, surface inventory |
| [`bugs.md`](./bugs.md) | Developers | Security audit + patch tracker (C-1…L-7), known-good vs known-broken |
| [`ACTIVATION-BOOKING-CHANGES.md`](./ACTIVATION-BOOKING-CHANGES.md) | Owner + developers | Step-by-step checklist to take the self-service reschedule + package-change feature live (migrations, Edge deploy, site deploy, smoke test) |
| [`REVENUE-READINESS.md`](./REVENUE-READINESS.md) | Owner + developers | Gap analysis + ordered roadmap from "platform built" to "collecting money" — activation (run/deploy), revenue integrity (payment verification), and revenue capture (top-ups, link delivery) |
| [`PROFITABILITY.md`](./PROFITABILITY.md) | Owner | How package profit is calculated, where the money goes, and three levers to improve margin |
| [`PRESENTATION.md`](./PRESENTATION.md) | Owner | One-slide-per-section walkthrough Fatima can flip through with a client or investor |
| [`integrations/email.md`](./integrations/email.md) | Owner + developers | Zoho Mail SMTP setup for the booking-confirmation email — DNS, app password, secrets, smoke test, failure-mode table |
| [`integrations/wa-platform.md`](./integrations/wa-platform.md) | Developers | Meta WhatsApp Cloud API lifecycle reminders + Claude-Vision receipt OCR (built) |
| [`integrations/whatsapp.md`](./integrations/whatsapp.md) | Reference | Earlier WhatsApp blueprint — kept for historical context; the live system follows `wa-platform.md` |
| [`integrations/payments.md`](./integrations/payments.md) | Owner + developers | Moyasar status, Tap comparison, activation checklist |
| [`marketing-proposal-2026-05/`](./marketing-proposal-2026-05/) | Owner | Bilingual (Arabic/English) Saudi-market marketing audit + growth playbook with live-site screenshots and a reproducible photo-adequacy report |

Also at the repo root:

- [`../README.md`](../README.md) — quick-start + repo map
- [`../CLAUDE.md`](../CLAUDE.md) — working brief for new Claude/dev sessions
- [`../PROJECT.md`](../PROJECT.md) — stack, schema, env vars, build/deploy reference
- [`../BACKEND_SETUP.md`](../BACKEND_SETUP.md) — first-time Supabase + Moyasar + Meta WA + Zoho wiring

## Reading order, by role

**Studio owner (Fatima):**
1. `PRESENTATION.md` — the elevator tour
2. `PROFITABILITY.md` — what each booking actually earns
3. `MANUAL.md` §6 (calendar), §8 (settings), §13b (mood board), §13g (self-service), §16 (support)
4. `integrations/payments.md` §2 (Moyasar live-activation checklist)
5. `integrations/email.md` §2 (Zoho activation steps — DNS + secrets)

**Developer joining the project:**
1. `../CLAUDE.md` — 60-second mental model + non-negotiable conventions
2. `MANUAL.md` end-to-end
3. `design.md` — palette + typography + how to add a new printable surface
4. `bugs.md` — what's been patched, what's known-broken
5. `PROFITABILITY.md` — needed to maintain the P&L engine
6. The `integrations/` docs as roadmap reference

## Generating PDF / Word / Slides from these

All docs are plain Markdown. Recommended converters:

```bash
# Markdown → PDF
npx md-to-pdf docs/MANUAL.md docs/MANUAL.pdf

# Markdown → PowerPoint (PRESENTATION.md uses slide-friendly H2 structure)
npx @marp-team/marp-cli@latest docs/PRESENTATION.md -o atema-presentation.pptx

# Markdown → Word (.docx)
pandoc docs/MANUAL.md -o atema-manual.docx
```

Keep the markdown source as the canonical version; regenerate the binary
formats when the markdown changes.
