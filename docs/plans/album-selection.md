# Plan — Post-Event Album Selection

> **Status:** proposed (not built). Planning doc only.
> **Author:** system session, 2026-07-03.
> **One-liner:** after a shoot happens, the bride receives a private link to
> choose her album **cover style** from a curated palette; the studio sees her
> choice and produces the album.

---

## 0. Decisions locked (2026-07-03, owner)

These settle the §7 open questions and shape the design below:

- **A "design" = a cover style.** The palette is a set of album *cover* styles
  (not page-layout families). Simplifies the data model and the customer page.
- **Release is manual** for now — Fatima clicks "release + send" after the
  gallery is delivered. A **staged automatic** workflow (auto-release N days
  post-event via the `wa-reminders` cron) comes **later**, not in Phase 1/2.
- **Choice is final once confirmed** — no change window. After the bride
  confirms, the selection locks (studio can still override manually if needed).
- **No price impact** — every cover style is included; selection never changes
  the total, so it stays a scoped `SECURITY DEFINER` RPC and never touches the
  `change-booking` money path.

Still to decide (minor, non-blocking for Phase 1): how many cover styles in the
palette, and the post-event reminder cadence (both belong to Phase 3).

---

## 1. What we're building

A capability-link page — `/#/album/<token>` — that is **dormant until the
event date has passed**, then lets the bride pick one album **design** from a
small, admin-curated palette (cover style + page layout family), optionally
leave a note, and confirm. The studio sees the selection in the admin booking
modal and builds the album from it.

This is deliberately the **same shape** as two things already shipped, so it
reuses proven patterns rather than inventing new ones:

- **Mood Board** (`/#/board/<token>`) — admin-composed, capability-token page,
  `SECURITY DEFINER` RPC for the one anon write, noir theme. See
  `docs/MANUAL.md` §13b and `database/migrations-2026-05-moodboard.sql`.
- **Manage Booking** (`/#/manage/<token>`) — the bride reads her own booking
  through `get_booking_by_token()` and never touches the `bookings` table;
  writes go through the `change-booking` Edge Function as service-role. See
  CLAUDE.md §4.9.

If we mirror those, this feature is mostly assembly, not new architecture.

---

## 2. The one genuinely new rule: time-gating

The album page must be **hidden/inert until `event_date` has passed** (the
shoot has happened — there's nothing to choose before then). Gating must be
**server-enforced**, never just a hidden button:

- The read RPC (`get_album_selection_by_token`) returns `status = 'not_ready'`
  (and no design data) when `now() < event_date`. The page shows a graceful
  "your gallery isn't ready yet" state.
- The write path (Edge Function / RPC) **rejects** a selection when
  `event_date` has not passed, exactly like `reschedule.ts` gates dates today.

Optionally add an admin **"release"** toggle so Fatima can open selection a few
days after delivery rather than the instant midnight ticks over — a
`bookings.album_released_at` timestamp; the gate becomes
`album_released_at is not null OR event_date < now()` (decide in §7).

---

## 3. Data model (new migration `migrations-2026-0X-album.sql`)

Follow the house rules (CLAUDE.md §4.3): new migration file, never edit
`schema.sql`; bilingual `_ar`/`_en` columns; UPSERT-by-stable-id seeds.

```
album_designs                         -- the curated palette (admin-managed)
  id            uuid pk default gen_random_bytes → or serial
  name_ar/en    text                  -- "كلاسيكي مذهّب" / "Gilded Classic"
  blurb_ar/en   text                  -- one-line description
  preview_url   text                  -- /photos/... swatch/mockup (optimised)
  tier          text null             -- optional: which package tiers it suits
  active        bool default true
  sort_order    int

bookings (add columns)
  album_token          text  -- 160-bit secret, encode(gen_random_bytes(20),'hex')
                             --   (same generation as manage_token)
  album_design_id      → album_designs.id  (nullable until chosen)
  album_note           text null           -- bride's free-text (esc() on render)
  album_selected_at    timestamptz null
  album_released_at    timestamptz null    -- optional manual release (see §2)

booking_album_events (optional audit, admin-only SELECT)
  booking_id, action ('released'|'selected'|'changed'), at, detail
```

RLS (mirror the mood-board / discount posture — CLAUDE.md §4.4/§4.8):

- `album_designs`: **anon SELECT allowed** (public palette, no PII) where
  `active`. Admin full access.
- `bookings.album_*`: anon **never** reads `bookings` directly. A
  `SECURITY DEFINER` RPC `get_album_selection_by_token(p_token)` returns only
  `{ status, event_date, chosen_design_id, designs[] }` — never customer PII.
- Writing the choice: a `SECURITY DEFINER` RPC `select_album_design(p_token,
  p_design_id, p_note)` that (a) checks the time gate, (b) validates the design
  is `active`, (c) sets `album_design_id/note/selected_at` on that **one** row.
  Anon can update nothing else. (An Edge Function is overkill here — no money,
  no OTP — so a scoped RPC like `mark_mood_board_viewed` is the right weight.)

---

## 4. Customer page — `/#/album/<token>`

Noir theme, RTL-first, same visual language as the Mood Board page.

States:
1. **Not ready** (`now() < event_date` and not released): a calm holding
   message ("نُجهّز لكِ الخيارات بعد المناسبة" / "Your options open after the
   session"), no palette shown.
2. **Ready, unselected**: grid of `album_designs` cards — each a `<picture>`
   WebP preview (optimised per CLAUDE.md §4.5), bilingual name + blurb, a
   "اختاري هذا التصميم / Choose this design" CTA, optional note field.
3. **Selected (locked)**: shows the chosen cover style and a confirmation
   message. No "change" affordance — the choice is final once confirmed
   (decision §0). Only the studio can override, from the admin modal.

All customer-controlled strings (the note) pass through `esc()` anywhere they
re-render into HTML (contract/invoice discipline, CLAUDE.md §4.4).

---

## 5. Admin side (booking modal)

Add a **4th tab** to the admin booking modal, next to "لوحة المزاج" (Mood
Board):

- Shows the album link + copy button (like the mood-board share), a
  **"release now"** button (sets `album_released_at`), the current selection
  (design name + bride's note) once made, and a status chip
  (not-released / awaiting-choice / chosen).
- Palette management (`album_designs` CRUD) lives in its own admin screen
  (`/admin/album-designs`), mirroring `/admin/addons` and the Packages/
  Portfolio managers — bilingual fields, preview upload, active toggle,
  drag-order.

---

## 6. Delivery / lifecycle

How the bride learns the link exists, post-event:

- **Manual (Phase 1):** Fatima clicks "release + send" in the booking modal;
  reuse the existing channels — email via Zoho SMTP
  (`docs/integrations/email.md`) and/or WhatsApp — sending `album_token`.
- **Automated (later):** extend the existing `wa-reminders` cron
  (`supabase/functions/wa-reminders/`, already runs every 30 min) with an
  "N days after `event_date`, if album unreleased → release + notify" rule.
  This slots into the lifecycle-reminder engine that already exists.

Note: WhatsApp free-form sends only land inside Meta's 24h window — same
constraint that just moved the change-OTP to email. So the **primary** album
notification should be **email**, with WhatsApp as a best-effort extra (or a
proper template if we register one).

---

## 7. Product decisions — RESOLVED (see §0)

| Question | Decision |
|---|---|
| What is a "design"? | **Cover style** (not page layouts) |
| Single vs. shortlist | **Single** — pick one, confirm |
| Release trigger | **Manual** now; staged auto-release later (Phase 3) |
| Change window | **None** — locked once confirmed; studio can override |
| Price impact | **None** — plain RPC, no `change-booking` money path |
| Palette size / reminder cadence | Open, non-blocking — decide during Phase 3 |

---

## 8. Suggested phasing

- **Phase 1 — foundation:** migration (tables + `album_token` backfill),
  `album_designs` admin CRUD, and the admin tab with manual "release + send".
  No customer page yet — validates the palette and data model.
- **Phase 2 — customer page:** `/#/album/<token>` with the three states, the
  two `SECURITY DEFINER` RPCs, time-gating, and selection write. This is the
  core deliverable.
- **Phase 3 — automation & polish:** post-event auto-release via `wa-reminders`,
  reminders, change-window rules, optional paid-upgrade path.

Each phase is independently shippable and testable (the policy bits — time
gate, active-design validation — go in dependency-free `_shared` modules with
unit tests, like `reschedule.ts`/`change.ts`).

---

## 9. Security checklist (must hold before ship)

- [ ] Token is 160-bit CSPRNG (`gen_random_bytes(20)`), the only credential.
- [ ] Anon never SELECTs `bookings`; reads go through the token RPC returning
      **no PII**.
- [ ] Time-gate enforced in **both** the read RPC and the write path.
- [ ] Write RPC/Edge validates the design is `active` and touches only the one
      row's album columns.
- [ ] Bride's note `esc()`-escaped on every render surface.
- [ ] Preview images optimised (`optimise-images.mjs`) and served via
      `<picture>`.
- [x] Selection has **no price impact** (decision §0) → a scoped
      `SECURITY DEFINER` RPC is correct; it must NOT write any monetary column.

---

*This is a plan, not code. Nothing here is implemented yet. Start with the §7
decisions, then Phase 1.*
