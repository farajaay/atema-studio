# Plan — Full Security & Code Check (July 2026)

> **Status:** ACTIVE — executed 2026-07-09 on branch
> `claude/security-code-check-plan-y1m2y6`.
> **Deliverables:** this plan · a full audit report in `docs/reviews/` ·
> a **PDF edition of the report themed in the ATEMA stationery palette** ·
> a status-update entry appended to `docs/bugs.md`.
> **Prior art:** `docs/reviews/2026-07-03-hardening-scan.md` (last full
> hardening pass) and `docs/bugs.md` (the running patch tracker C-1 → L-10,
> H-10, M-11, DB-1/DB-2). This pass re-verifies every prior patch **and**
> sweeps everything that landed since (Films page, album mockups, gallery
> refresh, transfer-only launch state, dual-channel notifications).

---

## 0. Why this pass exists

The last full audit baseline is 2026-07-03/04. Since then the July
integration pass went live (commit `203e6b9` tip). The studio is now in
its **launch configuration** — transfer-only payments, email as the
always-channel, WhatsApp parked behind `app_settings.wa_enabled`. A
launch configuration deserves a fresh, end-to-end security + code-quality
sweep with a **presentable artifact** (the PDF) the owner can file or
share with a consultant, plus a documented, repeatable process so the
next audit doesn't reinvent the method.

**Goals, in order:**

1. Re-verify that no previously-patched finding has regressed
   (C-1, C-3, H-6, H-9, H-10, M-8, M-9, M-10, M-11, L-8 at minimum).
2. Audit all surface added/changed since 2026-07-04 with fresh eyes.
3. Assess **documentation & work-process adequacy** — are the docs,
   migration discipline, CI gates, and handoff files still an accurate,
   sufficient operating system for this project?
4. Produce a bilingual-toned, stationery-themed **PDF report** the owner
   can read without opening a code editor.

**Non-goals:** live-environment probing (Supabase advisor, deployed Edge
Function versions, DNS) — this container has no project credentials.
Live-only checks are *listed* in the report as owner actions, exactly as
the 2026-07-04 report did. No production data is touched.

---

## 1. Scope

### 1.1 In scope (everything in the repo at HEAD)

| Layer | What gets checked |
|---|---|
| **Frontend** (`src/`) | XSS surfaces, `esc()` discipline, secrets in client code, PII exposure on public surfaces, token/CSPRNG usage, validation coverage, dead/stale code |
| **Edge Functions** (`supabase/functions/`) | Auth/authz on every endpoint, server-side money recomputation, webhook signature verification, OTP handling, CORS, secret handling, error-message leakage |
| **Database** (`database/*.sql`) | RLS policy review on every table touched by 2026-06/07 migrations, SECURITY DEFINER RPC surface, anon grant surface, seed idempotency |
| **Build & CI** (`vite.config.ts`, `.github/workflows/`) | Terser/console-strip/no-sourcemap settings, workflow permissions & secret usage, deploy trust boundary |
| **Dependencies** | `npm audit`, notable major-version drift |
| **Docs & process** (`CLAUDE.md`, `PROJECT.md`, `docs/`, `AGENTS.md`) | Accuracy vs shipped code, coverage of new features, migration-run checklist completeness, handoff freshness |

### 1.2 Out of scope

- Live Supabase project state (RLS advisor, deployed function versions).
- Real payment charges, real WhatsApp/email sends.
- Browser-driven E2E (Playwright) — recommended separately, not run here.
- Load/performance testing.

---

## 2. Work process (the repeatable method)

Run the phases **in order**; each phase's output feeds the report
section of the same number. Record findings as you go in a scratch
findings list with: *ID · severity · file:line · defect · exploit
scenario · fix*. Severity rubric is the one already used by
`docs/bugs.md` (🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW) — do not
invent a new scale; the tracker must stay consistent across audits.

### Phase A — Static baseline (mechanical gates)

Every gate must be run and its verbatim result recorded:

```bash
npm ci                      # clean install, lockfile-exact
npm audit                   # dependency CVEs — record counts by severity
npm run lint                # eslint . — record error/warning count
npm test                    # vitest run — record pass/fail count
npm run build               # tsc -b && vite build — must be clean
```

Then verify the **hardened-bundle invariants** on `dist/`:

```bash
ls dist/assets/*.map                    # MUST be empty (no sourcemaps)
grep -rl "console\.log" dist/assets/*.js  # MUST be empty (console stripped)
du -sh dist/                             # record bundle weight for the report
```

### Phase B — Regression sweep over prior patches

For each previously-patched finding, re-run the *original detection
method* (grep/read — not memory) and record HOLDS / REGRESSED:

| ID | Invariant to re-verify | Method |
|---|---|---|
| C-1 | Every customer-controlled string in contract/invoice/email templates passes `esc()` | grep `esc(` in `src/services/contract.ts`, `invoice.ts`, `supabase/functions/_shared/email-*.ts`; then grep `${` interpolations for unescaped customer fields |
| C-3 | Booking totals recomputed server-side | read `supabase/functions/create-booking/` — client totals must not be trusted |
| H-2/M-8 | No `Math.random`/`Date.now` in ref/invoice-number/token paths | `grep -rn "Math.random" src/ supabase/` and classify every hit |
| H-6 | `mood_boards` not anon-enumerable; token RPC only | read moodboard migration + `src/services/moodboard.ts` |
| H-9 | No permissive anon SELECT on `bookings` | grep policies in all migrations, latest-wins ordering |
| H-10 | `contracts`/`invoices` not anon-readable | read `migrations-2026-06-documents.sql` |
| M-9 | Fallback insert persists discount fields + RLS verifies | read `src/services/booking.ts` + `migrations-2026-06-fix-booking-insert.sql` |
| M-10 | Discount preview rate-limited | read `supabase/functions/discount-preview/` |
| M-11 | Payment result verified server-side via Moyasar secret | read `verify-payment/` + `PaymentResultPage.tsx` |
| L-8 | Storage upload paths use `crypto.randomUUID` | grep `randomUUID` in `journal.ts`, `portfolio.ts` |
| Meta HMAC | wa-webhook verifies `X-Hub-Signature-256` | read `_shared/wa.ts` + `wa-webhook/` |

### Phase C — Fresh-eyes sweep of new/changed surface (since 2026-07-04)

1. `git log --oneline --since=2026-07-03` + `git diff --stat` to enumerate
   the change set; audit **every** touched file, not a sample.
2. New DB surface: `migrations-2026-07-*.sql` — for each table/view/RPC:
   who can SELECT/INSERT/UPDATE/DELETE as `anon`? as `authenticated`?
   Is every `SECURITY DEFINER` function single-purpose, `set search_path`,
   and parameter-keyed (no enumeration)?
3. New pages/components (Films page, Films Manager, album selection,
   TopUpTransfer): XSS, PII, admin-gating (`useAdminAuth` present on every
   admin route), token handling.
4. Storage buckets (`videos` bucket migration): public-read scope, write
   policy, path traversal.
5. Edge Functions diff: CORS headers, error bodies (no stack traces or
   internal detail to anon), secrets only via `Deno.env`.

### Phase D — Cross-cutting security greps (full tree, every audit)

```bash
grep -rn "dangerouslySetInnerHTML\|innerHTML\|document.write" src/
grep -rn "eval(\|new Function(" src/ supabase/
grep -rniE "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][A-Za-z0-9]" src/ --include='*.ts' --include='*.tsx'
grep -rn "service_role" src/          # must be ZERO hits client-side
grep -rn "VITE_" src/ .github/ | sort -u   # enumerate client-exposed env vars — each must be publishable
grep -rn "http://" src/ supabase/     # no cleartext endpoints
```

Each hit is classified: SAFE (with reason) or FINDING (with ID).

### Phase E — Documentation & work-process adequacy review

This is a first-class phase, not an afterthought (it is half the request):

1. **Accuracy:** does `CLAUDE.md` §6 match shipped code? Does the
   migration list in §6 match `database/`? Is `AGENTS.md` handoff current?
2. **Coverage:** does every shipped feature have an operating doc
   (MANUAL.md section) and a design/integration doc where non-obvious?
3. **Process:** are the conventions (one-migration-per-change, UPSERT
   seeds, esc() rule, two-palette rule, commit style, CI gates) actually
   followed in the recent history? Sample the last 10 commits.
4. **Repeatability:** could a new agent run this exact audit from this
   plan alone? Fix the plan if not.

Verdict recorded as ADEQUATE / GAPS (with a list).

### Phase F — Report + PDF + tracker update

1. Write the full report to
   `docs/reviews/2026-07-09-security-code-check.md` (structure in §3).
2. Build the **stationery-themed HTML** edition (spec in §4) and print it
   to PDF with headless Chromium:

   ```bash
   chromium --headless --disable-gpu --no-sandbox \
     --print-to-pdf=docs/reviews/2026-07-09-security-code-check.pdf \
     --no-pdf-header-footer file:///…/report.html
   ```

3. Append a dated **status update** to the top block of `docs/bugs.md`
   (same format as the 2026-07-03 entry): baseline numbers, new findings
   table, regression verdict.
4. Commit in two steps — ① this plan; ② report (md + pdf + report HTML
   source) + `docs/bugs.md` update. Prose-first messages. Push to the
   designated branch.

---

## 3. Report structure (the .md and the PDF share it)

1. **Cover / header** — title, date, commit audited, auditor, scope line.
2. **Executive summary** — one paragraph + verdict banner
   (GREEN / AMBER / RED) an owner can read in 30 seconds.
3. **Static baseline table** — audit/lint/test/build/bundle numbers,
   side-by-side with the 2026-07-03 numbers (drift is signal).
4. **Regression sweep results** — the Phase B table with HOLDS/REGRESSED.
5. **New findings** — bugs.md-style entries (ID, severity, file, defect,
   exploit, fix). Empty section stated explicitly if none.
6. **Documentation & process adequacy** — Phase E verdict + gaps.
7. **Owner actions (live-only)** — SQL still to run, secrets to set,
   advisor checks — carried forward and updated.
8. **Appendix** — commands run, grep classifications, method notes.

## 4. PDF theming specification

The PDF is a **stationery surface** (printed/sent artifact), so per
`CLAUDE.md` §4.1 it wears the `STATIONERY` palette from
`src/theme/stationery.ts` — *not* the noir/ivory screen themes, and
**no hex literal that isn't a STATIONERY token**:

- Page on `paper #F9F5F0`, content card on `card #FFFFFF` with
  `borderHair #E8D9C5` hairlines and the `noirGrad` header band
  (`#1A1A1A → #2C2C2C → #4A3728`) carrying the spaced-letter wordmark in
  `goldHi #E8D9C5`.
- Body ink `#2C2218`, section heads `inkMuted #8C6B4F`, champagne frame
  accents `#C9B393`.
- Severity chips reuse the stationery status tokens (`okBg/okInk`,
  `warnBg/warnIn`) — never Tailwind greens.
- Fonts per stationery map: Cormorant Garamond for display, Tajawal for
  body, Amiri for the wordmark and any Arabic flourish. Import via
  `STATIONERY_FONTS_IMPORT`; if the render environment is offline, the
  stack degrades to serif/sans-serif — acceptable.
- A4, `@page { margin: 14mm }`, print-safe (no ink-heavy full-dark pages
  beyond the header band), tables `page-break-inside: avoid`.
- The HTML source is committed next to the PDF so the next audit can
  re-skin/re-print without reverse-engineering.

## 5. Exit criteria

- [ ] All Phase A gates run; results recorded verbatim.
- [ ] Every prior patch re-verified with an explicit HOLDS/REGRESSED.
- [ ] Every file changed since 2026-07-04 audited.
- [ ] Every grep hit classified SAFE-with-reason or FINDING.
- [ ] Docs/process verdict written with evidence.
- [ ] Report .md + themed .pdf + .html source committed.
- [ ] `docs/bugs.md` status block appended.
- [ ] Any CRITICAL finding: stop, fix or escalate before publishing.

*Authored 2026-07-09. If you re-run this audit later, copy this file to a
new date-stamped plan, update §0/§C baselines, and keep the method.*
