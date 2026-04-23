import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';
const LANES = ['product', 'marketing', 'ops', 'sales', 'research'];
const STATUSES = ['backlog', 'up_next', 'in_progress', 'done', 'archived'];
export function registerRoadmapTools(server) {
    server.tool('roadmap_list', 'List roadmap items, ordered by most-recent status change. Filter by lane (product/marketing/ops/sales/research) or status. Archived items are excluded.', {
        lane: z.enum(LANES).optional(),
        status: z.enum(STATUSES).optional(),
        limit: z.number().int().min(1).max(500).default(50),
    }, async ({ lane, status, limit }) => {
        try {
            const q = new URLSearchParams({ limit: String(limit) });
            if (lane)
                q.set('lane', lane);
            if (status)
                q.set('status', status);
            const data = await opsRequest('GET', `/api/ops/roadmap?${q.toString()}`);
            const rows = data.items;
            if (rows.length === 0)
                return textResult('No roadmap items match.');
            let out = `${rows.length} item(s):\n\n`;
            for (const i of rows) {
                out += `[${i.lane}] [${i.status}]`;
                if (i.priority)
                    out += ` P${i.priority}`;
                out += ` ${i.title}\n`;
                if (i.assignee)
                    out += `  assignee: ${i.assignee}\n`;
                out += `  status_changed: ${formatDateTime(i.status_changed_at)} | id: ${i.id}\n\n`;
            }
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('roadmap_get', 'Fetch a roadmap item by id with full body.', { id: z.string().uuid() }, async ({ id }) => {
        try {
            const data = await opsRequest('GET', `/api/ops/roadmap/${id}`);
            const i = data.item;
            let out = `[${i.lane}] [${i.status}]`;
            if (i.priority)
                out += ` P${i.priority}`;
            out += ` ${i.title}\n`;
            out += `Created: ${formatDateTime(i.created_at)} by ${i.actor_name ?? 'unknown'}\n`;
            if (i.assignee)
                out += `Assignee: ${i.assignee}\n`;
            if (i.tags?.length)
                out += `Tags: ${i.tags.join(', ')}\n`;
            out += '\n';
            if (i.body)
                out += `${i.body}\n`;
            out += `\nid: ${i.id}`;
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('roadmap_create', 'Add a roadmap item. Pick the right lane: `product` (build), `marketing` (campaigns/content), `ops` (internal tooling), `sales` (deals/outreach), `research` (learn before build). Default status is `backlog` — only set `up_next` if you are confident this is the next thing.', {
        lane: z.enum(LANES),
        title: z.string().min(1).max(500),
        body: z.string().max(20000).optional().nullable(),
        status: z.enum(['backlog', 'up_next', 'in_progress', 'done']).optional(),
        priority: z.number().int().min(1).max(5).optional().nullable().describe('1=highest, 5=lowest'),
        assignee: z.string().max(200).optional().nullable(),
        tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    }, async (input) => {
        try {
            const data = await opsRequest('POST', `/api/ops/roadmap`, {
                actor_name: actorName(),
                ...input,
            });
            return textResult(`Roadmap item created.\nid: ${data.id}\n${data.url}`);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('roadmap_update_status', 'Move a roadmap item to a new status (and optionally re-prioritize / reassign in the same call). Each change is logged to roadmap_activity automatically.', {
        id: z.string().uuid(),
        status: z.enum(STATUSES).optional(),
        priority: z.number().int().min(1).max(5).nullable().optional(),
        assignee: z.string().max(200).nullable().optional(),
    }, async ({ id, ...patch }) => {
        try {
            await opsRequest('PATCH', `/api/ops/roadmap/${id}`, patch);
            return textResult(`Roadmap item ${id} updated.`);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
}
//# sourceMappingURL=roadmap.js.map