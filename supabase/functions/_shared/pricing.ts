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
