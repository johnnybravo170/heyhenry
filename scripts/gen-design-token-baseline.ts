#!/usr/bin/env tsx
/**
 * Regenerate the design-token baseline (tests/unit/design-tokens.baseline.json).
 *
 * The baseline is a per-file count of the existing type-scale drift vectors
 * (arbitrary `text-[Npx]`, inline `font-size:`). The lint fails when a file
 * exceeds its baseline count — so the count can only ratchet DOWN, never up.
 *
 * Run this AFTER you've removed violations, to tighten the floor:
 *   pnpm design-tokens:baseline
 *
 * Never run it to silence a freshly-introduced violation — that re-loosens the
 * floor, which is the whole thing this guardrail exists to prevent.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanDesignTokens } from './design-token-scan';

const BASELINE_PATH = join(process.cwd(), 'tests/unit/design-tokens.baseline.json');

function sortByFile(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function main(): void {
  const scan = scanDesignTokens();
  const baseline = {
    textSizeArbitrary: sortByFile(scan.textSizeArbitrary),
    inlineFontSize: sortByFile(scan.inlineFontSize),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf-8');

  const textFiles = Object.keys(baseline.textSizeArbitrary).length;
  const textTotal = Object.values(baseline.textSizeArbitrary).reduce((a, b) => a + b, 0);
  const fontFiles = Object.keys(baseline.inlineFontSize).length;
  const fontTotal = Object.values(baseline.inlineFontSize).reduce((a, b) => a + b, 0);
  console.log(`✓ wrote ${BASELINE_PATH}`);
  console.log(`  text-[Npx]:    ${textTotal} across ${textFiles} files`);
  console.log(`  font-size:     ${fontTotal} across ${fontFiles} files`);
}

main();
