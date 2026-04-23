import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';
export function registerWorklogTools(server) {
    server.tool('worklog_add_note', 'Drop a note into the work log. Use this constantly: anything you observed, decided, tried, or learned while working — short or long. Categorize and tag generously so future searches find it. This is your memory across runs.', {
        title: z.string().min(1).max(500),
        body: z.string().max(20000).optional().nullable(),
        category: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .describe('e.g. "research", "bug", "decision"'),
        site: z.string().max(50).optional().nullable().describe('Brand/site shortname if applicable'),
        tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    }, async (input) => {
        try {
            const data = await opsRequest('POST', `/api/ops/worklog`, {
                actor_name: actorName(),
                ...input,
            });
            return textResult(`Worklog entry added.\nid: ${data.id}`);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('worklog_search', 'Search worklog entries by free-text (matches title and body, ILIKE), optionally limited to entries since a given ISO datetime. Use to find prior work before re-doing it.', {
        q: z.string().min(1).max(2000).optional(),
        since: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(500).default(50),
    }, async ({ q, since, limit }) => {
        try {
            const params = new URLSearchParams({ limit: String(limit) });
            if (q)
                params.set('q', q);
            if (since)
                params.set('since', since);
            const data = await opsRequest('GET', `/api/ops/worklog?${params.toString()}`);
            const rows = data.entries;
            if (rows.length === 0)
                return textResult('No worklog entries match.');
            let out = `${rows.length} entr(y/ies):\n\n`;
            for (const e of rows) {
                out += `[${formatDateTime(e.created_at)}] ${e.title}\n`;
                out += `  by ${e.actor_name ?? 'unknown'}`;
                if (e.category)
                    out += ` | ${e.category}`;
                if (e.site)
                    out += ` | ${e.site}`;
                if (e.tags?.length)
                    out += ` | #${e.tags.join(' #')}`;
                out += '\n';
                if (e.body) {
                    const t = e.body.length > 200 ? `${e.body.slice(0, 200)}...` : e.body;
                    out += `  ${t.replace(/\n/g, ' ')}\n`;
                }
                out += `  id: ${e.id}\n\n`;
            }
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
}
//# sourceMappingURL=worklog.js.map