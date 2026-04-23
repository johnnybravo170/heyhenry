import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

const LANES = ['product', 'marketing', 'ops', 'sales', 'research'] as const;
const STATUSES = ['backlog', 'up_next', 'in_progress', 'done', 'archived'] as const;

export function registerRoadmapTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'roadmap_list',
    'List roadmap items (excludes archived). Filter by lane and/or status. Sorted by status_changed_at desc.',
    {
      lane: z.enum(LANES).optional(),
      status: z.enum(STATUSES).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    withAudit(ctx, 'roadmap_list', 'read:roadmap', async ({ lane, status, limit }) => {
      const service = createServiceClient();
      let q = service
        .schema('ops')
        .from('roadmap_items')
        .select(
          'id, lane, status, priority, title, body, assignee, tags, actor_type, actor_name, source_idea_id, created_at, status_changed_at',
        )
        .neq('status', 'archived')
        .order('status_changed_at', { ascending: false })
        .limit(limit);
      if (lane) q = q.eq('lane', lane);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return jsonResult({ items: data ?? [] });
    }),
  );

  server.tool(
    'roadmap_add',
    'Add a new roadmap item. Pick the right lane (product/marketing/ops/sales/research). Default status is backlog. Priority 1-5 if known.',
    {
      lane: z.enum(LANES),
      status: z
        .enum(STATUSES.slice(0, 4) as unknown as readonly [string, ...string[]])
        .optional()
        .default('backlog'),
      priority: z.number().int().min(1).max(5).optional().nullable(),
      title: z.string().min(1).max(500),
      body: z.string().max(20000).optional().nullable(),
      assignee: z.string().max(200).optional().nullable(),
      tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    },
    withAudit(ctx, 'roadmap_add', 'write:roadmap', async (input) => {
      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .from('roadmap_items')
        .insert({
          actor_type: 'agent',
          actor_name: ctx.actorName,
          key_id: ctx.keyId,
          lane: input.lane,
          status: input.status ?? 'backlog',
          priority: input.priority ?? null,
          title: input.title,
          body: input.body ?? null,
          assignee: input.assignee ?? null,
          tags: input.tags ?? [],
        })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Insert failed');
      await service.schema('ops').from('roadmap_activity').insert({
        item_id: data.id,
        actor_type: 'agent',
        actor_name: ctx.actorName,
        kind: 'created',
        to_value: input.lane,
      });
      return jsonResult({
        ok: true,
        id: data.id,
        url: `https://ops.heyhenry.io/roadmap/${data.id}`,
      });
    }),
  );

  server.tool(
    'roadmap_update',
    'Update status/priority/assignee on a roadmap item. Each field change is logged to roadmap_activity.',
    {
      id: z.string().uuid(),
      status: z.enum(STATUSES).optional(),
      priority: z.number().int().min(1).max(5).nullable().optional(),
      assignee: z.string().max(200).nullable().optional(),
    },
    withAudit(ctx, 'roadmap_update', 'write:roadmap', async ({ id, ...input }) => {
      const service = createServiceClient();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.status !== undefined) {
        patch.status = input.status;
        patch.status_changed_at = new Date().toISOString();
      }
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.assignee !== undefined) patch.assignee = input.assignee;
      const { error } = await service
        .schema('ops')
        .from('roadmap_items')
        .update(patch)
        .eq('id', id);
      if (error) throw new Error(error.message);
      for (const [k, v] of Object.entries(input)) {
        if (v === undefined) continue;
        await service
          .schema('ops')
          .from('roadmap_activity')
          .insert({
            item_id: id,
            actor_type: 'agent',
            actor_name: ctx.actorName,
            kind:
              k === 'status'
                ? 'status_changed'
                : k === 'priority'
                  ? 'priority_changed'
                  : 'assigned',
            to_value: v == null ? null : String(v),
          });
      }
      return jsonResult({ ok: true });
    }),
  );
}
