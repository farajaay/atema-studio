// ATEMA STUDIO — shared UI constants.
//
// NOTE (2026-07-03, system hardening review): the package / add-on / city
// catalogues that used to live here were removed. They were dead code —
// nothing imported them — and, worse, they carried the PRE-overhaul price
// list (Engagement 1,855 · Classic 4,200 · Royal 6,900 · Couture 14,000),
// which is wrong since the May-2026 margin-based pricing overhaul. Keeping a
// second, stale copy of the price list is a foot-gun: a future edit could
// wire it up and quietly ship the old numbers.
//
// The single sources of truth for the catalogue are:
//   • Live data:     the `packages` / `addons` Supabase tables
//   • DB seed:       database/seed-packages-2026-05.sql
//   • Client fallback (used only when the tables are empty):
//                    src/hooks/usePackagesData.ts + src/hooks/useAddonsData.ts
//   • City fees:     supabase/functions/_shared/validation.ts (CITY_FEES),
//                    mirrored in the CITIES list inside src/pages/BookingPage.tsx
//   • Server money:  supabase/functions/_shared/pricing.ts (authoritative)
//   • Margins/P&L:   docs/PROFITABILITY.md §4

// ===== THEME COLORS =====
// Legacy palette retained for backwards compatibility. Values now point at the
// theme CSS custom properties (set by applyTheme via useTheme), so any element
// styled with these tokens automatically follows the active theme — no rewrite
// required on the consuming components.
export const ATEMA_COLORS = {
  champagne:      'var(--a-gold)',
  warmSand:       'var(--a-gold-deep)',
  deepBronze:     'var(--a-gold-deep)',
  softIvory:      'var(--a-bg)',
  editorialBlack: 'var(--a-heading)',
  lightGray:      'var(--a-surface-alt)',
};

// ===== VAT RATE =====
// Display-only mirror of the authoritative rate in
// supabase/functions/_shared/pricing.ts (server recomputes every total).
export const VAT_RATE = 0.15; // 15% Saudi VAT
