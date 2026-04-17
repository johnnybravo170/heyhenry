/**
 * Unit tests for the referral code generator.
 */

import { describe, expect, it } from 'vitest';
import { generateReferralCode } from '@/lib/referral/code-generator';

describe('generateReferralCode', () => {
  it('generates a slug from a business name', () => {
    expect(generateReferralCode("Will's Pressure Washing")).toBe('will-s-pressure');
  });

  it('lowercases the name', () => {
    expect(generateReferralCode('Acme Corp')).toBe('acme-corp');
  });

  it('replaces special characters with hyphens', () => {
    expect(generateReferralCode('A & B Contracting!')).toBe('a-b-contracting');
  });

  it('truncates long names to 20 chars at a hyphen boundary', () => {
    const code = generateReferralCode('Super Duper Long Business Name That Goes On Forever');
    expect(code.length).toBeLessThanOrEqual(20);
    expect(code).not.toMatch(/-$/);
  });

  it('generates a random 8-char code for an empty name', () => {
    const code = generateReferralCode('');
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
  });

  it('generates a random code for a name with only special characters', () => {
    const code = generateReferralCode('!!!@@@###');
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
  });

  it('handles a short name correctly', () => {
    expect(generateReferralCode('AB')).toBe('ab');
  });

  it('collapses consecutive special characters into a single hyphen', () => {
    expect(generateReferralCode('A  &  B')).toBe('a-b');
  });

  it('trims leading and trailing hyphens', () => {
    expect(generateReferralCode(' - Hello World - ')).toBe('hello-world');
  });
});
