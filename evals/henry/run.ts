/**
 * Henry tool-call eval runner.
 *
 *   source .env.local && pnpm henry:eval            # full battery
 *   source .env.local && pnpm henry:eval --limit 2  # smoke
 *   source .env.local && pnpm henry:eval --id schedule-shift-chain --verbose
 *   HENRY_OPENAI_REALTIME_MODEL=gpt-realtime-3 pnpm henry:eval   # gate a swap
 *
 * Replays a fixed battery of scenarios against the realtime model and prints a
 * pass-rate. Exit code is non-zero below --threshold (default 0.95) so it can
 * gate a model swap in a one-liner. It imports Henry's REAL system prompt +
 * tool schemas, so the eval can't drift from what production sends.
 *
 * Costs live model tokens + is non-deterministic — this is an on-demand script,
 * NOT a CI gate.
 */

import fs from 'node:fs';
import { getSystemPrompt } from '@/lib/ai/system-prompt';
import { allTools } from '@/lib/ai/tools';
import { clientRealtimeTools, toOpenAIRealtimeTools } from '@/lib/henry/openai-tools';
import { evaluate, type ScenarioResult } from './assert';
import { captureToolCalls } from './driver';
import { scenarios } from './scenarios';

// Defensive .env.local loader so `pnpm henry:eval` works without remembering to
// `source` first. Only fills vars that aren't already set.
function loadEnvLocal() {
  if (process.env.OPENAI_API_KEY) return;
  try {
    const txt = fs.readFileSync('.env.local', 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, rawV] = m;
      if (process.env[k]) continue;
      let v = rawV.trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch {
    /* no .env.local — rely on the ambient env */
  }
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (flag: string) => process.argv.includes(flag);

async function main() {
  loadEnvLocal();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('✗ OPENAI_API_KEY not set (source .env.local or export it).');
    process.exit(2);
  }
  const model = arg('--model') ?? process.env.HENRY_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2';
  const threshold = Number(arg('--threshold') ?? '0.95');
  const verbose = hasFlag('--verbose');
  const onlyId = arg('--id');
  const limit = arg('--limit') ? Number(arg('--limit')) : undefined;

  let battery = scenarios;
  if (onlyId) battery = battery.filter((s) => s.id === onlyId);
  if (limit) battery = battery.slice(0, limit);
  if (battery.length === 0) {
    console.error('✗ No scenarios matched.');
    process.exit(2);
  }

  // Built ONCE, exactly as /api/henry/session does — the anti-drift guarantee.
  const tools = [...toOpenAIRealtimeTools(allTools), ...clientRealtimeTools];

  console.error(`\nHenry tool-call eval — model=${model} — ${battery.length} scenario(s)\n`);

  const results: ScenarioResult[] = [];
  for (const scenario of battery) {
    const instructions =
      getSystemPrompt(scenario.tenant.name, scenario.tenant.timezone, scenario.tenant.vertical) +
      (scenario.screenContext ? `\n\n[CURRENT SCREEN]\n${scenario.screenContext}` : '');

    const { calls, error } = await captureToolCalls(scenario, {
      apiKey,
      model,
      instructions,
      tools,
      verbose,
    });
    const result = evaluate(scenario, calls, error);
    results.push(result);
    console.error(
      `${result.pass ? '✓' : '✗'} ${scenario.id}${result.pass ? '' : `\n    ${result.reasons.join('\n    ')}`}`,
    );
  }

  const passed = results.filter((r) => r.pass).length;
  const rate = passed / results.length;

  // Markdown summary to stdout (redirect to a file for a report artifact).
  const lines: string[] = [];
  lines.push(`# Henry tool-call eval — ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- model: \`${model}\``);
  lines.push(`- pass: **${passed}/${results.length}** (${(rate * 100).toFixed(1)}%)`);
  lines.push(`- threshold: ${(threshold * 100).toFixed(0)}%`);
  lines.push('');
  for (const r of results) {
    lines.push(`## ${r.pass ? '✓' : '✗'} ${r.id} — ${r.description}`);
    if (!r.pass) {
      for (const reason of r.reasons) lines.push(`- ${reason}`);
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(r.captured, null, 2));
      lines.push('```');
    }
    lines.push('');
  }
  console.log(lines.join('\n'));

  console.error(
    `\n${rate >= threshold ? '✓ PASS' : '✗ FAIL'} — ${passed}/${results.length} (${(rate * 100).toFixed(1)}%), threshold ${(threshold * 100).toFixed(0)}%\n`,
  );
  process.exit(rate >= threshold ? 0 : 1);
}

main().catch((e) => {
  console.error('✗ runner crashed:', e instanceof Error ? e.stack : e);
  process.exit(2);
});
