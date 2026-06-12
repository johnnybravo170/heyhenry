/**
 * Unit tests for the From-header normaliser used by the inbound email
 * sender resolver. The DB-backed RPC half is verified in integration.
 */

import { describe, expect, it } from 'vitest';
import { normaliseEmail, senderPassesEmailAuth } from '@/lib/inbound-email/sender-resolver';

describe('normaliseEmail', () => {
  it('strips display name', () => {
    expect(normaliseEmail('Jonathan B <jonathan@heyhenry.io>')).toBe('jonathan@heyhenry.io');
  });

  it('lowercases mixed-case addresses', () => {
    expect(normaliseEmail('Jonathan@HeyHenry.IO')).toBe('jonathan@heyhenry.io');
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseEmail('  jvd@example.com  ')).toBe('jvd@example.com');
  });

  it('handles display name with quoted parts', () => {
    expect(normaliseEmail('"JVD" <jvd@example.com>')).toBe('jvd@example.com');
  });

  it('returns the bare address when there is no display name', () => {
    expect(normaliseEmail('jvd@example.com')).toBe('jvd@example.com');
  });
});

describe('senderPassesEmailAuth', () => {
  it('passes when no SPF/DKIM headers are present (conservative default)', () => {
    expect(senderPassesEmailAuth([])).toBe(true);
  });

  it('passes on Received-SPF: Pass', () => {
    expect(
      senderPassesEmailAuth([{ Name: 'Received-SPF', Value: 'Pass (sender SPF authorized)' }]),
    ).toBe(true);
  });

  it('blocks on Received-SPF: Fail', () => {
    expect(
      senderPassesEmailAuth([{ Name: 'Received-SPF', Value: 'Fail (sender not authorized)' }]),
    ).toBe(false);
  });

  it('blocks on Received-SPF: SoftFail', () => {
    expect(senderPassesEmailAuth([{ Name: 'Received-SPF', Value: 'SoftFail (...)' }])).toBe(false);
  });

  it('is case-insensitive on the header name', () => {
    expect(senderPassesEmailAuth([{ Name: 'received-spf', Value: 'fail' }])).toBe(false);
  });

  it('blocks on Authentication-Results spf=fail', () => {
    expect(
      senderPassesEmailAuth([
        { Name: 'Authentication-Results', Value: 'mx.example.com; spf=fail; dkim=none' },
      ]),
    ).toBe(false);
  });

  it('blocks on Authentication-Results dkim=fail', () => {
    expect(
      senderPassesEmailAuth([
        { Name: 'Authentication-Results', Value: 'mx.example.com; spf=pass; dkim=fail' },
      ]),
    ).toBe(false);
  });

  it('passes on Authentication-Results spf=pass; dkim=pass', () => {
    expect(
      senderPassesEmailAuth([
        { Name: 'Authentication-Results', Value: 'mx.example.com; spf=pass; dkim=pass' },
      ]),
    ).toBe(true);
  });

  it('does not block on dkim=none or spf=neutral', () => {
    expect(
      senderPassesEmailAuth([
        { Name: 'Authentication-Results', Value: 'mx.example.com; spf=neutral; dkim=none' },
      ]),
    ).toBe(true);
  });
});
