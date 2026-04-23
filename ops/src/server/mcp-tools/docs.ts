import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

export function registerDocsTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'docs_list',
    'List generated commit-range docs, most-recent first. Optional `module` filter.',
    {
      module: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    withAudit(ctx, 'docs_list', 'read:docs', async ({ module, limit }) => {
      const service = createServiceClient();
      let q = service
        .schema('ops')
        .from('docs')
        .select('id, commit_range, module, summary_md, file_paths, actor_name, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (module) q = q.eq('module', module);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return jsonResult({ docs: data ?? [] });
    }),
  );

  server.tool(
    'docs_write',
    'Upsert a generated doc keyed by `commit_range`. Re-running on the same range overwrites the prior summary. `module` is the area of the codebase summarized (e.g. "ops/agent-platform").',
    {
      commit_range: z.string().min(1).max(200),
      module: z.string().min(1).max(200),
      summary_md: z.string().min(1).max(200000),
      file_paths: z.array(z.string().min(1).max(1000)).max(500).optional(),
    },
    withAudit(ctx, 'docs_write', 'write:docs', async (input) => {
      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .from('docs')
        .upsert(
          {
            actor_type: 'agent',
            actor_name: ctx.actorName,
            key_id: ctx.keyId,
            commit_range: input.commit_range,
            module: input.module,
            summary_md: input.summary_md,
            file_paths: input.file_paths ?? [],
          },
          { onConflict: 'commit_range' },
        )
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Upsert failed');
      return jsonResult({
        ok: true,
        id: data.id,
        url: `https://ops.heyhenry.io/docs/${data.id}`,
      });
    }),
  );
}
