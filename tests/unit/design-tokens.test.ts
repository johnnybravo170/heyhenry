/**
 * Design-token guardrail — keeps the White Ledger closed type scale from drifting.
 *
 * DESIGN.md v2 (canonical) + the named `@theme` size tokens in
 * `src/app/globals.css` define a closed scale: 12 / 14 / 16 for body+label,
 * {20,24,28,36} for display. The 11px mono-eyebrow tier is RETIRED in v2.
 * The two ways the scale drifts are arbitrary `text-[<n>px]` utilities and raw
 * inline `font-size:` — both bypass the tokens. (Root cause of the
 * Budget/Scope formatting drift.)
 *
 * This is a RATCHET, not a hard ban. ~600 such usages already exist across the
 * app, so a per-file baseline (tests/unit/design-tokens.baseline.json) records
 * the current count and the check fails only when a file exceeds it — or when a
 * file not in the baseline introduces one. The count can only go DOWN: fix a few,
 * then `pnpm design-tokens:baseline` to tighten the floor.
 *
 * Picking a size? Reach for a token instead of an arbitrary px value:
 *   text-eyebrow (11 mono) · text-meta (12) · text-body (14) · text-lead (16)
 *   text-display-xs/sm/md/lg (20/24/28/36)  ·  Tailwind text-sm=14 / text-base=16
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHECKS,
  type CheckKey,
  type FileCounts,
  scanDesignTokens,
} from '../../scripts/design-token-scan';

interface Baseline {
  textSizeArbitrary: FileCounts;
  inlineFontSize: FileCounts;
}

const baseline: Baseline = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/unit/design-tokens.baseline.json'), 'utf-8'),
);

const scan = scanDesignTokens();

/**
 * Compare a check's current per-file counts against the baseline. Returns a
 * list of human-readable regressions (file exceeds its allowance / new file).
 */
function regressions(check: CheckKey): string[] {
  const current = scan[check];
  const allowed = baseline[check] ?? {};
  const out: string[] = [];
  for (const [file, count] of Object.entries(current)) {
    const cap = allowed[file] ?? 0;
    if (count > cap) {
      out.push(
        cap === 0
          ? `  ${file}: ${count} new (not in baseline)`
          : `  ${file}: ${count} > baseline ${cap}`,
      );
    }
  }
  return out.sort();
}

describe('Design-token guardrail (Paper closed type scale)', () => {
  for (const key of Object.keys(CHECKS) as CheckKey[]) {
    const { label, fix } = CHECKS[key];
    it(`no file adds ${label} beyond its baseline`, () => {
      const offending = regressions(key);
      if (offending.length > 0) {
        expect.fail(
          [
            `New ${label} above the per-file baseline:`,
            '',
            ...offending,
            '',
            fix,
            '',
            'If a violation was legitimately REMOVED elsewhere and you need to tighten',
            'the floor, run: pnpm design-tokens:baseline',
            'Never regenerate the baseline just to absorb a new violation.',
          ].join('\n'),
        );
      }
    });
  }
});
