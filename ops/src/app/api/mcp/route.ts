/**
 * Remote MCP server endpoint for Claude Code Routines (and any other
 * Streamable-HTTP MCP client).
 *
 * Auth: `Authorization: Bearer ops_<id>_<secret>` — the existing ops API
 * key. HMAC signing is NOT required here (unlike `/api/ops/*`); Routines'
 * custom-connector model only sends a static bearer token. Per-tool scope
 * checks happen inside the tool handler via `withAudit`.
 *
 * Stateless mode: each POST is independent. We construct a fresh McpServer,
 * register only the tools the key's scopes allow, then hand the request to
 * the SDK's web-standard transport. No session storage.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateBearer } from '@/lib/api-auth';
import { registerScopedTools } from '@/server/mcp-tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await authenticateBearer(req);
  if (!auth.ok) return auth.response;

  const server = new McpServer(
    { name: 'heyhenry-ops', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  registerScopedTools(server, {
    keyId: auth.key.id,
    actorName: auth.key.name,
    scopes: auth.key.scopes,
  });

  // Stateless transport — no session IDs. enableJsonResponse=true returns
  // a single JSON response per request instead of an SSE stream, which is
  // what Routines (one-shot, no streaming UI) expects.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}
