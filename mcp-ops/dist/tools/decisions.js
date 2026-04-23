import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';
export function registerDecisionTools(server) {
    server.tool('decisions_list', 'List recorded decisions (a hypothesis + the action taken on it, then later the outcome). Use to find out whether something has already been tried before re-trying it.', {
        status: z
            .string()
            .optional()
            .describe('Filter by status, e.g. "open", "measuring", "learned"'),
        limit: z.number().int().min(1).max(500).default(50),
    }, async ({ status, limit }) => {
        try {
            const q = new URLSearchParams({ limit: String(limit) });
            if (status)
                q.set('status', status);
            const data = await opsRequest('GET', `/api/ops/decisions?${q.toString()}`);
            const rows = data.decisions;
            if (rows.length === 0)
                return textResult('No decisions match.');
            let out = `${rows.length} decision(s):\n\n`;
            for (const d of rows) {
                out += `[${d.status}] ${d.title}\n`;
                out += `  ${formatDateTime(d.created_at)} by ${d.actor_name ?? 'unknown'}`;
                if (d.tags?.length)
                    out += ` | #${d.tags.join(' #')}`;
                out += '\n';
                const t = d.hypothesis.length > 200 ? `${d.hypothesis.slice(0, 200)}...` : d.hypothesis;
                out += `  hypothesis: ${t.replace(/\n/g, ' ')}\n`;
                out += `  id: ${d.id}\n\n`;
            }
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('decisions_create', 'Record a new decision: state the hypothesis ("X will improve Y") and the action being taken ("we are doing Z"). Later, attach an outcome with `decisions_record_outcome`.', {
        title: z.string().min(1).max(500),
        hypothesis: z.string().min(1).max(20000).describe('What you believe will happen and why'),
        action: z.string().max(20000).optional().nullable().describe('What you are doing about it'),
        tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    }, async (input) => {
        try {
            const data = await opsRequest('POST', `/api/ops/decisions`, {
                actor_name: actorName(),
                ...input,
            });
            return textResult(`Decision recorded.\nid: ${data.id}\n${data.url}`);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('decisions_record_outcome', 'Append an outcome (with optional metrics) to a decision. Set `conclude=true` once you are done measuring — that flips the decision status to `learned` and stops further attention. Pass interim outcomes with `conclude=false`.', {
        decision_id: z.string().uuid(),
        body: z.string().min(1).max(20000).describe('What happened, in plain language'),
        metrics: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Structured numbers — conversion rate, revenue lift, latency, etc.'),
        conclude: z.boolean().default(false),
    }, async ({ decision_id, ...body }) => {
        try {
            await opsRequest('POST', `/api/ops/decisions/${decision_id}/outcomes`, {
                actor_name: actorName(),
                ...body,
            });
            return textResult(body.conclude
                ? `Outcome recorded; decision ${decision_id} concluded.`
                : `Interim outcome recorded for decision ${decision_id}.`);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
}
//# sourceMappingURL=decisions.js.map