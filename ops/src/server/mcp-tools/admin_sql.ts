import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { jsonResult, type McpToolCtx, withAudit } from './context';

// Defense-in-depth guard. The DB enforces the real boundary (cc_readonly role,
// READ ONLY txn, subquery wrapping), but reject obvious non-reads early so the
// agent gets a clear message instead of a Postgres error.
function rejectReason(q: string): string | null {
  const trimmed = q.trim();
  if (!trimmed) return 'Query is empty.';
  if (!/^(select|with)\b/i.test(trimmed)) return 'Only SELECT / WITH queries are allowed.';
  if (trimmed.includes(';')) return 'Send a single statement with no semicolons.';
  return null;
}

export function registerAdminSqlTools(server: McpServer, ctx: McpToolCtx) {
  server.tool(
    'admin_sql_read',
    [
      'Run a read-only SELECT against the platform DB to ground a recommendation',
      'in live state (e.g. "how many active tenants per plan/vertical?").',
      '',
      'Runs as a restricted read-only role in a READ ONLY transaction. You can',
      'ONLY read curated, non-PII views in the `ops` schema (e.g. ops.cc_tenants).',
      'Base tables and tenant PII are not reachable. Schema-qualify every',
      'relation (search_path is empty): `select count(*) from ops.cc_tenants`.',
      'Single SELECT only; no semicolons. Results are capped (max_rows, ≤1000).',
    ].join('\n'),
    {
      query: z.string().min(1).max(5000),
      max_rows: z.number().int().min(1).max(1000).default(200),
    },
    withAudit(ctx, 'admin_sql_read', 'read:db', async ({ query, max_rows }) => {
      const reason = rejectReason(query);
      if (reason) return jsonResult({ ok: false, error: reason });

      const service = createServiceClient();
      const { data, error } = await service
        .schema('ops')
        .rpc('cc_readonly_query', { q: query, max_rows });
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as unknown[];
      return jsonResult({ ok: true, row_count: rows.length, rows });
    }),
  );
}
