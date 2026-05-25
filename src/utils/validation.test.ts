import { describe, it, expect } from 'vitest';
import {
  normalizeSaudiMobile,
  validSaudiMobile,
  validEmail,
  isFutureOrToday,
  clampText,
} from './validation';

describe('normalizeSaudiMobile', () => {
  it('accepts the documented input forms and normalises to E.164', () => {
    expect(normalizeSaudiMobile('+966512345678')).toBe('+966512345678');
    expect(normalizeSaudiMobile('966512345678')).toBe('+966512345678');
    expect(normalizeSaudiMobile('00966512345678')).toBe('+966512345678');
    expect(normalizeSaudiMobile('0512345678')).toBe('+966512345678');
    expect(normalizeSaudiMobile('512345678')).toBe('+966512345678');
  });

  it('tolerates spaces, dashes and parentheses', () => {
    expect(normalizeSaudiMobile('05 12-34 56 78')).toBe('+966512345678');
    expect(normalizeSaudiMobile('+966 (51) 234-5678')).toBe('+966512345678');
  });

  it('rejects malformed or non-Saudi numbers', () => {
    expect(normalizeSaudiMobile('')).toBeNull();
    expect(normalizeSaudiMobile('0412345678')).toBeNull();   // not a 5x mobile
    expect(normalizeSaudiMobile('051234567')).toBeNull();    // too short
    expect(normalizeSaudiMobile('05123456789')).toBeNull();  // too long
    expect(normalizeSaudiMobile('+14155550123')).toBeNull(); // US number
    expect(normalizeSaudiMobile('not a phone')).toBeNull();
  });

  it('validSaudiMobile mirrors the boolean outcome', () => {
    expect(validSaudiMobile('0512345678')).toBe(true);
    expect(validSaudiMobile('garbage')).toBe(false);
  });
});

describe('validEmail', () => {
  it('treats empty as valid (email is optional)', () => {
    expect(validEmail('')).toBe(true);
  });

  it('accepts plausible addresses', () => {
    expect(validEmail('fatima@example.com')).toBe(true);
    expect(validEmail('a.b+tag@sub.domain.sa')).toBe(true);
  });

  it('rejects the common mistakes', () => {
    expect(validEmail('no-at-sign')).toBe(false);
    expect(validEmail('two@@at.com')).toBe(false);
    expect(validEmail('missing@tld')).toBe(false);
    expect(validEmail('has space@x.com')).toBe(false);
    expect(validEmail('@nolocal.com')).toBe(false);
    expect(validEmail('trailing@dot.')).toBe(false);
    expect(validEmail('lead@.dot')).toBe(false);
    expect(validEmail('x'.repeat(255) + '@x.com')).toBe(false);
  });
});

describe('isFutureOrToday', () => {
  it('accepts today and future dates', () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(isFutureOrToday(iso)).toBe(true);
    expect(isFutureOrToday('2999-01-01')).toBe(true);
  });

  it('rejects past dates, empty and garbage', () => {
    expect(isFutureOrToday('2000-01-01')).toBe(false);
    expect(isFutureOrToday('')).toBe(false);
    expect(isFutureOrToday('not-a-date')).toBe(false);
  });
});

describe('clampText', () => {
  it('trims and returns short values unchanged', () => {
    expect(clampText('  hello  ', 100)).toBe('hello');
    expect(clampText('', 10)).toBe('');
  });

  it('slices values that exceed the max', () => {
    expect(clampText('abcdef', 3)).toBe('abc');
  });
});
