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
import { authenticateMcpRequest } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/mcp-rate-limit';
import { registerScopedTools } from '@/server/mcp-tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
  const auth = await authenticateMcpRequest(req);
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
  // Keep-warm ping (Vercel cron — see vercel.json). Returns 200 immediately
  // without auth/DB/audit so the /api/mcp lambda stays warm; otherwise the
  // first real call after the function scales to zero eats a cold start and
  // the MCP client reports the connector as unresponsive. Exposes nothing.
  if (new URL(req.url).searchParams.get('warm') === '1') {
    return withCors(
      new Response(JSON.stringify({ ok: true, warm: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }
  // Refuse the standalone GET/SSE notification stream. This endpoint is
  // STATELESS (sessionIdGenerator: undefined) — there's no persistent session
  // to push server->client messages on, and Vercel guillotines any long-lived
  // response at `maxDuration` (30s). If we let the SDK open the GET SSE stream
  // it flaps every 30s and the client eventually drops the connector for good
  // ("connects, then can't get back in"). The GET/SSE stream is OPTIONAL in the
  // MCP spec — a server MAY return 405 and a compliant client falls back to
  // plain POST request/response, which is all a stateless server can serve and
  // is unaffected by maxDuration. Do NOT route GET into the transport.
  return withCors(
    new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message:
            'Method not allowed: this MCP endpoint is request/response only (stateless; no server-initiated SSE stream).',
        },
      }),
      {
        status: 405,
        headers: { 'content-type': 'application/json', allow: 'POST, OPTIONS' },
      },
    ),
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
