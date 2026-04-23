import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';

const SOURCES = ['app_error', 'qa_failure', 'security_probe', 'customer_pulse', 'other'] as const;
const SEVERITIES = ['low', 'med', 'high', 'critical'] as const;
const STATUSES = ['open', 'triaging', 'resolved', 'wontfix'] as const;

type Incident = {
  id: string;
  source: string;
  severity: string;
  status: string;
  title: string;
  body: string | null;
  assigned_agent: string | null;
  context: Record<string, unknown> | null;
  resolved_at: string | null;
  sms_escalated_at: string | null;
  actor_name: string | null;
  created_at: string;
  updated_at: string;
};

export function registerIncidentTools(server: McpServer) {
  server.tool(
    'incidents_open',
    'Open a new incident. Call this when you detect something broken, a flaky test, a failing security probe, or a recurring customer complaint that needs Jonathan to look at it. Pick severity honestly: `critical` will likely get escalated by SMS, `low` will sit in the queue.',
    {
      source: z.enum(SOURCES),
      severity: z.enum(SEVERITIES),
      title: z.string().min(1).max(500).describe('One-sentence summary'),
      body: z
        .string()
        .max(50000)
        .optional()
        .nullable()
        .describe('Full details, repro steps, links'),
      assigned_agent: z.string().max(200).optional().nullable(),
      context: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Structured context — error stack, request id, customer id, etc.'),
      status: z.enum(STATUSES).optional().default('open'),
    },
    async (input) => {
      try {
        const data = await opsRequest<{ id: string; url: string }>('POST', `/api/ops/incidents`, {
          actor_name: actorName(),
          ...input,
        });
        return textResult(`Incident opened.\nid: ${data.id}\n${data.url}`);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );

  server.tool(
    'incidents_list_open',
    'List open and triaging incidents — what currently needs attention. Use this BEFORE opening a new one to check for duplicates.',
    {
      severity: z.enum(SEVERITIES).optional(),
      source: z.enum(SOURCES).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ severity, source, limit }) => {
      try {
        // The list endpoint takes a single status filter; we want both `open`
        // and `triaging`, so issue them in parallel and merge.
        const params = (status: string) => {
          const q = new URLSearchParams({ status, limit: String(limit) });
          if (severity) q.set('severity', severity);
          if (source) q.set('source', source);
          return q.toString();
        };
        const [openRes, triagRes] = await Promise.all([
          opsRequest<{ incidents: Incident[] }>('GET', `/api/ops/incidents?${params('open')}`),
          opsRequest<{ incidents: Incident[] }>('GET', `/api/ops/incidents?${params('triaging')}`),
        ]);
        const rows = [...openRes.incidents, ...triagRes.incidents].sort((a, b) =>
          a.created_at < b.created_at ? 1 : -1,
        );
        if (rows.length === 0) return textResult('No open or triaging incidents.');
        let out = `${rows.length} incident(s):\n\n`;
        for (const i of rows) {
          out += `[${i.severity.toUpperCase()}] [${i.status}] ${i.title}\n`;
          out += `  source: ${i.source} | created: ${formatDateTime(i.created_at)}`;
          if (i.assigned_agent) out += ` | assigned: ${i.assigned_agent}`;
          if (i.sms_escalated_at) out += ` | SMS-paged: ${formatDateTime(i.sms_escalated_at)}`;
          out += `\n  id: ${i.id}\n\n`;
        }
        return textResult(out);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );

  server.tool(
    'incidents_get',
    'Fetch one incident by id with full body and context.',
    { id: z.string().uuid() },
    async ({ id }) => {
      try {
        const data = await opsRequest<{ item: Incident }>('GET', `/api/ops/incidents/${id}`);
        const i = data.item;
        let out = `[${i.severity.toUpperCase()}] [${i.status}] ${i.title}\n`;
        out += `Source: ${i.source}\n`;
        out += `Created: ${formatDateTime(i.created_at)} by ${i.actor_name ?? 'unknown'}\n`;
        if (i.assigned_agent) out += `Assigned: ${i.assigned_agent}\n`;
        if (i.resolved_at) out += `Resolved: ${formatDateTime(i.resolved_at)}\n`;
        if (i.sms_escalated_at) out += `SMS escalated: ${formatDateTime(i.sms_escalated_at)}\n`;
        out += '\n';
        if (i.body) out += `${i.body}\n\n`;
        if (i.context && Object.keys(i.context).length > 0) {
          out += `Context:\n${JSON.stringify(i.context, null, 2)}\n`;
        }
        out += `\nid: ${i.id}`;
        return textResult(out);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );

  server.tool(
    'incidents_update_status',
    'Move an incident through its lifecycle (triaging → resolved/wontfix). Reassign to a different agent at the same time if needed. Resolving auto-stamps resolved_at.',
    {
      id: z.string().uuid(),
      status: z.enum(STATUSES).optional(),
      assigned_agent: z.string().max(200).nullable().optional(),
    },
    async ({ id, ...patch }) => {
      try {
        await opsRequest('PATCH', `/api/ops/incidents/${id}`, patch);
        return textResult(`Incident ${id} updated.`);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );

  server.tool(
    'incidents_escalate_sms',
    "Send an SMS to Jonathan about a critical incident. Only use this for genuinely time-sensitive things — site is down, security incident in progress, customer-facing data leak. The message you pass IS the SMS body, so write it in plain English under 160 chars when possible. The incident's sms_escalated_at gets stamped automatically.",
    {
      incident_id: z.string().uuid(),
      message: z.string().min(1).max(1500).describe('The exact SMS text Jonathan will see'),
    },
    async (input) => {
      try {
        const data = await opsRequest<{ sid: string }>('POST', `/api/ops/escalate-sms`, input);
        return textResult(`SMS sent. Twilio sid: ${data.sid}`);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );
}
