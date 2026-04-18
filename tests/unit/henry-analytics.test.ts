import { beforeEach, describe, expect, it, vi } from 'vitest';

const stages = new Map<string, { data?: unknown[] | null; count?: number | null }>();

function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable for await
  chain.then = (resolve: (v: unknown) => unknown) => {
    const table = (chain as Record<string, string>)._table;
    const stage = stages.get(table) ?? { data: [] };
    return Promise.resolve(
      resolve({ data: stage.data ?? null, count: stage.count ?? null, error: null }),
    );
  };
  return chain;
}

const fromMock = vi.fn((table: string) => {
  const chain = makeChain();
  (chain as Record<string, string>)._table = table;
  return chain;
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

import {
  getHenryOverview,
  getInteractionsByVertical,
  getTopToolCalls,
} from '@/lib/db/queries/henry-analytics';

describe('henry-analytics queries', () => {
  beforeEach(() => {
    stages.clear();
    fromMock.mockClear();
  });

  it('getHenryOverview computes totals, error rate, avg duration, tokens', async () => {
    stages.set('henry_interactions', {
      data: [
        {
          duration_ms: 100,
          input_tokens: 50,
          output_tokens: 75,
          cached_input_tokens: 10,
          error: null,
        },
        {
          duration_ms: 200,
          input_tokens: 30,
          output_tokens: 40,
          cached_input_tokens: 0,
          error: 'boom',
        },
        {
          duration_ms: null,
          input_tokens: 20,
          output_tokens: 10,
          cached_input_tokens: null,
          error: null,
        },
      ],
    });
    const result = await getHenryOverview(30);
    expect(result.total).toBe(3);
    expect(result.errors).toBe(1);
    expect(result.errorRate).toBeCloseTo(1 / 3, 5);
    expect(result.avgDurationMs).toBeCloseTo(150, 5); // (100 + 200) / 2
    expect(result.totalInputTokens).toBe(100);
    expect(result.totalOutputTokens).toBe(125);
    expect(result.totalCachedInputTokens).toBe(10);
  });

  it('getHenryOverview handles empty window', async () => {
    stages.set('henry_interactions', { data: [] });
    const result = await getHenryOverview(30);
    expect(result.total).toBe(0);
    expect(result.errorRate).toBe(0);
    expect(result.avgDurationMs).toBe(0);
  });

  it('getTopToolCalls flattens tool_calls jsonb and counts by name', async () => {
    stages.set('henry_interactions', {
      data: [
        { tenant_id: 'A', tool_calls: [{ name: 'create_todo' }, { name: 'list_jobs' }] },
        { tenant_id: 'A', tool_calls: [{ name: 'create_todo' }] },
        { tenant_id: 'B', tool_calls: [{ name: 'list_jobs' }, { name: 'list_jobs' }] },
        { tenant_id: 'C', tool_calls: [] },
      ],
    });
    const result = await getTopToolCalls(30, 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ tool_name: 'list_jobs', count: 3, distinct_tenants: 2 });
    expect(result[1]).toEqual({ tool_name: 'create_todo', count: 2, distinct_tenants: 1 });
  });

  it('getInteractionsByVertical groups correctly', async () => {
    stages.set('henry_interactions', {
      data: [
        { vertical: 'pressure_washing' },
        { vertical: 'pressure_washing' },
        { vertical: 'renovation' },
        { vertical: null },
      ],
    });
    const result = await getInteractionsByVertical(30);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ vertical: 'pressure_washing', count: 2 });
  });
});
