import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

export function registerCompetitorTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'competitors_list',
    'List tracked competitors, most-recently-updated first. Use to see who we already know about before adding a new one.',
    { limit: z.number().int().min(1).max(500).default(50) },
    withAudit(ctx, 'competitors_list', 'read:competitors', async ({ limit }) => {
      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .from('competitors')
        .select(
          'id, name, url, edge_notes, latest_findings, last_checked_at, actor_name, created_at, updated_at',
        )
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return jsonResult({ competitors: data ?? [] });
    }),
  );

  server.tool(
    'competitors_get',
    'Fetch one competitor card by id, including full edge_notes and latest_findings.',
    { id: z.string().uuid() },
    withAudit(ctx, 'competitors_get', 'read:competitors', async ({ id }) => {
      const service = createServiceClient();
      const { data } = await service
        .schema('ops')
        .from('competitors')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!data) throw new Error('Not found');
      return jsonResult({ item: data });
    }),
  );

  server.tool(
    'competitors_upsert',
    'Create or update a competitor card. Keyed on `name` — re-running with the same name updates the existing row. Call whenever you learn something new (price change, feature launch, positioning shift). Set `last_checked_at` to now when confirming a card is still current.',
    {
      name: z.string().min(1).max(200),
      url: z.string().max(2000).optional().nullable(),
      edge_notes: z.string().max(20000).optional().nullable(),
      latest_findings: z.record(z.string(), z.unknown()).optional(),
      last_checked_at: z.string().datetime().optional().nullable(),
    },
    withAudit(ctx, 'competitors_upsert', 'write:competitors', async (input) => {
      const service = createServiceClient();
      const row: Record<string, unknown> = {
        actor_type: 'agent',
        actor_name: ctx.actorName,
        key_id: ctx.keyId,
        name: input.name,
        latest_findings: input.latest_findings ?? {},
        updated_at: new Date().toISOString(),
      };
      if (input.url !== undefined) row.url = input.url;
      if (input.edge_notes !== undefined) row.edge_notes = input.edge_notes;
      if (input.last_checked_at !== undefined) row.last_checked_at = input.last_checked_at;

      const { data, error } = await service
        .schema('ops')
        .from('competitors')
        .upsert(row, { onConflict: 'name' })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Upsert failed');
      return jsonResult({
        ok: true,
        id: data.id,
        url: `https://ops.heyhenry.io/competitors/${data.id}`,
      });
    }),
  );
}
