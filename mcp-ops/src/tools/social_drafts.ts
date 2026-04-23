import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';

const CHANNELS = ['blog', 'twitter', 'linkedin', 'youtube_short', 'reddit', 'other'] as const;
const STATUSES = ['draft', 'approved', 'posted', 'rejected'] as const;

type Draft = {
  id: string;
  topic: string;
  channel: string;
  draft_body: string;
  source_pain_points: unknown[];
  status: string;
  posted_at: string | null;
  posted_url: string | null;
  actor_name: string | null;
  created_at: string;
  updated_at: string;
};

export function registerSocialDraftTools(server: McpServer) {
  server.tool(
    'social_drafts_list',
    "List social-media drafts. Filter by status to find what is awaiting Jonathan's approval (`draft`), what is approved but not yet posted, or the recent history.",
    {
      status: z.enum(STATUSES).optional(),
      channel: z.enum(CHANNELS).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ status, channel, limit }) => {
      try {
        const q = new URLSearchParams({ limit: String(limit) });
        if (status) q.set('status', status);
        if (channel) q.set('channel', channel);
        const data = await opsRequest<{ social_drafts: Draft[] }>(
          'GET',
          `/api/ops/social-drafts?${q.toString()}`,
        );
        const rows = data.social_drafts;
        if (rows.length === 0) return textResult('No drafts match.');
        let out = `${rows.length} draft(s):\n\n`;
        for (const d of rows) {
          out += `[${d.status}] [${d.channel}] ${d.topic}\n`;
          out += `  ${formatDateTime(d.created_at)} by ${d.actor_name ?? 'unknown'}\n`;
          const preview =
            d.draft_body.length > 200 ? `${d.draft_body.slice(0, 200)}...` : d.draft_body;
          out += `  ${preview.replace(/\n/g, ' ')}\n`;
          if (d.posted_url) out += `  posted: ${d.posted_url}\n`;
          out += `  id: ${d.id}\n\n`;
        }
        return textResult(out);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );

  server.tool(
    'social_drafts_create_draft',
    'Submit a new social-media draft for Jonathan to review. Always write the full post text in `draft_body` — do not summarize. Tie the draft back to the customer pain points it addresses via `source_pain_points` so reviewers know why this angle was chosen.',
    {
      topic: z.string().min(1).max(500).describe('Internal label, e.g. "scheduling-pain-twitter"'),
      channel: z.enum(CHANNELS),
      draft_body: z.string().min(1).max(50000).describe('The exact post copy'),
      source_pain_points: z
        .array(z.unknown())
        .optional()
        .describe('Refs to incident ids, customer-pulse quotes, or other evidence'),
    },
    async (input) => {
      try {
        const data = await opsRequest<{ id: string; url: string }>(
          'POST',
          `/api/ops/social-drafts`,
          { actor_name: actorName(), ...input },
        );
        return textResult(`Draft created.\nid: ${data.id}\n${data.url}`);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );

  server.tool(
    'social_drafts_update_status',
    'Move a draft to approved/rejected/posted. When marking `posted`, pass `posted_url` so we have a link back. posted_at auto-stamps if you do not pass it.',
    {
      id: z.string().uuid(),
      status: z.enum(['approved', 'rejected', 'posted']),
      posted_url: z.string().max(2000).nullable().optional(),
      posted_at: z.string().datetime().nullable().optional(),
      draft_body: z
        .string()
        .min(1)
        .max(50000)
        .optional()
        .describe('Edit the body in the same call'),
    },
    async ({ id, ...patch }) => {
      try {
        await opsRequest('PATCH', `/api/ops/social-drafts/${id}`, patch);
        return textResult(`Draft ${id} → ${patch.status}.`);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );
}
