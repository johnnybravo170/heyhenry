import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sendOpsEmail } from '@/server/ops-services/email';
import { renderQueueDigest } from '@/server/ops-services/queue-digest';
import { jsonResult, type McpToolCtx, withAudit } from './context';

const DIGEST_DEFAULT_TO = 'jonathan@smartfusion.ca';

export function registerEmailTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'ops_email_send',
    [
      'Send an email via HeyHenry ops (Postmark-backed).',
      'Use for: transactional sends from agents (digests, alerts, handoffs).',
      'DO NOT use for: bulk marketing (use the autoresponder for that),',
      'per-customer invoices (use the in-app invoice flow).',
    ].join(' '),
    {
      to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
      from: z.string().optional(),
      subject: z.string().min(1).max(250),
      html: z.string().optional(),
      text: z.string().optional(),
      reply_to: z.string().email().optional(),
      tags: z
        .array(
          z.object({
            name: z.string().min(1).max(256),
            value: z.string().min(1).max(256),
          }),
        )
        .optional(),
    },
    withAudit(ctx, 'ops_email_send', 'write:email', async (input) => {
      if (!input.html && !input.text) {
        throw new Error('At least one of html or text is required');
      }
      const result = await sendOpsEmail(input, {
        keyId: ctx.keyId,
        path: '/api/mcp/ops_email_send',
        method: 'POST',
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return jsonResult({
        ok: true,
        id: result.id,
        to: result.to,
        subject: result.subject,
      });
    }),
  );

  server.tool(
    'ops_digest_send',
    [
      'Send the Command Center morning digest from STRUCTURED data — you pass',
      'the counts, the single highest-leverage item, and the collapsed',
      'per-stream lists; the formatter renders consistent email-safe HTML +',
      'plain text. Use this for the daily triage digest instead of',
      'hand-composing HTML in ops_email_send. Defaults to Jonathan.',
      'Keep `counts` in urgency order. One line per item — do NOT cram',
      'multiple items into one teaser.',
    ].join(' '),
    {
      to: z.union([z.string().email(), z.array(z.string().email()).min(1)]).optional(),
      subject: z.string().min(1).max(250).optional(),
      date_label: z.string().max(60).optional(),
      counts: z
        .array(z.object({ label: z.string().min(1).max(40), count: z.number().int().min(0) }))
        .min(1),
      top_item: z
        .object({
          severity: z.enum(['fire', 'normal']).optional(),
          title: z.string().min(1).max(300),
          body: z.string().min(1).max(4000),
        })
        .optional(),
      streams: z
        .array(
          z.object({
            label: z.string().min(1).max(40),
            items: z
              .array(
                z.object({
                  title: z.string().min(1).max(200),
                  teaser: z.string().max(300).optional(),
                }),
              )
              .max(20),
          }),
        )
        .max(8)
        .optional(),
      reply_to: z.string().email().optional(),
      from: z.string().optional(),
    },
    withAudit(ctx, 'ops_digest_send', 'write:email', async (input) => {
      const rendered = renderQueueDigest({
        subject: input.subject,
        dateLabel: input.date_label,
        counts: input.counts,
        topItem: input.top_item,
        streams: input.streams,
      });
      const result = await sendOpsEmail(
        {
          to: input.to ?? DIGEST_DEFAULT_TO,
          from: input.from,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          reply_to: input.reply_to,
          tags: [{ name: 'kind', value: 'command-center-digest' }],
        },
        { keyId: ctx.keyId, path: '/api/mcp/ops_digest_send', method: 'POST' },
      );
      if (!result.ok) {
        throw new Error(result.error);
      }
      return jsonResult({ ok: true, id: result.id, to: result.to, subject: result.subject });
    }),
  );
}
