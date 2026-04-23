import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, formatDateTime, textResult } from '../types.js';
export function registerDocsTools(server) {
    server.tool('docs_list', 'List recent doc-summaries, newest first. Optionally filter by module (e.g. "billing", "scheduling").', {
        module: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(500).default(50),
    }, async ({ module, limit }) => {
        try {
            const q = new URLSearchParams({ limit: String(limit) });
            if (module)
                q.set('module', module);
            const data = await opsRequest('GET', `/api/ops/docs?${q.toString()}`);
            const rows = data.docs;
            if (rows.length === 0)
                return textResult('No docs found.');
            let out = `${rows.length} doc(s):\n\n`;
            for (const d of rows) {
                out += `[${d.module}] ${d.commit_range}\n`;
                out += `  ${formatDateTime(d.created_at)} by ${d.actor_name ?? 'unknown'}\n`;
                const preview = d.summary_md.length > 200 ? `${d.summary_md.slice(0, 200)}...` : d.summary_md;
                out += `  ${preview.replace(/\n/g, ' ')}\n`;
                out += `  id: ${d.id}\n\n`;
            }
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('docs_get', 'Fetch one doc by id with its full summary_md and file_paths list.', { id: z.string().uuid() }, async ({ id }) => {
        try {
            const data = await opsRequest('GET', `/api/ops/docs/${id}`);
            const d = data.item;
            let out = `[${d.module}] ${d.commit_range}\n`;
            out += `${formatDateTime(d.created_at)} by ${d.actor_name ?? 'unknown'}\n\n`;
            out += `${d.summary_md}\n`;
            if (d.file_paths.length > 0) {
                out += `\nFiles touched (${d.file_paths.length}):\n`;
                for (const p of d.file_paths)
                    out += `  - ${p}\n`;
            }
            out += `\nid: ${d.id}`;
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('docs_upsert', 'Upsert a generated doc-summary keyed on `commit_range` (e.g. "abc1234..def5678"). Re-running the doc generator on the same range overwrites the prior summary. Use `module` to bucket by area of the codebase ("billing", "auth", "scheduling", etc.).', {
        commit_range: z.string().min(1).max(200).describe('Git ref range — the dedupe key'),
        module: z.string().min(1).max(200),
        summary_md: z.string().min(1).max(200000).describe('Full markdown summary'),
        file_paths: z.array(z.string().min(1).max(1000)).max(500).optional(),
    }, async (input) => {
        try {
            const data = await opsRequest('POST', `/api/ops/docs`, {
                actor_name: actorName(),
                ...input,
            });
            return textResult(`Doc upserted.\nid: ${data.id}\n${data.url}`);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
    server.tool('docs_search_by_module', 'Find all docs for a given module — convenience wrapper around docs_list with the module filter.', {
        module: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(500).default(50),
    }, async ({ module, limit }) => {
        try {
            const data = await opsRequest('GET', `/api/ops/docs?module=${encodeURIComponent(module)}&limit=${limit}`);
            const rows = data.docs;
            if (rows.length === 0)
                return textResult(`No docs for module "${module}".`);
            let out = `${rows.length} doc(s) in ${module}:\n\n`;
            for (const d of rows) {
                out += `- ${d.commit_range} — ${formatDateTime(d.created_at)} (id: ${d.id})\n`;
            }
            return textResult(out);
        }
        catch (e) {
            return errorResult(describeError(e));
        }
    });
}
//# sourceMappingURL=docs.js.map