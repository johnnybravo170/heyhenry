import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

export function registerWorklogTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'worklog_list',
    'List worklog entries (most recent first). Optional `since` ISO timestamp and freetext `q` (matches title/body).',
    {
      since: z.string().datetime().optional(),
      q: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    withAudit(ctx, 'worklog_list', 'read:worklog', async ({ since, q, limit }) => {
      const service = createServiceClient();
      let query = service
        .schema('ops')
        .from('worklog_entries')
        .select('id, actor_type, actor_name, category, site, title, body, tags, created_at')
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (since) query = query.gte('created_at', since);
      if (q) query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return jsonResult({ entries: data ?? [] });
    }),
  );

  server.tool(
    'worklog_add',
    'Append a worklog entry. Use to record what you did this run — keeps a human-readable audit trail beyond the raw audit_log.',
    {
      title: z.string().min(1).max(500),
      body: z.string().max(20000).optional().nullable(),
      category: z.string().max(50).optional().nullable(),
      site: z.string().max(50).optional().nullable(),
      tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    },
    withAudit(ctx, 'worklog_add', 'write:worklog', async (input) => {
      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .from('worklog_entries')
        .insert({
          actor_type: 'agent',
          actor_name: ctx.actorName,
          key_id: ctx.keyId,
          title: input.title,
          body: input.body ?? null,
          category: input.category ?? null,
          site: input.site ?? null,
          tags: input.tags ?? [],
        })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Insert failed');
      return jsonResult({ ok: true, id: data.id });
    }),
  );
}
