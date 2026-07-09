# ATEMA STUDIO — Full Security & Code Check

> **Date:** 2026-07-09
> **Commit audited:** `203e6b9` (tip of master, 2026-07-04 "Hand off back to Codex")
> **Auditor:** Claude Code (Anthropic) — static analysis + tool execution
> **Plan followed:** `docs/plans/security-code-check-2026-07.md`
> **Editions:** this file (canonical) · `2026-07-09-security-code-check.pdf`
> (stationery-themed, for the owner's file) · `.report-src.html` (PDF source)
>
> **Scope:** whole repo at HEAD — frontend, Edge Functions, every SQL
> migration, CI workflows, dependencies, and a documentation/process
> adequacy review. **Not covered:** live Supabase state (advisor, deployed
> function versions), real payments/sends, browser E2E — listed as owner
> actions in §7.

---

## 1. Executive summary — verdict: 🟠 AMBER

The codebase is in strong shape: every previously-patched finding
(C-1 → M-11, H-10, L-8) **holds with zero regressions**, all mechanical
gates are green (lint clean, 143/143 tests, clean type-checked build,
hardened bundle), and the two July P0 migrations correctly closed the
bookings PII leak discovered during album verification.

The pass surfaced **one new HIGH finding (H-11)**: the RLS policy that
lets the transfer screen mark a booking `awaiting_transfer` is row-level,
not column-level — so anyone holding the public anon key can blind-update
**every column** (including `manage_token`, `customer_email`, `total`,
`event_date`) on any booking still in the `pending` + `unpaid` window.
That is a booking-takeover and PII-tamper vector and should be patched
before the next real booking campaign. One MEDIUM (latent phishing relay
in `send-whatsapp`, dormant while `wa_enabled` is off), one LOW (JSON-LD
script-breakout on admin-authored journal content), and two process gaps
(July migrations missing from the CI manifest; the P0 fix untracked in
`docs/bugs.md`) round out the findings. Two dependency advisories
published since the last audit were **fixed in this pass** (`npm audit`
now 0).

Amber, not red: H-11's exposure window is the transient pending/unpaid
state, the attacker writes blind (no anon read exists any more), and the
fix is a ~30-minute RPC swap. But it is real money-and-PII surface and is
the top action item.

---

## 2. Static baseline (Phase A)

| Gate | 2026-07-03 baseline | This pass (2026-07-09) |
|---|---|---|
| `npm audit` | 0 vulnerabilities | **2 found** (vite HIGH — Windows-only dev-server; @babel/core LOW — dev-time) → **`npm audit fix` applied → 0** |
| `npm run lint` | clean | **clean** |
| `npm test` | 139/139 | **143/143** (16 files) |
| `npm run build` (`tsc -b` + vite) | clean | **clean** |
| Sourcemaps in `dist/` | 0 | **0** |
| `console.log` in bundle | 0 | **0** |
| JS bundle weight | — | **1.3 MB raw / ~367 KB gzip** (25 chunks) |
| Static payload note | — | `dist/videos` = **203 MB** — see §7 (Storage-sync sequence pending) |

Both dependency advisories were published upstream after 2026-07-03; the
fix is a lockfile-only patch bump (vite 8.0.x → patched, 31 packages),
committed with this report. Neither advisory affects the production
bundle — both are dev-server/build-time and one is Windows-only.

---

## 3. Regression sweep — all prior patches HOLD (Phase B)

| ID | Invariant | Verdict | Evidence |
|---|---|---|---|
| C-1 | Customer strings escaped in all HTML templates | **HOLDS** | `esc()` ×16 in `contract.ts`, ×14 in `invoice.ts`, ×8/×11/×4 in the three email renderers |
| C-3 | Totals recomputed server-side | **HOLDS** | `create-booking/index.ts:164` recompute block; client never trusted for money |
| H-2 / M-8 | No `Math.random`/`Date.now` in ref, invoice-number, or token paths | **HOLDS** | Only remaining `Math.random` mentions are patch comments; refs/tokens use `crypto.getRandomValues`, uploads use `crypto.randomUUID` (L-8) |
| H-6 | `mood_boards` not anon-enumerable | **HOLDS** | Client reads via `get_mood_board_by_token` RPC (`moodboard.ts:224`) |
| H-9 | No anon SELECT on `bookings` | **HOLDS, re-hardened** | `migrations-2026-07-bookings-pii-lockdown.sql` drops every anon/public SELECT policy incl. a catch-all `pg_policies` loop; companion definer-view migration keeps the DatePicker working via safe projection |
| H-10 | `contracts`/`invoices` admin-only SELECT | **HOLDS** | `migrations-2026-06-documents.sql:73-77` |
| M-9 | Fallback insert persists discount audit fields | **HOLDS** | `booking.ts:314-316` |
| M-10 | Discount preview rate-limited | **HOLDS** | `discount-preview/index.ts` per-IP token-bucket, 429 on breach |
| M-11 | Payment result verified server-side | **HOLDS** | `verify-payment` fetches Moyasar with secret key, checks `metadata.booking_id` |
| Meta HMAC | `wa-webhook` verifies `X-Hub-Signature-256` | **HOLDS** | `_shared/wa.ts:163` + `wa-webhook/index.ts:48-50` |
| Bundle hardening | terser + mangle + `drop_console` + no sourcemap | **HOLDS** | `vite.config.ts:16-37`, verified on built output |

The July P0 pair (`bookings-pii-lockdown` + `public-booked-dates-definer`)
is well-designed: explicit drops, a catch-all loop that can't touch the
authenticated policy, and the view converted to definer-semantics safe
projection instead of re-widening table RLS. It is, however, **untracked**
— see DOC-2.

---

## 4. New findings (Phase C + D)

### 🟠 H-11 · Anon UPDATE on `bookings` is column-unrestricted — takeover/tamper window
- **Files:** `database/migrations-2026-05-rls-hardening.sql:140-149`
  (policy "Anon update — payment intent only"; mirrored in
  `bundle-existing-db.sql:223-232`) · legitimate consumer at
  `src/components/BankTransferPayment.tsx:140-142`.
- **Defect:** RLS policies are row-level. The policy's `USING` gates
  which *rows* anon may update (`status='pending' and
  payment_status='unpaid'`) and `WITH CHECK` constrains the post-image of
  only three columns — it does **not** restrict *which columns* change.
  Anyone with the anon key (public, baked into the bundle) can issue
  `PATCH /rest/v1/bookings?status=eq.pending&payment_status=eq.unpaid`
  setting **any** column on **all** matching rows: overwrite
  `manage_token`/`album_token` to a known value (→ self-service page
  takeover, then OTP-gated actions against a `customer_email` they also
  just overwrote), null out `total`/`deposit`, move `event_date`, or
  corrupt PII. Writes are blind (the July lockdown removed anon SELECT,
  so nothing is returned), but blind mass-overwrite is enough.
- **Exposure window:** rows between creation and the bride choosing a
  payment path — transient per booking, but always open for whichever
  bookings are in flight, and an attacker can poll.
- **Severity:** HIGH — same class as H-9/H-10 (row-level policy treated
  as if column-level), now on the write side.
- **Fix (~30 min):** drop the anon UPDATE policy and replace the one
  legitimate use with a single-purpose `SECURITY DEFINER` RPC, mirroring
  the `mark_mood_board_viewed` pattern:
  ```sql
  drop policy if exists "Anon update — payment intent only" on public.bookings;
  create or replace function public.mark_awaiting_transfer(p_booking_id uuid)
  returns boolean language sql security definer set search_path = public as $$
    update public.bookings
       set payment_status = 'awaiting_transfer', payment_method = 'bank_transfer'
     where id = p_booking_id and status = 'pending' and payment_status = 'unpaid'
     returning true;
  $$;
  grant execute on function public.mark_awaiting_transfer(uuid) to anon, authenticated;
  ```
  Then switch `BankTransferPayment.tsx` to
  `supabase.rpc('mark_awaiting_transfer', { p_booking_id: bookingId })`.
  If card payments are ever re-enabled, add the equivalent for that path.

### 🟡 M-12 · `send-whatsapp` has no caller authorisation — latent phishing relay
- **File:** `supabase/functions/send-whatsapp/index.ts`
- **Defect:** the function accepts `phone`, `name`, `bookingRef`, `total`,
  and `manageLink` (an **arbitrary URL**) from the request body with no
  authorisation beyond Supabase's default JWT gate, which the public anon
  key satisfies. Anyone can make the studio's WhatsApp number send a
  legitimate-looking booking confirmation containing an attacker-chosen
  "إدارة حجزك" link to any phone — a phishing relay wearing ATEMA's brand.
- **Why not HIGH today:** dormant. `wa_enabled` defaults to off (function
  returns `skipped` before composing) and the Twilio secrets are unset.
  It becomes live the day the owner flips the WhatsApp switch.
- **Fix:** require an internal shared secret (e.g. reuse the `CRON_SECRET`
  pattern: caller sends `x-internal-token`, function compares
  constant-time) and have `create-booking` — its only legitimate caller —
  pass it. Alternatively accept only a service-role JWT. **Gate this into
  the WA-activation checklist in `docs/integrations/wa-platform.md` §6 so
  the switch can't be flipped before the patch.**
- **Also noted:** the function sends via **Twilio**, while every doc and
  the rest of the WA stack (`_shared/wa.ts`) speak **Meta Cloud API** —
  legacy implementation drift worth reconciling when touched.

### 🟢 L-11 · JSON-LD `JSON.stringify` allows `</script>` breakout on journal content
- **File:** `src/pages/JournalPostPage.tsx:184-204`
- **Defect:** post title/excerpt are serialised with `JSON.stringify`
  into a `<script type="application/ld+json">` via
  `dangerouslySetInnerHTML`. `JSON.stringify` does not escape `/`, so a
  journal field containing the literal `</script>` terminates the script
  element and injects markup — stored XSS. Input is admin-authored only
  (single trusted admin), hence LOW; it's a defence-in-depth gap of the
  same species as C-1.
- **Fix (1 line):** wrap the serialisation:
  `JSON.stringify(...).replace(/</g, '\\u003c')`.

### 🟡 DOC-1 · CI migration manifest frozen at June 2026 (process)
- **File:** `.github/workflows/supabase-migrations.yml:87-131`
- **Defect:** the explicit ordered manifest ends at
  `migrations-2026-06-fix-booking-insert.sql`. None of the **nine July
  migrations** — including the **P0 `bookings-pii-lockdown`** and its
  companion definer-view fix — are listed; the workflow would warn
  "on disk but not in manifest (skipping)" and silently not apply them.
  The workflow is currently disabled (2026-07-03, owner request), which
  contains the risk, but the manifest is now a trap for whoever
  re-enables it.
- **Fix:** append the July files in dependency order (lockdown before
  definer-view; album before album-examples) or add a top-of-manifest
  banner stating it is frozen and hand-run only.

### 🟢 DOC-2 · P0 PII-lockdown fix is untracked in the audit trail (process)
- **Defect:** the July P0 (anon could read the whole `bookings` table
  incl. `manage_token`/`album_token`) exists **only** as comments inside
  the two migration files. No `docs/bugs.md` tracker ID, no mention in
  `CLAUDE.md` §6's owner run-list, no review report. The tracker's value
  is that severities and fixes survive context loss — the most severe
  finding of the July cycle shouldn't live outside it.
- **Fix:** tracked as of this report (entered in `docs/bugs.md` as
  **H-12 retro-entry**, status fixed-pending-live-verify); the two
  migrations added to `CLAUDE.md` §6's run-list should follow with the
  H-11 patch migration.

### ✅ Classified SAFE (grep hits with reasons — Phase D appendix, §8)
No hardcoded secrets; no `service_role` in client code; the three
`dangerouslySetInnerHTML` sites besides L-11 render hardcoded constants
(M-1 guard comments present); `Access-Control-Allow-Origin: *` on Edge
Functions is acceptable (no cookie auth — capability tokens + server
checks); the only `http://` literal is an SVG namespace; all three
`VITE_*` vars are publishable by design.

---

## 5. Fresh-eyes review of post-2026-07-04 surface

Commits since the last integrity report (`ef264c4` film streams,
`1be3dbf` image-weight shed, `d6f91d5`/`203e6b9` docs): reviewed in full.
The film-streams work moved HLS delivery to Supabase Storage with a repo
fallback and a sync workflow using existing repo secrets — no new trust
boundary. Image-weight commit is binary-only. The `videos` Storage bucket
migration is public-read with no write policy (write = service-role via
workflow only) — correct. Album RPCs (`get_album_selection_by_token`,
`select_album_design`) are exemplary: token-keyed, column-scoped,
server-enforced time-gate and lock, `set search_path`. Films table:
public SELECT is `published`-filtered; writes admin-only.

---

## 6. Documentation & work-process adequacy (Phase E) — verdict: **ADEQUATE, with 2 gaps**

**What's working (verified, not assumed):**
- **Accuracy:** `CLAUDE.md`/`AGENTS.md`/`PROJECT.md` match shipped code on
  every claim sampled (launch decisions, feature list, folder map, §4
  conventions vs actual code patterns). `AGENTS.md` handoff is current at
  tip.
- **Coverage:** every shipped feature has an operating doc; integrations
  each have a deep-dive; the two-palette rule, esc() rule, migration
  discipline, and UPSERT-seed rule are all *actually followed* in the
  last 10 commits (sampled).
- **Process:** one-feature-one-commit with prose-first messages holds
  across recent history; CI gates (test → build → deploy) are real; the
  bugs tracker carried every pre-July finding with IDs, severities, and
  commits — this report format is itself reproducible from the plan file.

**The 2 gaps** are DOC-1 (manifest drift) and DOC-2 (untracked P0) above —
both are instances of the same root cause: the July cycle patched faster
than it documented. Neither invalidates the process; both are cheap to
close and DOC-2 is closed by this report.

---

## 7. Owner actions (live-only — cannot be verified from this container)

1. **Confirm the P0 pair ran in production**: `bookings-pii-lockdown` then
   `public-booked-dates-definer` (both idempotent). Smoke:
   `GET /rest/v1/bookings?select=customer_phone&limit=1` as anon → `[]`;
   `GET /rest/v1/public_booked_dates?select=*&limit=1` → rows.
2. **Apply the H-11 patch** once written (new migration + redeployed
   bundle) — until then, be aware of the pending/unpaid tamper window.
3. Before ever enabling WhatsApp: apply the M-12 caller-auth patch and
   redeploy `send-whatsapp`.
4. Supabase advisor: re-run linter after H-11; verify deployed Edge
   Function versions match `master`.
5. `dist/videos` 203 MB still ships with every deploy — complete the
   4-step Storage-sync sequence in `AGENTS.md`, then delete
   `public/videos/`.
6. LAUNCH15 expiry check (carried from CLAUDE.md §6) — retire or replace.

---

## 8. Appendix — method record

Commands run (all from repo root, clean `npm ci --ignore-scripts`;
`ffmpeg-static` postinstall blocked by the sandbox proxy, irrelevant to
build/test): `npm audit` (before + after fix) · `npm run lint` ·
`npm test` · `npm run build` · sourcemap/console greps over `dist/` ·
the Phase B/D grep batteries from the plan §2 · full read of
`migrations-2026-07-*.sql`, `send-whatsapp`, `verify-payment`,
`discount-preview`, `create-booking` recompute block,
`BankTransferPayment`, `JournalPostPage` JSON-LD block, all six workflow
files. Findings H-11/M-12/L-11 each traced to exact file:line and
confirmed against the live policy/code text quoted above — none are
inferred from docs.
