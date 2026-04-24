import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

export function registerDecisionTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'decisions_list',
    'List decisions (excludes archived), most recent first. Optional `status` filter.',
    {
      status: z.string().max(50).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    withAudit(ctx, 'decisions_list', 'read:decisions', async ({ status, limit }) => {
      const service = createServiceClient();
      let q = service
        .schema('ops')
        .from('decisions')
        .select(
          'id, title, hypothesis, action, status, actor_type, actor_name, tags, created_at, updated_at',
        )
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return jsonResult({ decisions: data ?? [] });
    }),
  );

  server.tool(
    'decisions_add',
    [
      'See ops_memory_guide for the full taxonomy.',
      '',
      'Record a CHOICE we made, with reasoning. Use when: Jonathan picks option A over B, an architectural call is made, a strategic direction is committed. Always include the rationale (put it in `hypothesis`). Decisions can later have outcomes recorded on them. DO NOT use for ideas-still-being-explored (\u2192 ideas_add) or facts that aren\u2019t choices (\u2192 knowledge_write).',
      '',
      'Record a decision: title, hypothesis (the bet), and optional action (what we will do about it).',
    ].join('\n'),
    {
      title: z.string().min(1).max(500),
      hypothesis: z.string().min(1).max(20000),
      action: z.string().max(20000).optional().nullable(),
      tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    },
    withAudit(ctx, 'decisions_add', 'write:decisions', async (input) => {
      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .from('decisions')
        .insert({
          actor_type: 'agent',
          actor_name: ctx.actorName,
          key_id: ctx.keyId,
          title: input.title,
          hypothesis: input.hypothesis,
          action: input.action ?? null,
          tags: input.tags ?? [],
        })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Insert failed');
      return jsonResult({
        ok: true,
        id: data.id,
        url: `https://ops.heyhenry.io/decisions/${data.id}`,
      });
    }),
  );
}
