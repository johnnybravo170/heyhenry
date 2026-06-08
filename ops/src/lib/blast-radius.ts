/**
 * Blast-radius vocabulary shared by the Command Center.
 *
 * The decision-bundle drafting routine (daily-board-triage) classifies each
 * option's blast radius; resolveBundleAction routes low-blast work to the
 * autoship lane (`cc:autoship` → the dispatch routine opens a PR) and everything
 * else to `cc:review`. Both sides MUST agree on the vocabulary, so it lives here
 * — previously the drafter wrote prose ("low — invoices only, reversible") while
 * the router did an exact-string match against a bare-token set, so every
 * low-blast option fell through to review and the autoship lane stayed empty.
 *
 * The contract: blast_radius LEADS with one of the canonical tokens below.
 * Trailing prose is allowed for the queue UI; `isLowBlast()` reads only the
 * leading token (after synonym folding), so the prose never breaks routing.
 */

/** Canonical low-blast tokens → auto-shippable (PR, never merge). */
export const LOW_BLAST_TOKENS = new Set([
  'none',
  'low',
  'ui',
  'copy',
  'presentational',
  'component',
  'isolated',
]);

/**
 * Common synonyms the scouts reach for, folded to a canonical token. Kept
 * deliberately tight: only words that are unambiguously low-blast. Anything
 * touching $/schema/auth/voice/design-tokens is NOT here — it stays review-gated.
 */
const BLAST_SYNONYMS: Record<string, string> = {
  local: 'isolated',
  localized: 'isolated',
  scoped: 'isolated',
  minor: 'low',
  small: 'low',
  trivial: 'low',
  tiny: 'low',
  cosmetic: 'presentational',
  css: 'ui',
};

/**
 * Reduce a free-form blast_radius string to its canonical token: lowercase,
 * take the leading alpha word (so "low — invoices only" → "low"), then fold
 * known synonyms. Returns '' for empty/unparseable input (treated as high-blast).
 */
export function blastToken(raw: string | null | undefined): string {
  const lead =
    (raw ?? '')
      .toLowerCase()
      .trim()
      .match(/^[a-z]+/)?.[0] ?? '';
  return BLAST_SYNONYMS[lead] ?? lead;
}

/**
 * True when the blast radius is low enough to auto-ship. Missing or unknown
 * blast info is high-blast by default — review-gated, never auto-shipped.
 */
export function isLowBlast(raw: string | null | undefined): boolean {
  return LOW_BLAST_TOKENS.has(blastToken(raw));
}
