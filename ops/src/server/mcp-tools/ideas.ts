import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

export function registerIdeaTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'ideas_list',
    'List ideas (excludes archived), most recent first. Optional `status` filter.',
    {
      status: z.string().max(50).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    withAudit(ctx, 'ideas_list', 'read:ideas', async ({ status, limit }) => {
      const service = createServiceClient();
      let q = service
        .schema('ops')
        .from('ideas')
        .select(
          'id, actor_type, actor_name, title, body, status, rating, assignee, tags, created_at, updated_at',
        )
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return jsonResult({ ideas: data ?? [] });
    }),
  );

  server.tool(
    'ideas_get',
    'Fetch a single idea with comments and followups.',
    { id: z.string().uuid() },
    withAudit(ctx, 'ideas_get', 'read:ideas', async ({ id }) => {
      const service = createServiceClient();
      const [idea, comments, followups] = await Promise.all([
        service
          .schema('ops')
          .from('ideas')
          .select(
            'id, actor_type, actor_name, title, body, status, rating, assignee, tags, created_at, updated_at, archived_at',
          )
          .eq('id', id)
          .maybeSingle(),
        service
          .schema('ops')
          .from('idea_comments')
          .select('id, actor_type, actor_name, body, created_at')
          .eq('idea_id', id)
          .order('created_at'),
        service
          .schema('ops')
          .from('idea_followups')
          .select('id, kind, payload, resolved_at, resolved_by_system, created_at')
          .eq('idea_id', id)
          .order('created_at', { ascending: false }),
      ]);
      if (!idea.data) throw new Error('Not found');
      return jsonResult({
        idea: idea.data,
        comments: comments.data ?? [],
        followups: followups.data ?? [],
      });
    }),
  );

  server.tool(
    'ideas_add',
    'File a new idea for Jonathan. Use for: feature suggestions, observations worth saving, things you noticed but did not act on. Returns a deep link.',
    {
      title: z.string().min(1).max(500),
      body: z.string().max(20000).optional().nullable(),
      tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    },
    withAudit(ctx, 'ideas_add', 'write:ideas', async (input) => {
      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .from('ideas')
        .insert({
          actor_type: 'agent',
          actor_name: ctx.actorName,
          key_id: ctx.keyId,
          title: input.title,
          body: input.body ?? null,
          tags: input.tags ?? [],
        })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Insert failed');
      return jsonResult({
        ok: true,
        id: data.id,
        url: `https://ops.heyhenry.io/ideas/${data.id}`,
      });
    }),
  );
}
