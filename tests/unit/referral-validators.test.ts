/**
 * Unit tests for the referral Zod validators.
 */

import { describe, expect, it } from 'vitest';
import { referralEmailSchema, referralSMSSchema } from '@/lib/validators/referral';

describe('referralEmailSchema', () => {
  it('accepts a valid email', () => {
    const result = referralEmailSchema.safeParse({ email: 'contractor@example.com' });
    expect(result.success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const result = referralEmailSchema.parse({ email: '  Foo@BAR.com  ' });
    expect(result.email).toBe('foo@bar.com');
  });

  it('rejects an invalid email', () => {
    const result = referralEmailSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = referralEmailSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });
});

describe('referralSMSSchema', () => {
  it('accepts a valid E.164 phone number', () => {
    const result = referralSMSSchema.safeParse({ phone: '+16045551234' });
    expect(result.success).toBe(true);
  });

  it('rejects a phone without leading +', () => {
    const result = referralSMSSchema.safeParse({ phone: '16045551234' });
    expect(result.success).toBe(false);
  });

  it('rejects a phone starting with +0', () => {
    const result = referralSMSSchema.safeParse({ phone: '+06045551234' });
    expect(result.success).toBe(false);
  });

  it('rejects a phone with letters', () => {
    const result = referralSMSSchema.safeParse({ phone: '+1604abc1234' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = referralSMSSchema.safeParse({ phone: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a phone with dashes (non-E.164)', () => {
    const result = referralSMSSchema.safeParse({ phone: '+1-604-555-1234' });
    expect(result.success).toBe(false);
  });
});
