/**
 * Henry interaction analytics — platform-wide queries for /admin/henry.
 *
 * All server-only, service-role scope. Reads from `henry_interactions`.
 */

import { createAdminClient } from '@/lib/supabase/admin';

function windowStart(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type ToolCallRow = {
  tool_name: string;
  count: number;
  distinct_tenants: number;
};

export type VerticalRow = {
  vertical: string | null;
  count: number;
};

export type HenryOverviewStats = {
  total: number;
  errors: number;
  errorRate: number; // 0..1
  avgDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedInputTokens: number;
};

export async function getHenryOverview(days: number): Promise<HenryOverviewStats> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('henry_interactions')
    .select('duration_ms, input_tokens, output_tokens, cached_input_tokens, error')
    .gte('created_at', windowStart(days));

  const rows = data ?? [];
  const total = rows.length;
  let errors = 0;
  let durationSum = 0;
  let durationCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cached = 0;

  for (const r of rows) {
    if (r.error) errors += 1;
    if (typeof r.duration_ms === 'number') {
      durationSum += r.duration_ms;
      durationCount += 1;
    }
    inputTokens += Number(r.input_tokens ?? 0);
    outputTokens += Number(r.output_tokens ?? 0);
    cached += Number(r.cached_input_tokens ?? 0);
  }

  return {
    total,
    errors,
    errorRate: total > 0 ? errors / total : 0,
    avgDurationMs: durationCount > 0 ? durationSum / durationCount : 0,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    totalCachedInputTokens: cached,
  };
}

/**
 * Top tool calls by frequency over the window. Pulls tool_calls jsonb
 * array from each interaction and counts names.
 */
export async function getTopToolCalls(days: number, limit = 15): Promise<ToolCallRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('henry_interactions')
    .select('tenant_id, tool_calls')
    .gte('created_at', windowStart(days));

  const counts = new Map<string, { count: number; tenants: Set<string> }>();
  for (const row of data ?? []) {
    const tenantId = String(row.tenant_id ?? '');
    const calls = Array.isArray(row.tool_calls) ? row.tool_calls : [];
    for (const call of calls as Array<{ name?: unknown }>) {
      const name = typeof call.name === 'string' ? call.name : null;
      if (!name) continue;
      const entry = counts.get(name) ?? { count: 0, tenants: new Set<string>() };
      entry.count += 1;
      if (tenantId) entry.tenants.add(tenantId);
      counts.set(name, entry);
    }
  }

  return Array.from(counts.entries())
    .map(([tool_name, { count, tenants }]) => ({
      tool_name,
      count,
      distinct_tenants: tenants.size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Total interactions per vertical in the window. */
export async function getInteractionsByVertical(days: number): Promise<VerticalRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('henry_interactions')
    .select('vertical')
    .gte('created_at', windowStart(days));

  const counts = new Map<string | null, number>();
  for (const row of data ?? []) {
    const v = (row.vertical ?? null) as string | null;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([vertical, count]) => ({ vertical, count }))
    .sort((a, b) => b.count - a.count);
}
