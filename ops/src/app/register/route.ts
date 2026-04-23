/**
 * RFC 7591 Dynamic Client Registration.
 *
 * Public endpoint (no auth) — anyone can register a client; the authorize
 * step still requires Jonathan's session to approve. We only accept
 * redirect_uris that point at Anthropic's fixed Routines callback.
 *
 * Raw client_secret is returned once and only the sha256 hash is persisted.
 */
import { ALLOWED_REDIRECT_PREFIX, generateOpaqueToken, sha256Hex } from '@/lib/oauth';
import { createServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': '*',
};

function err(status: number, error: string, description?: string): Response {
  const body: Record<string, string> = { error };
  if (description) body.error_description = description;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err(400, 'invalid_client_metadata', 'body must be JSON');
  }

  const redirect_uris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris.filter((u) => typeof u === 'string') as string[])
    : [];
  if (redirect_uris.length === 0) {
    return err(400, 'invalid_redirect_uri', 'redirect_uris required');
  }
  if (!redirect_uris.some((u) => u.startsWith(ALLOWED_REDIRECT_PREFIX))) {
    return err(
      400,
      'invalid_redirect_uri',
      `at least one redirect_uri must start with ${ALLOWED_REDIRECT_PREFIX}`,
    );
  }

  const client_name = typeof body.client_name === 'string' ? body.client_name : null;
  const scope = typeof body.scope === 'string' ? body.scope : null;

  const grant_types = Array.isArray(body.grant_types)
    ? (body.grant_types.filter((g) => typeof g === 'string') as string[])
    : ['authorization_code', 'refresh_token'];

  const token_endpoint_auth_method =
    typeof body.token_endpoint_auth_method === 'string' ? body.token_endpoint_auth_method : 'none';

  const client_id = `mcpclient_${crypto.randomUUID().replace(/-/g, '')}`;

  // Public PKCE clients (none) get no secret; confidential clients get a
  // 32-byte url-safe secret. Only the hash goes to the DB.
  let client_secret: string | null = null;
  let client_secret_hash: string | null = null;
  if (token_endpoint_auth_method !== 'none') {
    client_secret = generateOpaqueToken();
    client_secret_hash = await sha256Hex(client_secret);
  }

  const service = createServiceClient();
  const { error } = await service.schema('ops').from('oauth_clients').insert({
    client_id,
    client_secret_hash,
    client_name,
    redirect_uris,
    grant_types,
    token_endpoint_auth_method,
    scope,
  });
  if (error) return err(500, 'server_error', error.message);

  const response: Record<string, unknown> = {
    client_id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris,
    grant_types,
    token_endpoint_auth_method,
  };
  if (client_name) response.client_name = client_name;
  if (scope) response.scope = scope;
  if (client_secret) {
    response.client_secret = client_secret;
    response.client_secret_expires_at = 0;
  }

  return new Response(JSON.stringify(response), {
    status: 201,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      pragma: 'no-cache',
      ...CORS_HEADERS,
    },
  });
}
