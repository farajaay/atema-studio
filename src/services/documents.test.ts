import { describe, it, expect } from 'vitest';
import { generateContractHTML, type ContractData } from './contract';
import {
  generateInvoiceHTML,
  generateInvoiceNumber,
  generateZatcaQR,
  type InvoiceData,
} from './invoice';

const XSS = '<script>alert(1)</script>';

function contract(over: Partial<ContractData> = {}): ContractData {
  return {
    customerName: 'فاطمة',
    customerPhone: '+966512345678',
    bookingRef: 'ATEMA-260101-ABCDEFGH',
    bookingId: 'id-1',
    contractDate: '',
    eventDate: '2026-06-01',
    eventTime: '18:00',
    packageNameAr: 'كلاسيك',
    packageNameEn: 'Classic',
    location: 'Jubail',
    durationHours: 4,
    subtotal: 3000,
    vat: 450,
    total: 3450,
    deposit: 1725,
    remaining: 1725,
    addons: [],
    ...over,
  };
}

function invoice(over: Partial<InvoiceData> = {}): InvoiceData {
  return {
    invoiceNumber: 'INV-2601-ABCDE',
    bookingRef: 'ATEMA-260101-ABCDEFGH',
    bookingId: 'id-1',
    issueDate: '2026-01-01T00:00:00.000Z',
    customerName: 'فاطمة',
    customerPhone: '+966512345678',
    packageNameAr: 'كلاسيك',
    packageNameEn: 'Classic',
    addons: [],
    subtotal: 3000,
    vat: 450,
    total: 3450,
    paymentMethod: 'transfer',
    ...over,
  };
}

describe('HTML escaping (Patch C-1 — do not regress)', () => {
  it('escapes customer-controlled values in the contract', () => {
    const html = generateContractHTML(contract({ customerName: XSS }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes customer-controlled values in the invoice', () => {
    const html = generateInvoiceHTML(invoice({ customerName: XSS }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes addon names in the contract', () => {
    const html = generateContractHTML(contract({ addons: ['<img src=x onerror=1>'] }));
    expect(html).not.toContain('<img src=x onerror=1>');
    expect(html).toContain('&lt;img');
  });
});

describe('generateZatcaQR', () => {
  it('TLV-encodes seller name as tag 1 with a length prefix', () => {
    const b64 = generateZatcaQR({
      sellerName: 'ATEMA',
      vatNumber: '300000000000003',
      timestamp: '2026-01-01T00:00:00Z',
      total: 3450,
      vat: 450,
    });
    const bytes = Buffer.from(b64, 'base64');
    expect(bytes[0]).toBe(1);                          // tag 1 = seller name
    expect(bytes[1]).toBe('ATEMA'.length);             // length prefix
    expect(bytes.subarray(2, 2 + 5).toString('utf8')).toBe('ATEMA');
  });
});

describe('generateInvoiceNumber', () => {
  it('matches the INV-YYMM-XXXXX Crockford format', () => {
    const n = generateInvoiceNumber();
    expect(n).toMatch(/^INV-\d{4}-[0-9A-Z]{5}$/);
    // Crockford excludes I, L, O, U
    expect(n.slice(8)).not.toMatch(/[ILOU]/);
  });

  it('is unique across many calls', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateInvoiceNumber()));
    expect(seen.size).toBe(500);
  });
});
