/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata.
 * Anthropic's connector probes this to discover /authorize, /token, /register.
 * Shape mirrors Notion's public mcp.notion.com so Anthropic's validator accepts us.
 */
import type { NextRequest } from 'next/server';
import { SUPPORTED_SCOPES } from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const body = {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    revocation_endpoint: `${origin}/token`,
    scopes_supported: SUPPORTED_SCOPES,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['plain', 'S256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    client_id_metadata_document_supported: true,
    service_documentation: origin,
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
