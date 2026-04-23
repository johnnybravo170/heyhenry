/**
 * RFC 9728 OAuth 2.0 Protected Resource Metadata.
 * Referenced from the WWW-Authenticate header on 401s from /api/mcp.
 * `resource` is the ORIGIN (matches Notion's working server). The same
 * document is also served at the path-appended locations
 * /.well-known/oauth-protected-resource/api/mcp and /mcp per RFC 9728.
 */
import type { NextRequest } from 'next/server';
import { SUPPORTED_SCOPES } from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const body = {
    resource: origin,
    authorization_servers: [origin],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'HeyHenry Ops MCP',
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': '*',
    },
  });
}
