import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';
export function registerIdeasTools(server) {
    server.tool('ideas_list', 'List ideas (newest first). Ideas are raw seeds — anything that might be worth doing later. They get rated, then either archived or promoted into roadmap items.', {
        status: z.string().optional().describe('Filter by status if you know it'),
        limit: z.number().int().min(1).max(500).default(50),
    }, async ({ status, limit }) => {
        try {
            const q = new URLSearchParams({ limit: String(limit) });
            if (status)
                q.set('status', status);
            const data = await opsRequest('GET', `/api/ops/ideas?${q.toString()}`);
            const rows = data.ideas;
            if (rows.length === 0)
                return textResult('No ideas match.');
            let out = `${rows.length} idea(s):\n\n`;
            for (const i of rows) {
                out += `${i.title}`;
                if (i.rating)
                    out += ` (★${i.rating})`;
                out += '\n';
                out += `  ${formatDateTime(i.created_at)} by ${i.actor_name ?? 'unknown'}`;
                if (i.status)
                    out += ` | ${i.status}`;
                if (i.tags?.length)
                    out += ` | #${i.tags.join(' #')}`;
                out += '\n';
                if (i.body) {
                    const t = i.body.length > 200 ? `${i.body.slice(0, 200)}...` : i.body;
                    out += `  ${t.replace(/\n/g, ' ')}\n`;
                }
                out += `  id: ${i.id}\n\n`;
            }
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('ideas_create', 'File a new idea. Low bar — anything that occurs to you while doing other work. Better to over-file than to lose it. The body should explain WHY it might matter, not just WHAT.', {
        title: z.string().min(1).max(500),
        body: z.string().max(20000).optional().nullable(),
        tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    }, async (input) => {
        try {
            const data = await opsRequest('POST', `/api/ops/ideas`, {
                actor_name: actorName(),
                ...input,
            });
            return textResult(`Idea filed.\nid: ${data.id}\n${data.url}`);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
}
//# sourceMappingURL=ideas.js.map