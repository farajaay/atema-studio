# ATEMA Studio — Documentation Index

This folder is the single source of truth for how the ATEMA Studio platform
works, what it costs, and how to extend it.

| Document | Audience | Purpose |
|---|---|---|
| [`MANUAL.md`](./MANUAL.md) | Owner + developers | Master operational handbook — brand, IA, booking flow, self-service changes (§13g), calendar, settings, schema, deployment, performance, code map |
| [`PROFITABILITY.md`](./PROFITABILITY.md) | Owner | How package profit is calculated, where the money goes, and three levers to improve margin |
| [`PRESENTATION.md`](./PRESENTATION.md) | Owner | One-slide-per-section walkthrough Fatima can flip through with a client or investor |
| [`integrations/whatsapp.md`](./integrations/whatsapp.md) | Developer / no-code automator | Full design + process map for auto-confirming bank-transfer receipts via WhatsApp |
| [`integrations/payments.md`](./integrations/payments.md) | Owner + developers | Moyasar status, Tap comparison, activation checklist |
| [`marketing-proposal-2026-05/`](./marketing-proposal-2026-05/) | Owner | Bilingual (Arabic/English) Saudi-market marketing audit + growth playbook with live-site screenshots and a reproducible photo-adequacy report |

## Reading order, by role

**Studio owner (Fatima):**
1. `PRESENTATION.md` — the elevator tour
2. `PROFITABILITY.md` — what each booking actually earns
3. `MANUAL.md` §6 (calendar), §8 (settings), §16 (support contacts)
4. `integrations/payments.md` §2 (Moyasar live-activation checklist)
5. `integrations/whatsapp.md` §1 (high-level intent) + §7 (cost estimate)

**Developer joining the project:**
1. `MANUAL.md` end-to-end
2. `PROFITABILITY.md` — needed to maintain the P&L engine
3. Both `integrations/` docs as roadmap reference

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
