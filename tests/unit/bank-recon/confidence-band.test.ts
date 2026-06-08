import { describe, expect, it } from 'vitest';
import {
  confidenceLabel,
  confidenceTone,
  explainMatch,
  scoreToBand,
} from '@/lib/bank-recon/confidence-band';
import type { MatchCandidate } from '@/lib/bank-recon/matcher';
import { HIGH_CONFIDENCE_THRESHOLD, MEDIUM_CONFIDENCE_THRESHOLD } from '@/lib/bank-recon/matcher';

describe('scoreToBand', () => {
  it('maps scores to the right band at the boundaries', () => {
    expect(scoreToBand(HIGH_CONFIDENCE_THRESHOLD)).toBe('high');
    expect(scoreToBand(HIGH_CONFIDENCE_THRESHOLD - 1)).toBe('medium');
    expect(scoreToBand(MEDIUM_CONFIDENCE_THRESHOLD)).toBe('medium');
    expect(scoreToBand(MEDIUM_CONFIDENCE_THRESHOLD - 1)).toBe('low');
    expect(scoreToBand(100)).toBe('high');
    expect(scoreToBand(0)).toBe('low');
  });
});

describe('confidence band → tone (status-tokens)', () => {
  it('maps high→success, medium→warning, low→hold', () => {
    expect(confidenceTone.high).toBe('success');
    expect(confidenceTone.medium).toBe('warning');
    expect(confidenceTone.low).toBe('hold');
  });

  it('never labels a band a "bucket"', () => {
    for (const label of Object.values(confidenceLabel)) {
      expect(label.toLowerCase()).not.toContain('bucket');
    }
  });
});

describe('explainMatch — the "How Henry matched" rubric', () => {
  const candidate: MatchCandidate = {
    kind: 'invoice',
    id: 'inv-1',
    score: 100,
    confidence: 'high',
    amount_cents: 113000,
    tx_date: '2026-03-10',
    label: 'Maple Ridge Renos',
  };

  it('breaks an exact, same-day, named match into a full-score rubric', () => {
    const ex = explainMatch(
      { posted_at: '2026-03-10', amount_cents: 113000, description: 'E-TFR MAPLE RIDGE RENOS' },
      candidate,
      'Maple Ridge Renos',
    );
    const byLabel = Object.fromEntries(ex.lines.map((l) => [l.label, l]));
    expect(byLabel.Amount.points).toBe(50);
    expect(byLabel.Date.points).toBe(30);
    expect(byLabel.Payee.points).toBe(20);
    expect(ex.total).toBe(100);
    expect(ex.band).toBe('high');
  });

  it('drops the band when amount and payee disagree', () => {
    const ex = explainMatch(
      { posted_at: '2026-04-30', amount_cents: 50000, description: 'CHEQUE 0042' },
      candidate,
      'Maple Ridge Renos',
    );
    const amount = ex.lines.find((l) => l.label === 'Amount');
    expect(amount?.points).toBe(0);
    expect(ex.band).toBe('low');
  });
});
