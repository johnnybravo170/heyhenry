import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { sendOpsSms } from '@/lib/twilio';
import { jsonResult, type McpToolCtx, withAudit } from './context';

export function registerEscalateTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'escalate_sms',
    'Send an SMS escalation to Jonathan for a high/critical incident. Pass the incident_id (from incidents_open) and a short message (≤1500 chars). Marks incidents.sms_escalated_at = now() on success. Use sparingly — this pages Jonathan.',
    {
      incident_id: z.string().uuid(),
      message: z.string().min(1).max(1500),
    },
    withAudit(ctx, 'escalate_sms', 'write:escalate', async ({ incident_id, message }) => {
      const service = createServiceClient();
      const { data: incident } = await service
        .schema('ops')
        .from('incidents')
        .select('id')
        .eq('id', incident_id)
        .maybeSingle();
      if (!incident) throw new Error('Incident not found');

      const result = await sendOpsSms(message);
      if (!result.ok) throw new Error(result.error);

      await service
        .schema('ops')
        .from('incidents')
        .update({
          sms_escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', incident_id);

      return jsonResult({ ok: true, sid: result.sid });
    }),
  );
}
