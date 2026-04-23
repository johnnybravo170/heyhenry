import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

const CHANNELS = ['blog', 'twitter', 'linkedin', 'youtube_short', 'reddit', 'other'] as const;
const STATUSES = ['draft', 'approved', 'posted', 'rejected'] as const;

export function registerSocialDraftTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'social_drafts_list',
    'List social drafts. Filter by status (draft/approved/posted/rejected) or channel.',
    {
      status: z.enum(STATUSES).optional(),
      channel: z.enum(CHANNELS).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    withAudit(ctx, 'social_drafts_list', 'read:social', async ({ status, channel, limit }) => {
      const service = createServiceClient();
      let q = service
        .schema('ops')
        .from('social_drafts')
        .select(
          'id, topic, channel, draft_body, source_pain_points, status, posted_at, posted_url, actor_name, created_at, updated_at',
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status) q = q.eq('status', status);
      if (channel) q = q.eq('channel', channel);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return jsonResult({ social_drafts: data ?? [] });
    }),
  );

  server.tool(
    'social_drafts_create',
    'Create a new social draft for Jonathan to review. Defaults to status=draft. Include the source pain points (e.g. customer quotes, competitor moves) that triggered the draft so he can judge it in context.',
    {
      topic: z.string().min(1).max(500),
      channel: z.enum(CHANNELS),
      draft_body: z.string().min(1).max(50000),
      source_pain_points: z.array(z.unknown()).optional(),
      status: z.enum(STATUSES).optional().default('draft'),
    },
    withAudit(ctx, 'social_drafts_create', 'write:social', async (input) => {
      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .from('social_drafts')
        .insert({
          actor_type: 'agent',
          actor_name: ctx.actorName,
          key_id: ctx.keyId,
          topic: input.topic,
          channel: input.channel,
          draft_body: input.draft_body,
          source_pain_points: input.source_pain_points ?? [],
          status: input.status ?? 'draft',
        })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Insert failed');
      return jsonResult({
        ok: true,
        id: data.id,
        url: `https://ops.heyhenry.io/social-drafts/${data.id}`,
      });
    }),
  );

  server.tool(
    'social_drafts_update',
    'Update a draft (e.g. mark as posted with URL). Setting status=posted auto-stamps posted_at if not given.',
    {
      id: z.string().uuid(),
      status: z.enum(STATUSES).optional(),
      draft_body: z.string().min(1).max(50000).optional(),
      posted_at: z.string().datetime().nullable().optional(),
      posted_url: z.string().max(2000).nullable().optional(),
    },
    withAudit(ctx, 'social_drafts_update', 'write:social', async ({ id, ...input }) => {
      const service = createServiceClient();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.status !== undefined) {
        patch.status = input.status;
        if (input.status === 'posted' && input.posted_at === undefined) {
          patch.posted_at = new Date().toISOString();
        }
      }
      if (input.draft_body !== undefined) patch.draft_body = input.draft_body;
      if (input.posted_at !== undefined) patch.posted_at = input.posted_at;
      if (input.posted_url !== undefined) patch.posted_url = input.posted_url;
      const { error } = await service
        .schema('ops')
        .from('social_drafts')
        .update(patch)
        .eq('id', id);
      if (error) throw new Error(error.message);
      return jsonResult({ ok: true });
    }),
  );
}
