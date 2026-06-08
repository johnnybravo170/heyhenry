/** Pure assertion logic — no I/O. Unit-testable on its own. */

import type { ArgMatcher, CapturedCall, Scenario } from './types';

export type ScenarioResult = {
  id: string;
  description: string;
  pass: boolean;
  reasons: string[];
  captured: CapturedCall[];
  error?: string;
};

function deepEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function matchArg(matcher: ArgMatcher, actual: unknown): boolean {
  if (matcher !== null && typeof matcher === 'object') {
    if ('present' in matcher) return actual !== undefined && actual !== null;
    if ('equals' in matcher) return deepEq(actual, matcher.equals);
    if ('contains' in matcher) {
      return (
        typeof actual === 'string' &&
        actual.toLowerCase().includes(String(matcher.contains).toLowerCase())
      );
    }
    if ('oneOf' in matcher) return matcher.oneOf.some((v) => deepEq(actual, v));
    return false;
  }
  // shorthand: exact equals
  return deepEq(actual, matcher);
}

/**
 * Evaluate captured tool calls against a scenario. A scenario passes when:
 *   - no forbidden tool was called, AND
 *   - the first N captured calls match the N expected calls in order
 *     (tool name + every specified arg matcher).
 * Captured calls beyond the expected length are ignored (not a failure).
 */
export function evaluate(
  scenario: Scenario,
  captured: CapturedCall[],
  error?: string,
): ScenarioResult {
  const reasons: string[] = [];

  if (error) reasons.push(`harness error: ${error}`);

  for (const forbidden of scenario.forbid ?? []) {
    if (captured.some((c) => c.tool === forbidden)) {
      reasons.push(`forbidden tool was called: ${forbidden}`);
    }
  }

  scenario.expect.forEach((exp, i) => {
    const got = captured[i];
    if (!got) {
      reasons.push(`missing call #${i + 1}: expected "${exp.tool}"`);
      return;
    }
    if (got.tool !== exp.tool) {
      reasons.push(`call #${i + 1}: expected "${exp.tool}", got "${got.tool}"`);
      return;
    }
    for (const [key, matcher] of Object.entries(exp.args ?? {})) {
      if (!matchArg(matcher, got.args[key])) {
        reasons.push(
          `call #${i + 1} "${exp.tool}": arg "${key}" mismatch — got ${JSON.stringify(got.args[key])}`,
        );
      }
    }
  });

  return {
    id: scenario.id,
    description: scenario.description,
    pass: reasons.length === 0,
    reasons,
    captured,
    error,
  };
}
