import { describe, expect, it } from 'vitest';
// Lives in the root suite (not ops/) because ops has no vitest harness and this
// helper is pure with no app-alias imports, so a relative import runs under
// existing CI. Guards the Command Center autoship router against the exact
// regression that kept the cc:autoship lane empty: the drafting routine writes
// blast_radius as prose ("low — invoices only, reversible") while the router
// used to exact-match a bare-token set, so every low-blast option fell through
// to cc:review.
import { blastToken, isLowBlast } from '../../ops/src/lib/blast-radius';

describe('blastToken', () => {
  it('extracts the leading token from prose', () => {
    expect(blastToken('low — invoices only, draft-only path, reversible')).toBe('low');
    expect(blastToken('isolated, only one component')).toBe('isolated');
  });

  it('folds known synonyms to a canonical token', () => {
    expect(blastToken('localized — only tenant_prefs reads')).toBe('isolated');
    expect(blastToken('minor css tweak')).toBe('low');
    expect(blastToken('css')).toBe('ui');
  });

  it('returns empty string for missing/unparseable input', () => {
    expect(blastToken(undefined)).toBe('');
    expect(blastToken(null)).toBe('');
    expect(blastToken('')).toBe('');
    expect(blastToken('123')).toBe('');
  });
});

describe('isLowBlast', () => {
  it('routes the real prose strings that were silently misrouted to review', () => {
    expect(isLowBlast('low — invoices only, draft-only path, reversible')).toBe(true);
    expect(isLowBlast('localized — only tenant_prefs reads for quote_followup_enabled')).toBe(true);
  });

  it('keeps higher-blast domains review-gated', () => {
    expect(isLowBlast('design-system')).toBe(false);
    expect(isLowBlast('voice')).toBe(false);
    expect(isLowBlast('billing')).toBe(false);
    expect(isLowBlast('schema')).toBe(false);
    expect(isLowBlast('auth')).toBe(false);
  });

  it('defaults missing blast info to high-blast (review)', () => {
    expect(isLowBlast(undefined)).toBe(false);
    expect(isLowBlast(null)).toBe(false);
    expect(isLowBlast('')).toBe(false);
  });

  it('accepts every canonical low-blast token', () => {
    for (const t of ['none', 'low', 'ui', 'copy', 'presentational', 'component', 'isolated']) {
      expect(isLowBlast(t)).toBe(true);
    }
  });
});
