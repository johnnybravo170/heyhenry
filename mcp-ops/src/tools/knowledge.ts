import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { actorName, describeError, opsRequest } from '../client.js';
import { errorResult, textResult } from '../types.js';

type Hit = {
  id: string;
  title: string;
  body: string;
  similarity: number;
  tags: string[] | null;
};

export function registerKnowledgeTools(server: McpServer) {
  server.tool(
    'knowledge_search',
    'Semantic-search the knowledge base (long-form notes, playbooks, learnings) by natural-language query. Always search BEFORE writing a new doc — the answer may already be there.',
    {
      query: z.string().min(1).max(2000),
      limit: z.number().int().min(1).max(50).default(10),
      min_similarity: z.number().min(0).max(1).default(0.4),
    },
    async (input) => {
      try {
        const data = await opsRequest<{ hits: Hit[] }>('POST', `/api/ops/knowledge/search`, input);
        const rows = data.hits;
        if (rows.length === 0) return textResult(`No hits for "${input.query}".`);
        let out = `${rows.length} hit(s):\n\n`;
        for (const h of rows) {
          out += `[${(h.similarity * 100).toFixed(0)}%] ${h.title}\n`;
          if (h.tags?.length) out += `  #${h.tags.join(' #')}\n`;
          const t = h.body.length > 240 ? `${h.body.slice(0, 240)}...` : h.body;
          out += `  ${t.replace(/\n/g, ' ')}\n`;
          out += `  id: ${h.id}\n\n`;
        }
        return textResult(out);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );

  server.tool(
    'knowledge_upsert',
    'Add a new knowledge doc (auto-embedded for future semantic search). Use this for substantial findings worth recalling later — playbooks, debugging walk-throughs, "how X works", competitive teardowns. Tag generously. (There is no update-by-id today: each call creates a new row.)',
    {
      title: z.string().min(1).max(500),
      body: z.string().min(1).max(100000),
      tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    },
    async (input) => {
      try {
        const data = await opsRequest<{ id: string; warning?: string }>(
          'POST',
          `/api/ops/knowledge`,
          { actor_name: actorName(), ...input },
        );
        let out = `Knowledge doc saved.\nid: ${data.id}`;
        if (data.warning) out += `\nWARNING: ${data.warning}`;
        return textResult(out);
      } catch (e) {
        return errorResult(describeError(e));
      }
    },
  );
}
