import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';
export function registerCompetitorTools(server) {
    server.tool('competitors_list', 'List tracked competitors, most-recently-updated first. Use to see who we already know about before deciding to add a new one.', {
        limit: z.number().int().min(1).max(500).default(50).describe('Max rows'),
    }, async ({ limit }) => {
        try {
            const data = await opsRequest('GET', `/api/ops/competitors?limit=${limit}`);
            const rows = data.competitors;
            if (rows.length === 0)
                return textResult('No competitors tracked yet.');
            let out = `${rows.length} competitor(s):\n\n`;
            for (const c of rows) {
                out += `- ${c.name}`;
                if (c.url)
                    out += ` (${c.url})`;
                out += `\n  last_checked: ${c.last_checked_at ? formatDateTime(c.last_checked_at) : 'never'} | updated: ${formatDateTime(c.updated_at)}\n`;
                if (c.edge_notes) {
                    const t = c.edge_notes.length > 160 ? `${c.edge_notes.slice(0, 160)}...` : c.edge_notes;
                    out += `  edge: ${t}\n`;
                }
                out += `  id: ${c.id}\n`;
            }
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('competitors_get', 'Fetch one competitor card by id, including the full edge_notes and latest_findings JSON.', { id: z.string().uuid() }, async ({ id }) => {
        try {
            const data = await opsRequest(`GET`, `/api/ops/competitors/${id}`);
            const c = data.item;
            let out = `${c.name}\n`;
            if (c.url)
                out += `URL: ${c.url}\n`;
            out += `Last checked: ${c.last_checked_at ? formatDateTime(c.last_checked_at) : 'never'}\n`;
            out += `Updated: ${formatDateTime(c.updated_at)} by ${c.actor_name ?? 'unknown'}\n\n`;
            if (c.edge_notes)
                out += `Edge notes:\n${c.edge_notes}\n\n`;
            if (c.latest_findings && Object.keys(c.latest_findings).length > 0) {
                out += `Latest findings:\n${JSON.stringify(c.latest_findings, null, 2)}\n`;
            }
            out += `\nid: ${c.id}`;
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('competitors_upsert', 'Create or update a competitor card. Keyed on `name` — re-running with the same name updates the existing row. Call this whenever you learn something new about a competitor (a price change, a feature launch, a positioning shift). Set `last_checked_at` to now when you confirm a card is still current even if nothing changed.', {
        name: z.string().min(1).max(200).describe('Competitor company/product name (the dedupe key)'),
        url: z.string().max(2000).optional().nullable(),
        edge_notes: z
            .string()
            .max(20000)
            .optional()
            .nullable()
            .describe('What makes them interesting — their angle, edge, or weakness'),
        latest_findings: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Free-form JSON for structured data (pricing tiers, feature list, etc.)'),
        last_checked_at: z
            .string()
            .datetime()
            .optional()
            .describe('ISO timestamp; default to NOW when you actually inspected them today'),
    }, async (input) => {
        try {
            const data = await opsRequest('POST', `/api/ops/competitors`, {
                actor_name: actorName(),
                ...input,
            });
            return textResult(`Competitor upserted.\nid: ${data.id}\n${data.url}`);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
}
//# sourceMappingURL=competitors.js.map