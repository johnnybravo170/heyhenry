import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';

type Queue = {
  social_drafts: Array<{
    id: string;
    topic: string;
    channel: string;
    draft_body: string;
    actor_name: string | null;
    created_at: string;
  }>;
  incidents_open: Array<{
    id: string;
    severity: string;
    status: string;
    title: string;
    sms_escalated_at: string | null;
    actor_name: string | null;
    created_at: string;
  }>;
  competitors_stale: Array<{
    id: string;
    name: string;
    last_checked_at: string | null;
  }>;
  docs_recent: Array<{
    id: string;
    module: string;
    commit_range: string;
    actor_name: string | null;
    created_at: string;
  }>;
};

export function registerReviewQueueTools(server: McpServer) {
  server.tool(
    'review_queue_fetch',
    'Single round trip that returns the four stacks Jonathan reviews each day: social drafts awaiting approval, open/triaging incidents, competitor cards not checked in 7+ days, and docs created in the last 7 days. Use this as the "what needs me?" prompt at the start of a triage routine.',
    {},
    async () => {
      try {
        const q = await opsRequest<Queue>('GET', `/api/ops/review-queue`);
        let out = '';
        out += `=== Social drafts awaiting approval (${q.social_drafts.length}) ===\n`;
        for (const d of q.social_drafts) {
          out += `- [${d.channel}] ${d.topic} (${formatDateTime(d.created_at)}, id: ${d.id})\n`;
        }
        out += `\n=== Open incidents (${q.incidents_open.length}) ===\n`;
        for (const i of q.incidents_open) {
          out += `- [${i.severity}] [${i.status}] ${i.title}`;
          if (i.sms_escalated_at) out += ' (SMS-paged)';
          out += ` (id: ${i.id})\n`;
        }
        out += `\n=== Stale competitors — not checked in 7+ days (${q.competitors_stale.length}) ===\n`;
        for (const c of q.competitors_stale) {
          out += `- ${c.name} (last_checked: ${c.last_checked_at ? formatDateTime(c.last_checked_at) : 'never'}, id: ${c.id})\n`;
        }
        out += `\n=== Recent docs — last 7 days (${q.docs_recent.length}) ===\n`;
        for (const d of q.docs_recent) {
          out += `- [${d.module}] ${d.commit_range} (${formatDateTime(d.created_at)} by ${d.actor_name ?? 'unknown'}, id: ${d.id})\n`;
        }
        return textResult(out);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );
}
