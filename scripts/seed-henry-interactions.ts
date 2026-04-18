#!/usr/bin/env tsx
/**
 * Seeds fake henry_interactions rows so the admin analytics charts have
 * data during early beta. Off by default — guarded by env flag.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   SEED_FAKE_HENRY_DATA=true pnpm tsx scripts/seed-henry-interactions.ts
 *   SEED_FAKE_HENRY_DATA=true pnpm tsx scripts/seed-henry-interactions.ts --days 30 --per-day 25
 *
 * Generates ~per-day interactions per day across the last N days, spread
 * across every non-deleted tenant. Tool call names and verticals are
 * representative. Existing rows are not touched.
 */
import { createClient } from '@supabase/supabase-js';

function arg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return fallback;
  const n = Number.parseInt(process.argv[idx + 1] ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
}

const TOOL_NAMES = [
  'get_dashboard',
  'list_customers',
  'create_customer',
  'list_jobs',
  'update_job_status',
  'create_quote',
  'send_quote',
  'create_invoice',
  'create_todo',
  'complete_todo',
  'get_current_screen_context',
  'fill_current_form',
  'send_sms',
  'search_worklog',
  'list_catalog',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

async function main() {
  if (process.env.SEED_FAKE_HENRY_DATA !== 'true') {
    console.error('Refusing to run without SEED_FAKE_HENRY_DATA=true. This protects prod.');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const days = arg('--days', 30);
  const perDay = arg('--per-day', 20);

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tenants, error: tenantErr } = await admin
    .from('tenants')
    .select('id, vertical')
    .is('deleted_at', null);

  if (tenantErr) {
    console.error('Failed to list tenants:', tenantErr);
    process.exit(1);
  }
  if (!tenants?.length) {
    console.error('No tenants found.');
    process.exit(1);
  }

  const total = days * perDay;
  console.log(`Seeding ~${total} henry_interactions across ${tenants.length} tenant(s)…`);

  const batch: Record<string, unknown>[] = [];
  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    for (let i = 0; i < perDay; i++) {
      const tenant = pick(tenants);
      // Spread timestamps randomly within the day.
      const ts = new Date(
        Date.now() - dayOffset * 86_400_000 - Math.floor(rand(0, 86_400_000)),
      ).toISOString();

      const toolCount = Math.random() < 0.3 ? 0 : Math.floor(rand(1, 4));
      const tool_calls = Array.from({ length: toolCount }, () => ({
        name: pick(TOOL_NAMES),
        args: {},
        result: 'ok',
        duration_ms: Math.floor(rand(50, 800)),
      }));

      const audio_input_seconds = Math.random() < 0.5 ? Number(rand(5, 60).toFixed(2)) : 0;
      const audio_output_seconds = audio_input_seconds > 0 ? Number(rand(3, 45).toFixed(2)) : 0;

      const errored = Math.random() < 0.03;

      batch.push({
        tenant_id: tenant.id,
        user_id: null,
        created_at: ts,
        conversation_id: null,
        vertical: tenant.vertical,
        user_text: 'fake seed turn',
        assistant_text: errored ? null : 'fake response',
        tool_calls,
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        input_tokens: Math.floor(rand(200, 2000)),
        output_tokens: Math.floor(rand(100, 1200)),
        cached_input_tokens: Math.floor(rand(0, 300)),
        audio_input_seconds,
        audio_output_seconds,
        duration_ms: Math.floor(rand(500, 4000)),
        error: errored ? 'simulated error' : null,
      });
    }
  }

  // Insert in chunks of 500 to avoid huge single requests.
  const chunkSize = 500;
  for (let i = 0; i < batch.length; i += chunkSize) {
    const chunk = batch.slice(i, i + chunkSize);
    const { error } = await admin.from('henry_interactions').insert(chunk);
    if (error) {
      console.error(`Chunk ${i / chunkSize} failed:`, error.message);
      process.exit(1);
    }
    console.log(`Inserted ${Math.min(i + chunkSize, batch.length)} / ${batch.length}`);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
