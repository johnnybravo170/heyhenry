/**
 * Remote MCP server endpoint for Claude Code Routines (and any other
 * Streamable-HTTP MCP client).
 *
 * Auth: OAuth 2.1 bearer token issued via /authorize + /token. The opaque
 * access token is looked up by sha256 in `ops.oauth_tokens`. Per-tool scope
 * checks happen inside the tool handler via `withAudit`.
 *
 * On 401 we attach `WWW-Authenticate: Bearer resource_metadata="..."` so
 * the client can discover the auth server (RFC 9728 / MCP auth spec).
 *
 * Stateless mode: each POST is independent. We construct a fresh McpServer,
 * register only the tools the token's scopes allow, then hand the request
 * to the SDK's web-standard transport.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateOAuthToken } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/mcp-rate-limit';
import { registerScopedTools } from '@/server/mcp-tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers':
    'Authorization, Content-Type, mcp-protocol-version, mcp-session-id',
  'access-control-expose-headers': 'mcp-protocol-version, mcp-session-id, www-authenticate',
};

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

async function handle(req: Request): Promise<Response> {
  const auth = await authenticateOAuthToken(req);
  if (!auth.ok) return withCors(auth.response);

  const limited = await enforceRateLimit(auth.token.id);
  if (!limited.ok) {
    return withCors(
      new Response(
        JSON.stringify({
          error: 'rate_limited',
          error_description: `Rate limit exceeded. Retry in ${limited.retryAfterSec}s.`,
        }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(limited.retryAfterSec),
          },
        },
      ),
    );
  }

  const server = new McpServer(
    { name: 'heyhenry-ops', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  registerScopedTools(server, {
    // Stamp the OAuth token id into audit_log.key_id so the admin MCP page can
    // attribute calls back to the issuing token / client. There's no FK on
    // audit_log.key_id, so cross-table reference to ops.oauth_tokens is fine.
    keyId: auth.token.id,
    actorName: auth.token.client_id,
    scopes: auth.token.scopes,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  const response = await transport.handleRequest(req);
  return withCors(response);
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
