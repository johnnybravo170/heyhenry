/**
 * Unit tests for the shared phone helpers (src/lib/phone.ts).
 */

import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone, phoneDigits } from '@/lib/phone';

describe('phoneDigits', () => {
  it('collapses formatting to bare significant digits', () => {
    expect(phoneDigits('(604) 555-0820')).toBe('6045550820');
    expect(phoneDigits('604-555-0820')).toBe('6045550820');
    expect(phoneDigits('6045550820')).toBe('6045550820');
  });
  it('strips the NANP country code', () => {
    expect(phoneDigits('+1 604 555 0820')).toBe('6045550820');
    expect(phoneDigits('1-604-555-0820')).toBe('6045550820');
  });
  it('is null-safe', () => {
    expect(phoneDigits(null)).toBe('');
    expect(phoneDigits(undefined)).toBe('');
    expect(phoneDigits('')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('normalizes every common NANP format to E.164', () => {
    const e164 = '+16045550820';
    for (const input of [
      '(604) 555-0820',
      '604-555-0820',
      '6045550820',
      '1-604-555-0820',
      '+1 604 555 0820',
      ' 604.555.0820 ',
    ]) {
      expect(normalizePhone(input)).toBe(e164);
    }
  });
  it('keeps an international country code', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });
  it('keeps bare digits it cannot confidently parse', () => {
    expect(normalizePhone('911')).toBe('911');
    expect(normalizePhone('555-1234')).toBe('5551234'); // 7-digit, no area code
  });
  it('returns null for empty / no-digit input', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('n/a')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('formats E.164 NANP for display', () => {
    expect(formatPhone('+16045550820')).toBe('(604) 555-0820');
  });
  it('formats bare 10-digit storage too (legacy rows)', () => {
    expect(formatPhone('6045550820')).toBe('(604) 555-0820');
    expect(formatPhone('8888888888')).toBe('(888) 888-8888');
  });
  it('returns international / odd numbers as stored', () => {
    expect(formatPhone('+442079460958')).toBe('+442079460958');
    expect(formatPhone('911')).toBe('911');
  });
  it('is null-safe', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('')).toBe('');
  });
});

describe('normalize + format round-trip', () => {
  it('three messy inputs converge to one display string', () => {
    const inputs = ['+1-604-555-0820', '6045550820', '604-555-0820'];
    const displays = inputs.map((i) => formatPhone(normalizePhone(i)));
    expect(new Set(displays).size).toBe(1);
    expect(displays[0]).toBe('(604) 555-0820');
  });
});
