/**
 * Shared scanner for the design-token guardrail.
 *
 * Counts the two "type-scale drift vectors" per source file:
 *   1. Arbitrary Tailwind font sizes — `text-[<n>px]`
 *   2. Raw inline `font-size:` declarations
 *
 * Both bypass the closed Paper type scale (the named `@theme` size tokens in
 * `src/app/globals.css`). The lint (tests/unit/design-tokens.test.ts) and the
 * baseline generator (scripts/gen-design-token-baseline.ts) MUST count via this
 * one module so the baseline and the check can never disagree.
 */

import { execSync } from 'node:child_process';

/** Map of source file → number of matches in that file. */
export type FileCounts = Record<string, number>;

export interface DesignTokenScan {
  /** `text-[<n>px]` arbitrary font-size utilities. */
  textSizeArbitrary: FileCounts;
  /** Raw inline `font-size:` declarations. */
  inlineFontSize: FileCounts;
}

export const CHECKS = {
  textSizeArbitrary: {
    pattern: 'text-\\[[0-9]+(\\.[0-9]+)?px\\]',
    label: 'arbitrary text-[Npx] font sizes',
    fix: 'Use a closed-scale token: text-eyebrow (11) / text-meta (12) / text-body (14) / text-lead (16), or a Tailwind default (text-sm=14, text-base=16). Display: text-display-xs/sm/md/lg.',
  },
  inlineFontSize: {
    pattern: 'font-size:',
    label: 'raw inline font-size:',
    fix: 'Drop the inline font-size and apply a closed-scale text-* token class instead.',
  },
} as const;

export type CheckKey = keyof typeof CHECKS;

/**
 * Count occurrences of `pattern` per file under src/, using grep -o so a line
 * with two matches counts twice (occurrences, not lines).
 */
function countByFile(pattern: string): FileCounts {
  let output = '';
  try {
    output = execSync(`grep -rEo '${pattern}' src --include='*.ts' --include='*.tsx' || true`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    output = '';
  }

  const counts: FileCounts = {};
  for (const line of output.split('\n')) {
    if (!line) continue;
    // grep -r prefixes each match with "path:" — split on the first colon.
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const file = line.slice(0, idx);
    counts[file] = (counts[file] ?? 0) + 1;
  }
  return counts;
}

export function scanDesignTokens(): DesignTokenScan {
  return {
    textSizeArbitrary: countByFile(CHECKS.textSizeArbitrary.pattern),
    inlineFontSize: countByFile(CHECKS.inlineFontSize.pattern),
  };
}
