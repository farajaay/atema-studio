// ATEMA STUDIO — payment channel facts, shared by every surface that shows
// them (booking transfer flow, manage-page top-up, future invoices/emails).
// Single source of truth: the IBAN also appears on /policy and in the
// anti-impersonation copy — if the account ever changes, change it HERE and
// grep for the old value across docs.

export const BANK = {
  name:     'بنك الراجحي',
  nameEn:   'Al Rajhi Bank',
  iban:     'SA0380000000329608010885626',
  account:  '329608010885626',
  holder:   'فاطمة بوحسن',
  holderEn: 'Fatima Bohassan',
} as const;

export const WHATSAPP_NUMBER = '966548323496';
