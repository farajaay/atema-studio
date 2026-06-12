// ATEMA STUDIO — document regeneration (contract + ZATCA tax invoice).
//
// At booking time the documents are generated from the in-flow state
// (BookingPage handleSubmit). After the booking changes — a self-service
// package change via /#/manage/<token>, or an admin edit — those artifacts
// go stale. This service rebuilds both from the booking's CURRENT state and
// appends new versions to the contracts/invoices tables (append-only; the
// latest row per booking is the live document — see
// migrations-2026-06-documents.sql).
//
// The builders are pure (booking row + catalogue rows in, document data out)
// so the math is unit-testable; the async wrappers do the IO.

import { supabase } from './supabase';
import { generateContractHTML, saveContract, type ContractData } from './contract';
import {
  generateInvoiceHTML, generateInvoiceNumber, saveInvoice,
  type InvoiceData,
} from './invoice';
import type { AppSettings } from './settings';

/** The booking columns regeneration needs — matches the admin Booking shape. */
export interface RegenBooking {
  id:              string;
  booking_ref:     string;
  customer_name:   string;
  customer_phone:  string;
  package_id:      number;
  addon_ids:       string[];
  event_date:      string;
  event_time:      string;
  location?:       string;
  subtotal:        number;
  vat:             number;
  total:           number;
  payment_status:  'unpaid' | 'awaiting_transfer' | 'paid' | 'refunded';
  discount_code?:   string | null;
  discount_amount?: number | null;
  discount_kind?:   'percent' | 'flat' | null;
}

export interface RegenPackage {
  name_ar:           string;
  name_en:           string;
  duration_hours:    number;
  edited_photos?:    number | null;
  editorial_photos?: number | null;
}

export interface RegenAddon {
  id:      string;
  name_ar: string;
  name_en: string;
  price:   number;
}

/** Rebuild the discount block from the persisted booking columns. The code's
 *  raw percent value isn't stored, so for percent codes it is reconstructed
 *  from amount / gross — close enough for the document line. */
function rebuildDiscount(b: RegenBooking): ContractData['discount'] {
  if (!b.discount_code || !b.discount_amount || b.discount_amount <= 0) return null;
  const gross = b.subtotal + b.discount_amount;
  const kind = b.discount_kind === 'percent' ? 'percent' as const : 'flat' as const;
  return {
    code:   b.discount_code,
    amount: b.discount_amount,
    kind,
    value:  kind === 'percent'
      ? Math.round((b.discount_amount / Math.max(1, gross)) * 100)
      : b.discount_amount,
  };
}

export function buildContractData(
  b: RegenBooking, pkg: RegenPackage, addons: RegenAddon[], now: Date = new Date(),
): ContractData {
  const deposit = Math.round(b.total * 0.5);
  const discount = rebuildDiscount(b);
  return {
    customerName:    b.customer_name,
    customerPhone:   b.customer_phone,
    bookingRef:      b.booking_ref,
    bookingId:       b.id,
    contractDate:    now.toISOString().split('T')[0],
    eventDate:       b.event_date,
    eventTime:       b.event_time,
    packageNameAr:   pkg.name_ar,
    packageNameEn:   pkg.name_en,
    location:        b.location || '',
    durationHours:   pkg.duration_hours,
    editedPhotos:    pkg.edited_photos ?? 0,
    editorialPhotos: pkg.editorial_photos ?? 0,
    subtotal: b.subtotal, vat: b.vat, total: b.total,
    deposit,
    remaining: b.total - deposit,
    addons: addons.map(a => a.name_ar),
    discount,
    grossSubtotal: discount ? b.subtotal + discount.amount : undefined,
  };
}

export function buildInvoiceData(
  b: RegenBooking, pkg: RegenPackage, addons: RegenAddon[],
  invoiceNumber: string, settings?: AppSettings, now: Date = new Date(),
): InvoiceData {
  const deposit  = Math.round(b.total * 0.5);
  const discount = rebuildDiscount(b);
  return {
    invoiceNumber,
    bookingRef:    b.booking_ref,
    bookingId:     b.id,
    issueDate:     now.toISOString(),
    customerName:  b.customer_name,
    customerPhone: b.customer_phone,
    packageNameAr: pkg.name_ar,
    packageNameEn: pkg.name_en,
    addons:        addons.map(a => ({ name: a.name_ar, price: a.price })),
    subtotal: b.subtotal, vat: b.vat, total: b.total,
    // The method isn't stored on the booking; the explicit paymentState
    // drives the badge instead so a paid booking never reads "pending".
    paymentMethod: 'pending',
    paymentState:  b.payment_status === 'paid' ? 'paid'
                 : b.payment_status === 'awaiting_transfer' ? 'awaiting_transfer'
                 : 'pending',
    depositPaid:   b.payment_status === 'paid' ? deposit : 0,
    settings,
    discount,
    grossSubtotal: discount ? b.subtotal + discount.amount : undefined,
  };
}

export interface RegeneratedDocuments {
  contractHTML:  string;
  invoiceHTML:   string;
  invoiceNumber: string;
}

/** Rebuild both documents from the booking's current state and append them
 *  as new versions. Returns the fresh HTML (or null when offline / the
 *  package row can't be found). */
export async function regenerateDocuments(
  b: RegenBooking, settings?: AppSettings,
): Promise<RegeneratedDocuments | null> {
  if (!supabase) return null;

  const [pkgRes, addonRes] = await Promise.all([
    supabase.from('packages')
      .select('name_ar, name_en, duration_hours, edited_photos, editorial_photos')
      .eq('id', b.package_id).maybeSingle(),
    (b.addon_ids?.length
      ? supabase.from('addons').select('id, name_ar, name_en, price').in('id', b.addon_ids)
      : Promise.resolve({ data: [] as RegenAddon[], error: null })),
  ]);
  const pkg = pkgRes.data as RegenPackage | null;
  if (!pkg) return null;
  const addons = (addonRes.data ?? []) as RegenAddon[];

  const contractHTML  = generateContractHTML(buildContractData(b, pkg, addons));
  const invoiceNumber = generateInvoiceNumber();
  const invoiceHTML   = generateInvoiceHTML(
    buildInvoiceData(b, pkg, addons, invoiceNumber, settings));

  await Promise.all([
    saveContract(b.id, b.booking_ref, contractHTML),
    saveInvoice(b.id, b.booking_ref, invoiceNumber, invoiceHTML, b.total),
  ]);
  return { contractHTML, invoiceHTML, invoiceNumber };
}

export interface LatestDocuments {
  contract: { content_html: string; created_at: string } | null;
  invoice:  { content_html: string; invoice_number: string; created_at: string } | null;
}

/** The newest stored version of each document for a booking (admin-only —
 *  the tables are authenticated-SELECT). */
export async function fetchLatestDocuments(bookingId: string): Promise<LatestDocuments> {
  if (!supabase) return { contract: null, invoice: null };
  const [c, i] = await Promise.all([
    supabase.from('contracts')
      .select('content_html, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('invoices')
      .select('content_html, invoice_number, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    contract: (c.data as LatestDocuments['contract']) ?? null,
    invoice:  (i.data as LatestDocuments['invoice'])  ?? null,
  };
}
