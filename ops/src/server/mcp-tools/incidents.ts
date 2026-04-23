import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

const SOURCES = ['app_error', 'qa_failure', 'security_probe', 'customer_pulse', 'other'] as const;
const SEVERITIES = ['low', 'med', 'high', 'critical'] as const;
const STATUSES = ['open', 'triaging', 'resolved', 'wontfix'] as const;

export function registerIncidentTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'incidents_list',
    'List incidents (open / triaging / resolved / wontfix), most-recent first. Optional filters: status, severity, source.',
    {
      status: z.enum(STATUSES).optional(),
      severity: z.enum(SEVERITIES).optional(),
      source: z.enum(SOURCES).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    withAudit(
      ctx,
      'incidents_list',
      'read:incidents',
      async ({ status, severity, source, limit }) => {
        const service = createServiceClient();
        let q = service
          .schema('ops')
          .from('incidents')
          .select(
            'id, source, severity, status, title, body, assigned_agent, context, resolved_at, sms_escalated_at, actor_name, created_at, updated_at',
          )
          .order('created_at', { ascending: false })
          .limit(limit);
        if (status) q = q.eq('status', status);
        if (severity) q = q.eq('severity', severity);
        if (source) q = q.eq('source', source);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return jsonResult({ incidents: data ?? [] });
      },
    ),
  );

  server.tool(
    'incidents_open',
    'Open a new incident. Source = where it came from; severity = how urgent. Use this for: app errors, flaky/failing CI, security-probe findings, customer-pulse pain spikes. For high/critical, follow up with `escalate_sms` after opening.',
    {
      source: z.enum(SOURCES),
      severity: z.enum(SEVERITIES),
      status: z.enum(STATUSES).optional().default('open'),
      title: z.string().min(1).max(500),
      body: z.string().max(50000).optional().nullable(),
      assigned_agent: z.string().max(200).optional().nullable(),
      context: z.record(z.string(), z.unknown()).optional(),
    },
    withAudit(ctx, 'incidents_open', 'write:incidents', async (input) => {
      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .from('incidents')
        .insert({
          actor_type: 'agent',
          actor_name: ctx.actorName,
          key_id: ctx.keyId,
          source: input.source,
          severity: input.severity,
          status: input.status ?? 'open',
          title: input.title,
          body: input.body ?? null,
          assigned_agent: input.assigned_agent ?? null,
          context: input.context ?? {},
        })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Insert failed');
      return jsonResult({
        ok: true,
        id: data.id,
        url: `https://ops.heyhenry.io/incidents/${data.id}`,
      });
    }),
  );

  server.tool(
    'incidents_update',
    'Update an incident: change status, reassign, set resolved_at. Moving to resolved/wontfix auto-stamps resolved_at if not provided.',
    {
      id: z.string().uuid(),
      status: z.enum(STATUSES).optional(),
      assigned_agent: z.string().max(200).nullable().optional(),
      resolved_at: z.string().datetime().nullable().optional(),
    },
    withAudit(ctx, 'incidents_update', 'write:incidents', async ({ id, ...input }) => {
      const service = createServiceClient();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.status !== undefined) {
        patch.status = input.status;
        if (
          (input.status === 'resolved' || input.status === 'wontfix') &&
          input.resolved_at === undefined
        ) {
          patch.resolved_at = new Date().toISOString();
        }
      }
      if (input.assigned_agent !== undefined) patch.assigned_agent = input.assigned_agent;
      if (input.resolved_at !== undefined) patch.resolved_at = input.resolved_at;
      const { error } = await service.schema('ops').from('incidents').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
      return jsonResult({ ok: true });
    }),
  );
}
