/**
 * UI mapping for the deterministic matcher's confidence levels.
 *
 * The matcher (`matcher.ts`) is a *scoring rubric, not a model* — it sums
 * Amount (≤50) + Date (≤30) + Payee text (≤20) into a 0–100 score and lands
 * each candidate in a confidence **band** (never "bucket" in UI copy):
 *
 *   high   (≥85) → success tone — pre-checked for one-click bulk-confirm
 *   medium (60–84) → warning tone — suggested, not pre-checked
 *   low    (30–59) → hold tone — shown, de-emphasized
 *
 * Band → `status-tokens` tone so the badge carries the soft pair + glyph
 * (never colour-only). The matcher never auto-confirms: money state flips
 * only on a human click — high-confidence is merely *pre-checked*.
 */

import type { MatchCandidate } from '@/lib/bank-recon/matcher';
import {
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  scoreAmount,
  scoreDate,
  scoreText,
} from '@/lib/bank-recon/matcher';
import type { StatusTone } from '@/lib/ui/status-tokens';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Band → status tone (high→success, medium→warning, low→hold). */
export const confidenceTone: Record<ConfidenceLevel, StatusTone> = {
  high: 'success',
  medium: 'warning',
  low: 'hold',
};

/** Human label for a band. Never the word "bucket". */
export const confidenceLabel: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

/**
 * Map a raw 0–100 score to its confidence band. Mirrors the matcher's
 * private `bucket()` — kept here as the single UI-facing band mapping so the
 * badge tone and the disclosure agree. Pure; unit-tested.
 */
export function scoreToBand(score: number): ConfidenceLevel {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

/** Max points each rubric component can contribute (for the disclosure). */
export const RUBRIC_MAX = { amount: 50, date: 30, payee: 20 } as const;

export type RubricLine = {
  /** Component label as shown in the disclosure. */
  label: 'Amount' | 'Date' | 'Payee';
  /** Points this component earned. */
  points: number;
  /** Max points for this component. */
  max: number;
  /** Plain-English read of why it scored what it did. */
  detail: string;
};

export type MatchExplanation = {
  lines: RubricLine[];
  total: number;
  band: ConfidenceLevel;
};

const NORMALIZE = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function amountDetail(points: number): string {
  if (points === 50) return 'Matches to the cent';
  if (points === 35) return 'Within $1 (rounding / fee)';
  if (points === 20) return 'Within 1%';
  return 'No amount agreement';
}

function dateDetail(points: number): string {
  if (points === 30) return 'Within 2 days';
  if (points === 20) return 'Within 5 days';
  if (points === 10) return 'Within 10 days';
  return 'No close date';
}

function payeeDetail(points: number): string {
  if (points >= 15) return 'Payee name appears in the bank line';
  if (points > 0) return 'Partial payee-text overlap';
  return 'No payee-text overlap';
}

/**
 * Rebuild the matcher's per-component rubric for the "How Henry matched"
 * disclosure. The stored candidate only carries the total score, so we
 * re-run the (deterministic, pure) component scorers against the bank line
 * and the candidate — same rubric the engine used, made legible.
 */
export function explainMatch(
  tx: { posted_at: string; amount_cents: number; description: string },
  candidate: MatchCandidate,
  candidateLabel: string,
): MatchExplanation {
  const amount = scoreAmount(Math.abs(tx.amount_cents), candidate.amount_cents);
  const date = scoreDate(tx.posted_at, candidate.tx_date);
  const payee = scoreText(NORMALIZE(tx.description), candidateLabel);
  const total = amount + date + payee;
  return {
    lines: [
      { label: 'Amount', points: amount, max: RUBRIC_MAX.amount, detail: amountDetail(amount) },
      { label: 'Date', points: date, max: RUBRIC_MAX.date, detail: dateDetail(date) },
      { label: 'Payee', points: payee, max: RUBRIC_MAX.payee, detail: payeeDetail(payee) },
    ],
    total,
    band: scoreToBand(total),
  };
}
