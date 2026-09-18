// ATEMA STUDIO — Authoritative booking-total arithmetic (Patch C-3).
//
// Extracted from create-booking/index.ts so the money math that the audit
// hardened ("a crafted POST must never be able to record a 14,000 SAR booking
// with total=1 SAR") can be unit-tested in isolation. The Edge Function feeds
// these helpers values it has independently fetched from the packages / addons
// / app_settings tables — the client is never trusted for a monetary figure.
//
// Dependency-free (no Deno globals, no remote imports) so it imports cleanly in
// both the Deno edge runtime and a Node/Vitest test process.

export const VAT_RATE = 0.15;

/** Sum the prices of ONLY the active add-ons. Inactive rows contribute 0 so a
 *  retired add-on can't be priced into a new booking. */
export function sumActiveAddons(addons: Array<{ price: number; active: boolean }>): number {
  let total = 0;
  for (const a of addons) if (a.active) total += a.price;
  return total;
}

/** Clamp a redeemed discount to [0, grossSubtotal] and coerce non-numbers to 0,
 *  so a discount can neither go negative nor exceed the booking value. */
export function clampDiscount(applied: number, grossSubtotal: number): number {
  return Math.max(0, Math.min(Number(applied) || 0, grossSubtotal));
}

/** Recompute net subtotal, VAT and grand total from a gross subtotal.
 *  VAT is charged on the post-discount (net) subtotal per ZATCA Phase-1. */
export function computeBookingTotals(opts: {
  grossSubtotal: number;
  discountAmount?: number;
  vatEnabled?: boolean;
}): { subtotal: number; vat: number; total: number } {
  const discountAmount = clampDiscount(opts.discountAmount ?? 0, opts.grossSubtotal);
  const subtotal = Math.max(0, opts.grossSubtotal - discountAmount);
  const vatEnabled = opts.vatEnabled ?? true;
  const vat = vatEnabled ? Math.round(subtotal * VAT_RATE) : 0;
  return { subtotal, vat, total: subtotal + vat };
}

/** The «بدون طباعة» option: a fixed riyal amount off the package price when
 *  the bride keeps the coverage and the full digital delivery but skips the
 *  printed album (Sept 2026 — enabled on الكلاسيكية + الملكية only).
 *
 *  Three guards, and every one of them is load-bearing on a public surface:
 *    · `enabled` is the package's own `no_print_enabled` flag — a client that
 *      POSTs `noPrint: true` against a tier that doesn't offer the choice
 *      gets the full price, not a discount;
 *    · the discount is read from the package row, never from the request —
 *      same posture as the package price itself (Patch C-3);
 *    · it is clamped to [0, price) so a mis-typed admin value can't produce a
 *      free or negative booking even if the DB check were somehow bypassed.
 *
 *  Returns the package's gross contribution — add-ons and the city fee are
 *  layered on top by the caller. */
export function grossForPackage(opts: {
  price: number;
  noPrint?: boolean;
  noPrintEnabled?: boolean;
  noPrintDiscount?: number;
}): number {
  const price = Math.max(0, Number(opts.price) || 0);
  if (!opts.noPrint || !opts.noPrintEnabled) return price;
  const raw = Number(opts.noPrintDiscount) || 0;
  const discount = Math.max(0, Math.min(raw, Math.max(0, price - 1)));
  return price - discount;
}

/** Did this booking actually take the no-print option? True only when the
 *  bride asked for it AND the package offers it — the one predicate the
 *  contract, the invoice, the workflow ladder and the album link all read, so
 *  none of them can disagree about whether an album is being printed. */
export function isNoPrint(opts: {
  noPrint?: boolean;
  noPrintEnabled?: boolean;
}): boolean {
  return Boolean(opts.noPrint && opts.noPrintEnabled);
}
