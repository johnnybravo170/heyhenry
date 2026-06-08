/**
 * Print Henry's full tool catalog (name · one-line description · args).
 *
 * Authoring aid for the eval scenarios — so an expected tool call references
 * a real tool name + real arg names, not a guess. Reads the SAME `allTools`
 * the realtime session sends, so it can't drift.
 *
 *   pnpm tsx evals/henry/list-tools.ts
 */

import { allTools } from '@/lib/ai/tools';

for (const t of allTools) {
  const d = t.definition;
  const schema = (d.input_schema ?? {}) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const args =
    Object.keys(props)
      .map((k) => (required.has(k) ? `${k}*` : k))
      .join(', ') || '(none)';
  console.log(`${d.name}`);
  console.log(`    ${(d.description ?? '').slice(0, 110).replace(/\s+/g, ' ')}`);
  console.log(`    args: ${args}`);
}
console.log(`\nTOTAL: ${allTools.length} tools  (* = required)`);
