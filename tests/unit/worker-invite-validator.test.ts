/**
 * Unit tests for the worker signup Zod validator.
 */

import { describe, expect, it } from 'vitest';
import { workerSignupSchema } from '@/lib/validators/worker-invite';

describe('workerSignupSchema', () => {
  const valid = {
    name: 'Jake Smith',
    email: 'jake@example.com',
    password: 'secure123',
    inviteCode: 'abc123def456',
  };

  it('accepts a valid worker signup payload', () => {
    const result = workerSignupSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const result = workerSignupSchema.parse({
      ...valid,
      email: '  Jake@Example.COM  ',
    });
    expect(result.email).toBe('jake@example.com');
  });

  it('trims the name', () => {
    const result = workerSignupSchema.parse({
      ...valid,
      name: '  Jake Smith  ',
    });
    expect(result.name).toBe('Jake Smith');
  });

  it('rejects an empty name', () => {
    const result = workerSignupSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 100 characters', () => {
    const result = workerSignupSchema.safeParse({ ...valid, name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = workerSignupSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a letter', () => {
    const result = workerSignupSchema.safeParse({ ...valid, password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a number', () => {
    const result = workerSignupSchema.safeParse({ ...valid, password: 'abcdefgh' });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = workerSignupSchema.safeParse({ ...valid, password: 'abc12' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty invite code', () => {
    const result = workerSignupSchema.safeParse({ ...valid, inviteCode: '' });
    expect(result.success).toBe(false);
  });
});
