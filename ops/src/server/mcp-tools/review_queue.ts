import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

const LIST_CAP = 50;
const STALE_DAYS = 7;

export function registerReviewQueueTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'review_queue_fetch',
    'Aggregator: returns the four "needs Jonathan" stacks — pending social_drafts, open/triaging incidents, stale (>7d) competitor cards, and recently-written docs. Use as the starting prompt for a daily-digest agent.',
    {},
    withAudit(ctx, 'review_queue_fetch', 'read:review_queue', async () => {
      const service = createServiceClient();
      const sevenDaysAgo = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const [social, incidents, competitors, docs] = await Promise.all([
        service
          .schema('ops')
          .from('social_drafts')
          .select('id, topic, channel, draft_body, status, actor_name, created_at, updated_at')
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(LIST_CAP),
        service
          .schema('ops')
          .from('incidents')
          .select(
            'id, source, severity, status, title, assigned_agent, sms_escalated_at, actor_name, created_at, updated_at',
          )
          .in('status', ['open', 'triaging'])
          .order('severity', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(LIST_CAP),
        service
          .schema('ops')
          .from('competitors')
          .select('id, name, url, last_checked_at, edge_notes, updated_at')
          .or(`last_checked_at.is.null,last_checked_at.lt.${sevenDaysAgo}`)
          .order('last_checked_at', { ascending: true, nullsFirst: true })
          .limit(LIST_CAP),
        service
          .schema('ops')
          .from('docs')
          .select('id, commit_range, module, summary_md, file_paths, actor_name, created_at')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(LIST_CAP),
      ]);
      return jsonResult({
        social_drafts: social.data ?? [],
        incidents_open: incidents.data ?? [],
        competitors_stale: competitors.data ?? [],
        docs_recent: docs.data ?? [],
      });
    }),
  );
}
